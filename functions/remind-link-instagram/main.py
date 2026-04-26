import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from appwrite.services.messaging import Messaging
from appwrite.services.users import Users

sys.path.insert(0, str(Path(__file__).resolve().parent))
from email_template import render_email_html

PAGE_SIZE = 100
MAX_RETRIES = 3
RETRY_SLEEP_SECONDS = 0.2
SIGNUP_REMINDER_DELAY_HOURS = 24
EXPIRY_REMINDER_LEAD_DAYS = 3
ACTIVE_ACCOUNT_STATUSES = {"active"}
INACTIVE_SUBSCRIPTION_STATUSES = {"inactive", "cancelled", "expired", "past_due"}
SIGNUP_PREF_KEY = "ig_link_signup_reminder_sent_at"
EXPIRING_PREF_KEY = "ig_link_expiring_reminder_for"
EXPIRING_SENT_AT_PREF_KEY = "ig_link_expiring_reminder_sent_at"
EXPIRED_PREF_KEY = "ig_link_expired_reminder_for"
EXPIRED_SENT_AT_PREF_KEY = "ig_link_expired_reminder_sent_at"


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _env(key: str, default: str = "") -> str:
    return str(os.environ.get(key, default) or "").strip()


def _trim_trailing_slash(value: str = "") -> str:
    return str(value or "").rstrip("/")


def _with_retry(fn):
    last = None
    for idx in range(MAX_RETRIES):
        try:
            return fn()
        except Exception as err:  # noqa: BLE001
            last = err
            if idx < MAX_RETRIES - 1:
                time.sleep(RETRY_SLEEP_SECONDS * (idx + 1))
    raise last


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _parse_iso_datetime(value):
    safe = str(value or "").strip()
    if not safe:
        return None
    try:
        return datetime.fromisoformat(safe.replace("Z", "+00:00"))
    except ValueError:
        return None


def _list_all(client: Client, db_id: str, collection_id: str, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])

    while True:
        q = list(base_queries) + [Query.limit(PAGE_SIZE), Query.order_asc("$id")]
        if cursor:
            q.append(Query.cursor_after(cursor))

        page = _with_retry(
            lambda: _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{collection_id}/documents",
                {"queries": q},
            )
        )
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(_obj_get(docs[-1], "$id", "") or "").strip() or None
        if not cursor:
            break

    return rows


def _build_dashboard_account_settings_url():
    frontend_origin = _trim_trailing_slash(_env("FRONTEND_ORIGIN"))
    if not frontend_origin:
        return ""
    return f"{frontend_origin}/dashboard/account-settings"


def _normalize_subscription_status(value) -> str:
    return str(value or "").strip().lower()


def _has_active_instagram_connection(rows: list[dict]) -> bool:
    for row in rows or []:
        status = str(_obj_get(row, "status", "") or "").strip().lower()
        if status in ACTIVE_ACCOUNT_STATUSES:
            return True
    return False


def _get_profile_by_user_id(rows: list[dict]) -> dict:
    mapping = {}
    for row in rows or []:
        user_id = str(_obj_get(row, "user_id", "") or "").strip()
        if user_id and user_id not in mapping:
            mapping[user_id] = row
    return mapping


def _get_accounts_by_user_id(rows: list[dict]) -> dict:
    mapping = {}
    for row in rows or []:
        user_id = str(_obj_get(row, "user_id", "") or "").strip()
        if not user_id:
            continue
        mapping.setdefault(user_id, []).append(row)
    return mapping


def _build_expiry_marker(expires_at, fallback_status: str = "") -> str:
    if expires_at:
        return expires_at.isoformat()
    safe_status = _normalize_subscription_status(fallback_status)
    return f"status:{safe_status}" if safe_status else ""


def _resolve_reminder_type(
    user_doc: dict,
    profile_doc: dict,
    prefs: dict,
    user_accounts: list[dict],
    now: datetime,
    signup_reminder_delay_hours: int,
    expiry_reminder_lead_days: int,
):
    if _has_active_instagram_connection(user_accounts):
        return None

    created_at = _parse_iso_datetime(_obj_get(user_doc, "$createdAt", ""))
    expires_at = _parse_iso_datetime(_obj_get(profile_doc, "expires_at"))
    subscription_status = _normalize_subscription_status(_obj_get(profile_doc, "plan_status"))

    if expires_at:
        expiry_marker = _build_expiry_marker(expires_at, subscription_status)
        if now >= expires_at or subscription_status in INACTIVE_SUBSCRIPTION_STATUSES:
            if str(_obj_get(prefs, EXPIRED_PREF_KEY, "") or "").strip() != expiry_marker:
                return "expired"

        expiring_window_start = expires_at - timedelta(days=expiry_reminder_lead_days)
        if expiring_window_start <= now < expires_at and subscription_status not in INACTIVE_SUBSCRIPTION_STATUSES:
            if str(_obj_get(prefs, EXPIRING_PREF_KEY, "") or "").strip() != expiry_marker:
                return "expiring"

    if created_at and now >= (created_at + timedelta(hours=signup_reminder_delay_hours)):
        if not _obj_get(prefs, SIGNUP_PREF_KEY):
            return "signup"

    return None


def _build_reminder_payload(reminder_type: str, user_name: str, expires_at):
    action_url = _build_dashboard_account_settings_url()
    safe_name = user_name or "there"
    frontend_origin = _trim_trailing_slash(_env("FRONTEND_ORIGIN"))
    dashboard_url = f"{frontend_origin}/dashboard" if frontend_origin else ""

    if reminder_type == "expired":
        return {
            "subject": "Your DM Panda plan ended before Instagram was connected",
            "title": "Instagram was never connected during your paid period",
            "intro": f"Hi {safe_name}, your DM Panda subscription has ended and no Instagram account was connected while the plan was active.",
            "paragraphs": [
                "You are receiving this email because Instagram connection is required before DM Panda automations, comment flows, welcome messages, and lead capture journeys can go live.",
                "When you renew, connect Instagram first so you can start using the plan immediately.",
            ],
            "callouts": [{
                "tone": "info",
                "title": "Next best step",
                "lines": [
                    "Renew your plan, then open account settings to connect Instagram before turning automations back on."
                ],
            }],
            "summary_rows": [
                ("Subscription status", "Expired"),
                ("Instagram status", "Not connected"),
                ("Next step", "Renew and connect Instagram"),
            ],
            "action_label": "Open Account Settings",
            "action_url": action_url,
            "secondary_links": [{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
        }

    if reminder_type == "expiring":
        expiry_text = expires_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if expires_at else "soon"
        return {
            "subject": "Link Instagram before your DM Panda subscription expires",
            "title": "Your subscription is close to ending",
            "intro": f"Hi {safe_name}, your DM Panda subscription is close to ending, but your Instagram account is still not linked.",
            "paragraphs": [
                f"Your current subscription is set to expire on {expiry_text}. Connect Instagram before then so you can start using your plan while it is still active.",
                "You are receiving this email because your account currently has paid access but no active Instagram connection.",
            ],
            "callouts": [{
                "tone": "warning",
                "title": "Why linking matters",
                "lines": [
                    "Without Instagram connected, your paid automation features cannot start.",
                    "Connection takes only a few steps from account settings."
                ],
            }],
            "summary_rows": [
                ("Subscription status", "Active but expiring soon"),
                ("Expiry date", expiry_text),
                ("Instagram status", "Not connected"),
            ],
            "bullets": [
                "Welcome messages and keyword automations need an active Instagram connection.",
                "Lead capture flows only start after the Instagram account is linked.",
            ],
            "action_label": "Link Instagram",
            "action_url": action_url,
            "secondary_links": [{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
        }

    return {
        "subject": "Complete your DM Panda setup by linking Instagram",
        "title": "Link Instagram to start your automations",
        "intro": f"Hi {safe_name}, your DM Panda account is ready, but your Instagram account is still not connected.",
        "paragraphs": [
            "You are receiving this setup reminder because Instagram must be linked before automations can run.",
            "This reminder is sent once after your first 24 hours so you can finish setup without repeated nudges.",
        ],
        "summary_rows": [
            ("Account status", "Ready for setup"),
            ("Instagram status", "Not connected"),
            ("Next step", "Connect Instagram in account settings"),
        ],
        "bullets": [
            "Start welcome automations and keyword replies.",
            "Launch comment flows and lead capture journeys.",
            "Manage your connected account from the DM Panda dashboard.",
        ],
        "action_label": "Link Instagram",
        "action_url": action_url,
        "secondary_links": [{"label": "Open dashboard", "url": dashboard_url}] if dashboard_url else [],
    }


def _send_reminder_email(messaging: Messaging, user_id: str, reminder_type: str, user_name: str, expires_at):
    payload = _build_reminder_payload(reminder_type, user_name, expires_at)
    frontend_origin = _trim_trailing_slash(_env("FRONTEND_ORIGIN"))
    _with_retry(
        lambda: messaging.create_email(
            message_id=ID.unique(),
            subject=payload["subject"],
            content=render_email_html(
                title=payload["title"],
                preheader=payload["subject"],
                greeting="",
                intro=payload.get("intro", ""),
                paragraphs=payload["paragraphs"],
                bullets=payload.get("bullets", []),
                callouts=payload.get("callouts", []),
                summary_rows=payload.get("summary_rows", []),
                cta_label=payload["action_label"],
                cta_url=payload["action_url"],
                secondary_links=payload.get("secondary_links", []),
                footer_note="If Instagram is already connected, you can ignore this reminder.",
                frontend_origin=frontend_origin,
            ),
            users=[user_id],
            html=True,
        )
    )


def _build_updated_prefs(prefs: dict, reminder_type: str, now: datetime, expires_at, subscription_status: str):
    next_prefs = {**(prefs or {})}
    now_iso = now.isoformat()
    if reminder_type == "signup":
        next_prefs[SIGNUP_PREF_KEY] = now_iso
        return next_prefs

    expiry_marker = _build_expiry_marker(expires_at, subscription_status)
    if reminder_type == "expiring":
        next_prefs[EXPIRING_PREF_KEY] = expiry_marker
        next_prefs[EXPIRING_SENT_AT_PREF_KEY] = now_iso
        return next_prefs

    if reminder_type == "expired":
        next_prefs[EXPIRED_PREF_KEY] = expiry_marker
        next_prefs[EXPIRED_SENT_AT_PREF_KEY] = now_iso
        return next_prefs

    return next_prefs


def main(context):
    try:
        raw_body = getattr(getattr(context, "req", None), "body", None)
        if isinstance(raw_body, dict):
            request_body = raw_body
        else:
            try:
                request_body = json.loads(str(raw_body or "{}"))
            except Exception:
                request_body = {}
        dry_run = request_body.get("dry_run") is True

        client = Client()
        client.set_endpoint(_env("APPWRITE_ENDPOINT"))
        client.set_project(_env("APPWRITE_PROJECT_ID"))
        client.set_key(_env("APPWRITE_API_KEY"))

        messaging = Messaging(client)
        users = Users(client)

        db_id = _env("APPWRITE_DATABASE_ID")
        users_collection_id = _env("USERS_COLLECTION_ID", "users")
        profiles_collection_id = _env("PROFILES_COLLECTION_ID", "profiles")
        ig_accounts_collection_id = _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts")
        signup_reminder_delay_hours = max(1, int(_env("REMINDER_DELAY_HOURS", str(SIGNUP_REMINDER_DELAY_HOURS))))
        expiry_reminder_lead_days = max(1, int(_env("EXPIRY_REMINDER_LEAD_DAYS", str(EXPIRY_REMINDER_LEAD_DAYS))))
        now = datetime.now(timezone.utc)

        user_docs = _list_all(client, db_id, users_collection_id)
        profile_map = _get_profile_by_user_id(_list_all(client, db_id, profiles_collection_id))
        accounts_by_user = _get_accounts_by_user_id(_list_all(client, db_id, ig_accounts_collection_id))

        counts = {
            "signup_reminded": 0,
            "expiring_reminded": 0,
            "expired_reminded": 0,
            "skipped": 0,
            "errors": 0,
        }

        for user_doc in user_docs:
            user_id = str(_obj_get(user_doc, "$id", "") or "").strip()
            if not user_id:
                continue

            try:
                prefs = _with_retry(lambda: users.get_prefs(user_id)) or {}
                profile_doc = profile_map.get(user_id) or {}
                user_accounts = accounts_by_user.get(user_id, [])
                reminder_type = _resolve_reminder_type(
                    user_doc,
                    profile_doc,
                    prefs,
                    user_accounts,
                    now,
                    signup_reminder_delay_hours,
                    expiry_reminder_lead_days,
                )
                if not reminder_type:
                    counts["skipped"] += 1
                    continue

                user_name = str(_obj_get(user_doc, "name", "there") or "there").strip() or "there"
                expires_at = _parse_iso_datetime(_obj_get(profile_doc, "expires_at"))
                subscription_status = _normalize_subscription_status(_obj_get(profile_doc, "plan_status"))

                if not dry_run:
                    _send_reminder_email(messaging, user_id, reminder_type, user_name, expires_at)
                    updated_prefs = _build_updated_prefs(prefs, reminder_type, now, expires_at, subscription_status)
                    _with_retry(lambda: users.update_prefs(user_id=user_id, prefs=updated_prefs))
                counts[f"{reminder_type}_reminded"] += 1
            except Exception as err:  # noqa: BLE001
                counts["errors"] += 1
                context.error(f"instagram-link-reminders failed for user {user_id}: {err}")

        return context.res.json({"status": "success", "dry_run": dry_run, **counts})
    except Exception as err:  # noqa: BLE001
        context.error(f"instagram-link-reminders failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
