import hashlib
import json
import os
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from email_template import render_email_html

PAGE_SIZE = 100
STALE_AFTER_HOURS = 24
PAID_PLAN_ACTIVE_STATUSES = {"active", "trial"}


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


def _call_appwrite(client: Client, method: str, path: str, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _is_duplicate_conflict(error: Exception) -> bool:
    message = str(error or "").strip().lower()
    return "already exists" in message or "document with the requested id already exists" in message or "409" in message


def _list_all(client: Client, db_id: str, collection_id: str, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        page_queries = [Query.limit(PAGE_SIZE), *base_queries]
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
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(_obj_get(docs[-1], "$id", "") or "").strip()
        if not cursor:
            break
    return rows


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


def _send_email(client: Client, user_id: str, subject: str, html: str):
    _send_email_with_id(client, ID.unique(), user_id, subject, html)


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


def _acquire_run_lock(client: Client, db_id: str, collection_id: str, job_name: str, run_window: str, ttl_minutes: int = 70):
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


def _normalize_plan_code(value):
    return str(value or "").strip().lower() or "free"


def _normalize_billing_cycle(value):
    normalized = str(value or "").strip().lower()
    return normalized if normalized in {"monthly", "yearly"} else "monthly"


def _normalize_attempt_status(value):
    normalized = str(value or "").strip().lower()
    return normalized if normalized in {"created", "paid", "expired", "cancelled", "failed", "cleared"} else "created"


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


def _build_attempt_meta(attempt, **updates):
    meta = _parse_json_object(_obj_get(attempt, "meta_json"), {})
    for key, value in updates.items():
        if value is None:
            meta.pop(key, None)
        else:
            meta[key] = value
    return meta


def _transaction_created_at(transaction):
    return (
        _parse_datetime(_obj_get(transaction, "paid_at"))
        or _parse_datetime(_obj_get(transaction, "transactionDate"))
        or _parse_datetime(_obj_get(transaction, "created_at"))
        or _parse_datetime(_obj_get(transaction, "$createdAt"))
    )


def _find_superseding_transaction(transactions, attempt, attempt_created_at):
    attempt_user_id = str(_obj_get(attempt, "user_id", "") or "").strip()
    attempt_plan = _normalize_plan_code(_obj_get(attempt, "plan_code"))
    attempt_cycle = _normalize_billing_cycle(_obj_get(attempt, "billing_cycle"))
    if not attempt_user_id or not attempt_created_at or attempt_plan == "free":
        return None
    for transaction in transactions:
        status = str(_obj_get(transaction, "status") or "").strip().lower()
        if status not in {"success", "paid", "captured", "completed"}:
            continue
        if str(_obj_get(transaction, "userId") or _obj_get(transaction, "user_id") or "").strip() != attempt_user_id:
            continue
        transaction_plan = _normalize_plan_code(
            _obj_get(transaction, "planCode")
            or _obj_get(transaction, "plan_code")
            or _obj_get(transaction, "planId")
            or _obj_get(transaction, "plan_id")
        )
        transaction_cycle = _normalize_billing_cycle(
            _obj_get(transaction, "billingCycle") or _obj_get(transaction, "billing_cycle")
        )
        transaction_created_at = _transaction_created_at(transaction)
        if transaction_plan != attempt_plan or transaction_cycle != attempt_cycle or not transaction_created_at:
            continue
        if transaction_created_at > attempt_created_at:
            return transaction
    return None


def _find_success_transaction(transactions, attempt):
    attempt_id = str(_obj_get(attempt, "$id", "") or "").strip()
    gateway_order = str(_obj_get(attempt, "gateway_order_id", "") or "").strip()
    gateway_payment = str(_obj_get(attempt, "gateway_payment_id", "") or "").strip()
    for transaction in transactions:
        status = str(_obj_get(transaction, "status") or "").strip().lower()
        if status not in {"success", "paid", "captured", "completed"}:
            continue
        if attempt_id and str(_obj_get(transaction, "paymentAttemptId") or "").strip() == attempt_id:
            return transaction, "paymentAttemptId"
        if gateway_order and str(_obj_get(transaction, "gatewayOrderId") or "").strip() == gateway_order:
            return transaction, "gatewayOrderId"
        if gateway_payment and str(_obj_get(transaction, "transactionId") or "").strip() == gateway_payment:
            return transaction, "transactionId"
        if gateway_payment and str(_obj_get(transaction, "gatewayPaymentId") or "").strip() == gateway_payment:
            return transaction, "gatewayPaymentId"
    return None, None


def _is_profile_currently_paid(profile, now):
    if not profile:
        return False
    plan_code = _normalize_plan_code(_obj_get(profile, "plan_code"))
    plan_status = str(_obj_get(profile, "plan_status") or "").strip().lower()
    expires_at = _parse_datetime(_obj_get(profile, "expires_at"))
    if plan_code == "free" or plan_status not in PAID_PLAN_ACTIVE_STATUSES:
        return False
    if expires_at and expires_at <= now:
        return False
    return True


def _cleanup_attempt_document(client, db_id, attempts_collection, attempt, next_status=None, meta_updates=None):
    attempt_id = str(_obj_get(attempt, "$id", "") or "").strip()
    if not attempt_id:
        return False
    patch = {}
    if next_status:
        patch["status"] = next_status
    if meta_updates is not None:
        patch["meta_json"] = _serialize_json_object(_build_attempt_meta(attempt, **meta_updates))
    if patch:
        _update_document(client, db_id, attempts_collection, attempt_id, patch)
        attempt = {
            **attempt,
            **patch
        }
    _delete_document(client, db_id, attempts_collection, attempt_id)
    return True


def _send_payment_reminder(client, attempt):
    user_id = str(_obj_get(attempt, "user_id", "") or "").strip()
    attempt_id = str(_obj_get(attempt, "$id", "") or "").strip()
    plan_name = str(_obj_get(attempt, "plan_name") or "DM Panda Plan").strip()
    billing_cycle = str(_obj_get(attempt, "billing_cycle") or "monthly").strip()
    frontend_origin = str(_env("FRONTEND_ORIGIN") or "").rstrip("/")
    pricing_url = f"{frontend_origin}/pricing" if frontend_origin else ""
    dashboard_url = f"{frontend_origin}/dashboard" if frontend_origin else ""
    subject = "Complete your DM Panda subscription checkout"
    html = render_email_html(
        title="Your checkout was not completed",
        preheader=subject,
        greeting="Hello,",
        intro=f"You started a {plan_name} ({billing_cycle}) checkout in DM Panda, but it was not completed within 24 hours.",
        callouts=[{
            "tone": "info",
            "title": "No charge was made",
            "lines": [
                "If the payment was abandoned or failed, no subscription charge is applied until you successfully complete checkout.",
                "If you already finished payment from another attempt, you can safely ignore this email.",
            ],
        }],
        summary_rows=[
            ("Plan", plan_name),
            ("Billing cycle", billing_cycle.title()),
            ("Checkout status", "Not completed"),
        ],
        paragraphs=[
            "You are receiving this email because your account started a subscription purchase that did not finish.",
            "To continue with paid access, start a fresh checkout from the pricing page or your dashboard."
        ],
        cta_label="Continue subscription checkout",
        cta_url=pricing_url,
        secondary_links=[{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
        footer_note="Need a hand with billing or checkout issues? Our team can help.",
        frontend_origin=frontend_origin,
    )
    message_id = hashlib.sha1(f"payment-reminder:{attempt_id}".encode("utf-8")).hexdigest()[:32]
    try:
        _send_email_with_id(client, message_id, user_id, subject, html)
        return "sent"
    except Exception as error:
        if _is_duplicate_conflict(error):
            return "already_sent"
        raise


def main(context):
    try:
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

        attempts_collection = _env("PAYMENT_ATTEMPTS_COLLECTION_ID", "payment_attempts")
        transactions_collection = _env("TRANSACTIONS_COLLECTION_ID", "transactions")
        profiles_collection = _env("PROFILES_COLLECTION_ID", "profiles")
        job_locks_collection = _env("JOB_LOCKS_COLLECTION_ID", "job_locks")

        run_window = datetime.now(timezone.utc).strftime("%Y%m%d%H")
        if not _acquire_run_lock(client, db_id, job_locks_collection, "payment-reminders", run_window):
            return context.res.json({"status": "ok", "skipped_due_lock": 1})

        attempts = _list_all(client, db_id, attempts_collection)
        transactions = _list_all(client, db_id, transactions_collection)
        profiles = _list_all(client, db_id, profiles_collection)
        profiles_by_user_id = {
            str(_obj_get(profile, "user_id", "") or "").strip(): profile
            for profile in profiles
            if str(_obj_get(profile, "user_id", "") or "").strip()
        }
        now = datetime.now(timezone.utc)
        stale_before = now - timedelta(hours=STALE_AFTER_HOURS)

        summary = {
            "job": "payment-reminders",
            "run_window": run_window,
            "scanned": 0,
            "reminded": 0,
            "already_reminded": 0,
            "cleaned_paid_plan": 0,
            "cleaned_reconciled": 0,
            "cleaned_terminal": 0,
            "cleaned_abandoned": 0,
            "deleted": 0,
            "failed": 0,
            "skipped_due_lock": 0,
        }

        for attempt in attempts:
            summary["scanned"] += 1
            attempt_id = str(_obj_get(attempt, "$id", "") or "").strip()
            created_at = _parse_datetime(_obj_get(attempt, "created_at") or _obj_get(attempt, "$createdAt"))
            attempt_status = _normalize_attempt_status(_obj_get(attempt, "status"))
            if not attempt_id or not created_at or created_at > stale_before:
                continue
            try:
                if attempt_status in {"expired", "cleared", "cancelled", "failed", "paid"}:
                    _cleanup_attempt_document(client, db_id, attempts_collection, attempt)
                    summary["cleaned_terminal"] += 1
                    summary["deleted"] += 1
                    continue

                transaction, match_type = _find_success_transaction(transactions, attempt)
                if transaction:
                    _cleanup_attempt_document(
                        client,
                        db_id,
                        attempts_collection,
                        attempt,
                        next_status="cancelled",
                        meta_updates={
                            "cleanup_reason": f"reconciled:{match_type or 'transaction'}",
                            "cleanup_at": _to_iso(now),
                        },
                    )
                    summary["cleaned_reconciled"] += 1
                    summary["deleted"] += 1
                    continue

                superseding_transaction = _find_superseding_transaction(transactions, attempt, created_at)
                if superseding_transaction:
                    _cleanup_attempt_document(
                        client,
                        db_id,
                        attempts_collection,
                        attempt,
                        next_status="cancelled",
                        meta_updates={
                            "cleanup_reason": "superseded_by_paid_transaction",
                            "cleanup_at": _to_iso(now),
                        },
                    )
                    summary["cleaned_reconciled"] += 1
                    summary["deleted"] += 1
                    continue

                user_id = str(_obj_get(attempt, "user_id", "") or "").strip()
                profile = profiles_by_user_id.get(user_id)
                if _is_profile_currently_paid(profile, now):
                    _cleanup_attempt_document(
                        client,
                        db_id,
                        attempts_collection,
                        attempt,
                        next_status="cancelled",
                        meta_updates={
                            "cleanup_reason": "user_already_on_paid_plan",
                            "cleanup_at": _to_iso(now),
                        },
                    )
                    summary["cleaned_paid_plan"] += 1
                    summary["deleted"] += 1
                    continue

                reminder_result = _send_payment_reminder(client, attempt)
                _cleanup_attempt_document(
                    client,
                    db_id,
                    attempts_collection,
                    attempt,
                    next_status="expired",
                    meta_updates={
                        "reminder_sent_at": _to_iso(now),
                        "cleanup_reason": "abandoned_payment_attempt",
                        "cleanup_at": _to_iso(now),
                    },
                )
                if reminder_result == "sent":
                    summary["reminded"] += 1
                elif reminder_result == "already_sent":
                    summary["already_reminded"] += 1
                summary["cleaned_abandoned"] += 1
                summary["deleted"] += 1
            except Exception as error:
                summary["failed"] += 1
                context.error(json.dumps({
                    "job": "payment-reminders",
                    "attempt_id": attempt_id,
                    "user_id": _obj_get(attempt, "user_id"),
                    "error": str(error),
                    "attempt_status": attempt_status,
                }))

        context.log(json.dumps(summary))
        return context.res.json({"status": "ok", **summary})
    except Exception as err:
        context.error(f"payment-reminders failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
