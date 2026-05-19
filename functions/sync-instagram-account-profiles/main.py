import os
from typing import Dict, List

import requests
from appwrite.client import Client
from appwrite.query import Query


IG_GRAPH_URL = "https://graph.instagram.com/v24.0/me"


def _env(key: str, default: str = "") -> str:
    if key in os.environ and str(os.environ[key]).strip():
        return str(os.environ[key]).strip()
    runtime_key_map = {
        "APPWRITE_ENDPOINT": "APPWRITE_FUNCTION_API_ENDPOINT",
        "APPWRITE_PROJECT_ID": "APPWRITE_FUNCTION_PROJECT_ID",
        "APPWRITE_API_KEY": "APPWRITE_FUNCTION_API_KEY",
    }
    runtime_key = runtime_key_map.get(key)
    if runtime_key and runtime_key in os.environ and str(os.environ[runtime_key]).strip():
        return str(os.environ[runtime_key]).strip()
    function_key = key.replace("APPWRITE_", "APPWRITE_FUNCTION_")
    if function_key in os.environ and str(os.environ[function_key]).strip():
        return str(os.environ[function_key]).strip()
    legacy_function_key = key.replace("APPWRITE_", "FUNCTION_APPWRITE_")
    if legacy_function_key in os.environ and str(os.environ[legacy_function_key]).strip():
        return str(os.environ[legacy_function_key]).strip()
    return str(default or "").strip()


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


def _fetch_all_documents(client, db_id, collection_id) -> List[Dict]:
    documents: List[Dict] = []
    cursor = None

    while True:
        queries = [Query.limit(100), Query.order_asc("$id")]
        if cursor:
            queries.append(Query.cursor_after(cursor))

        response = _list_documents(client, db_id, collection_id, queries=queries)
        page = response.get("documents", [])
        documents.extend(page)
        if len(page) < 100:
            break
        cursor = page[-1].get("$id")
        if not cursor:
            break

    return documents


def _normalize_account_status(account: Dict) -> str:
    return str(account.get("status") or "active").strip().lower() or "active"


def _should_sync_account(account: Dict) -> bool:
    return _normalize_account_status(account) in {"active", "inactive"} and bool(account.get("access_token"))


def _fetch_profile_snapshot(access_token: str) -> Dict:
    response = requests.get(
        IG_GRAPH_URL,
        params={
            "fields": "user_id,username,name,profile_picture_url",
            "access_token": access_token,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json() or {}


def _build_patch(account: Dict, snapshot: Dict) -> Dict:
    patch = {}

    profile_picture_url = snapshot.get("profile_picture_url")
    username = snapshot.get("username")
    name = snapshot.get("name")
    user_id = snapshot.get("user_id")

    if profile_picture_url is not None and profile_picture_url != account.get("profile_picture_url"):
        patch["profile_picture_url"] = profile_picture_url or ""
    if username is not None and username != account.get("username"):
        patch["username"] = username or ""
    if name is not None and name != account.get("name"):
        patch["name"] = name or ""
    if user_id is not None:
        user_id = str(user_id)
        if user_id and user_id != str(account.get("ig_user_id") or ""):
            patch["ig_user_id"] = user_id
        if user_id and user_id != str(account.get("account_id") or ""):
            patch["account_id"] = user_id

    return patch


def main(context):
    try:
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

        collection_id = _env("IG_ACCOUNTS_COLLECTION_ID", "ig_accounts")

        accounts = _fetch_all_documents(client, db_id, collection_id)
        candidates = [account for account in accounts if _should_sync_account(account)]
        context.log(f"Found {len(candidates)} Instagram accounts eligible for profile sync.")

        synced = 0
        updated = 0
        failed = 0
        failures = []

        for account in candidates:
            username = str(account.get("username") or "").strip() or account.get("$id")
            try:
                snapshot = _fetch_profile_snapshot(account["access_token"])
                patch = _build_patch(account, snapshot)
                if patch:
                    _update_document(client, db_id, collection_id, account["$id"], patch)
                    updated += 1
                synced += 1
                context.log(f"Synced Instagram profile for @{username}")
            except Exception as err:
                failed += 1
                failures.append({
                    "account_id": account.get("$id"),
                    "username": account.get("username") or "",
                    "error": str(err),
                })
                context.error(f"Failed syncing Instagram profile for @{username}: {err}")

        return context.res.json(
            {
                "status": "done",
                "scanned": len(accounts),
                "eligible": len(candidates),
                "synced": synced,
                "updated": updated,
                "failed": failed,
                "failures": failures[:25],
            }
        )
    except Exception as err:
        context.error(f"Error in Instagram account profile sync job: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
