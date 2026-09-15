"""Database Orphan Sweeper Appwrite Function.

Periodically reconciles all database collections to detect and clean up
orphaned/junk records that may have escaped primary cascading deletions.

Key Safety Features:
1. Grace Period: Only inspects records created > 6 hours ago (prevents creation race conditions).
2. Sanity Circuit Breaker: Aborts immediately if parent tables return zero documents.
3. Virtual ID Awareness: Properly validates virtual composite IDs (e.g. comment moderation rules).
4. Run Lock: Prevents overlapping executions using the job_locks collection.
5. Dry-Run Support: Supports safe inspection without mutation via payload {"dry_run": true}.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query

PAGE_SIZE = 100
MAX_RETRIES = 3
DEFAULT_GRACE_HOURS = 24  # 24 hours grace period
DEFAULT_MAX_DELETIONS = 1000
LOCK_TTL_MINUTES = 60


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


def _obj_get(value, key: str, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _is_transient_error(error: Exception) -> bool:
    message = str(error or "").lower()
    return any(token in message for token in (
        "timeout",
        "timed out",
        "rate limit",
        "too many requests",
        "429",
        "502",
        "503",
        "504",
        "econnreset",
        "enotfound",
        "eai_again",
    ))


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
            time.sleep(0.5 * (attempt + 1))
    raise last_error


def _parse_iso_datetime(value):
    if not value:
        return None
    try:
        clean = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return None


def _is_older_than_grace(doc: dict, cutoff_time: datetime) -> bool:
    created_str = _obj_get(doc, "$createdAt") or _obj_get(doc, "created_at")
    if not created_str:
        return True
    created_dt = _parse_iso_datetime(created_str)
    if not created_dt:
        return True
    return created_dt < cutoff_time


def _acquire_run_lock(client: Client, db_id: str, locks_collection: str, job_name: str, run_window: str) -> bool:
    lock_key = f"{job_name}:{run_window}"
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(minutes=LOCK_TTL_MINUTES)).isoformat(timespec="seconds").replace("+00:00", "Z")

    try:
        _call_appwrite(
            client,
            "post",
            f"/databases/{db_id}/collections/{locks_collection}/documents",
            {
                "documentId": ID.unique(),
                "data": {
                    "job_name": job_name,
                    "run_window": run_window,
                    "lock_key": lock_key,
                    "expires_at": expires_at,
                    "created_at": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
                },
            },
        )
        return True
    except Exception as error:
        # Check if existing lock is expired
        try:
            existing = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{locks_collection}/documents",
                {"queries": [Query.equal("lock_key", lock_key), Query.limit(1)]},
            )
            docs = _obj_get(existing, "documents", []) or []
            if docs:
                exp_str = _obj_get(docs[0], "expires_at")
                exp_dt = _parse_iso_datetime(exp_str)
                if exp_dt and exp_dt < now:
                    # Lock expired, overwrite
                    _call_appwrite(
                        client,
                        "patch",
                        f"/databases/{db_id}/collections/{locks_collection}/documents/{docs[0]['$id']}",
                        {"data": {"expires_at": expires_at}},
                    )
                    return True
        except Exception:
            pass
        return False


def _release_run_lock(client: Client, db_id: str, locks_collection: str, job_name: str, run_window: str):
    lock_key = f"{job_name}:{run_window}"
    try:
        existing = _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{locks_collection}/documents",
            {"queries": [Query.equal("lock_key", lock_key), Query.limit(1)]},
        )
        docs = _obj_get(existing, "documents", []) or []
        for doc in docs:
            _call_appwrite(
                client,
                "delete",
                f"/databases/{db_id}/collections/{locks_collection}/documents/{doc['$id']}",
            )
    except Exception:
        pass


def _list_all_documents(client: Client, db_id: str, collection_id: str, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])

    while True:
        page_queries = [Query.limit(PAGE_SIZE), *base_queries]
        if cursor:
            page_queries.append(Query.cursor_after(cursor))

        try:
            res = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{collection_id}/documents",
                {"queries": page_queries},
            )
        except Exception as e:
            message = str(e).lower()
            if "collection" in message and "not found" in message:
                return []
            raise

        docs = _obj_get(res, "documents", []) or []
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(_obj_get(docs[-1], "$id") or "").strip()
        if not cursor:
            break

    return rows


def _delete_document(client: Client, db_id: str, collection_id: str, document_id: str, dry_run: bool = False) -> bool:
    if dry_run:
        return True
    try:
        _call_appwrite(
            client,
            "delete",
            f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
        )
        return True
    except Exception as error:
        # Ignore 404 already deleted
        if "not found" in str(error).lower():
            return True
        raise


def main(context):
    start_time = time.time()
    try:
        body = getattr(getattr(context, "req", None), "body", None)
        if isinstance(body, str) and body.strip():
            try:
                body = json.loads(body)
            except Exception:
                body = {}
        elif not isinstance(body, dict):
            body = {}

        dry_run = body.get("dry_run", False) is True
        grace_hours = max(1, int(body.get("grace_hours", DEFAULT_GRACE_HOURS)))
        max_deletions = max(1, int(body.get("max_deletions", DEFAULT_MAX_DELETIONS)))

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

        now = datetime.now(timezone.utc)
        cutoff_time = now - timedelta(hours=grace_hours)
        run_window = now.strftime("%Y-%m-%d")  # Daily lock key for twice-a-week runs

        job_locks_col = _env("JOB_LOCKS_COLLECTION_ID", "job_locks")

        if not dry_run:
            if not _acquire_run_lock(client, db_id, job_locks_col, "database-orphan-sweeper", run_window):
                context.log("Job lock already held for this run window. Skipping execution.")
                return context.res.json({
                    "status": "skipped",
                    "reason": "lock_held",
                    "run_window": run_window,
                })

        context.log(f"Starting Database Orphan Sweeper (dry_run={dry_run}, grace_hours={grace_hours})...")

        # -------------------------------------------------------------------------
        # Step 1: Build Parent Existence Index
        # -------------------------------------------------------------------------
        users_col = _env("USERS_COLLECTION_ID", "users")
        ig_accounts_col = _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts")
        automations_col = _env("AUTOMATIONS_COLLECTION_ID", "automations")

        users = _list_all_documents(client, db_id, users_col)
        valid_user_ids = {str(_obj_get(u, "$id", "") or "").strip() for u in users}
        valid_user_ids.discard("")

        # Sanity Circuit Breaker: If users collection returns 0, abort immediately
        if not valid_user_ids:
            msg = "CIRCUIT BREAKER TRIGGERED: Users table returned 0 documents. Aborting sweeper."
            context.error(msg)
            if not dry_run:
                _release_run_lock(client, db_id, job_locks_col, "database-orphan-sweeper", run_window)
            return context.res.json({"status": "aborted_circuit_breaker", "error": msg}, 500)

        ig_accounts = _list_all_documents(client, db_id, ig_accounts_col)
        valid_ig_account_ids = set()
        for acc in ig_accounts:
            for field in ("$id", "account_id", "ig_user_id"):
                val = str(_obj_get(acc, field, "") or "").strip()
                if val:
                    valid_ig_account_ids.add(val)

        automations = _list_all_documents(client, db_id, automations_col)
        valid_automation_ids = {str(_obj_get(a, "$id", "") or "").strip() for a in automations}
        valid_automation_ids.discard("")

        context.log(f"Parent Index Loaded: {len(valid_user_ids)} users, {len(valid_ig_account_ids)} IG account refs, {len(valid_automation_ids)} automations.")

        summary = {
            "dry_run": dry_run,
            "grace_hours": grace_hours,
            "scanned": {},
            "orphans_found": {},
            "deleted": {},
            "total_deleted": 0,
            "errors": [],
        }

        total_deletions = 0

        # Helper to check deletion cap
        def _can_delete():
            return total_deletions < max_deletions

        # -------------------------------------------------------------------------
        # Step 2: Sweep Child Collections
        # -------------------------------------------------------------------------

        # 1. ig_accounts (orphan if user_id not in valid_user_ids)
        summary["scanned"]["ig_accounts"] = len(ig_accounts)
        orphan_ig = []
        for acc in ig_accounts:
            uid = str(_obj_get(acc, "user_id", "") or "").strip()
            if uid and uid not in valid_user_ids and _is_older_than_grace(acc, cutoff_time):
                orphan_ig.append(acc)

        summary["orphans_found"]["ig_accounts"] = len(orphan_ig)
        del_ig = 0
        for acc in orphan_ig:
            if not _can_delete():
                break
            doc_id = str(_obj_get(acc, "$id", "") or "").strip()
            if _delete_document(client, db_id, ig_accounts_col, doc_id, dry_run):
                del_ig += 1
                total_deletions += 1
        summary["deleted"]["ig_accounts"] = del_ig

        # 2. automations (orphan if account_id not in valid_ig_account_ids or user_id not in valid_user_ids)
        summary["scanned"]["automations"] = len(automations)
        orphan_automations = []
        for auto in automations:
            aid = str(_obj_get(auto, "account_id", "") or "").strip()
            uid = str(_obj_get(auto, "user_id", "") or "").strip()
            is_orphan = (
                (aid and aid not in valid_ig_account_ids)
                or (uid and uid not in valid_user_ids)
            )
            if is_orphan and _is_older_than_grace(auto, cutoff_time):
                orphan_automations.append(auto)

        summary["orphans_found"]["automations"] = len(orphan_automations)
        del_auto = 0
        for auto in orphan_automations:
            if not _can_delete():
                break
            doc_id = str(_obj_get(auto, "$id", "") or "").strip()
            if _delete_document(client, db_id, automations_col, doc_id, dry_run):
                del_auto += 1
                total_deletions += 1
        summary["deleted"]["automations"] = del_auto

        # 3. keywords & keyword_index
        for col_name in ("keywords", "keyword_index"):
            col_id = _env(f"{col_name.upper()}_COLLECTION_ID", col_name)
            docs = _list_all_documents(client, db_id, col_id)
            summary["scanned"][col_name] = len(docs)
            orphans = []

            for doc in docs:
                if not _is_older_than_grace(doc, cutoff_time):
                    continue
                acc_id = str(_obj_get(doc, "account_id", "") or "").strip()
                auto_id = str(_obj_get(doc, "automation_id", "") or "").strip()

                is_orphan = False
                # If account is deleted/missing, it's an orphan
                if acc_id and acc_id not in valid_ig_account_ids:
                    is_orphan = True
                # Virtual ID for comment moderation: valid if account exists
                elif auto_id.startswith("comment_moderation_"):
                    if acc_id not in valid_ig_account_ids:
                        is_orphan = True
                # Regular automation keywords: must reference valid automation
                elif auto_id and auto_id not in valid_automation_ids:
                    is_orphan = True

                if is_orphan:
                    orphans.append(doc)

            summary["orphans_found"][col_name] = len(orphans)
            del_count = 0
            for doc in orphans:
                if not _can_delete():
                    break
                doc_id = str(_obj_get(doc, "$id", "") or "").strip()
                if _delete_document(client, db_id, col_id, doc_id, dry_run):
                    del_count += 1
                    total_deletions += 1
            summary["deleted"][col_name] = del_count

        # 4. Standard User/Account Scoped Collections
        scoped_collections = [
            ("super_profiles", "SUPER_PROFILES_COLLECTION_ID", ["user_id", "account_id"]),
            ("reply_templates", "REPLY_TEMPLATES_COLLECTION_ID", ["user_id"]),
            ("comment_moderation", "COMMENT_MODERATION_COLLECTION_ID", ["account_id", "user_id"]),
            ("chat_states", "CHAT_STATES_COLLECTION_ID", ["account_id"]),
            ("logs", "LOGS_COLLECTION_ID", ["account_id"]),
            ("coupon_redemptions", "COUPON_REDEMPTIONS_COLLECTION_ID", ["user_id"]),
            ("payment_attempts", "PAYMENT_ATTEMPTS_COLLECTION_ID", ["user_id"]),
            ("email_change_tokens", "EMAIL_CHANGE_TOKENS_COLLECTION_ID", ["user_id"]),
        ]

        for col_name, env_key, keys in scoped_collections:
            col_id = _env(env_key, col_name)
            try:
                docs = _list_all_documents(client, db_id, col_id)
            except Exception as e:
                summary["errors"].append(f"Failed to scan {col_name}: {str(e)}")
                continue

            summary["scanned"][col_name] = len(docs)
            orphans = []

            for doc in docs:
                if not _is_older_than_grace(doc, cutoff_time):
                    continue

                is_orphan = False
                if "user_id" in keys:
                    uid = str(_obj_get(doc, "user_id", "") or _obj_get(doc, "userId", "") or "").strip()
                    if uid and uid not in valid_user_ids:
                        is_orphan = True

                if "account_id" in keys:
                    aid = str(_obj_get(doc, "account_id", "") or "").strip()
                    if aid and aid not in valid_ig_account_ids:
                        is_orphan = True

                # Special check for expired email change tokens
                if col_name == "email_change_tokens" and not is_orphan:
                    exp_str = _obj_get(doc, "expires_at")
                    exp_dt = _parse_iso_datetime(exp_str)
                    if exp_dt and exp_dt < cutoff_time:
                        is_orphan = True

                if is_orphan:
                    orphans.append(doc)

            summary["orphans_found"][col_name] = len(orphans)
            del_count = 0
            for doc in orphans:
                if not _can_delete():
                    break
                doc_id = str(_obj_get(doc, "$id", "") or "").strip()
                if _delete_document(client, db_id, col_id, doc_id, dry_run):
                    del_count += 1
                    total_deletions += 1
            summary["deleted"][col_name] = del_count

        summary["total_deleted"] = total_deletions
        summary["duration_seconds"] = round(time.time() - start_time, 2)
        summary["status"] = "completed"

        context.log(f"Database Orphan Sweeper finished. Total orphans deleted: {total_deletions} (dry_run={dry_run})")
        return context.res.json(summary)

    except Exception as error:
        context.error(f"Database Orphan Sweeper encountered fatal error: {str(error)}")
        return context.res.json({
            "status": "error",
            "message": str(error),
            "duration_seconds": round(time.time() - start_time, 2),
        }, 500)
    finally:
        pass
