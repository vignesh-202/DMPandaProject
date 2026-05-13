import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from appwrite.client import Client
from appwrite.id import ID
from appwrite.query import Query
from appwrite.services.messaging import Messaging

sys.path.insert(0, str(Path(__file__).resolve().parent))
from email_template import escape_html, render_email_html

PAGE_SIZE = 100
MAX_RETRIES = 3
RETRY_SLEEP_SECONDS = 0.2
SUPPORT_EMAIL = "support@dmpanda.com"
STORY_MAX_AGE_HOURS = 25


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _env(key: str, default: str = "") -> str:
    return str(os.environ.get(key, default) or "").strip()


def _parse_request_body(context):
    raw = getattr(getattr(context, "req", None), "body", None)
    if raw in (None, ""):
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(str(raw))
    except Exception:  # noqa: BLE001
        return {}


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


def _parse_iso_datetime(value: str):
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


def _delete_related(client: Client, db_id: str, collection_id: str, automation_id: str):
    deleted = 0
    failed = 0
    while True:
        page = _with_retry(
            lambda: _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{collection_id}/documents",
                {"queries": [Query.equal("automation_id", automation_id), Query.limit(PAGE_SIZE)]},
            )
        )
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break
        progressed = 0
        for row in docs:
            doc_id = str(_obj_get(row, "$id", "") or "").strip()
            if not doc_id:
                continue
            try:
                _with_retry(
                    lambda: _call_appwrite(
                        client,
                        "delete",
                        f"/databases/{db_id}/collections/{collection_id}/documents/{doc_id}",
                    )
                )
                deleted += 1
                progressed += 1
            except Exception:  # noqa: BLE001
                failed += 1
        if progressed == 0:
            break
    return deleted, failed


def _delete_automation_artifacts(
    client: Client,
    db_id: str,
    automation_id: str,
    *,
    keywords_collection: str,
    keyword_index_collection: str,
    collector_destinations_collection: str,
):
    deleted_index, failed_index = _delete_related(client, db_id, keyword_index_collection, automation_id)
    deleted_keywords, failed_keywords = _delete_related(client, db_id, keywords_collection, automation_id)
    deleted_destinations, failed_destinations = _delete_related(client, db_id, collector_destinations_collection, automation_id)
    return {
        "deleted_keyword_index": deleted_index,
        "failed_keyword_index": failed_index,
        "deleted_keywords": deleted_keywords,
        "failed_keywords": failed_keywords,
        "deleted_collect_destinations": deleted_destinations,
        "failed_collect_destinations": failed_destinations,
    }


def _ensure_collections_exist(client: Client, db_id: str, collection_ids):
    checked = []
    for collection_id in collection_ids:
        safe_collection_id = str(collection_id or "").strip()
        if not safe_collection_id:
            continue
        _with_retry(
            lambda cid=safe_collection_id: _call_appwrite(
                client,
                "get",
                f"/databases/{db_id}/collections/{cid}",
            )
        )
        checked.append(safe_collection_id)
    return checked


def _get_ig_account(client: Client, db_id: str, ig_collection: str, account_id: str):
    safe = str(account_id or "").strip()
    if not safe:
        return None
    page = _with_retry(
        lambda: _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{ig_collection}/documents",
            {"queries": [Query.equal("ig_user_id", safe), Query.limit(1)]},
        )
    )
    docs = _obj_get(page, "documents", []) or []
    if docs:
        return docs[0]

    page = _with_retry(
        lambda: _call_appwrite(
            client,
            "get",
            f"/databases/{db_id}/collections/{ig_collection}/documents",
            {"queries": [Query.equal("account_id", safe), Query.limit(1)]},
        )
    )
    docs = _obj_get(page, "documents", []) or []
    return docs[0] if docs else None


def _media_exists(media_id: str, ig_account: dict):
    safe_media_id = str(media_id or "").strip()
    token = str(_obj_get(ig_account, "access_token", "") or "").strip()
    if not safe_media_id or not token:
        return True

    api_version = _env("IG_API_VERSION", "v24.0")
    url = f"https://graph.instagram.com/{api_version}/{safe_media_id}"
    try:
        response = requests.get(url, params={"fields": "id", "access_token": token}, timeout=10)
    except Exception:  # noqa: BLE001
        return True

    if 200 <= response.status_code < 300:
        return True
    if response.status_code == 404:
        return False

    try:
        body = response.json() or {}
    except Exception:  # noqa: BLE001
        body = {}

    err = body.get("error") or {}
    message = str(err.get("message") or "").lower()
    if response.status_code == 400 and any(
        x in message for x in ["unknown", "cannot be found", "does not exist", "deleted"]
    ):
        return False
    return True


def _list_active_story_ids(ig_account: dict):
    token = str(_obj_get(ig_account, "access_token", "") or "").strip()
    if not token:
        return None

    api_version = _env("IG_API_VERSION", "v24.0")
    url = f"https://graph.instagram.com/{api_version}/me/stories"
    params = {
        "fields": "id",
        "access_token": token,
    }

    try:
        response = requests.get(url, params=params, timeout=10)
    except Exception:  # noqa: BLE001
        return None

    if not (200 <= response.status_code < 300):
        return None

    try:
        body = response.json() or {}
    except Exception:  # noqa: BLE001
        return None

    rows = body.get("data") or []
    return {
        str(_obj_get(row, "id", "") or "").strip()
        for row in rows
        if str(_obj_get(row, "id", "") or "").strip()
    }


def _story_should_exist(
    automation: dict,
    ig_account: dict,
    active_story_cache: dict,
    now: datetime,
    context,
):
    account_id = str(_obj_get(automation, "account_id", "") or "").strip()
    media_id = str(_obj_get(automation, "media_id", "") or "").strip()
    created_at = _parse_iso_datetime(_obj_get(automation, "$createdAt", ""))
    age_cutoff = now - timedelta(hours=STORY_MAX_AGE_HOURS)

    if account_id not in active_story_cache:
        active_story_cache[account_id] = _list_active_story_ids(ig_account)

    active_story_ids = active_story_cache.get(account_id)
    if active_story_ids is not None:
        exists = media_id in active_story_ids
        context.log(
            f"Story audit media_id={media_id} account_id={account_id} "
            f"active_count={len(active_story_ids)} exists={exists}"
        )
        return exists

    if created_at and created_at <= age_cutoff:
        context.log(
            f"Story audit fallback-expire media_id={media_id} account_id={account_id} "
            f"created_at={created_at.isoformat()}"
        )
        return False

    context.log(
        f"Story audit fallback-keep media_id={media_id} account_id={account_id} "
        f"created_at={(created_at.isoformat() if created_at else 'unknown')}"
    )
    return True


def _send_report_email(messaging: Messaging, user_id: str, rows: list[dict], ts: str):
    subject = f"Automation Cleanup Report: {len(rows)} invalid automations removed"
    frontend_origin = str(_env("FRONTEND_ORIGIN") or "").rstrip("/")
    dashboard_url = f"{frontend_origin}/dashboard" if frontend_origin else ""
    detail_rows = "".join(
        "<tr>"
        f"<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;\">{escape_html(_obj_get(row, 'title') or _obj_get(row, 'automation_id') or '')}</td>"
        f"<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;\">{escape_html(_obj_get(row, 'automation_type') or 'automation')}</td>"
        f"<td style=\"padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;\">{escape_html(_obj_get(row, 'reason') or 'Missing Instagram media')}</td>"
        "</tr>"
        for row in rows
    )
    html = render_email_html(
        title="Automation cleanup completed",
        preheader=subject,
        greeting="Hello,",
        intro=f"We audited your Instagram-linked automations and removed {len(rows)} item(s) because the connected media no longer exists or is no longer accessible.",
        callouts=[{
            "tone": "info",
            "title": "What changed",
            "lines": [
                "Related keyword and keyword-index mappings were also removed for each deleted automation."
            ],
        }],
        summary_rows=[
            ("Removed automations", str(len(rows))),
            ("Audit timestamp (UTC)", ts),
            ("Recommended next step", "Review your dashboard and recreate any flows you still need"),
        ],
        body_html=(
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
            'style="margin:0 0 16px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;border-collapse:separate;border-spacing:0;">'
            '<tr style="background:#f8fafc;">'
            '<th align="left" style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;text-transform:uppercase;">Automation</th>'
            '<th align="left" style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;text-transform:uppercase;">Type</th>'
            '<th align="left" style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;text-transform:uppercase;">Reason</th>'
            f'</tr>{detail_rows}</table>'
        ),
        cta_label="Open dashboard",
        cta_url=dashboard_url,
        footer_note="If something looks unexpected, contact support and include the audit timestamp above.",
        frontend_origin=frontend_origin,
    )
    messaging.create_email(
        message_id=ID.unique(),
        subject=subject,
        content=html,
        users=[user_id],
        html=True,
    )


def main(context):
    try:
        request_body = _parse_request_body(context)
        dry_run = request_body.get("dry_run") is True
        client = Client()
        client.set_endpoint(_env("APPWRITE_ENDPOINT"))
        client.set_project(_env("APPWRITE_PROJECT_ID"))
        client.set_key(_env("APPWRITE_API_KEY"))

        messaging = Messaging(client)

        db_id = _env("APPWRITE_DATABASE_ID")
        automations_collection = _env("AUTOMATIONS_COLLECTION_ID", "automations")
        keywords_collection = _env("KEYWORDS_COLLECTION_ID", "keywords")
        keyword_index_collection = _env("KEYWORD_INDEX_COLLECTION_ID", "keyword_index")
        collector_destinations_collection = _env("AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID", "automation_collect_destinations")
        ig_accounts_collection = _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts")
        now = datetime.now(timezone.utc)
        checked_collections = _ensure_collections_exist(
            client,
            db_id,
            [
                automations_collection,
                keywords_collection,
                keyword_index_collection,
                collector_destinations_collection,
                ig_accounts_collection,
                _env("LOGS_COLLECTION_ID", "logs"),
                _env("CHAT_STATES_COLLECTION_ID", "chat_states"),
            ],
        )

        deletions_by_user = {}
        totals = {
            "deleted_automations": 0,
            "deleted_keywords": 0,
            "deleted_keyword_index": 0,
            "deleted_collect_destinations": 0,
            "failed_automations": 0,
            "failed_keywords": 0,
            "failed_keyword_index": 0,
            "failed_collect_destinations": 0,
        }

        automations = _list_all(
            client,
            db_id,
            automations_collection,
            [
                Query.equal("automation_type", ["post", "reel", "story"]),
                Query.is_not_null("media_id"),
                Query.not_equal("media_id", ""),
            ],
        )
        context.log(f"Loaded {len(automations)} media-bound automations for audit")

        ig_cache = {}
        media_cache = {}
        active_story_cache = {}
        for automation in automations:
            automation_id = str(_obj_get(automation, "$id", "") or "").strip()
            media_id = str(_obj_get(automation, "media_id", "") or "").strip()
            account_id = str(_obj_get(automation, "account_id", "") or "").strip()
            user_id = str(_obj_get(automation, "user_id", "") or "").strip()
            automation_type = str(_obj_get(automation, "automation_type", "") or "").strip().lower()
            if not automation_id or not media_id or not account_id:
                continue

            if account_id not in ig_cache:
                ig_cache[account_id] = _get_ig_account(client, db_id, ig_accounts_collection, account_id)
                context.log(
                    f"IG lookup account_id={account_id} found={bool(ig_cache[account_id])}"
                )

            ig_account = ig_cache.get(account_id)
            exists = True
            if ig_account:
                if automation_type == "story":
                    exists = _story_should_exist(automation, ig_account, active_story_cache, now, context)
                else:
                    cache_key = f"{account_id}:{media_id}"
                    if cache_key in media_cache:
                        exists = media_cache[cache_key]
                    else:
                        exists = _media_exists(media_id, ig_account)
                        media_cache[cache_key] = exists
            else:
                context.log(
                    f"Skipping media validation automation_id={automation_id} type={automation_type} "
                    f"account_id={account_id} reason=missing_ig_account"
                )

            if exists:
                continue

            reason = "Linked Instagram media is missing or inaccessible"
            if dry_run:
                artifact_totals = {
                    "deleted_keyword_index": 0,
                    "failed_keyword_index": 0,
                    "deleted_keywords": 0,
                    "failed_keywords": 0,
                    "deleted_collect_destinations": 0,
                    "failed_collect_destinations": 0,
                }
            else:
                artifact_totals = _delete_automation_artifacts(
                    client,
                    db_id,
                    automation_id,
                    keywords_collection=keywords_collection,
                    keyword_index_collection=keyword_index_collection,
                    collector_destinations_collection=collector_destinations_collection,
                )
            totals["deleted_keyword_index"] += artifact_totals["deleted_keyword_index"]
            totals["failed_keyword_index"] += artifact_totals["failed_keyword_index"]
            totals["deleted_keywords"] += artifact_totals["deleted_keywords"]
            totals["failed_keywords"] += artifact_totals["failed_keywords"]
            totals["deleted_collect_destinations"] += artifact_totals["deleted_collect_destinations"]
            totals["failed_collect_destinations"] += artifact_totals["failed_collect_destinations"]

            try:
                if not dry_run:
                    _with_retry(
                        lambda: _call_appwrite(
                            client,
                            "delete",
                            f"/databases/{db_id}/collections/{automations_collection}/documents/{automation_id}",
                        )
                    )
                    totals["deleted_automations"] += 1
                    context.log(
                        f"Deleted automation automation_id={automation_id} type={automation_type} "
                        f"media_id={media_id} user_id={user_id}"
                    )
                if user_id:
                    deletions_by_user.setdefault(user_id, []).append(
                        {
                            "automation_id": automation_id,
                            "automation_type": automation_type,
                            "title": str(_obj_get(automation, "title", "") or ""),
                            "account_id": account_id,
                            "media_id": media_id,
                            "deleted_keywords": artifact_totals["deleted_keywords"],
                            "deleted_keyword_index": artifact_totals["deleted_keyword_index"],
                            "deleted_collect_destinations": artifact_totals["deleted_collect_destinations"],
                            "reason": reason,
                        }
                    )
            except Exception as err:  # noqa: BLE001
                context.error(f"Failed deleting automation {automation_id}: {err}")
                totals["failed_automations"] += 1

        timestamp_iso = now.isoformat(timespec="seconds").replace("+00:00", "Z")
        email_sent = 0
        for user_id, rows in deletions_by_user.items():
            try:
                if not dry_run:
                    _send_report_email(messaging, user_id, rows, timestamp_iso)
                    email_sent += 1
            except Exception as err:  # noqa: BLE001
                context.error(f"Failed sending cleanup report email for user {user_id}: {err}")

        return context.res.json(
            {
                "status": "ok",
                "dry_run": dry_run,
                "timestamp": timestamp_iso,
                "totals": totals,
                "users_with_removals": len(deletions_by_user),
                "emails_sent": email_sent,
                "checked_collections": checked_collections,
            }
        )
    except Exception as err:  # noqa: BLE001
        context.error(f"audit-media-automations failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
