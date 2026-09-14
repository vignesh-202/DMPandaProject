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


def main(context):
    try:
        request_body = _parse_request_body(context)
        dry_run = request_body.get("dry_run") is True
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
        logs_collection = _env("LOGS_COLLECTION_ID", "logs")
        chat_states_collection = _env("CHAT_STATES_COLLECTION_ID", "chat_states")
        automations_collection = _env("AUTOMATIONS_COLLECTION_ID", "automations")

        logs_cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        chat_states_cutoff_iso = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(timespec="milliseconds").replace("+00:00", "Z")

        if dry_run:
            old_logs = _list_documents(client, db_id, logs_collection, [Query.less_than("sent_at", logs_cutoff_iso), Query.limit(PAGE_SIZE)])
            old_states = _list_documents(client, db_id, chat_states_collection, [Query.less_than("last_seen_at", chat_states_cutoff_iso), Query.limit(PAGE_SIZE)])
            logs_deleted = 0
            logs_failed = 0
            states_deleted = 0
            states_failed = 0
        else:
            logs_deleted, logs_failed = _delete_older_than(client, db_id, logs_collection, "sent_at", logs_cutoff_iso)
            states_deleted, states_failed = _delete_older_than(client, db_id, chat_states_collection, "last_seen_at", chat_states_cutoff_iso)

        # Cleanup function execution history
        executions_deleted = 0
        executions_failed = 0
        execution_details = {}

        try:
            funcs_response = _call_appwrite(client, "get", "/functions")
            funcs = _obj_get(funcs_response, "functions", []) or []
            for func in funcs:
                func_id = _obj_get(func, "$id", "")
                if not func_id:
                    continue
                try:
                    execs_response = _call_appwrite(client, "get", f"/functions/{func_id}/executions", {"limit": 100})
                    execs = _obj_get(execs_response, "executions", []) or []
                    execs.sort(key=lambda x: _obj_get(x, "$createdAt", ""), reverse=True)
                    to_delete = execs[5:]
                    func_deleted = 0
                    func_failed = 0
                    for exec_doc in to_delete:
                        exec_id = _obj_get(exec_doc, "$id", "")
                        if not exec_id:
                            continue
                        if not dry_run:
                            try:
                                _call_appwrite(client, "delete", f"/functions/{func_id}/executions/{exec_id}")
                                func_deleted += 1
                            except Exception:  # noqa: BLE001
                                func_failed += 1
                        else:
                            func_deleted += 1
                    executions_deleted += func_deleted
                    executions_failed += func_failed
                    execution_details[func_id] = {
                        "before": len(execs),
                        "deleted": func_deleted,
                        "failed": func_failed,
                        "after": len(execs) - func_deleted if not dry_run else len(execs)
                    }
                except Exception as e:  # noqa: BLE001
                    context.error(f"Failed to clean executions for function {func_id}: {e}")
        except Exception as e:  # noqa: BLE001
            context.error(f"Failed to fetch functions for execution cleanup: {e}")

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
                "executions_deleted": executions_deleted,
                "executions_failed": executions_failed,
                "execution_details": execution_details,
            }
        )
    except Exception as err:  # noqa: BLE001
        context.error(f"cleanup-logs-chat-state failed: {err}")
        return context.res.json({"status": "error", "message": str(err)}, 500)
