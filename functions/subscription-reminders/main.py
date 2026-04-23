import json
import os
from datetime import datetime, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query

PAGE_SIZE = 100
DEFAULT_FREE_PLAN = "free"
REMINDER_STAGES = {
    3: "three_days_before",
    0: "expires_today",
    -1: "day_after_expiry",
}


def _env(key: str, default: str = "") -> str:
    return str(os.environ.get(key, default) or "").strip()


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _safe_int(value, fallback=0):
    try:
        if value is None:
            return fallback
        return int(float(str(value)))
    except Exception:
        return fallback


def _parse_datetime(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def _parse_request_body(context):
    raw = getattr(getattr(context, "req", None), "body", None)
    if raw in (None, ""):
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(str(raw))
    except Exception:
        return {}


def _call_appwrite(client: Client, method: str, path: str, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _list_all(client: Client, db_id: str, collection_id: str, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        page_queries = [Query.limit(PAGE_SIZE), Query.order_asc("$id"), *base_queries]
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


def _normalize_plan_code(value):
    return str(value or "").strip().lower()


def _load_pricing_rows(client: Client, db_id: str, collection_id: str):
    rows = _list_all(client, db_id, collection_id)
    pricing = {}
    for row in rows:
        code = _normalize_plan_code(_obj_get(row, "plan_code") or _obj_get(row, "name"))
        if not code:
            continue
        monthly_limit = _safe_int(_obj_get(row, "actions_per_month_limit"), 0)
        pricing[code] = {
            "plan_id": code,
            "hourly_action_limit": _safe_int(_obj_get(row, "actions_per_hour_limit"), 0),
            "daily_action_limit": _safe_int(_obj_get(row, "actions_per_day_limit"), 0),
            "monthly_action_limit": monthly_limit if monthly_limit > 0 else 0,
        }
    if DEFAULT_FREE_PLAN not in pricing:
        raise ValueError("Pricing collection does not include a free plan row.")
    return pricing


def _send_reminder_email(client: Client, user_id: str, subject: str, html: str):
    _call_appwrite(
        client,
        "post",
        "/messaging/messages/email",
        {
            "messageId": ID.unique(),
            "subject": subject,
            "content": html,
            "users": [user_id],
            "html": True,
        },
    )


def _recompute_account_access(client: Client, db_id: str, profile, ig_accounts_collection: str = "ig_accounts"):
    user_id = str(_obj_get(profile, "user_id", "") or "").strip()
    if not user_id:
        return 0

    try:
        limit_payload = _obj_get(profile, "limits_json")
        if isinstance(limit_payload, str):
            limit_payload = json.loads(limit_payload or "{}")
        if not isinstance(limit_payload, dict):
            limit_payload = {}
    except Exception:
        limit_payload = {}

    limit = _safe_int(limit_payload.get("instagram_connections_limit", _obj_get(profile, "instagram_connections_limit")), 0)
    accounts = _list_all(client, db_id, ig_accounts_collection, [Query.equal("user_id", user_id)])
    active_candidates = [
        account for account in accounts
        if _obj_get(account, "is_active", True) is not False
        and str(_obj_get(account, "status") or "active").strip().lower() == "active"
        and _obj_get(account, "admin_disabled", False) is not True
        and _obj_get(account, "access_override_enabled", False) is not True
    ]
    active_candidates.sort(key=lambda account: str(_obj_get(account, "linked_at") or _obj_get(account, "$createdAt") or ""))
    allowed_ids = {
        str(_obj_get(account, "$id", "") or "").strip()
        for account in active_candidates[:max(0, limit)]
    }

    updated = 0
    for account in accounts:
        account_id = str(_obj_get(account, "$id", "") or "").strip()
        if not account_id:
            continue
        linked_active = _obj_get(account, "is_active", True) is not False and str(_obj_get(account, "status") or "active").strip().lower() == "active"
        admin_disabled = _obj_get(account, "admin_disabled", False) is True
        access_override_enabled = _obj_get(account, "access_override_enabled", False) is True
        plan_locked = bool(linked_active and not admin_disabled and not access_override_enabled and account_id not in allowed_ids)
        effective_access = bool(linked_active and not admin_disabled and (not plan_locked or access_override_enabled))
        access_state = "inactive"
        access_reason = "inactive"
        if linked_active:
            if admin_disabled:
                access_state = "admin_disabled"
                access_reason = "admin_disabled"
            elif plan_locked and not access_override_enabled:
                access_state = "plan_locked"
                access_reason = "plan_locked"
            elif access_override_enabled:
                access_state = "override_enabled"
                access_reason = "override_enabled"
            else:
                access_state = "active"
                access_reason = None
        patch = {
            "plan_locked": plan_locked,
            "effective_access": effective_access,
            "access_state": access_state,
            "access_reason": access_reason,
        }
        _call_appwrite(
            client,
            "patch",
            f"/databases/{db_id}/collections/{ig_accounts_collection}/documents/{account_id}",
            {"data": patch},
        )
        updated += 1
    return updated


def _build_email_content(stage: str, profile) -> tuple[str, str]:
    plan_id = str(_obj_get(profile, "plan_code") or DEFAULT_FREE_PLAN).strip() or DEFAULT_FREE_PLAN
    expiry = str(_obj_get(profile, "expires_at") or "").strip()

    if stage == "three_days_before":
        subject = "Your DM Panda plan ends in 3 days"
        body = f"<p>Your <strong>{plan_id}</strong> plan is scheduled to end on <strong>{expiry}</strong>.</p><p>Renew now to keep your current benefits active.</p>"
    elif stage == "expires_today":
        subject = "Your DM Panda plan ends today"
        body = f"<p>Your <strong>{plan_id}</strong> plan reaches its expiry date today: <strong>{expiry}</strong>.</p><p>Renew now to avoid a free-plan downgrade.</p>"
    else:
        subject = "Your DM Panda plan has expired"
        body = f"<p>Your <strong>{plan_id}</strong> plan expired on <strong>{expiry}</strong>.</p><p>If you have already renewed, you can ignore this message. Otherwise your account will remain on the free plan until you subscribe again.</p>"

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827;">
        <h2>{subject}</h2>
        {body}
      </body>
    </html>
    """
    return subject, html


def _profile_requires_downgrade(profile) -> bool:
    current_plan = _normalize_plan_code(_obj_get(profile, "plan_code"))
    expiry_dt = _parse_datetime(_obj_get(profile, "expires_at"))
    now = datetime.now(timezone.utc)

    if current_plan == DEFAULT_FREE_PLAN or not expiry_dt or expiry_dt >= now:
        return False
    return True


def _downgrade_profile_if_still_expired(client: Client, db_id: str, profile_collection: str, pricing_rows: dict, profile) -> bool:
    profile_id = str(_obj_get(profile, "$id", "") or "").strip()
    if not profile_id or not _profile_requires_downgrade(profile):
        return False

    free_defaults = pricing_rows[DEFAULT_FREE_PLAN]
    patch = {
        "plan_code": DEFAULT_FREE_PLAN,
        "plan_name": "Free Plan",
        "plan_status": "inactive",
        "billing_cycle": None,
        "expires_at": None,
        "limits_json": json.dumps({
            "instagram_connections_limit": 0,
            "hourly_action_limit": free_defaults["hourly_action_limit"],
            "daily_action_limit": free_defaults["daily_action_limit"],
            "monthly_action_limit": free_defaults["monthly_action_limit"],
        }),
        "features_json": json.dumps({}),
        "paid_plan_snapshot_json": None,
        "admin_override_json": None,
        "hourly_action_limit": free_defaults["hourly_action_limit"],
        "daily_action_limit": free_defaults["daily_action_limit"],
        "monthly_action_limit": free_defaults["monthly_action_limit"],
        "feature_overrides_json": None,
    }
    _call_appwrite(
        client,
        "patch",
        f"/databases/{db_id}/collections/{profile_collection}/documents/{profile_id}",
        {"data": patch},
    )
    return True


def main(context):
    try:
        request_body = _parse_request_body(context)
        dry_run = request_body.get("dry_run") is True

        client = Client()
        client.set_endpoint(_env("APPWRITE_ENDPOINT"))
        client.set_project(_env("APPWRITE_PROJECT_ID"))
        client.set_key(_env("APPWRITE_API_KEY"))

        db_id = _env("APPWRITE_DATABASE_ID")
        profiles_collection = _env("PROFILES_COLLECTION_ID", "profiles")
        pricing_collection = _env("PRICING_COLLECTION_ID", "pricing")
        pricing_rows = _load_pricing_rows(client, db_id, pricing_collection)
        profiles = _list_all(client, db_id, profiles_collection)
        now = datetime.now(timezone.utc)
        today = now.date()

        summary = {
            "dry_run": dry_run,
            "scanned_profiles": 0,
            "emails_sent": 0,
            "emails_planned": 0,
            "downgraded_profiles": 0,
            "downgrades_planned": 0,
            "skipped_free": 0,
            "skipped_missing_expiry": 0,
            "skipped_idempotent": 0,
        }

        for profile in profiles:
            summary["scanned_profiles"] += 1

            user_id = str(_obj_get(profile, "user_id", "") or "").strip()
            plan_id = _normalize_plan_code(_obj_get(profile, "plan_code"))
            expiry_dt = _parse_datetime(_obj_get(profile, "expires_at"))

            if not user_id or plan_id == DEFAULT_FREE_PLAN:
                summary["skipped_free"] += 1
                continue
            if not expiry_dt:
                summary["skipped_missing_expiry"] += 1
                continue

            days_until_expiry = (expiry_dt.date() - today).days
            stage = REMINDER_STAGES.get(days_until_expiry)
            if stage:
                if dry_run:
                    summary["emails_planned"] += 1
                else:
                    subject, html = _build_email_content(stage, profile)
                    _send_reminder_email(client, user_id, subject, html)
                    summary["emails_sent"] += 1

            if _profile_requires_downgrade(profile):
                if dry_run:
                    summary["downgrades_planned"] += 1
                elif _downgrade_profile_if_still_expired(client, db_id, profiles_collection, pricing_rows, profile):
                    summary["downgraded_profiles"] += 1
                    downgraded_profile = {
                        **profile,
                        "limits_json": json.dumps({
                            "instagram_connections_limit": 0,
                            "hourly_action_limit": pricing_rows[DEFAULT_FREE_PLAN]["hourly_action_limit"],
                            "daily_action_limit": pricing_rows[DEFAULT_FREE_PLAN]["daily_action_limit"],
                            "monthly_action_limit": pricing_rows[DEFAULT_FREE_PLAN]["monthly_action_limit"],
                        })
                    }
                    _recompute_account_access(client, db_id, downgraded_profile)

        return context.res.json({"status": "ok", **summary})
    except Exception as err:
        context.error(f"subscription-reminders failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
