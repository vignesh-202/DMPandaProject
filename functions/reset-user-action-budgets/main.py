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


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _parse_limits(profile: dict):
    return {
        "hourly_action_limit": _safe_int(_obj_get(profile, "hourly_action_limit"), 0),
        "daily_action_limit": _safe_int(_obj_get(profile, "daily_action_limit"), 0),
        "monthly_action_limit": _safe_int(_obj_get(profile, "monthly_action_limit"), 0),
    }


def _safe_int(value, fallback=0):
    try:
        if value is None:
            return fallback
        return int(float(str(value)))
    except Exception:  # noqa: BLE001
        return fallback


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


def _list_profiles(client: Client, db_id: str, collection_id: str):
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

        db_id = _env("APPWRITE_DATABASE_ID")
        profiles_collection = _env("PROFILES_COLLECTION_ID", "profiles")
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat(timespec="seconds").replace("+00:00", "Z")

        updated = 0
        scanned = 0
        profiles = _list_profiles(client, db_id, profiles_collection)
        for profile in profiles:
            scanned += 1
            profile_id = str(_obj_get(profile, "$id", "") or "").strip()
            if not profile_id:
                continue

            defaults = _parse_limits(profile)
            patch = {}

            for field, default_value in defaults.items():
                current = _safe_int(_obj_get(profile, field), 0)
                if current != default_value:
                    patch[field] = default_value

            windows = [
                ("hourly", timedelta(hours=1)),
                ("daily", timedelta(hours=24)),
                ("monthly", timedelta(days=30)),
            ]
            for prefix, duration in windows:
                used_key = f"{prefix}_actions_used"
                limit_key = f"{prefix}_action_limit"
                window_key = f"{prefix}_window_started_at"

                limit_val = _safe_int(_obj_get(profile, limit_key), _safe_int(patch.get(limit_key), 0))
                used_val = max(0, _safe_int(_obj_get(profile, used_key), 0))
                started_raw = str(_obj_get(profile, window_key) or "").strip()
                try:
                    started_dt = datetime.fromisoformat(started_raw.replace("Z", "+00:00")) if started_raw else None
                except Exception:  # noqa: BLE001
                    started_dt = None

                if not started_dt or (now - started_dt) >= duration:
                    patch[used_key] = 0
                    patch[window_key] = now_iso
                else:
                    patch[used_key] = used_val if limit_val <= 0 else min(used_val, limit_val)

            if patch and not dry_run:
                _update_document(client, db_id, profiles_collection, profile_id, patch)
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
