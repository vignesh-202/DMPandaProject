import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from email_template import render_email_html

PAGE_SIZE = 100
DEFAULT_FREE_PLAN = "free"
MAX_RETRIES = 3
BENEFIT_KEYS = [
    "unlimited_contacts",
    "post_comment_dm_automation",
    "post_comment_reply_automation",
    "reel_comment_dm_automation",
    "reel_comment_reply_automation",
    "share_reel_to_dm",
    "share_post_to_dm",
    "super_profile",
    "welcome_message",
    "convo_starters",
    "inbox_menu",
    "dm_automation",
    "story_automation",
    "suggest_more",
    "comment_moderation",
    "global_trigger",
    "mentions",
    "collect_email",
    "instagram_live_automation",
    "priority_support",
    "followers_only",
    "seen_typing",
    "no_watermark",
]
BENEFIT_STORAGE_KEYS = {
    "post_comment_reply_automation": "post_comment_reply",
    "reel_comment_reply_automation": "reel_comment_reply",
}


def _benefit_field(key):
    return f"benefit_{BENEFIT_STORAGE_KEYS.get(key, key)}"

VALID_SELF_TRANSACTION_STATUSES = {"success", "paid", "captured", "completed", "active"}
NEGATIVE_SELF_TRANSACTION_STATUSES = {"refunded", "partially_refunded", "chargeback", "disputed", "void", "reversed", "cancelled", "canceled"}


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


def _safe_int(value, fallback=0):
    try:
        if value is None or value == "":
            return fallback
        return int(float(str(value)))
    except Exception:
        return fallback


def _parse_json_array(value):
    if value in (None, "", []):
        return []
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _normalize_feature_key(value):
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("+", "_")
        .replace("/", "_")
        .replace("-", "_")
        .replace(" ", "_")
    )


def _normalize_boolean(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized = str(value or "").strip().lower()
    if normalized in {"true", "yes", "enabled", "active", "included", "available", "unlimited"}:
        return True
    if normalized in {"false", "no", "disabled", "inactive", "excluded"}:
        return False
    return False


def _normalize_plan_code(value):
    return str(value or "").strip().lower() or DEFAULT_FREE_PLAN


def _normalize_plan_source(value, fallback="self"):
    normalized = str(value or "").strip().lower()
    if normalized in {"self", "admin"}:
        return normalized
    return fallback


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


def _snapshot_state(profile):
    snapshot = _parse_json_object(_obj_get(profile, "paid_plan_snapshot_json"), None)
    return snapshot if isinstance(snapshot, dict) else {}


def _snapshot_runtime(profile):
    runtime = _snapshot_state(profile).get("__rt")
    return runtime if isinstance(runtime, dict) else {}


def _snapshot_reminders(profile):
    reminders = _snapshot_runtime(profile).get("r")
    return reminders if isinstance(reminders, dict) else {}


def _snapshot_last_expired(profile):
    expired = _snapshot_runtime(profile).get("lx")
    return expired if isinstance(expired, dict) else {}


def _serialize_snapshot(snapshot):
    return json.dumps(snapshot, separators=(",", ":")) if snapshot else None


def _apply_snapshot_runtime(snapshot, *, reminders=None, last_expired=None):
    current = snapshot.get("__rt")
    runtime = current if isinstance(current, dict) else {}
    next_runtime = dict(runtime)
    if reminders is not None:
        clean_reminders = {key: value for key, value in reminders.items() if value}
        if clean_reminders:
            next_runtime["r"] = clean_reminders
        else:
            next_runtime.pop("r", None)
    if last_expired is not None:
        clean_last = {key: value for key, value in last_expired.items() if value}
        if clean_last:
            next_runtime["lx"] = clean_last
        else:
            next_runtime.pop("lx", None)
    if next_runtime:
        snapshot["__rt"] = next_runtime
    else:
        snapshot.pop("__rt", None)
    return snapshot


def _active_snapshot(plan_code, plan_name, billing_cycle, status, expires_at, limits_payload, existing_snapshot=None):
    snapshot = {
        "plan_id": plan_code,
        "plan_name": plan_name,
        "billing_cycle": billing_cycle,
        "status": status,
        "expires": expires_at,
        "limits": limits_payload,
    }
    runtime = _snapshot_runtime(existing_snapshot or {})
    if runtime:
        snapshot["__rt"] = runtime
    return snapshot


def _infer_plan_source(profile, user_doc):
    profile_plan = _normalize_plan_code(_obj_get(profile, "plan_code"))
    user_plan = _normalize_plan_code(_obj_get(user_doc or {}, "plan_id"))
    profile_expiry = _to_iso(_parse_datetime(_obj_get(profile, "expires_at")))
    user_expiry = _to_iso(_parse_datetime(_obj_get(user_doc or {}, "plan_expires_at")))
    if profile_plan != user_plan or profile_expiry != user_expiry:
        return "admin"
    return "self"


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


def _load_pricing_map(client: Client, db_id: str, collection_id: str):
    rows = _list_all(client, db_id, collection_id)
    pricing = {}
    for row in rows:
        plan_code = _normalize_plan_code(_obj_get(row, "plan_code") or _obj_get(row, "name"))
        if not plan_code:
            continue
        comparison = _parse_json_array(_obj_get(row, "comparison_json") or _obj_get(row, "comparison"))
        entitlements = {}
        for item in comparison:
            feature_key = _normalize_feature_key(_obj_get(item, "key") or _obj_get(item, "label"))
            if not feature_key:
                continue
            if feature_key in {
                "instagram_connections_limit",
                "instagram_link_limit",
                "actions_per_hour_limit",
                "actions_per_day_limit",
                "actions_per_month_limit",
                "hourly_action_limit",
                "daily_action_limit",
                "monthly_action_limit",
            }:
                continue
            if _normalize_boolean(_obj_get(item, "value")):
                entitlements[feature_key] = True
        for benefit_key in BENEFIT_KEYS:
            field = _benefit_field(benefit_key)
            if field in row:
                entitlements[benefit_key] = _normalize_boolean(_obj_get(row, field))
            else:
                entitlements.setdefault(benefit_key, False)
        monthly_limit = _safe_int(_obj_get(row, "actions_per_month_limit"), 0)
        active_limit = _safe_int(_obj_get(row, "instagram_connections_limit"), 0)
        linked_limit = _safe_int(_obj_get(row, "instagram_link_limit"), active_limit)
        pricing[plan_code] = {
            "plan_id": plan_code,
            "plan_name": str(_obj_get(row, "name") or plan_code.title()).strip() or "Plan",
            "entitlements": entitlements,
            "instagram_connections_limit": active_limit,
            "instagram_link_limit": linked_limit,
            "hourly_action_limit": _safe_int(_obj_get(row, "actions_per_hour_limit"), 0),
            "daily_action_limit": _safe_int(_obj_get(row, "actions_per_day_limit"), 0),
            "monthly_action_limit": monthly_limit if monthly_limit > 0 else 0,
            "monthly_duration_days": _safe_int(_obj_get(row, "monthly_duration_days"), 30),
            "yearly_duration_days": _safe_int(_obj_get(row, "yearly_duration_days"), 364),
        }
    if DEFAULT_FREE_PLAN not in pricing:
        raise ValueError("Pricing collection does not include a free plan row.")
    return pricing


def _resolve_limits_payload(profile, defaults):
    limits_payload = _parse_json_object(_obj_get(profile, "limits_json"), {})
    active_limit = _safe_int(
        limits_payload.get("instagram_connections_limit", _obj_get(profile, "instagram_connections_limit")),
        defaults["instagram_connections_limit"],
    )
    linked_limit = _safe_int(
        limits_payload.get("instagram_link_limit", _obj_get(profile, "instagram_link_limit")),
        defaults["instagram_link_limit"],
    )
    return {
        "instagram_connections_limit": active_limit,
        "instagram_link_limit": linked_limit if linked_limit > 0 else active_limit,
        "hourly_action_limit": _safe_int(limits_payload.get("hourly_action_limit", _obj_get(profile, "hourly_action_limit")), defaults["hourly_action_limit"]),
        "daily_action_limit": _safe_int(limits_payload.get("daily_action_limit", _obj_get(profile, "daily_action_limit")), defaults["daily_action_limit"]),
        "monthly_action_limit": _safe_int(limits_payload.get("monthly_action_limit", _obj_get(profile, "monthly_action_limit")), defaults["monthly_action_limit"]),
    }


def _transaction_plan_code(transaction):
    return _normalize_plan_code(
        _obj_get(transaction, "planCode")
        or _obj_get(transaction, "plan_code")
        or _obj_get(transaction, "planId")
        or _obj_get(transaction, "plan_id")
        or _obj_get(transaction, "planName")
        or _obj_get(transaction, "plan_name")
    )


def _transaction_created_at(transaction):
    return (
        _parse_datetime(_obj_get(transaction, "transactionDate"))
        or _parse_datetime(_obj_get(transaction, "created_at"))
        or _parse_datetime(_obj_get(transaction, "$createdAt"))
    )


def _transaction_billing_cycle(transaction):
    cycle = str(_obj_get(transaction, "billingCycle") or _obj_get(transaction, "billing_cycle") or "monthly").strip().lower()
    return cycle if cycle in {"monthly", "yearly"} else "monthly"


def _transaction_expiry(transaction, plan_defaults):
    start = _transaction_created_at(transaction) or datetime.now(timezone.utc)
    cycle = _transaction_billing_cycle(transaction)
    days = plan_defaults["yearly_duration_days"] if cycle == "yearly" else plan_defaults["monthly_duration_days"]
    return start + timedelta(days=max(1, _safe_int(days, 30)))


def _self_subscription_from_transactions(transactions, pricing_map, now):
    ranked = []
    for transaction in transactions:
        plan_code = _transaction_plan_code(transaction)
        if plan_code == DEFAULT_FREE_PLAN or plan_code not in pricing_map:
            continue
        created_at = _transaction_created_at(transaction)
        status = str(_obj_get(transaction, "status") or "").strip().lower()
        ranked.append((created_at or datetime.min.replace(tzinfo=timezone.utc), status, plan_code, transaction))
    ranked.sort(key=lambda item: item[0], reverse=True)
    decisive = next((item for item in ranked if item[1] in VALID_SELF_TRANSACTION_STATUSES or item[1] in NEGATIVE_SELF_TRANSACTION_STATUSES), None)
    if not decisive:
        return {"plan_id": DEFAULT_FREE_PLAN, "plan_expires_at": None, "billing_cycle": None}
    _, status, plan_code, transaction = decisive
    if status in NEGATIVE_SELF_TRANSACTION_STATUSES:
        return {"plan_id": DEFAULT_FREE_PLAN, "plan_expires_at": None, "billing_cycle": None}
    expires = _transaction_expiry(transaction, pricing_map[plan_code])
    if expires <= now:
        return {"plan_id": DEFAULT_FREE_PLAN, "plan_expires_at": None, "billing_cycle": _transaction_billing_cycle(transaction)}
    return {"plan_id": plan_code, "plan_expires_at": _to_iso(expires), "billing_cycle": _transaction_billing_cycle(transaction)}


def _build_profile_patch_for_plan(profile, plan_defaults, *, plan_code, plan_name, plan_source, billing_cycle, expires_at, status, preserve_expired_snapshot=False):
    limits_payload = _resolve_limits_payload(profile, plan_defaults if plan_code != DEFAULT_FREE_PLAN else plan_defaults)
    existing_snapshot = _snapshot_state(profile)
    patch = {
        "plan_code": plan_code,
        "plan_name": plan_name,
        "plan_status": status,
        "billing_cycle": billing_cycle,
        "expires_at": expires_at,
        "limits_json": json.dumps(limits_payload),
        "features_json": json.dumps(plan_defaults.get("entitlements") or {}),
        "admin_override_json": _obj_get(profile, "admin_override_json"),
        "instagram_connections_limit": limits_payload["instagram_connections_limit"],
        "hourly_action_limit": limits_payload["hourly_action_limit"],
        "daily_action_limit": limits_payload["daily_action_limit"],
        "monthly_action_limit": limits_payload["monthly_action_limit"],
    }
    for benefit_key in BENEFIT_KEYS:
        patch[_benefit_field(benefit_key)] = bool((plan_defaults.get("entitlements") or {}).get(benefit_key))
    if plan_code != DEFAULT_FREE_PLAN:
        patch["paid_plan_snapshot_json"] = _serialize_snapshot(
            _active_snapshot(plan_code, plan_name, billing_cycle, status, expires_at, limits_payload, existing_snapshot)
        )
    elif preserve_expired_snapshot:
        snapshot = existing_snapshot if isinstance(existing_snapshot, dict) else {}
        patch["paid_plan_snapshot_json"] = _serialize_snapshot(
            _apply_snapshot_runtime(
                snapshot,
                reminders={},
                last_expired={
                    "c": _normalize_plan_code(_obj_get(profile, "plan_code")),
                    "n": str(_obj_get(profile, "plan_name") or "").strip() or None,
                    "e": _obj_get(profile, "expires_at") or None,
                },
            )
        )
    else:
        patch["paid_plan_snapshot_json"] = None
    return patch


def _downgrade_profile_to_free(client, db_id, profiles_collection, pricing_map, profile, *, preserve_expired_snapshot=True):
    profile_id = str(_obj_get(profile, "$id", "") or "").strip()
    if not profile_id:
        return None
    free_defaults = pricing_map[DEFAULT_FREE_PLAN]
    patch = _build_profile_patch_for_plan(
        profile,
        free_defaults,
        plan_code=DEFAULT_FREE_PLAN,
        plan_name=free_defaults["plan_name"],
        plan_source="self",
        billing_cycle=None,
        expires_at=None,
        status="inactive",
        preserve_expired_snapshot=preserve_expired_snapshot,
    )
    return _update_document(client, db_id, profiles_collection, profile_id, patch)


def _restore_profile_from_self_memory(client, db_id, profiles_collection, pricing_map, profile, self_memory):
    profile_id = str(_obj_get(profile, "$id", "") or "").strip()
    plan_code = _normalize_plan_code(_obj_get(self_memory, "plan_id"))
    if not profile_id or plan_code == DEFAULT_FREE_PLAN:
        return None
    plan_defaults = pricing_map.get(plan_code)
    if not plan_defaults:
        return None
    expires_at = _obj_get(self_memory, "plan_expires_at") or None
    billing_cycle = str(_obj_get(self_memory, "billing_cycle") or "monthly").strip().lower()
    if billing_cycle not in {"monthly", "yearly"}:
        billing_cycle = "monthly"
    limits_payload = {
        "instagram_connections_limit": plan_defaults["instagram_connections_limit"],
        "instagram_link_limit": plan_defaults["instagram_link_limit"],
        "hourly_action_limit": plan_defaults["hourly_action_limit"],
        "daily_action_limit": plan_defaults["daily_action_limit"],
        "monthly_action_limit": plan_defaults["monthly_action_limit"],
    }
    patch = {
        "plan_code": plan_code,
        "plan_name": plan_defaults["plan_name"],
        "plan_status": "active",
        "billing_cycle": billing_cycle,
        "expires_at": expires_at,
        "limits_json": json.dumps(limits_payload),
        "features_json": json.dumps(plan_defaults.get("entitlements") or {}),
        "paid_plan_snapshot_json": _serialize_snapshot(
            _active_snapshot(plan_code, plan_defaults["plan_name"], billing_cycle, "active", expires_at, limits_payload, profile)
        ),
        "admin_override_json": None,
        "instagram_connections_limit": plan_defaults["instagram_connections_limit"],
        "hourly_action_limit": plan_defaults["hourly_action_limit"],
        "daily_action_limit": plan_defaults["daily_action_limit"],
        "monthly_action_limit": plan_defaults["monthly_action_limit"],
    }
    return _update_document(client, db_id, profiles_collection, profile_id, patch)


def _update_user_memory(client, db_id, users_collection, user_id, plan_id, expires_at):
    return None


def _build_email_content(stage: str, plan_name: str, expiry: str, frontend_origin: str = ""):
    frontend_base = str(frontend_origin or "").rstrip("/")
    pricing_url = f"{frontend_base}/pricing" if frontend_base else ""
    dashboard_url = f"{frontend_base}/dashboard" if frontend_base else ""
    if stage == "3d":
        subject = "Your DM Panda plan expires in 3 days"
        title = "Your paid plan is close to expiry"
        intro = f"Your {plan_name} plan is scheduled to expire on {expiry}."
        callouts = [{
            "tone": "warning",
            "title": "Action recommended",
            "lines": [
                "Renew before the expiry date to keep your current automation access and paid limits without interruption."
            ],
        }]
    elif stage == "day0":
        subject = "Your DM Panda plan expires today"
        title = "Your paid access ends today"
        intro = f"Your {plan_name} plan reaches its expiry date today: {expiry}."
        callouts = [{
            "tone": "warning",
            "title": "Renew today to avoid disruption",
            "lines": [
                "If renewal is not completed, your account will fall back to free-plan access and premium automation capacity will stop."
            ],
        }]
    elif stage == "day1":
        subject = "Your DM Panda plan has expired"
        title = "Your paid access has expired"
        intro = f"Your {plan_name} plan expired on {expiry}."
        callouts = [{
            "tone": "critical",
            "title": "Current impact",
            "lines": [
                "Your account now follows free-plan access rules until you renew.",
                "Extra Instagram accounts and premium automation capacity stay locked until paid access is restored.",
            ],
        }]
    else:
        subject = "Renew your DM Panda plan to restore full access"
        title = "Renew to restore your paid automation access"
        intro = f"Your previous {plan_name} plan expired on {expiry}."
        callouts = [{
            "tone": "info",
            "title": "When you renew",
            "lines": [
                "Your paid plan limits and premium automation access will be restored as soon as the renewal is completed."
            ],
        }]
    html = render_email_html(
        title=title,
        preheader=subject,
        greeting="Hello,",
        intro=intro,
        callouts=callouts,
        summary_rows=[
            ("Plan", plan_name),
            ("Status", "Expires soon" if stage in {"3d", "day0"} else "Expired"),
            ("Effective date", expiry),
        ],
        paragraphs=[
            "You are receiving this email because your DM Panda account currently has or recently had an active paid subscription.",
            "Renewing keeps your automation setup available and prevents avoidable interruptions to account access."
            if stage in {"3d", "day0"}
            else "Renewing restores paid limits so you can continue using your premium automation setup."
        ],
        bullets=[
            "Linked Instagram accounts above the free-plan limit remain locked until your paid plan is active again.",
            "Your account data stays in place. This notice is only about subscription access and plan entitlements.",
        ],
        cta_label="Review plans and renew",
        cta_url=pricing_url,
        secondary_links=[{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
        footer_note="Questions about billing or renewal timing? Reply to support and we will help.",
        frontend_origin=frontend_base,
    )
    return subject, html


def _recompute_account_access(client: Client, db_id: str, profile, ig_accounts_collection: str = "ig_accounts"):
    user_id = str(_obj_get(profile, "user_id", "") or "").strip()
    if not user_id:
        return 0

    limits_payload = _parse_json_object(_obj_get(profile, "limits_json"), {})
    limit = _safe_int(limits_payload.get("instagram_connections_limit", _obj_get(profile, "instagram_connections_limit")), 0)
    accounts = _list_all(client, db_id, ig_accounts_collection, [Query.equal("user_id", user_id)])
    ordered_active_accounts = [
        account for account in accounts
        if _obj_get(account, "is_active", True) is not False
        and str(_obj_get(account, "status") or "active").strip().lower() == "active"
    ]
    ordered_active_accounts.sort(key=lambda account: (
        str(_obj_get(account, "linked_at") or ""),
        str(_obj_get(account, "$createdAt") or ""),
        str(_obj_get(account, "$id") or ""),
    ))
    default_window_ids = {
        str(_obj_get(account, "$id", "") or "").strip()
        for account in ordered_active_accounts[:max(0, limit)]
    }

    updated = 0
    for account in accounts:
        account_id = str(_obj_get(account, "$id", "") or "").strip()
        if not account_id:
            continue
        linked_active = _obj_get(account, "is_active", True) is not False and str(_obj_get(account, "status") or "active").strip().lower() == "active"
        admin_disabled = _obj_get(account, "admin_disabled", False) is True
        access_override_enabled = _obj_get(account, "access_override_enabled", False) is True
        plan_locked = bool(linked_active and account_id not in default_window_ids and not access_override_enabled)
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
        _update_document(
            client,
            db_id,
            ig_accounts_collection,
            account_id,
            {
                "plan_locked": plan_locked,
                "effective_access": effective_access,
                "access_state": access_state,
                "access_reason": access_reason,
            },
        )
        updated += 1
    return updated


def _acquire_run_lock(client: Client, db_id: str, job_locks_collection: str, job_name: str, run_window: str, ttl_minutes: int = 90):
    lock_key = f"{job_name}:{run_window}"
    document_id = hashlib.sha1(lock_key.encode("utf-8")).hexdigest()[:32]
    try:
        _create_document(
            client,
            db_id,
            job_locks_collection,
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


def _maybe_send_reminder(client, db_id, profiles_collection, profile, stage, anchor_expiry, summary):
    profile_id = str(_obj_get(profile, "$id", "") or "").strip()
    user_id = str(_obj_get(profile, "user_id", "") or "").strip()
    if not profile_id or not user_id or not anchor_expiry:
        return
    field_map = {
        "3d": "3d",
        "day0": "d0",
        "day1": "d1",
        "repeat": "rp",
    }
    reminder_key = field_map[stage]
    reminders = _snapshot_reminders(profile)
    last_sent_value = reminders.get(reminder_key)
    if last_sent_value:
        if stage != "repeat":
            summary["skipped_duplicate_reminders"] += 1
            return
        last_sent = _parse_datetime(last_sent_value)
        if last_sent and (datetime.now(timezone.utc) - last_sent).days < 7:
            summary["skipped_duplicate_reminders"] += 1
            return

    expiry_text = anchor_expiry.date().isoformat()
    last_expired = _snapshot_last_expired(profile)
    plan_name = str(_obj_get(profile, "plan_name") or last_expired.get("n") or _obj_get(_snapshot_state(profile), "plan_name") or "DM Panda Plan").strip()
    subject, html = _build_email_content(stage, plan_name, expiry_text, _env("FRONTEND_ORIGIN"))
    _send_email(client, user_id, subject, html)
    next_snapshot = _apply_snapshot_runtime(
        _snapshot_state(profile),
        reminders={**reminders, reminder_key: _to_iso(datetime.now(timezone.utc))},
    )
    _update_document(client, db_id, profiles_collection, profile_id, {
        "paid_plan_snapshot_json": _serialize_snapshot(next_snapshot)
    })
    summary["emails_sent"] += 1


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

        profiles_collection = _env("PROFILES_COLLECTION_ID", "profiles")
        transactions_collection = _env("TRANSACTIONS_COLLECTION_ID", "transactions")
        pricing_collection = _env("PRICING_COLLECTION_ID", "pricing")
        job_locks_collection = _env("JOB_LOCKS_COLLECTION_ID", "job_locks")
        pricing_map = _load_pricing_map(client, db_id, pricing_collection)

        run_window = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")[:11]
        if not _acquire_run_lock(client, db_id, job_locks_collection, "subscription-manager", run_window):
            return context.res.json({"status": "ok", "skipped_due_lock": 1})

        profiles = _list_all(client, db_id, profiles_collection)
        transactions = _list_all(client, db_id, transactions_collection)
        transactions_by_user = {}
        for transaction in transactions:
            tx_user_id = str(_obj_get(transaction, "userId") or _obj_get(transaction, "user_id") or "").strip()
            if tx_user_id:
                transactions_by_user.setdefault(tx_user_id, []).append(transaction)
        now = datetime.now(timezone.utc)
        today = now.date()

        summary = {
            "job": "subscription-manager",
            "run_window": run_window,
            "scanned": 0,
            "emails_sent": 0,
            "downgraded": 0,
            "restored": 0,
            "transaction_self_memory_expired": 0,
            "failed": 0,
            "skipped_duplicate_reminders": 0,
            "skipped_due_lock": 0,
        }

        for profile in profiles:
            summary["scanned"] += 1
            user_id = str(_obj_get(profile, "user_id", "") or "").strip()
            if not user_id:
                continue
            self_memory = _self_subscription_from_transactions(transactions_by_user.get(user_id, []), pricing_map, now)
            current_plan = _normalize_plan_code(_obj_get(profile, "plan_code"))
            plan_source = _infer_plan_source(profile, self_memory)
            expires_at = _parse_datetime(_obj_get(profile, "expires_at"))
            self_plan_id = _normalize_plan_code(_obj_get(self_memory, "plan_id"))
            self_plan_expires = _parse_datetime(_obj_get(self_memory, "plan_expires_at"))

            try:
                if current_plan != DEFAULT_FREE_PLAN and expires_at:
                    days_until_expiry = (expires_at.date() - today).days
                    if days_until_expiry == 3:
                        _maybe_send_reminder(client, db_id, profiles_collection, profile, "3d", expires_at, summary)
                    elif days_until_expiry == 0:
                        _maybe_send_reminder(client, db_id, profiles_collection, profile, "day0", expires_at, summary)
                    elif days_until_expiry == -1:
                        _maybe_send_reminder(client, db_id, profiles_collection, profile, "day1", expires_at, summary)
                    elif days_until_expiry <= -7 and abs(days_until_expiry) % 7 == 0:
                        _maybe_send_reminder(client, db_id, profiles_collection, profile, "repeat", expires_at, summary)

                if current_plan == DEFAULT_FREE_PLAN:
                    last_expired = _snapshot_last_expired(profile)
                    last_expired_at = _parse_datetime(last_expired.get("e"))
                    if last_expired_at:
                        days_since_expiry = (last_expired_at.date() - today).days
                        if days_since_expiry <= -7 and abs(days_since_expiry) % 7 == 0:
                            _maybe_send_reminder(client, db_id, profiles_collection, profile, "repeat", last_expired_at, summary)

                if current_plan != DEFAULT_FREE_PLAN and expires_at and expires_at < now:
                    if plan_source == "admin" and self_plan_id != DEFAULT_FREE_PLAN and self_plan_expires and self_plan_expires > now:
                        restored = _restore_profile_from_self_memory(client, db_id, profiles_collection, pricing_map, profile, self_memory)
                        if restored:
                            summary["restored"] += 1
                            profile = restored
                        _recompute_account_access(client, db_id, restored or profile)
                    else:
                        downgraded = _downgrade_profile_to_free(client, db_id, profiles_collection, pricing_map, profile, preserve_expired_snapshot=True)
                        if downgraded:
                            summary["downgraded"] += 1
                            profile = downgraded
                        if plan_source == "self":
                            summary["transaction_self_memory_expired"] += 1
                        _recompute_account_access(client, db_id, downgraded or profile)
                        continue

                if current_plan == DEFAULT_FREE_PLAN and plan_source == "admin" and self_plan_id != DEFAULT_FREE_PLAN and self_plan_expires and self_plan_expires < now:
                    summary["transaction_self_memory_expired"] += 1
            except Exception as error:
                summary["failed"] += 1
                context.error(json.dumps({
                    "job": "subscription-manager",
                    "user_id": user_id,
                    "profile_id": _obj_get(profile, "$id"),
                    "error": str(error),
                }))

        context.log(json.dumps(summary))
        return context.res.json({"status": "ok", **summary})
    except Exception as err:
        context.error(f"subscription-manager failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
