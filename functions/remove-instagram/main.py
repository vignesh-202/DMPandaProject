import os
import json
from appwrite.client import Client
from appwrite.query import Query

PAGE_SIZE = 100


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _parse_body(context):
    payload = getattr(getattr(context, "req", None), "body", None)
    if isinstance(payload, dict):
        return payload
    try:
        return json.loads(str(payload or "{}"))
    except Exception:
        return {}


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _delete_by_queries(client, db_id, collection_id, queries, dry_run=False):
    deleted = 0
    while True:
        docs = _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{collection_id}/documents",
            {"queries": queries + [Query.limit(PAGE_SIZE)]},
        )
        rows = _obj_get(docs, "documents", []) or []
        if not rows:
            break
        if dry_run:
            deleted += len(rows)
            break
        for row in rows:
            _call_appwrite(
                client,
                "delete",
                f"/databases/{db_id}/collections/{collection_id}/documents/{_obj_get(row, '$id')}",
            )
            deleted += 1
        if len(rows) < PAGE_SIZE:
            break
    return deleted


# Handle Instagram account unlink (soft delete) and delete (hard delete with cascade).
def main(context):
    try:
        payload = _parse_body(context)
        action = payload.get('action') # 'unlink' or 'delete'
        account_doc_id = payload.get('account_doc_id') # The Appwrite document ID
        dry_run = payload.get('dry_run') is True
        
        if not account_doc_id:
            return context.res.json({"error": "Missing account_doc_id"}, 400)

        client = Client()
        client.set_endpoint(os.environ['APPWRITE_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        db_id = os.environ['APPWRITE_DATABASE_ID']
        
        # Collection IDs
        IG_ACCOUNTS_COLLECTION = 'ig_accounts'

        # Get account details first
        try:
            account = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{IG_ACCOUNTS_COLLECTION}/documents/{account_doc_id}",
            )
            ig_user_id = account.get('ig_user_id')
            account_id = account.get('account_id')
        except Exception as e:
            return context.res.json({"error": f"Account not found: {str(e)}"}, 404)

        if action == 'unlink':
            # Soft delete: set is_active to false
            if not dry_run:
                _call_appwrite(
                    client,
                    "patch",
                    f"/databases/{db_id}/collections/{IG_ACCOUNTS_COLLECTION}/documents/{account_doc_id}",
                    {"data": {"is_active": False, "status": "inactive"}},
                )
            context.log(f"Account unlinked: {account_doc_id}")
            return context.res.json({"status": "success", "dry_run": dry_run, "message": "Account unlinked"})

        elif action == 'delete':
            related_account_ids = [value for value in {str(ig_user_id or '').strip(), str(account_id or '').strip(), str(account_doc_id or '').strip()} if value]
            automation_queries = [Query.equal('account_id', related_account_ids)] if len(related_account_ids) > 1 else [Query.equal('account_id', related_account_ids[0])]
            automation_docs = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/automations/documents",
                {"queries": automation_queries + [Query.limit(PAGE_SIZE)]},
            )
            automation_rows = _obj_get(automation_docs, 'documents', []) or []
            collection_specs = [
                ('reply_templates', 'account_id'),
                ('super_profiles', 'account_id'),
                ('comment_moderation', 'account_id'),
                ('logs', 'account_id'),
                ('chat_states', 'account_id'),
                ('automation_collect_destinations', 'account_id'),
                ('automation_collected_emails', 'account_id'),
            ]
            deleted_counts = {}

            for coll, field in collection_specs:
                total_deleted = 0
                for related_id in related_account_ids:
                    try:
                        total_deleted += _delete_by_queries(
                            client,
                            db_id,
                            coll,
                            [Query.equal(field, related_id)],
                            dry_run=dry_run,
                        )
                    except Exception as e:
                        context.error(f"Error cleaning collection {coll}: {str(e)}")
                deleted_counts[coll] = total_deleted

            for row in automation_rows:
                automation_id = str(_obj_get(row, '$id', '') or '').strip()
                if not automation_id:
                    continue
                for coll in ('keywords', 'keyword_index'):
                    try:
                        deleted_counts[f'{coll}:{automation_id}'] = _delete_by_queries(
                            client,
                            db_id,
                            coll,
                            [Query.equal('automation_id', automation_id)],
                            dry_run=dry_run,
                        )
                    except Exception as e:
                        context.error(f"Error cleaning collection {coll} for automation {automation_id}: {str(e)}")

            deleted_counts['automations'] = 0
            for related_id in related_account_ids:
                try:
                    deleted_counts['automations'] += _delete_by_queries(
                        client,
                        db_id,
                        'automations',
                        [Query.equal('account_id', related_id)],
                        dry_run=dry_run,
                    )
                except Exception as e:
                    context.error(f"Error cleaning collection automations: {str(e)}")

            if not dry_run:
                _call_appwrite(
                    client,
                    "delete",
                    f"/databases/{db_id}/collections/{IG_ACCOUNTS_COLLECTION}/documents/{account_doc_id}",
                )
            context.log(f"Account deleted: {account_doc_id}")
            
            return context.res.json({"status": "success", "dry_run": dry_run, "deleted_counts": deleted_counts, "message": "Account and related data deleted"})

        return context.res.json({"error": "Invalid action"}, 400)

    except Exception as e:
        context.error(f"Error in account action: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
