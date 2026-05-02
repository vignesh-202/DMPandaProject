import hashlib
import json
import os
import sys
import time
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from pathlib import Path

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query

sys.path.insert(0, str(Path(__file__).resolve().parent))
from email_template import render_email_html

PAGE_SIZE = 100
MAX_RETRIES = 3
DEFAULT_BATCH_SIZE = 50
DEFAULT_FREE_PLAN = "free"

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


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _request_header(context, key: str) -> str:
    headers = getattr(getattr(context, "req", None), "headers", None) or {}
    return str(
        _obj_get(headers, key)
        or _obj_get(headers, key.lower())
        or _obj_get(headers, key.upper())
        or ""
    ).strip()


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


def _is_duplicate_conflict(error: Exception) -> bool:
    message = str(error or "").strip().lower()
    return "already exists" in message or "409" in message


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


def _list_all(client: Client, db_id: str, collection_id: str, queries=None, page_size: int = PAGE_SIZE):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        page_queries = [Query.limit(page_size), *base_queries]
        if cursor:
            page_queries.append(Query.cursor_after(cursor))
        page = _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{collection_id}/documents",
            {"queries": page_queries},
        )
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < page_size:
            break
        cursor = str(_obj_get(docs[-1], "$id", "") or "").strip()
        if not cursor:
            break
    return rows


def _get_document(client: Client, db_id: str, collection_id: str, document_id: str):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


def _update_document(client: Client, db_id: str, collection_id: str, document_id: str, data: dict):
    return _call_appwrite(
        client,
        "patch",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
        {"data": data},
    )


def _delete_document(client: Client, db_id: str, collection_id: str, document_id: str):
    return _call_appwrite(
        client,
        "delete",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


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


def _send_email_with_id(client: Client, message_id: str, user_id: str, subject: str, html: str):
    _call_appwrite(
        client,
        "post",
        "/messaging/messages/email",
        {
            "messageId": message_id,
            "subject": subject,
            "content": html,
            "users": [user_id],
            "html": True,
        },
    )


def _parse_datetime(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def _to_iso(value):
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_json_object(value, fallback=None):
    if value in (None, ""):
        return {} if fallback is None else fallback
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {} if fallback is None else fallback


def _serialize_json_object(value):
    return json.dumps(value or {}, separators=(",", ":")) if value else None


def _normalize_plan_code(value):
    return str(value or "").strip().lower() or DEFAULT_FREE_PLAN


def _hash_value(value: str) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


def _hash_email(email: str) -> str:
    safe = str(email or "").strip().lower()
    return _hash_value(safe) if safe else None


def _build_deleted_user_ref(user_id: str) -> str:
    return f"deleted:{_hash_value(f'deleted-user:{user_id}')[:32]}"


def _max_datetime(values):
    valid = [value for value in values if value]
    return max(valid) if valid else None


def _add_months(value: datetime, months: int) -> datetime:
    month_index = (value.month - 1) + months
    year = value.year + (month_index // 12)
    month = (month_index % 12) + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def _parse_csv_set(raw: str):
    return {
        item.strip().lower()
        for item in str(raw or "").split(",")
        if item and item.strip()
    }


def _auth_user_path(user_id: str) -> str:
    return f"/users/{str(user_id or '').strip()}"


def _get_auth_user(client: Client, user_id: str):
    safe_user_id = str(user_id or "").strip()
    if not safe_user_id:
        return None
    try:
        return _call_appwrite(client, "get", _auth_user_path(safe_user_id))
    except Exception as error:
        if "404" in str(error):
            return None
        raise


def _delete_auth_user(client: Client, user_id: str):
    safe_user_id = str(user_id or "").strip()
    if not safe_user_id:
        return True
    try:
        _call_appwrite(client, "delete", _auth_user_path(safe_user_id))
        return True
    except Exception as error:
        if "404" in str(error):
            return True
        raise


def _activity_anchor(user_doc, latest_success_at):
    return _max_datetime([
        _parse_datetime(_obj_get(user_doc, "last_active_at")),
        _parse_datetime(_obj_get(user_doc, "last_login")),
        _parse_datetime(_obj_get(user_doc, "first_login")),
        latest_success_at,
    ])


def _is_cleanup_protected(user_doc, auth_user, protected_emails, protected_domains):
    if _obj_get(user_doc, "cleanup_protected") is True:
        return True, "cleanup_protected"

    labels = _obj_get(auth_user, "labels", []) or []
    if "admin" in labels:
        return True, "admin_label"

    email = str(_obj_get(user_doc, "email") or _obj_get(auth_user, "email") or "").strip().lower()
    if email and email in protected_emails:
        return True, "protected_email"
    if email and "@" in email:
        domain = email.split("@", 1)[1]
        if domain in protected_domains:
            return True, "protected_domain"

    return False, None


def _resolve_cleanup_state(user_doc, activity_at, now):
    current = _parse_json_object(_obj_get(user_doc, "cleanup_state_json"), {})
    activity_iso = _to_iso(activity_at)
    scheduled_default = max(_add_months(activity_at, 6), now + timedelta(days=30))

    if not current:
        return {
            "v": 1,
            "activity_at": activity_iso,
            "scheduled_delete_at": _to_iso(scheduled_default),
            "warnings": {},
        }

    state_activity = str(current.get("activity_at") or "").strip()
    state_schedule = _parse_datetime(current.get("scheduled_delete_at"))
    warnings = current.get("warnings") if isinstance(current.get("warnings"), dict) else {}
    if state_activity != activity_iso or not state_schedule:
        return {
            "v": 1,
            "activity_at": activity_iso,
            "scheduled_delete_at": _to_iso(scheduled_default),
            "warnings": {},
        }

    current["v"] = 1
    current["warnings"] = warnings
    return current


def _warning_key_for_days(days_until: int):
    mapping = {30: "30d", 7: "7d", 1: "1d"}
    return mapping.get(days_until) or ("day0" if days_until <= 0 else None)


def _build_warning_email(stage: str, scheduled_delete_at: datetime, frontend_origin: str):
    delete_date = scheduled_delete_at.date().isoformat()
    frontend_base = str(frontend_origin or "").rstrip("/")
    login_url = f"{frontend_base}/login" if frontend_base else ""
    dashboard_url = f"{frontend_base}/dashboard" if frontend_base else ""
    stage_map = {
        "30d": {
            "subject": "Log in to keep your DM Panda account",
            "title": "Your inactive free account is scheduled for deletion",
            "tone": "info",
            "status": "30 days remaining",
            "callout_title": "What to do now",
            "callout_lines": [
                f"Log in before {delete_date} to cancel the deletion countdown automatically.",
                "Paid users and active paid subscriptions are not deleted by this cleanup.",
            ],
        },
        "7d": {
            "subject": "Your DM Panda free account is scheduled for deletion in 7 days",
            "title": "Your deletion window is getting close",
            "tone": "warning",
            "status": "7 days remaining",
            "callout_title": "Action needed this week",
            "callout_lines": [
                f"Log in before {delete_date} to keep your DM Panda account.",
                "If you stay inactive, your free account data enters the final cleanup window.",
            ],
        },
        "1d": {
            "subject": "Final reminder: log in today to keep your DM Panda account",
            "title": "Final reminder before scheduled deletion",
            "tone": "critical",
            "status": "1 day remaining",
            "callout_title": "Final 24-hour warning",
            "callout_lines": [
                f"Your free account is scheduled for deletion on {delete_date}.",
                "Logging in today cancels the cleanup countdown immediately.",
            ],
        },
        "day0": {
            "subject": "Final notice: your DM Panda free account is scheduled for deletion today",
            "title": "Your account is due for deletion today",
            "tone": "critical",
            "status": "Scheduled today",
            "callout_title": "Immediate action required",
            "callout_lines": [
                "This is the final scheduled deletion day for your inactive free account.",
                "Log in now if you want to keep the account and stop the cleanup process.",
            ],
        },
    }
    payload = stage_map.get(stage, stage_map["30d"])
    html = render_email_html(
        title=payload["title"],
        preheader=payload["subject"],
        greeting="Hello,",
        intro="Your DM Panda free-plan account has been inactive for at least 6 months, so it has entered the inactive-account cleanup process.",
        callouts=[{
            "tone": payload["tone"],
            "title": payload["callout_title"],
            "lines": payload["callout_lines"],
        }],
        summary_rows=[
            ("Account status", payload["status"]),
            ("Scheduled deletion date", delete_date),
            ("How to stop deletion", "Log in before the scheduled date"),
        ],
        paragraphs=[
            "You are receiving this email because DM Panda periodically removes long-inactive free accounts to keep the workspace secure and accurate.",
            "If deletion proceeds, inactive account records may be removed and financial references kept for reporting may be anonymized.",
            "Paid users and users with active paid subscriptions are not deleted by this cleanup flow.",
        ],
        cta_label="Log in to keep your account",
        cta_url=login_url,
        secondary_links=[{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
        footer_note="If you have already logged in recently, you can ignore this email and the cleanup state will be cleared automatically.",
        frontend_origin=frontend_base,
    )
    return payload["subject"], html


def _acquire_run_lock(client: Client, db_id: str, collection_id: str, job_name: str, run_window: str, ttl_hours: int = 30):
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
                "expires_at": _to_iso(datetime.now(timezone.utc) + timedelta(hours=ttl_hours)),
                "created_at": _to_iso(datetime.now(timezone.utc)),
            },
        )
        return True
    except Exception:
        return False


def _write_audit_log(client: Client, db_id: str, collection_id: str, *, user_doc, action: str, reason: str = None, details: dict = None, dry_run: bool = False, scheduled_delete_at=None, last_active_at=None, plan_code=None):
    if not collection_id:
        return None
    email = str(_obj_get(user_doc, "email") or "").strip().lower()
    payload = {
        "user_hash": _hash_value(str(_obj_get(user_doc, "$id") or _obj_get(user_doc, "user_id") or "")),
        "email_hash": _hash_email(email),
        "action": action,
        "plan_code": _normalize_plan_code(plan_code or _obj_get(user_doc, "plan_code")),
        "reason": reason,
        "last_active_at": _to_iso(last_active_at),
        "scheduled_delete_at": _to_iso(scheduled_delete_at),
        "dry_run": dry_run,
        "details_json": _serialize_json_object(details),
        "created_at": _to_iso(datetime.now(timezone.utc)),
    }
    try:
        return _create_document(client, db_id, collection_id, ID.unique(), payload)
    except Exception:
        return None


def _get_profile_for_user(client: Client, db_id: str, collection_id: str, user_id: str):
    safe_user_id = str(user_id or "").strip()
    if not safe_user_id:
        return None
    try:
        return _get_document(client, db_id, collection_id, safe_user_id)
    except Exception as error:
        if "404" not in str(error):
            raise
    docs = _list_all(client, db_id, collection_id, [Query.equal("user_id", safe_user_id), Query.limit(1)], page_size=1)
    return docs[0] if docs else None


def _latest_success_transaction_at(client: Client, db_id: str, collection_id: str, user_id: str):
    safe_user_id = str(user_id or "").strip()
    if not safe_user_id:
        return None
    response = _list_all(
        client,
        db_id,
        collection_id,
        [Query.equal("userId", safe_user_id), Query.limit(25)],
        page_size=25,
    )
    latest = None
    for row in response:
        status = str(_obj_get(row, "status") or "").strip().lower()
        if status not in {"success", "paid", "captured", "completed"}:
            continue
        candidate = (
            _parse_datetime(_obj_get(row, "transactionDate"))
            or _parse_datetime(_obj_get(row, "created_at"))
            or _parse_datetime(_obj_get(row, "$createdAt"))
        )
        if candidate and (latest is None or candidate > latest):
            latest = candidate
    return latest


def _latest_self_subscription_from_transactions(client: Client, db_id: str, collection_id: str, user_id: str, now):
    safe_user_id = str(user_id or "").strip()
    if not safe_user_id:
        return {"plan_id": DEFAULT_FREE_PLAN, "expiry_date": None}
    transactions = _list_all(
        client,
        db_id,
        collection_id,
        [Query.equal("userId", safe_user_id)],
        page_size=100,
    )
    ranked = []
    for row in transactions:
        plan_code = _normalize_plan_code(
            _obj_get(row, "planCode")
            or _obj_get(row, "plan_code")
            or _obj_get(row, "planId")
            or _obj_get(row, "plan_id")
        )
        if plan_code == DEFAULT_FREE_PLAN:
            continue
        status = str(_obj_get(row, "status") or "").strip().lower()
        created_at = (
            _parse_datetime(_obj_get(row, "transactionDate"))
            or _parse_datetime(_obj_get(row, "created_at"))
            or _parse_datetime(_obj_get(row, "$createdAt"))
        )
        if not created_at:
            continue
        ranked.append((created_at, status, plan_code, row))
    ranked.sort(key=lambda item: item[0], reverse=True)
    decisive = next((item for item in ranked if item[1] in {"success", "paid", "captured", "completed", "active", "refunded", "partially_refunded", "chargeback", "disputed", "void", "reversed", "cancelled", "canceled"}), None)
    if not decisive:
        return {"plan_id": DEFAULT_FREE_PLAN, "expiry_date": None}
    created_at, status, plan_code, row = decisive
    if status in {"refunded", "partially_refunded", "chargeback", "disputed", "void", "reversed", "cancelled", "canceled"}:
        return {"plan_id": DEFAULT_FREE_PLAN, "expiry_date": None}
    expiry_date = _parse_datetime(_obj_get(row, "expiry_date"))
    if not expiry_date:
        return {"plan_id": DEFAULT_FREE_PLAN, "expiry_date": None}
    if expiry_date <= now:
        return {"plan_id": DEFAULT_FREE_PLAN, "expiry_date": expiry_date}
    return {"plan_id": plan_code, "expiry_date": expiry_date}


def _evaluate_user(user_doc, profile_doc, latest_tx_at, now, self_subscription=None):
    if not profile_doc:
        return {"decision": "skip_uncertain", "reason": "missing_profile"}

    profile_plan = _normalize_plan_code(_obj_get(profile_doc, "plan_code"))
    profile_expires = _parse_datetime(_obj_get(profile_doc, "expiry_date"))
    if profile_plan != DEFAULT_FREE_PLAN:
        if not profile_expires:
            return {"decision": "skip_uncertain", "reason": "runtime_paid_missing_expiry"}
        if profile_expires > now:
            return {"decision": "skip_paid", "reason": "runtime_paid_profile"}
        return {"decision": "skip_uncertain", "reason": "runtime_profile_expired_non_free"}

    activity_at = _activity_anchor(user_doc, latest_tx_at)
    if not activity_at:
        return {"decision": "skip_uncertain", "reason": "missing_activity_anchor"}

    raw_delete_at = _add_months(activity_at, 6)
    existing_state = _parse_json_object(_obj_get(user_doc, "cleanup_state_json"), {})
    state_activity = str(existing_state.get("activity_at") or "").strip()
    if raw_delete_at > (now + timedelta(days=30)) and (not existing_state or state_activity != _to_iso(activity_at)):
        return {
            "decision": "skip_not_due",
            "reason": "outside_warning_window",
            "activity_at": activity_at,
            "raw_delete_at": raw_delete_at,
        }

    cleanup_state = _resolve_cleanup_state(user_doc, activity_at, now)
    scheduled_delete_at = _parse_datetime(cleanup_state.get("scheduled_delete_at"))
    if not scheduled_delete_at:
        return {"decision": "skip_uncertain", "reason": "invalid_cleanup_schedule"}

    return {
        "decision": "candidate",
        "reason": "eligible_free_inactive_user",
        "activity_at": activity_at,
        "raw_delete_at": raw_delete_at,
        "cleanup_state": cleanup_state,
        "scheduled_delete_at": scheduled_delete_at,
        "days_until_delete": (scheduled_delete_at.date() - now.date()).days,
    }


def _upsert_cleanup_state(client: Client, db_id: str, users_collection: str, user_doc, state: dict):
    user_id = str(_obj_get(user_doc, "$id") or "").strip()
    if not user_id:
        return None
    return _update_document(
        client,
        db_id,
        users_collection,
        user_id,
        {"cleanup_state_json": _serialize_json_object(state)},
    )


def _clear_cleanup_state(client: Client, db_id: str, users_collection: str, user_doc):
    if not str(_obj_get(user_doc, "cleanup_state_json") or "").strip():
        return None
    user_id = str(_obj_get(user_doc, "$id") or "").strip()
    if not user_id:
        return None
    return _update_document(client, db_id, users_collection, user_id, {"cleanup_state_json": None})


def _send_warning_email(client: Client, user_doc, stage: str, scheduled_delete_at: datetime, frontend_origin: str):
    user_id = str(_obj_get(user_doc, "$id") or "").strip()
    state = _parse_json_object(_obj_get(user_doc, "cleanup_state_json"), {})
    message_seed = f"inactive-cleanup:{user_id}:{stage}:{_to_iso(scheduled_delete_at)}"
    message_id = hashlib.sha1(message_seed.encode("utf-8")).hexdigest()[:32]
    subject, html = _build_warning_email(stage, scheduled_delete_at, frontend_origin)
    try:
        _send_email_with_id(client, message_id, user_id, subject, html)
        return "sent"
    except Exception as error:
        if _is_duplicate_conflict(error):
            return "already_sent"
        raise


def _delete_by_field(client: Client, db_id: str, collection_id: str, field: str, value: str):
    deleted = 0
    safe_value = str(value or "").strip()
    if not safe_value:
        return deleted
    while True:
        try:
            page = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{collection_id}/documents",
                {"queries": [Query.equal(field, safe_value), Query.limit(PAGE_SIZE)]},
            )
        except Exception as error:
            message = str(error or "").lower()
            if "404" in message or "attribute" in message:
                return deleted
            raise
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break
        for row in docs:
            _delete_document(client, db_id, collection_id, str(_obj_get(row, "$id") or "").strip())
            deleted += 1
        if len(docs) < PAGE_SIZE:
            break
    return deleted


def _anonymize_transactions(client: Client, db_id: str, collection_id: str, user_id: str):
    deleted_ref = _build_deleted_user_ref(user_id)
    updated = 0
    while True:
        page = _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{collection_id}/documents",
            {"queries": [Query.equal("userId", str(user_id)), Query.limit(PAGE_SIZE)]},
        )
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break
        for row in docs:
            notes = str(_obj_get(row, "notes") or "").strip()
            if "user deleted/anonymized" not in notes.lower():
                notes = f"{notes} [user deleted/anonymized]".strip()
            _update_document(
                client,
                db_id,
                collection_id,
                str(_obj_get(row, "$id") or "").strip(),
                {
                    "userId": deleted_ref,
                    "notes": notes,
                },
            )
            updated += 1
        if len(docs) < PAGE_SIZE:
            break
    return updated


def _delete_user_data(client: Client, db_id: str, collections: dict, user_doc):
    user_id = str(_obj_get(user_doc, "$id") or "").strip()
    summary = {"deleted": {}, "anonymized_transactions": 0}

    ig_accounts = _list_all(client, db_id, collections["ig_accounts"], [Query.equal("user_id", user_id)], page_size=PAGE_SIZE)
    linked_account_ids = {
        str(value or "").strip()
        for account in ig_accounts
        for value in [_obj_get(account, "account_id"), _obj_get(account, "ig_user_id"), _obj_get(account, "$id")]
        if str(value or "").strip()
    }

    account_scoped = [
        collections["automations"],
        collections["reply_templates"],
        collections["inbox_menus"],
        collections["convo_starters"],
        collections["super_profiles"],
        collections["comment_moderation"],
        collections["chat_states"],
        collections["automation_collect_destinations"],
        collections["automation_collected_emails"],
        collections["logs"],
        collections["keywords"],
        collections["keyword_index"],
    ]
    for account_id in linked_account_ids:
        for collection_id in account_scoped:
            deleted = _delete_by_field(client, db_id, collection_id, "account_id", account_id)
            if deleted:
                summary["deleted"][collection_id] = summary["deleted"].get(collection_id, 0) + deleted

    user_scoped = [
        collections["campaigns"],
        collections["automations"],
        collections["reply_templates"],
        collections["inbox_menus"],
        collections["convo_starters"],
        collections["super_profiles"],
        collections["comment_moderation"],
        collections["automation_collect_destinations"],
        collections["automation_collected_emails"],
        collections["ig_accounts"],
        collections["payment_attempts"],
        collections["coupon_redemptions"],
    ]
    for collection_id in user_scoped:
        deleted = _delete_by_field(client, db_id, collection_id, "user_id", user_id)
        if deleted:
            summary["deleted"][collection_id] = summary["deleted"].get(collection_id, 0) + deleted

    summary["anonymized_transactions"] = _anonymize_transactions(client, db_id, collections["transactions"], user_id)
    return summary


def _list_user_batch(client: Client, db_id: str, users_collection: str, batch_size: int):
    query_variants = [
        [Query.limit(batch_size), Query.order_asc("last_active_at")],
        [Query.limit(batch_size), Query.order_asc("last_login")],
        [Query.limit(batch_size), Query.order_asc("$id")],
    ]
    last_error = None
    for queries in query_variants:
        try:
            response = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{users_collection}/documents",
                {"queries": queries},
            )
            return _obj_get(response, "documents", []) or []
        except Exception as error:
            last_error = error
            continue
    if last_error:
        raise last_error
    return []


def main(context):
    try:
        request_body = _parse_body(context)
        dry_run = request_body.get("dry_run") is True
        batch_size = max(1, min(int(request_body.get("batch_size") or _env("INACTIVE_CLEANUP_BATCH_SIZE", str(DEFAULT_BATCH_SIZE)) or DEFAULT_BATCH_SIZE), 250))

        endpoint = _env("APPWRITE_ENDPOINT")
        project_id = _env("APPWRITE_PROJECT_ID")
        api_key = _request_header(context, "x-appwrite-key") or _env("APPWRITE_API_KEY")
        db_id = _env("APPWRITE_DATABASE_ID")
        if not endpoint or not project_id or not api_key or not db_id:
            raise ValueError("Missing required Appwrite runtime configuration.")

        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        users_collection = _env("USERS_COLLECTION_ID", "users")
        profiles_collection = _env("PROFILES_COLLECTION_ID", "profiles")
        transactions_collection = _env("TRANSACTIONS_COLLECTION_ID", "transactions")
        payment_attempts_collection = _env("PAYMENT_ATTEMPTS_COLLECTION_ID", "payment_attempts")
        coupon_redemptions_collection = _env("COUPON_REDEMPTIONS_COLLECTION_ID", "coupon_redemptions")
        job_locks_collection = _env("JOB_LOCKS_COLLECTION_ID", "job_locks")
        audit_collection = (
            _env("INACTIVE_CLEANUP_AUDIT_COLLECTION_ID")
            or _env("INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID")
            or "inactive_user_cleanup_audit"
        )
        frontend_origin = _env("FRONTEND_ORIGIN")
        protected_emails = _parse_csv_set(_env("INACTIVE_CLEANUP_PROTECTED_EMAILS"))
        protected_domains = _parse_csv_set(_env("INACTIVE_CLEANUP_PROTECTED_EMAIL_DOMAINS"))

        collections = {
            "campaigns": _env("CAMPAIGNS_COLLECTION_ID", "campaigns"),
            "profiles": profiles_collection,
            "automations": _env("AUTOMATIONS_COLLECTION_ID", "automations"),
            "reply_templates": _env("REPLY_TEMPLATES_COLLECTION_ID", "reply_templates"),
            "inbox_menus": _env("INBOX_MENUS_COLLECTION_ID", "inbox_menus"),
            "convo_starters": _env("CONVO_STARTERS_COLLECTION_ID", "convo_starters"),
            "super_profiles": _env("SUPER_PROFILES_COLLECTION_ID", "super_profiles"),
            "comment_moderation": _env("COMMENT_MODERATION_COLLECTION_ID", "comment_moderation"),
            "chat_states": _env("CHAT_STATES_COLLECTION_ID", "chat_states"),
            "automation_collect_destinations": _env("AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID", "automation_collect_destinations"),
            "automation_collected_emails": _env("AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID", "automation_collected_emails"),
            "logs": _env("LOGS_COLLECTION_ID", "logs"),
            "keywords": _env("KEYWORDS_COLLECTION_ID", "keywords"),
            "keyword_index": _env("KEYWORD_INDEX_COLLECTION_ID", "keyword_index"),
            "ig_accounts": _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts"),
            "payment_attempts": payment_attempts_collection,
            "coupon_redemptions": coupon_redemptions_collection,
            "transactions": transactions_collection,
        }

        now = datetime.now(timezone.utc)
        run_window = now.strftime("%Y%m%d")
        if not dry_run and not _acquire_run_lock(client, db_id, job_locks_collection, "inactive-user-cleanup", run_window):
            return context.res.json({"status": "ok", "skipped_due_lock": 1})

        users_batch = _list_user_batch(client, db_id, users_collection, batch_size)
        summary = {
            "job": "inactive-user-cleanup",
            "dry_run": dry_run,
            "batch_size": batch_size,
            "scanned": 0,
            "candidates": 0,
            "warnings_sent": 0,
            "warnings_already_sent": 0,
            "deleted": 0,
            "skipped_paid": 0,
            "skipped_protected": 0,
            "skipped_uncertain": 0,
            "skipped_not_due": 0,
            "failed": 0,
            "reports": [],
        }

        for user_doc in users_batch:
            summary["scanned"] += 1
            user_id = str(_obj_get(user_doc, "$id") or "").strip()
            email = str(_obj_get(user_doc, "email") or "").strip().lower()
            if not user_id:
                continue

            try:
                auth_user = _get_auth_user(client, user_id)
                is_protected, protection_reason = _is_cleanup_protected(user_doc, auth_user, protected_emails, protected_domains)
                if is_protected:
                    summary["skipped_protected"] += 1
                    if not dry_run:
                        _clear_cleanup_state(client, db_id, users_collection, user_doc)
                        _write_audit_log(client, db_id, audit_collection, user_doc=user_doc, action="skip_protected", reason=protection_reason, dry_run=False)
                    continue

                profile_doc = _get_profile_for_user(client, db_id, profiles_collection, user_id)
                latest_tx_at = _latest_success_transaction_at(client, db_id, transactions_collection, user_id)
                self_subscription = _latest_self_subscription_from_transactions(client, db_id, transactions_collection, user_id, now)
                evaluation = _evaluate_user(user_doc, profile_doc, latest_tx_at, now, self_subscription)

                if evaluation["decision"] == "skip_paid":
                    summary["skipped_paid"] += 1
                    if not dry_run:
                        _clear_cleanup_state(client, db_id, users_collection, user_doc)
                        _write_audit_log(client, db_id, audit_collection, user_doc=user_doc, action="skip_paid", reason=evaluation["reason"], dry_run=False)
                    continue

                if evaluation["decision"] == "skip_not_due":
                    summary["skipped_not_due"] += 1
                    if not dry_run:
                        _clear_cleanup_state(client, db_id, users_collection, user_doc)
                    continue

                if evaluation["decision"] != "candidate":
                    summary["skipped_uncertain"] += 1
                    if not dry_run:
                        _write_audit_log(client, db_id, audit_collection, user_doc=user_doc, action="skip_uncertain", reason=evaluation["reason"], dry_run=False)
                    continue

                summary["candidates"] += 1
                activity_at = evaluation["activity_at"]
                scheduled_delete_at = evaluation["scheduled_delete_at"]
                state = evaluation["cleanup_state"]
                days_until_delete = evaluation["days_until_delete"]
                warning_key = _warning_key_for_days(days_until_delete)
                warnings = state.get("warnings") if isinstance(state.get("warnings"), dict) else {}

                report_entry = {
                    "user_id": user_id,
                    "email": email,
                    "last_active_at": _to_iso(activity_at),
                    "scheduled_delete_at": _to_iso(scheduled_delete_at),
                    "days_until_delete": days_until_delete,
                    "warning_due": warning_key,
                }

                if dry_run:
                    summary["reports"].append(report_entry)
                    continue

                _upsert_cleanup_state(client, db_id, users_collection, user_doc, state)

                if warning_key and not warnings.get(warning_key):
                    result = _send_warning_email(client, user_doc, warning_key, scheduled_delete_at, frontend_origin)
                    warnings[warning_key] = _to_iso(now)
                    state["warnings"] = warnings
                    _upsert_cleanup_state(client, db_id, users_collection, user_doc, state)
                    _write_audit_log(
                        client,
                        db_id,
                        audit_collection,
                        user_doc=user_doc,
                        action=f"warning_{warning_key}" if warning_key != "day0" else "warning_final",
                        reason="warning_sent" if result == "sent" else "warning_already_sent",
                        details=report_entry,
                        dry_run=False,
                        scheduled_delete_at=scheduled_delete_at,
                        last_active_at=activity_at,
                    )
                    if result == "sent":
                        summary["warnings_sent"] += 1
                    else:
                        summary["warnings_already_sent"] += 1

                if days_until_delete <= 0:
                    _write_audit_log(
                        client,
                        db_id,
                        audit_collection,
                        user_doc=user_doc,
                        action="delete_started",
                        reason="deletion_due",
                        details=report_entry,
                        dry_run=False,
                        scheduled_delete_at=scheduled_delete_at,
                        last_active_at=activity_at,
                    )
                    delete_summary = _delete_user_data(client, db_id, collections, user_doc)
                    _delete_auth_user(client, user_id)
                    if profile_doc and str(_obj_get(profile_doc, "$id") or "").strip():
                        _delete_document(client, db_id, profiles_collection, str(_obj_get(profile_doc, "$id") or "").strip())
                    _delete_document(client, db_id, users_collection, user_id)
                    summary["deleted"] += 1
                    _write_audit_log(
                        client,
                        db_id,
                        audit_collection,
                        user_doc=user_doc,
                        action="delete_completed",
                        reason="inactive_free_user_deleted",
                        details={**report_entry, **delete_summary},
                        dry_run=False,
                        scheduled_delete_at=scheduled_delete_at,
                        last_active_at=activity_at,
                    )
            except Exception as error:
                summary["failed"] += 1
                context.error(json.dumps({
                    "job": "inactive-user-cleanup",
                    "user_id": user_id,
                    "error": str(error),
                }))
                if not dry_run:
                    _write_audit_log(
                        client,
                        db_id,
                        audit_collection,
                        user_doc=user_doc,
                        action="delete_failed",
                        reason="processing_error",
                        details={"error": str(error)},
                        dry_run=False,
                    )

        context.log(json.dumps(summary))
        return context.res.json({"status": "ok", **summary})
    except Exception as err:
        context.error(f"inactive-user-cleanup failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
