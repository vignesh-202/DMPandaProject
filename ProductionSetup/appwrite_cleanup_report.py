#!/usr/bin/env python3
"""Generate a conservative Appwrite cleanup report.

This script is intentionally read-only. It lists live collections, attributes,
and indexes, then scans the checked-out repository for references so a human can
approve any future deletion script.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from appwrite.client import Client
from appwrite.query import Query
from appwrite.services.databases import Databases
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / "ProductionSetup" / ".env"
DEFAULT_REPORT_PATH = ROOT_DIR / "ProductionSetup" / "reports" / "appwrite-cleanup-report.json"

PROTECTED_COLLECTIONS = {
    "admin_audit_logs",
    "admin_settings",
    "automation_collected_emails",
    "chat_states",
    "comment_moderation",
    "email_campaigns",
    "inactive_user_cleanup_audit",
    "job_locks",
    "logs",
    "payment_attempts",
    "pricing",
    "profiles",
    "settings",
    "transactions",
    "users",
}

SKIP_DIRS = {
    ".git",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
}

TEXT_EXTENSIONS = {
    ".cjs",
    ".css",
    ".env",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

_REPO_TEXT_CACHE: List[Tuple[str, List[str]]] | None = None


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _collection_id(collection: Dict[str, Any]) -> str:
    return str(collection.get("$id") or collection.get("id") or "").strip()


def _attribute_key(attribute: Dict[str, Any]) -> str:
    return str(attribute.get("key") or "").strip()


def _index_key(index: Dict[str, Any]) -> str:
    return str(index.get("key") or "").strip()


def _paginate(fetcher, key: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    limit = 100
    offset = 0
    while True:
        response = fetcher(limit=limit, offset=offset)
        batch = response.get(key, []) if isinstance(response, dict) else []
        items.extend(batch)
        total = int(response.get("total", len(items))) if isinstance(response, dict) else len(items)
        if len(items) >= total or not batch:
            return items
        offset += limit


def _iter_repo_text_files() -> Iterable[Path]:
    for path in ROOT_DIR.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        yield path


def _repo_text_cache() -> List[Tuple[str, List[str]]]:
    global _REPO_TEXT_CACHE
    if _REPO_TEXT_CACHE is not None:
        return _REPO_TEXT_CACHE
    cache: List[Tuple[str, List[str]]] = []
    for path in _iter_repo_text_files():
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        cache.append((path.relative_to(ROOT_DIR).as_posix(), text.splitlines()))
    _REPO_TEXT_CACHE = cache
    return cache


def _find_references(term: str, max_hits: int = 25) -> List[str]:
    needle = str(term or "").strip()
    if not needle:
        return []
    hits: List[str] = []
    for rel, lines in _repo_text_cache():
        if not any(needle in line for line in lines):
            continue
        for line_no, line in enumerate(lines, start=1):
            if needle in line:
                hits.append(f"{rel}:{line_no}")
                if len(hits) >= max_hits:
                    return hits
    return hits


def _classify_collection(collection_id: str, references: List[str]) -> Tuple[str, str]:
    if collection_id in PROTECTED_COLLECTIONS:
        return "keep", "protected runtime, financial, audit, or migration collection"
    if references:
        return "keep", "referenced by checked-in code or scripts"
    return "manual_review", "no direct references found; requires live data and roadmap validation before deletion"


def _classify_attribute(attribute_key: str, references: List[str]) -> Tuple[str, str]:
    if attribute_key in {"plan_id", "plan_expires_at"}:
        return "manual_review", "legacy subscription memory field kept for compatibility and rollback"
    if attribute_key.startswith("benefit_"):
        return "keep", "current plan benefit field"
    if references:
        return "keep", "referenced by checked-in code or scripts"
    return "manual_review", "no direct references found; needs runtime/data validation before removal"


def _classify_index(index: Dict[str, Any], references: List[str]) -> Tuple[str, str]:
    index_key = _index_key(index)
    attributes = [str(item) for item in index.get("attributes", []) or []]
    if index_key.startswith("$"):
        return "keep", "system index"
    if references or any(_find_references(attribute, max_hits=1) for attribute in attributes):
        return "keep", "index key or attributes are referenced by checked-in queries"
    return "manual_review", "no direct query reference found; confirm Appwrite query usage before removal"


def generate_report() -> Dict[str, Any]:
    load_dotenv(ENV_PATH)
    endpoint = _env("APPWRITE_ENDPOINT")
    project_id = _env("APPWRITE_PROJECT_ID")
    api_key = _env("APPWRITE_API_KEY")
    database_id = _env("APPWRITE_DATABASE_ID")
    if not all([endpoint, project_id, api_key, database_id]):
        raise SystemExit("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, or APPWRITE_DATABASE_ID")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)
    databases = Databases(client)

    collections = _paginate(
        lambda limit, offset: databases.list_collections(database_id, queries=[Query.limit(limit), Query.offset(offset)]),
        "collections",
    )
    report_collections = []
    for collection in collections:
        collection_id = _collection_id(collection)
        collection_refs = _find_references(collection_id)
        collection_action, collection_reason = _classify_collection(collection_id, collection_refs)
        attributes = _paginate(
            lambda limit, offset, cid=collection_id: databases.list_attributes(
                database_id,
                cid,
                queries=[Query.limit(limit), Query.offset(offset)],
            ),
            "attributes",
        )
        indexes = _paginate(
            lambda limit, offset, cid=collection_id: databases.list_indexes(
                database_id,
                cid,
                queries=[Query.limit(limit), Query.offset(offset)],
            ),
            "indexes",
        )
        report_attributes = []
        for attribute in attributes:
            key = _attribute_key(attribute)
            refs = _find_references(key)
            action, reason = _classify_attribute(key, refs)
            report_attributes.append({
                "key": key,
                "type": attribute.get("type"),
                "required": bool(attribute.get("required")),
                "status": attribute.get("status"),
                "action": action,
                "reason": reason,
                "references": refs,
            })
        report_indexes = []
        for index in indexes:
            key = _index_key(index)
            refs = _find_references(key)
            action, reason = _classify_index(index, refs)
            report_indexes.append({
                "key": key,
                "type": index.get("type"),
                "attributes": index.get("attributes", []),
                "orders": index.get("orders", []),
                "status": index.get("status"),
                "action": action,
                "reason": reason,
                "references": refs,
            })
        report_collections.append({
            "id": collection_id,
            "name": collection.get("name"),
            "action": collection_action,
            "reason": collection_reason,
            "references": collection_refs,
            "attributes": report_attributes,
            "indexes": report_indexes,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "read_only_report",
        "database_id": database_id,
        "deletion_guard": "No collections, attributes, or indexes are deleted by this script.",
        "collections": report_collections,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a read-only Appwrite database cleanup report.")
    parser.add_argument("--out", default=str(DEFAULT_REPORT_PATH), help="Path for the JSON report.")
    args = parser.parse_args()
    report = generate_report()
    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    collections = report.get("collections", [])
    summary = {
        "collections": len(collections),
        "keep": sum(1 for item in collections if item.get("action") == "keep"),
        "manual_review": sum(1 for item in collections if item.get("action") == "manual_review"),
        "safe_to_delete": sum(1 for item in collections if item.get("action") == "safe_to_delete"),
        "out": str(out_path),
    }
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
