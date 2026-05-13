import os
import json
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.query import Query

PAGE_SIZE = 100


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


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    try:
        return value[key]
    except Exception:  # noqa: BLE001
        pass
    return getattr(value, key, default)


def _list_documents(client: Client, db_id: str, collection_id: str, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _delete_document(client: Client, db_id: str, collection_id: str, document_id: str):
    return _call_appwrite(
        client,
        "delete",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


def _delete_older_than(client: Client, db_id: str, collection_id: str, field: str, cutoff_iso: str):
    deleted = 0
    failed = 0
    while True:
        page = _list_documents(client, db_id, collection_id, [Query.less_than(field, cutoff_iso), Query.limit(PAGE_SIZE)])
        docs = _obj_get(page, "documents", []) or []
        if not docs:
            break

        progressed = 0
        for doc in docs:
            doc_id = str(_obj_get(doc, "$id", "") or "").strip()
            if not doc_id:
                continue
            try:
                _delete_document(client, db_id, collection_id, doc_id)
                deleted += 1
                progressed += 1
            except Exception:  # noqa: BLE001
                failed += 1

        if progressed == 0:
            break
    return deleted, failed


def _parse_json(value, default=None):
    if value is None:
        return {} if default is None else default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except Exception:  # noqa: BLE001
        return {} if default is None else default


def _normalize_destination_type(value) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized == "webhook" else ""


def _list_all_documents(client: Client, db_id: str, collection_id: str, queries=None, page_size: int = PAGE_SIZE, max_pages: int = 20):
    base_queries = list(queries or [])
    documents = []
    offset = 0
    page = 0
    while page < max_pages:
        response = _list_documents(client, db_id, collection_id, base_queries + [Query.limit(page_size), Query.offset(offset)])
        docs = _obj_get(response, "documents", []) or []
        if not docs:
            break
        documents.extend(docs)
        if len(docs) < page_size:
            break
        offset += len(docs)
        page += 1
    return documents


def _normalize_verified_destinations(collector_doc):
    config = _parse_json(_obj_get(collector_doc, "config_json") or _obj_get(collector_doc, "template_content"), {})
    webhooks = config.get("webhooks") if isinstance(config, dict) else []
    verified_webhooks = {
        str(_obj_get(entry, "id", "") or "").strip()
        for entry in (webhooks or [])
        if _obj_get(entry, "webhook_verified") is True and str(_obj_get(entry, "webhook_url", "") or "").strip()
    }
    return {"webhook": verified_webhooks}


def _resolve_collect_email_destination(automation_doc):
    config = _parse_json(_obj_get(automation_doc, "config_json") or _obj_get(automation_doc, "template_content"), {})
    scoped = config.get("collect_email_destination") if isinstance(config, dict) else None
    if isinstance(scoped, dict) and scoped.get("scoped") is True:
        return {
            "type": _normalize_destination_type(scoped.get("type")),
            "id": str(scoped.get("id") or "").strip(),
        }
    row_type = _normalize_destination_type(
        _obj_get(automation_doc, "collect_email_destination_type", "")
        or (config.get("collect_email_destination_type") if isinstance(config, dict) else "")
    )
    row_id = str(
        _obj_get(automation_doc, "collect_email_destination_id", "")
        or (config.get("collect_email_destination_id") if isinstance(config, dict) else "")
    ).strip()
    return {"type": row_type, "id": row_id}


def _is_collect_email_link_error(log_doc) -> bool:
    payload = _parse_json(_obj_get(log_doc, "payload"), {})
    send_error = payload.get("send_error") if isinstance(payload, dict) else {}
    code = str(_obj_get(send_error, "code", "") or "").strip().lower()
    message = str(_obj_get(log_doc, "message", "") or "").strip().lower()
    return (
        code in {
            "destination_not_linked",
            "destination_missing",
            "collect_email_destination_not_linked",
            "collect_email_destination_missing",
        }
        or "destination is no longer linked" in message
        or "destination is not linked" in message
    )


def _delete_resolved_collect_email_errors(client: Client, db_id: str, logs_collection: str, automations_collection: str):
    deleted = 0
    failed = 0
    skipped = 0
    checked = 0

    failed_logs = _list_all_documents(
        client,
        db_id,
        logs_collection,
        queries=[Query.equal("status", "failed"), Query.order_desc("sent_at")],
        page_size=PAGE_SIZE,
        max_pages=20,
    )

    collector_cache = {}
    automation_cache = {}

    for log_doc in failed_logs:
        if not _is_collect_email_link_error(log_doc):
            continue
        checked += 1
        payload = _parse_json(_obj_get(log_doc, "payload"), {})
        automation_id = str(payload.get("trigger_automation_id") or _obj_get(log_doc, "automation_id", "") or "").strip()
        account_id = str(_obj_get(log_doc, "account_id", "") or "").strip()
        if not automation_id or not account_id:
            skipped += 1
            continue

        automation_doc = automation_cache.get(automation_id)
        if automation_doc is None:
            try:
                automation_doc = _call_appwrite(
                    client,
                    "get",
                    f"/databases/{db_id}/collections/{automations_collection}/documents/{automation_id}",
                )
            except Exception:  # noqa: BLE001
                automation_doc = False
            automation_cache[automation_id] = automation_doc

        if automation_doc is False:
            try:
                _delete_document(client, db_id, logs_collection, str(_obj_get(log_doc, "$id", "")))
                deleted += 1
            except Exception:  # noqa: BLE001
                failed += 1
            continue

        if _obj_get(automation_doc, "is_active") is not True or _obj_get(automation_doc, "collect_email_enabled") is not True:
            try:
                _delete_document(client, db_id, logs_collection, str(_obj_get(log_doc, "$id", "")))
                deleted += 1
            except Exception:  # noqa: BLE001
                failed += 1
            continue

        collector_doc = collector_cache.get(account_id)
        if collector_doc is None:
            response = _list_documents(
                client,
                db_id,
                automations_collection,
                [
                    Query.equal("account_id", account_id),
                    Query.equal("automation_type", "email_collector"),
                    Query.limit(5),
                ],
            )
            docs = _obj_get(response, "documents", []) or []
            collector_doc = docs[0] if docs else False
            collector_cache[account_id] = collector_doc

        verified = _normalize_verified_destinations(collector_doc if collector_doc is not False else {})
        destination = _resolve_collect_email_destination(automation_doc)
        if destination["type"] and destination["id"] and destination["id"] in verified.get(destination["type"], set()):
            try:
                _delete_document(client, db_id, logs_collection, str(_obj_get(log_doc, "$id", "")))
                deleted += 1
            except Exception:  # noqa: BLE001
                failed += 1
        else:
            skipped += 1

    return {
        "checked": checked,
        "deleted": deleted,
        "failed": failed,
        "skipped": skipped,
    }


def _scan_resolved_collect_email_errors(client: Client, db_id: str, logs_collection: str):
    checked = 0
    matches = 0
    failed_logs = _list_all_documents(
        client,
        db_id,
        logs_collection,
        queries=[Query.equal("status", "failed"), Query.order_desc("sent_at")],
        page_size=PAGE_SIZE,
        max_pages=20,
    )
    for log_doc in failed_logs:
        if _is_collect_email_link_error(log_doc):
            checked += 1
            matches += 1
    return {
        "checked": checked,
        "deleted": 0,
        "failed": 0,
        "skipped": 0,
        "would_delete": matches,
    }


def main(context):
    try:
        request_body = _parse_request_body(context)
        dry_run = request_body.get("dry_run") is True
        client = Client()
        client.set_endpoint(_env("APPWRITE_ENDPOINT"))
        client.set_project(_env("APPWRITE_PROJECT_ID"))
        client.set_key(_env("APPWRITE_API_KEY"))

        db_id = _env("APPWRITE_DATABASE_ID")
        logs_collection = _env("LOGS_COLLECTION_ID", "logs")
        chat_states_collection = _env("CHAT_STATES_COLLECTION_ID", "chat_states")
        automations_collection = _env("AUTOMATIONS_COLLECTION_ID", "automations")

        logs_cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        chat_states_cutoff_iso = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(timespec="milliseconds").replace("+00:00", "Z")

        if dry_run:
            old_logs = _list_documents(client, db_id, logs_collection, [Query.less_than("sent_at", logs_cutoff_iso), Query.limit(PAGE_SIZE)])
            old_states = _list_documents(client, db_id, chat_states_collection, [Query.less_than("last_seen_at", chat_states_cutoff_iso), Query.limit(PAGE_SIZE)])
            collect_email_cleanup = _scan_resolved_collect_email_errors(
                client,
                db_id,
                logs_collection,
            )
            logs_deleted = 0
            logs_failed = 0
            states_deleted = 0
            states_failed = 0
            collect_email_cleanup["would_delete_logs_sample"] = len(_obj_get(old_logs, "documents", []) or [])
            collect_email_cleanup["would_delete_states_sample"] = len(_obj_get(old_states, "documents", []) or [])
        else:
            logs_deleted, logs_failed = _delete_older_than(client, db_id, logs_collection, "sent_at", logs_cutoff_iso)
            states_deleted, states_failed = _delete_older_than(client, db_id, chat_states_collection, "last_seen_at", chat_states_cutoff_iso)
            collect_email_cleanup = _delete_resolved_collect_email_errors(
                client,
                db_id,
                logs_collection,
                automations_collection,
            )

        return context.res.json(
            {
                "status": "ok",
                "dry_run": dry_run,
                "logs_cutoff": logs_cutoff_iso,
                "chat_states_cutoff": chat_states_cutoff_iso,
                "logs_deleted": logs_deleted,
                "logs_failed": logs_failed,
                "chat_states_deleted": states_deleted,
                "chat_states_failed": states_failed,
                "collect_email_notifications_checked": collect_email_cleanup["checked"],
                "collect_email_notifications_deleted": collect_email_cleanup["deleted"],
                "collect_email_notifications_failed": collect_email_cleanup["failed"],
                "collect_email_notifications_skipped": collect_email_cleanup["skipped"],
            }
        )
    except Exception as err:  # noqa: BLE001
        context.error(f"cleanup-logs-chat-state failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
