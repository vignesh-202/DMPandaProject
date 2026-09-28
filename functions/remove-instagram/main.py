import os
import json
import time
from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from appwrite.services.messaging import Messaging

PAGE_SIZE = 100
MAX_RETRIES = 3


def _env(key: str, default: str = "") -> str:
    runtime_key = {
        "APPWRITE_ENDPOINT": "APPWRITE_FUNCTION_API_ENDPOINT",
        "APPWRITE_PROJECT_ID": "APPWRITE_FUNCTION_PROJECT_ID",
        "APPWRITE_API_KEY": "APPWRITE_FUNCTION_API_KEY",
    }.get(key, key.replace("APPWRITE_", "APPWRITE_FUNCTION_"))
    return str(
        os.environ.get(key)
        or os.environ.get(runtime_key)
        or default
        or ""
    ).strip()


def _is_transient_error(error: Exception) -> bool:
    message = str(error or "").strip().lower()
    return any(marker in message for marker in {
        "fetch failed",
        "socket hang up",
        "etimedout",
        "econnreset",
        "enotfound",
        "eai_again",
    })


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")
        except Exception as error:
            last_error = error
            if attempt >= (MAX_RETRIES - 1) or not _is_transient_error(error):
                raise
            time.sleep(0.25 * (attempt + 1))
    raise last_error


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


def _list_by_queries(client, db_id, collection_id, queries):
    rows = []
    cursor = None
    while True:
        page_queries = list(queries) + [Query.limit(PAGE_SIZE)]
        if cursor:
            page_queries.append(Query.cursor_after(cursor))
        docs = _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{collection_id}/documents",
            {"queries": page_queries},
        )
        page_rows = _obj_get(docs, "documents", []) or []
        if not page_rows:
            break
        rows.extend(page_rows)
        if len(page_rows) < PAGE_SIZE:
            break
        cursor = str(_obj_get(page_rows[-1], "$id", "") or "").strip() or None
        if not cursor:
            break
    return rows


def _safe_int(value, fallback=0):
    try:
        if value in (None, ""):
            return fallback
        return int(float(str(value)))
    except Exception:
        return fallback


def _parse_json_object(value):
    if value in (None, "", {}):
        return {}
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _delete_automation_artifacts(client, db_id, automation_id, dry_run=False):
    safe_automation_id = str(automation_id or "").strip()
    if not safe_automation_id:
        return {}

    for coll in ('keywords',):
        try:
            deleted_counts[coll] = _delete_by_queries(
                client,
                db_id,
                coll,
                [Query.equal('automation_id', safe_automation_id)],
                dry_run=dry_run,
            )
        except Exception:
            deleted_counts[coll] = 0
    return deleted_counts


def _ensure_collections_exist(client, db_id, collection_ids):
    checked = []
    for collection_id in collection_ids:
        safe_collection_id = str(collection_id or "").strip()
        if not safe_collection_id:
            continue
        _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{safe_collection_id}",
        )
        checked.append(safe_collection_id)
    return checked


def _recompute_account_access(client, db_id, user_id, profile_doc, dry_run=False):
    if not user_id:
        return 0
    accounts = _list_by_queries(client, db_id, "ig_accounts", [Query.equal("user_id", str(user_id))])
    return sum(
        1
        for account in accounts
        if str(_obj_get(account, "status") or "active").strip().lower() == "active"
        and str(_obj_get(account, "admin_status") or "active").strip().lower() == "active"
    )


def _resolve_frontend_origin(client=None, db_id: str = "") -> str:
    if client and db_id:
        try:
            document = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/system_config/documents/frontend_runtime_origin",
            )
            runtime_origin = str(_obj_get(document, "updated_by", "") or "").rstrip("/")
            if runtime_origin.startswith(("http://", "https://")):
                return runtime_origin
        except Exception:
            pass
    return str(_env("FRONTEND_ORIGIN") or "https://dmpanda.com").rstrip("/")


def _send_account_removed_email(client, db_id, user_id, username, action="delete", context=None):
    if not user_id:
        if context:
            context.log("Skipping removal email: no user_id found")
        return
    try:
        messaging = Messaging(client)
        frontend_origin = _resolve_frontend_origin(client, db_id)
        account_settings_url = f"{frontend_origin}/dashboard/account-settings" if frontend_origin else ""
        safe_username = str(username or "your Instagram account").strip() or "your Instagram account"
        action_verb = "removed" if action == "delete" else "unlinked"
        subject = f"Your Instagram account @{safe_username} has been {action_verb} from DM Panda"

        cta_html = (
            f'<div style="margin:24px 0 16px;">'
            f'<a href="{account_settings_url}" style="display:inline-block;padding:12px 24px;background:#0f172a;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">Open Account Settings</a>'
            f'</div>'
            if account_settings_url
            else ""
        )

        html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Instagram Account {action_verb.capitalize()} — DM Panda</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Instagram account @{safe_username} has been {action_verb} from your DM Panda workspace.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.04);">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <span style="font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">DM Panda</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Account Update</span>
                    </td>
                  </tr>
                </table>
                <h1 style="margin:18px 0 0;color:#0f172a;font-size:21px;font-weight:700;line-height:1.3;letter-spacing:-0.015em;">Instagram Account {action_verb.capitalize()}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 20px;">
                <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">Your Instagram account <strong>@{safe_username}</strong> has been {action_verb} from DM Panda.</p>
                <div style="margin:0 0 18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <p style="margin:0 0 8px;color:#0f172a;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">What happens now</p>
                  <ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.65;">
                    <li style="margin-bottom:6px;">Automations, triggers, and scheduled tasks for @{safe_username} have been safely stopped.</li>
                    <li style="margin-bottom:6px;">DM Panda has stopped processing direct messages, comments, and mentions for this account.</li>
                    <li>You can reconnect this account or link another profile at any time.</li>
                  </ul>
                </div>
                <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">If you removed this account intentionally, no further action is needed. If this was unexpected, you can re-link your Instagram account directly from your settings.</p>
                {cta_html}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="border-top:1px solid #f1f5f9;padding-top:20px;color:#94a3b8;font-size:12px;line-height:1.65;">
                  <p style="margin:0 0 6px;">Questions? Contact support@dmpanda.com.</p>
                  <p style="margin:0;color:#94a3b8;">DM Panda &bull; Instagram automation & lead capture</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

        messaging.create_email(
            message_id=ID.unique(),
            subject=subject,
            content=html,
            users=[user_id],
            html=True,
        )
        if context:
            context.log(f"Sent account {action_verb} email to user {user_id} for @{safe_username}")
    except Exception as email_err:
        if context:
            context.error(f"Failed to send account removal email for user {user_id}: {str(email_err)}")



# Handle Instagram account unlink (soft delete) and delete (hard delete with cascade).
def main(context):
    try:
        payload = _parse_body(context)
        action = payload.get('action') # 'unlink' or 'delete'
        account_doc_id = payload.get('account_doc_id') # The Appwrite document ID
        dry_run = payload.get('dry_run') is True
        
        if not account_doc_id:
            return context.res.json({"error": "Missing account_doc_id"}, 400)

        endpoint = _env("APPWRITE_ENDPOINT")
        project_id = _env("APPWRITE_PROJECT_ID")
        api_key = _env("APPWRITE_API_KEY")
        db_id = _env("APPWRITE_DATABASE_ID")
        if not endpoint or not project_id or not api_key or not db_id:
            raise ValueError("Missing required Appwrite runtime configuration.")

        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)
        
        # Collection IDs
        IG_ACCOUNTS_COLLECTION = 'ig_accounts'

        # Get account details first
        account = {}
        try:
            account = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{IG_ACCOUNTS_COLLECTION}/documents/{account_doc_id}",
            )
        except Exception as e:
            if not payload.get('user_id'):
                return context.res.json({"error": f"Account not found: {str(e)}"}, 404)

        ig_user_id = account.get('ig_user_id') or payload.get('ig_user_id')
        account_id = account.get('account_id') or payload.get('account_id')
        user_id = account.get('user_id') or payload.get('user_id')
        username = account.get('username') or payload.get('username')

        profile = None
        if user_id:
            profile_rows = _list_by_queries(
                client,
                db_id,
                "users",
                [Query.equal("$id", str(user_id)), Query.limit(1)],
            )
            profile = profile_rows[0] if profile_rows else {}

        if action == 'unlink':
            # Preserve the record so relink can refresh linked_at and keep ordering semantics.
            if not dry_run:
                _call_appwrite(
                    client,
                    "patch",
                    f"/databases/{db_id}/collections/{IG_ACCOUNTS_COLLECTION}/documents/{account_doc_id}",
                    {"data": {"status": "inactive"}},
                )
                _recompute_account_access(client, db_id, user_id, profile, dry_run=False)
                _send_account_removed_email(client, db_id, user_id, username, action="unlink", context=context)
            context.log(f"Account unlinked: {account_doc_id}")
            return context.res.json({"status": "success", "dry_run": dry_run, "message": "Account unlinked"})

        elif action == 'delete':
            checked_collections = _ensure_collections_exist(
                client,
                db_id,
                [
                    'automations',
                    'keywords',
                    'logs',
                    'chat_states',
                    'reply_templates',
                    'super_profiles',
                    'comment_moderation',
                    'ig_accounts',
                ],
            )
            related_account_ids = [value for value in {str(ig_user_id or '').strip(), str(account_id or '').strip(), str(account_doc_id or '').strip()} if value]
            automation_queries = [Query.equal('account_id', related_account_ids)] if len(related_account_ids) > 1 else [Query.equal('account_id', related_account_ids[0])]
            automation_rows = _list_by_queries(
                client,
                db_id,
                'automations',
                automation_queries,
            )
            collection_specs = [
                ('reply_templates', 'account_id'),
                ('super_profiles', 'account_id'),
                ('comment_moderation', 'account_id'),
                ('logs', 'account_id'),
                ('chat_states', 'account_id'),
                ('keywords', 'account_id'),
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
                artifact_counts = _delete_automation_artifacts(client, db_id, automation_id, dry_run=dry_run)
                for coll, count in artifact_counts.items():
                    deleted_counts[f'{coll}:{automation_id}'] = count

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
                _recompute_account_access(client, db_id, user_id, profile, dry_run=False)
                _send_account_removed_email(client, db_id, user_id, username, action="delete", context=context)
            context.log(f"Account deleted: {account_doc_id}")
            
            return context.res.json({"status": "success", "dry_run": dry_run, "checked_collections": checked_collections, "deleted_counts": deleted_counts, "message": "Account and related data deleted"})

        return context.res.json({"error": "Invalid action"}, 400)

    except Exception as e:
        context.error(f"Error in account action: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
