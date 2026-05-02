import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query

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
        or os.environ.get(f"FUNCTION_{key}")
        or os.environ.get(runtime_key)
        or default
        or ""
    ).strip()


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _parse_body(context):
    raw = getattr(getattr(context, "req", None), "body", None)
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(str(raw or "{}"))
    except Exception:
        return {}


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


def _call_appwrite(client: Client, method: str, path: str, params=None):
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


def _create_document(client: Client, db_id: str, collection_id: str, document_id: str, data: dict):
    return _call_appwrite(
        client,
        "post",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {
            "documentId": document_id or ID.unique(),
            "data": data,
            "permissions": [],
        },
    )


def _delete_document(client: Client, db_id: str, collection_id: str, document_id: str):
    return _call_appwrite(
        client,
        "delete",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


def _list_documents(client: Client, db_id: str, collection_id: str, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _to_iso(value):
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_int(value, default: int, minimum: int = 0, maximum: int = 3650) -> int:
    try:
        parsed = int(value)
    except Exception:
        parsed = int(default)
    return max(minimum, min(maximum, parsed))


def _acquire_run_lock(client: Client, db_id: str, collection_id: str, job_name: str, run_window: str, ttl_minutes: int = 120):
    lock_key = f"{job_name}:{run_window}"
    document_id = hashlib.sha1(lock_key.encode("utf-8")).hexdigest()[:32]
    try:
        _create_document(
            client,
            db_id,
            collection_id,
            document_id,
            {
                "job_name": job_name,
                "run_window": run_window,
                "lock_key": lock_key,
                "expires_at": _to_iso(datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)),
                "created_at": _to_iso(datetime.now(timezone.utc)),
            },
        )
        return True
    except Exception:
        return False


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
            except Exception:
                failed += 1

        if progressed == 0:
            break
    return deleted, failed


def main(context):
    try:
        request_body = _parse_body(context)
        dry_run = request_body.get("dry_run") is True

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

        job_locks_collection = _env("JOB_LOCKS_COLLECTION_ID", "job_locks")
        audit_collection = (
            _env("INACTIVE_CLEANUP_AUDIT_COLLECTION_ID")
            or _env("INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID")
            or "inactive_user_cleanup_audit"
        )

        audit_retention_days = _parse_int(
            request_body.get("audit_retention_days"),
            _env("INACTIVE_CLEANUP_AUDIT_RETENTION_DAYS", "90"),
            minimum=1,
            maximum=3650,
        )
        job_lock_grace_hours = _parse_int(
            request_body.get("job_lock_grace_hours"),
            _env("JOB_LOCKS_RETENTION_HOURS", "24"),
            minimum=0,
            maximum=3650,
        )

        now = datetime.now(timezone.utc)
        run_window = now.strftime("%Y%m%d%H")
        if not dry_run and not _acquire_run_lock(client, db_id, job_locks_collection, "cleanup-audit-job-locks", run_window):
            return context.res.json({"status": "ok", "skipped_due_lock": 1})

        audit_cutoff_iso = _to_iso(now - timedelta(days=audit_retention_days))
        job_locks_cutoff_iso = _to_iso(now - timedelta(hours=job_lock_grace_hours))

        if dry_run:
            old_audit = _list_documents(client, db_id, audit_collection, [Query.less_than("created_at", audit_cutoff_iso), Query.limit(PAGE_SIZE)])
            old_job_locks = _list_documents(client, db_id, job_locks_collection, [Query.less_than("expires_at", job_locks_cutoff_iso), Query.limit(PAGE_SIZE)])
            audit_deleted = 0
            audit_failed = 0
            job_locks_deleted = 0
            job_locks_failed = 0
            audit_sample = len(_obj_get(old_audit, "documents", []) or [])
            job_locks_sample = len(_obj_get(old_job_locks, "documents", []) or [])
        else:
            audit_deleted, audit_failed = _delete_older_than(client, db_id, audit_collection, "created_at", audit_cutoff_iso)
            job_locks_deleted, job_locks_failed = _delete_older_than(client, db_id, job_locks_collection, "expires_at", job_locks_cutoff_iso)
            audit_sample = 0
            job_locks_sample = 0

        return context.res.json(
            {
                "status": "ok",
                "dry_run": dry_run,
                "audit_collection": audit_collection,
                "job_locks_collection": job_locks_collection,
                "audit_retention_days": audit_retention_days,
                "job_lock_grace_hours": job_lock_grace_hours,
                "audit_cutoff": audit_cutoff_iso,
                "job_locks_cutoff": job_locks_cutoff_iso,
                "inactive_user_cleanup_audit_deleted": audit_deleted,
                "inactive_user_cleanup_audit_failed": audit_failed,
                "job_locks_deleted": job_locks_deleted,
                "job_locks_failed": job_locks_failed,
                "inactive_user_cleanup_audit_would_delete_sample": audit_sample,
                "job_locks_would_delete_sample": job_locks_sample,
            }
        )
    except Exception as err:
        context.error(f"cleanup-audit-job-locks failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
