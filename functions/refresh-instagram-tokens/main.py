import os
import re
import requests
from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from appwrite.services.messaging import Messaging

PAGE_SIZE = 100
RECONNECT_REQUIRED_REASON = "reconnect_required"
RECONNECT_PERMISSION_MARKER = "dm_panda_reconnect_required"
SYSTEM_CONFIG_COLLECTION_ID = "system_config"
FRONTEND_RUNTIME_ORIGIN_DOC_ID = "frontend_runtime_origin"


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


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _list_documents(client, db_id, collection_id, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _update_document(client, db_id, collection_id, document_id, data):
    return _call_appwrite(
        client,
        "patch",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
        {"data": data},
    )


def _extract_unknown_attribute_name(error) -> str:
    message = str(getattr(error, "message", "") or error or "")
    match = re.search(r'Unknown attribute:\s*"([^"]+)"', message, flags=re.IGNORECASE)
    return str(match.group(1) or "").strip() if match else ""


def _update_document_with_unknown_attribute_retry(client, db_id, collection_id, document_id, data):
    payload = dict(data or {})
    removed = set()

    while True:
        try:
            return _update_document(client, db_id, collection_id, document_id, payload)
        except Exception as error:
            unknown_attribute = _extract_unknown_attribute_name(error)
            if not unknown_attribute or unknown_attribute in removed or unknown_attribute not in payload:
                raise
            del payload[unknown_attribute]
            removed.add(unknown_attribute)


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _request_header_map(context):
    req = getattr(context, "req", None)
    headers = getattr(req, "headers", None)
    pairs = []
    if isinstance(headers, dict):
        pairs = headers.items()
    elif isinstance(headers, list):
        pairs = [
            (_obj_get(item, "name", ""), _obj_get(item, "value", ""))
            for item in headers
        ]
    return {
        str(key or "").strip().lower(): str(value or "").strip().lower()
        for key, value in pairs
        if str(key or "").strip()
    }


def _is_dry_run_request(context):
    headers = _request_header_map(context)
    return headers.get("x-dry-run") in {"1", "true", "yes", "on"}


def _list_all_documents(client, db_id, collection_id):
    rows = []
    cursor = None
    while True:
        queries = [Query.limit(PAGE_SIZE), Query.order_asc("$id")]
        if cursor:
            queries.append(Query.cursor_after(cursor))
        result = _list_documents(client, db_id, collection_id, queries=queries)
        documents = result.get("documents", []) or []
        if not documents:
            break
        rows.extend(documents)
        if len(documents) < PAGE_SIZE:
            break
        cursor = str(_obj_get(documents[-1], "$id", "") or "").strip()
        if not cursor:
            break
    return rows


def _resolve_frontend_origin(client=None, db_id: str = "") -> str:
    if client and db_id:
        try:
            document = _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{SYSTEM_CONFIG_COLLECTION_ID}/documents/{FRONTEND_RUNTIME_ORIGIN_DOC_ID}",
            )
            runtime_origin = str(_obj_get(document, "updated_by", "") or "").rstrip("/")
            if runtime_origin.startswith(("http://", "https://")):
                return runtime_origin
        except Exception:
            pass
    return str(_env("FRONTEND_ORIGIN") or "").rstrip("/")


def _build_dashboard_account_settings_url(client=None, db_id: str = "") -> str:
    frontend_origin = _resolve_frontend_origin(client, db_id)
    if not frontend_origin:
        return ""
    return f"{frontend_origin}/dashboard/account-settings"


def _append_reconnect_permission_marker(raw_permissions) -> str:
    parts = [
        str(item or "").strip()
        for item in str(raw_permissions or "").split(",")
        if str(item or "").strip()
    ]
    if RECONNECT_PERMISSION_MARKER not in parts:
        parts.append(RECONNECT_PERMISSION_MARKER)
    return ",".join(parts)[:1024]


def _remove_reconnect_permission_marker(raw_permissions) -> str:
    parts = [
        str(item or "").strip()
        for item in str(raw_permissions or "").split(",")
        if str(item or "").strip() and str(item or "").strip() != RECONNECT_PERMISSION_MARKER
    ]
    return ",".join(parts)[:1024]


def _send_reconnect_email(messaging: Messaging, user_id: str, username: str, client=None, db_id: str = ""):
    account_settings_url = _build_dashboard_account_settings_url(client, db_id)
    safe_username = str(username or "your Instagram account").strip() or "your Instagram account"
    cta_html = (
        f'<div style="margin:28px 0 16px;">'
        f'<a href="{account_settings_url}" style="display:inline-block;padding:14px 22px;background:#f97316;border:1px solid #ea580c;border-radius:999px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Reconnect Instagram</a>'
        f'</div>'
        if account_settings_url
        else ""
    )
    html = f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7deea;border-radius:28px;overflow:hidden;">
      <div style="padding:30px 32px 26px;background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 42%,#b91c1c 100%);">
        <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);color:#fee2e2;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">DM Panda Alert</div>
        <h1 style="margin:16px 0 0;color:#ffffff;font-size:31px;line-height:1.2;">Instagram reconnection needed</h1>
        <p style="margin:10px 0 0;color:#fecaca;font-size:14px;line-height:1.7;">Automation is paused until the same account is linked again.</p>
      </div>
      <div style="padding:30px 32px 28px;">
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.75;">DM Panda was unable to access your connected Instagram account.</p>
        <div style="margin:0 0 20px;padding:16px 18px;background:#fff1f2;border:1px solid #fda4af;border-radius:16px;">
          <p style="margin:0 0 10px;color:#be123c;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Account details</p>
          <p style="margin:0 0 10px;color:#be123c;font-size:14px;line-height:1.7;"><strong>Instagram account:</strong> @{safe_username}</p>
          <p style="margin:0;color:#be123c;font-size:14px;line-height:1.7;">Automations for this account are currently stopped until you reconnect it.</p>
        </div>
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.75;">Please reconnect this Instagram account from your DM Panda settings so automations can continue.</p>
        {cta_html}
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">If you connect a different Instagram account, DM Panda will keep the paused account inactive and treat the new one as a separate linked account.</p>
      </div>
    </div>
  </body>
</html>"""
    messaging.create_email(
        message_id=ID.unique(),
        subject="Reconnect Instagram to restart your DM Panda automations",
        content=html,
        users=[user_id],
        html=True,
    )


def _mark_account_reconnect_required(client, db_id, account, messaging, context):
    doc_id = account.get("$id")
    username = account.get("username")
    user_id = str(account.get("user_id") or "").strip()
    _update_document_with_unknown_attribute_retry(client, db_id, "ig_accounts", doc_id, {
        "status": "inactive",
        "permissions": _append_reconnect_permission_marker(account.get("permissions")),
    })
    if user_id:
        try:
            _send_reconnect_email(messaging, user_id, username, client, db_id)
        except Exception as email_error:
            context.error(f"Failed to send reconnect email for @{username}: {str(email_error)}")


def main(context):
    try:
        dry_run = _is_dry_run_request(context)
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
        messaging = Messaging(client)

        accounts = [
            account
            for account in _list_all_documents(client, db_id, "ig_accounts")
            if str(account.get("status") or "active").strip().lower() in {"active", "inactive"}
        ]
        context.log(f"Found {len(accounts)} linked accounts to refresh.")

        refreshed_count = 0
        error_count = 0

        for account in accounts:
            current_token = account.get("access_token")
            username = account.get("username")

            if not current_token:
                continue

            if dry_run:
                refreshed_count += 1
                continue

            try:
                response = requests.get(
                    "https://graph.instagram.com/refresh_access_token",
                    params={
                        "grant_type": "ig_refresh_token",
                        "access_token": current_token
                    },
                    timeout=30
                )
                data = response.json()

                if response.status_code == 200:
                    new_token = data.get("access_token")
                    expires_in = data.get("expires_in")
                    token_expires_at = None
                    try:
                        if expires_in is not None:
                            from datetime import datetime, timedelta, timezone
                            token_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat().replace("+00:00", "Z")
                    except Exception:
                        token_expires_at = None

                    _update_document_with_unknown_attribute_retry(client, db_id, "ig_accounts", account.get("$id"), {
                        "access_token": new_token,
                        "status": "active",
                        "permissions": _remove_reconnect_permission_marker(account.get("permissions")),
                        **({"token_expires_at": token_expires_at} if token_expires_at else {})
                    })
                    context.log(f"Successfully refreshed token for @{username}")
                    refreshed_count += 1
                else:
                    _mark_account_reconnect_required(client, db_id, account, messaging, context)
                    context.error(f"Failed to refresh token for @{username}: {data.get('error', {}).get('message', 'Unknown error')}")
                    error_count += 1
            except Exception as error:
                try:
                    _mark_account_reconnect_required(client, db_id, account, messaging, context)
                except Exception as patch_error:
                    context.error(f"Failed to mark @{username} as reconnect-required: {str(patch_error)}")
                context.error(f"Network error refreshing token for @{username}: {str(error)}")
                error_count += 1

        return context.res.json({
            "status": "done",
            "dry_run": dry_run,
            "scanned": len(accounts),
            "refreshed": refreshed_count,
            "failed": error_count
        })

    except Exception as error:
        context.error(f"Error in token refresh job: {str(error)}")
        return context.res.json({"status": "error", "message": str(error)}, 500)
