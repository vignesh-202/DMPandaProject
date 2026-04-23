import os
import time
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from appwrite.services.messaging import Messaging
from appwrite.services.users import Users

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


def _escape_html(value: str = "") -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


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


def _build_email_html(title: str, paragraphs: list[str], action_label: str, action_url: str) -> str:
    frontend_origin = _trim_trailing_slash(_env("FRONTEND_ORIGIN"))
    logo_url = f"{frontend_origin}/images/logo.png" if frontend_origin else ""
    dashboard_url = f"{frontend_origin}/dashboard" if frontend_origin else ""
    paragraph_html = "".join(
        f'<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.7;">{_escape_html(paragraph)}</p>'
        for paragraph in paragraphs
    )
    action_html = (
        f'<div style="margin:26px 0 14px;">'
        f'<a href="{_escape_html(action_url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;'
        f'padding:14px 22px;border-radius:12px;font-weight:700;font-size:14px;">{_escape_html(action_label)}</a>'
        f"</div>"
        if action_label and action_url
        else ""
    )
    dashboard_html = (
        f'<div style="margin-top:8px;"><a href="{_escape_html(dashboard_url)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Open DM Panda dashboard</a></div>'
        if dashboard_url
        else ""
    )
    logo_html = (
        f'<img src="{_escape_html(logo_url)}" alt="DM Panda" width="52" height="52" style="display:block;border-radius:14px;background:#ffffff;padding:6px;object-fit:contain;" />'
        if logo_url
        else ""
    )
    return f"""
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
                    {logo_html}
                    <p style="margin:18px 0 8px;color:#cbd5e1;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">DM Panda</p>
                    <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;">{_escape_html(title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 32px;">
                    {paragraph_html}
                    {action_html}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px;">
                    <div style="border-top:1px solid #e2e8f0;padding-top:18px;color:#64748b;font-size:13px;line-height:1.6;">
                      Need help? Contact support@dmpanda.com.
                      {dashboard_html}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


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
    expires_at = _parse_iso_datetime(_obj_get(profile_doc, "expires_at") or _obj_get(profile_doc, "subscription_expires"))
    subscription_status = _normalize_subscription_status(
        _obj_get(profile_doc, "subscription_status")
    )

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

    if reminder_type == "expired":
        return {
            "subject": "Your DM Panda subscription is over. Link Instagram when you renew",
            "title": "Subscription ended before Instagram was linked",
            "paragraphs": [
                f"Hi {safe_name}, your DM Panda subscription has ended and no Instagram account was linked during the active period.",
                "When you renew your plan, connect Instagram first so you can immediately use DM automations, comment flows, welcome messages, and lead capture journeys.",
                "Your account settings are ready whenever you want to reconnect and finish setup.",
            ],
            "action_label": "Open Account Settings",
            "action_url": action_url,
        }

    if reminder_type == "expiring":
        expiry_text = expires_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if expires_at else "soon"
        return {
            "subject": "Link Instagram before your DM Panda subscription expires",
            "title": "Your subscription is close to ending",
            "paragraphs": [
                f"Hi {safe_name}, your DM Panda subscription is close to ending, but your Instagram account is still not linked.",
                f"Your current subscription is set to expire on {expiry_text}. Link Instagram before then so you can start using your plan while it is still active.",
                "Once Instagram is connected, you can complete setup directly from the dashboard in a few minutes.",
            ],
            "action_label": "Link Instagram",
            "action_url": action_url,
        }

    return {
        "subject": "Complete your DM Panda setup by linking Instagram",
        "title": "Link Instagram to start your automations",
        "paragraphs": [
            f"Hi {safe_name}, your DM Panda account is ready, but your Instagram account is still not connected.",
            "Connect Instagram to start building welcome automations, keyword replies, comment flows, and lead capture journeys.",
            "This reminder is sent once after your first 24 hours so you can finish setup without repeated nudges.",
        ],
        "action_label": "Link Instagram",
        "action_url": action_url,
    }


def _send_reminder_email(messaging: Messaging, user_id: str, reminder_type: str, user_name: str, expires_at):
    payload = _build_reminder_payload(reminder_type, user_name, expires_at)
    _with_retry(
        lambda: messaging.create_email(
            message_id=ID.unique(),
            subject=payload["subject"],
            content=_build_email_html(
                title=payload["title"],
                paragraphs=payload["paragraphs"],
                action_label=payload["action_label"],
                action_url=payload["action_url"],
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
                expires_at = _parse_iso_datetime(_obj_get(profile_doc, "expires_at") or _obj_get(profile_doc, "subscription_expires"))
                subscription_status = _normalize_subscription_status(
                    _obj_get(profile_doc, "subscription_status")
                )

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
