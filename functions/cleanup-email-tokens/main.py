import os
import json
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.query import Query

PAGE_SIZE = 100


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


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


def _parse_request_body(context):
    raw = getattr(getattr(context, "req", None), "body", None)
    if raw in (None, ""):
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(str(raw))
    except Exception:  # noqa: BLE001
        return {}


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    try:
        return value[key]
    except Exception:  # noqa: BLE001
        pass
    return getattr(value, key, default)


def _list_documents(client: Client, db_id: str, collection_id: str, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _delete_document(client: Client, db_id: str, collection_id: str, document_id: str):
    return _call_appwrite(
        client,
        "delete",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


def _delete_older_than(client: Client, db_id: str, collection_id: str, field: str, cutoff_iso: str):
    deleted = 0
    failed = 0
    while True:
        page = _list_documents(client, db_id, collection_id, [Query.less_than(field, cutoff_iso), Query.limit(PAGE_SIZE)])
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break

        progressed = 0
        for doc in docs:
            doc_id = str(_obj_get(doc, "$id", "") or "").strip()
            if not doc_id:
                continue
            try:
                _delete_document(client, db_id, collection_id, doc_id)
                deleted += 1
                progressed += 1
            except Exception:  # noqa: BLE001
                failed += 1

        if progressed == 0:
            break
    return deleted, failed


def main(context):
    try:
        request_body = _parse_request_body(context)
        dry_run = request_body.get("dry_run") is True
        endpoint = _env("APPWRITE_ENDPOINT")
        project_id = _env("APPWRITE_PROJECT_ID")
        api_key = _env("APPWRITE_API_KEY")
        db_id = _env("APPWRITE_DATABASE_ID") or _env("DATABASE_ID")
        
        if not endpoint or not project_id or not api_key or not db_id:
            raise ValueError("Missing required Appwrite runtime configuration.")
            
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)
        
        collection_id = _env("EMAIL_CHANGE_TOKENS_COLLECTION_ID", "email_change_tokens")

        # Tokens older than 15 minutes
        cutoff_iso = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(timespec="milliseconds").replace("+00:00", "Z")

        if dry_run:
            old_tokens = _list_documents(client, db_id, collection_id, [Query.less_than("created_at", cutoff_iso), Query.limit(PAGE_SIZE)])
            tokens_to_delete = len(_obj_get(old_tokens, "documents", []) or [])
            deleted = 0
            failed = 0
            context.log(f"[DRY RUN] Found {tokens_to_delete} email change tokens older than {cutoff_iso} to delete.")
        else:
            deleted, failed = _delete_older_than(client, db_id, collection_id, "created_at", cutoff_iso)
            context.log(f"Deleted {deleted} email change tokens. Failed to delete {failed} tokens.")

        return context.res.json(
            {
                "status": "ok",
                "dry_run": dry_run,
                "cutoff_time": cutoff_iso,
                "deleted": deleted,
                "failed": failed,
            }
        )
    except Exception as err:  # noqa: BLE001
        context.error(f"cleanup-email-tokens failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
