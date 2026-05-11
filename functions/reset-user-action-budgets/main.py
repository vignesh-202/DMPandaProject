import os
from datetime import datetime, timedelta, timezone

from appwrite.client import Client
from appwrite.query import Query

PAGE_SIZE = 100


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


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
    except Exception:  # noqa: BLE001
        return fallback


def _request_header_map(context) -> dict:
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


def _is_dry_run_request(context) -> bool:
    headers = _request_header_map(context)
    return headers.get("x-dry-run") in {"1", "true", "yes", "on"}


def _list_documents(client: Client, db_id: str, collection_id: str, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _update_document(client: Client, db_id: str, collection_id: str, document_id: str, data: dict):
    return _call_appwrite(
        client,
        "patch",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
        {"data": data},
    )


def _list_accounts(client: Client, db_id: str, collection_id: str):
    rows = []
    cursor = None
    while True:
        queries = [Query.limit(PAGE_SIZE), Query.order_asc("$id")]
        if cursor:
            queries.append(Query.cursor_after(cursor))
        page = _list_documents(client, db_id, collection_id, queries=queries)
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


def main(context):
    try:
        dry_run = _is_dry_run_request(context)

        client = Client()
        client.set_endpoint(_env("APPWRITE_ENDPOINT"))
        client.set_project(_env("APPWRITE_PROJECT_ID"))
        client.set_key(_env("APPWRITE_API_KEY"))

        db_id = _env("APPWRITE_DATABASE_ID")
        accounts_collection = _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts")
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat(timespec="seconds").replace("+00:00", "Z")

        updated = 0
        scanned = 0
        accounts = _list_accounts(client, db_id, accounts_collection)
        for account in accounts:
            scanned += 1
            account_id = str(_obj_get(account, "$id", "") or "").strip()
            if not account_id:
                continue

            patch = {}

            windows = [
                ("hourly", timedelta(hours=1)),
                ("daily", timedelta(hours=24)),
                ("monthly", timedelta(days=30)),
            ]
            for prefix, duration in windows:
                used_key = f"{prefix}_actions_used"
                window_key = f"{prefix}_window_started_at"

                used_val = max(0, _safe_int(_obj_get(account, used_key), 0))
                started_raw = str(_obj_get(account, window_key) or "").strip()
                try:
                    started_dt = datetime.fromisoformat(started_raw.replace("Z", "+00:00")) if started_raw else None
                except Exception:  # noqa: BLE001
                    started_dt = None

                if not started_dt or (now - started_dt) >= duration:
                    patch[used_key] = 0
                    patch[window_key] = now_iso
                else:
                    patch[used_key] = used_val

            if patch and not dry_run:
                _update_document(client, db_id, accounts_collection, account_id, patch)
                updated += 1
            elif patch:
                updated += 1

        return context.res.json(
            {
                "status": "ok",
                "dry_run": dry_run,
                "scanned": scanned,
                "updated": updated,
                "timestamp": now_iso,
            }
        )
    except Exception as err:  # noqa: BLE001
        context.error(f"reset-user-action-budgets failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
