import json
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


def _parse_body(context):
    payload = getattr(getattr(context, "req", None), "body", None)
    if isinstance(payload, dict):
        return payload
    try:
        return json.loads(str(payload or "{}"))
    except Exception:
        return {}


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
        f'<div style="margin:24px 0 16px;">'
        f'<a href="{account_settings_url}" style="display:inline-block;padding:12px 24px;background:#0f172a;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">Reconnect Instagram</a>'
        f'</div>'
        if account_settings_url
        else ""
    )
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reconnect Instagram — DM Panda</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Action required: Reconnect your Instagram account @{safe_username} to resume automations.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.04);">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <span style="font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">DM Panda</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Action Required</span>
                    </td>
                  </tr>
                </table>
                <h1 style="margin:18px 0 0;color:#0f172a;font-size:21px;font-weight:700;line-height:1.3;letter-spacing:-0.015em;">Instagram Reconnection Needed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 20px;">
                <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">DM Panda was unable to access your connected Instagram account due to an expired or revoked session token.</p>
                <div style="margin:0 0 18px;padding:14px 16px;background:#fef2f2;border:1px solid #fecdd3;border-radius:12px;">
                  <p style="margin:0 0 6px;color:#9f1239;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Account Details</p>
                  <p style="margin:0 0 4px;color:#9f1239;font-size:13px;line-height:1.6;"><strong>Instagram Account:</strong> @{safe_username}</p>
                  <p style="margin:0;color:#9f1239;font-size:13px;line-height:1.6;">Automations and message listeners for this account are paused until you re-authenticate.</p>
                </div>
                <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">Please reconnect this Instagram account from your account settings to restore your automations immediately.</p>
                {cta_html}
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">If you connect a different Instagram account, DM Panda will keep the paused account inactive and treat the new one as a separate linked profile.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="border-top:1px solid #f1f5f9;padding-top:20px;color:#94a3b8;font-size:12px;line-height:1.65;">
                  <p style="margin:0 0 6px;">Need assistance? Contact support@dmpanda.com.</p>
                  <p style="margin:0;color:#94a3b8;">DM Panda &bull; Instagram automation & lead capture</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
    messaging.create_email(
        message_id=ID.unique(),
        subject="Action Required: Reconnect Instagram to resume your DM Panda automations",
        content=html,
        users=[user_id],
        html=True,
    )


def _mark_account_reconnect_required(client, db_id, account, messaging, context, reason=""):
    doc_id = account.get("$id")
    username = account.get("username")
    user_id = str(account.get("user_id") or "").strip()
    reauth_email_sent_at = account.get("reauth_email_sent_at")

    patch = {
        "status": "inactive",
        "reauth_required": True,
        "permissions": _append_reconnect_permission_marker(account.get("permissions")),
        "deactivation_reason": (reason or "Instagram token invalid or refresh failed")[:255]
    }

    should_send_email = bool(user_id and not reauth_email_sent_at)
    if should_send_email:
        from datetime import datetime, timezone
        patch["reauth_email_sent_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    _update_document_with_unknown_attribute_retry(client, db_id, "ig_accounts", doc_id, patch)

    if should_send_email:
        try:
            _send_reconnect_email(messaging, user_id, username, client, db_id)
            context.log(f"Sent re-authorization email to user {user_id} for @{username}")
        except Exception as email_error:
            context.error(f"Failed to send reconnect email for @{username}: {str(email_error)}")
    else:
        context.log(f"Skipped duplicate re-authorization email for @{username} (already notified at {reauth_email_sent_at})")


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

        body = _parse_body(context)
        action = str(body.get("action") or "").strip().lower()

        if action in {"validate_account", "validate"}:
            account_doc_id = str(body.get("account_doc_id") or "").strip()
            account_id = str(body.get("account_id") or "").strip()
            account = None

            if account_doc_id:
                try:
                    account = _call_appwrite(
                        client,
                        "get",
                        f"/databases/{db_id}/collections/ig_accounts/documents/{account_doc_id}",
                    )
                except Exception as doc_err:
                    context.error(f"Failed to fetch account by doc id {account_doc_id}: {doc_err}")

            if not account and account_id:
                res = _list_documents(
                    client,
                    db_id,
                    "ig_accounts",
                    queries=[Query.equal("account_id", account_id), Query.limit(1)],
                )
                docs = res.get("documents", []) or []
                if docs:
                    account = docs[0]

            if not account:
                return context.res.json({"status": "not_found", "message": "Instagram account document not found"}, 404)

            current_token = account.get("access_token")
            username = account.get("username")
            if not current_token:
                _mark_account_reconnect_required(client, db_id, account, messaging, context, reason="No access token present on account")
                return context.res.json({
                    "status": "invalid",
                    "reauth_required": True,
                    "message": "No access token present on account",
                    "username": username
                })

            if dry_run:
                return context.res.json({
                    "status": "dry_run",
                    "account_id": account.get("account_id"),
                    "username": username
                })

            try:
                probe_res = requests.get(
                    "https://graph.instagram.com/me",
                    params={"fields": "id,username", "access_token": current_token},
                    timeout=15,
                )
                probe_data = probe_res.json() if probe_res.content else {}

                if probe_res.status_code == 200 and probe_data.get("id"):
                    _update_document_with_unknown_attribute_retry(client, db_id, "ig_accounts", account.get("$id"), {
                        "status": "active",
                        "permissions": _remove_reconnect_permission_marker(account.get("permissions")),
                        "reauth_required": False,
                        "reauth_email_sent_at": None,
                        "deactivation_reason": None,
                    })
                    context.log(f"Validated token successfully for @{username} (active)")
                    return context.res.json({
                        "status": "valid",
                        "account_id": account.get("account_id"),
                        "username": username,
                        "reauth_required": False
                    })
                else:
                    err_info = probe_data.get("error", {})
                    err_msg = err_info.get("message") or f"HTTP {probe_res.status_code}"
                    err_code = err_info.get("code")
                    is_auth_error = probe_res.status_code in {400, 401} or err_code in {190, 102} or "OAuthException" in str(err_info.get("type", "")) or "token" in err_msg.lower()

                    if is_auth_error:
                        _mark_account_reconnect_required(client, db_id, account, messaging, context, reason=f"Meta validation failed: {err_msg}")
                        return context.res.json({
                            "status": "invalid",
                            "reauth_required": True,
                            "error": err_msg,
                            "error_code": err_code,
                            "username": username
                        })
                    else:
                        context.error(f"Meta non-auth error for @{username}: {err_msg}")
                        return context.res.json({
                            "status": "meta_error",
                            "message": err_msg
                        }, 502)

            except requests.exceptions.RequestException as net_err:
                context.error(f"Transient network error during validate_account probe for @{username}: {str(net_err)}")
                return context.res.json({"status": "transient_error", "message": str(net_err)}, 503)

        accounts = []
        for account in _list_all_documents(client, db_id, "ig_accounts"):
            status = str(account.get("status") or "active").strip().lower()
            permissions = str(account.get("permissions") or "").lower()
            reauth_required = account.get("reauth_required") is True or RECONNECT_PERMISSION_MARKER in permissions
            if status == "inactive" and reauth_required:
                context.log(f"Skipped Instagram token refresh because account is already inactive requiring re-auth. (@{account.get('username')})")
                continue
            if status in {"active", "inactive"} and account.get("access_token"):
                accounts.append(account)

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
                        "reauth_required": False,
                        "reauth_email_sent_at": None,
                        "deactivation_reason": None,
                        **({"token_expires_at": token_expires_at} if token_expires_at else {})
                    })
                    context.log(f"Successfully refreshed token for @{username}")
                    refreshed_count += 1
                else:
                    err_msg = data.get('error', {}).get('message', 'Unknown error')
                    _mark_account_reconnect_required(client, db_id, account, messaging, context, reason=f"Meta refresh failed: {err_msg}")
                    context.error(f"Failed to refresh token for @{username}: {err_msg}")
                    error_count += 1
            except requests.exceptions.RequestException as net_err:
                # Transient network error - do NOT mark account inactive!
                context.error(f"Transient network error refreshing token for @{username} (preserved existing status): {str(net_err)}")
                error_count += 1
            except Exception as error:
                context.error(f"Unexpected error refreshing token for @{username}: {str(error)}")
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
