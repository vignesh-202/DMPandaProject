#!/usr/bin/env python3
"""Audit and optionally delete orphaned Appwrite rows.

Conservative rules only:
- Delete rows only when required parent references are missing.
- Never delete financial/runtime-critical rows just because they look old.

Usage:
  python ProductionSetup/audit_orphan_rows.py --dry-run
  python ProductionSetup/audit_orphan_rows.py --delete
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set

from appwrite.client import Client
from appwrite.query import Query
from appwrite.services.databases import Databases
from appwrite.services.users import Users
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / "ProductionSetup" / ".env"
DEFAULT_OUTPUT = ROOT_DIR / "reports" / "orphan-row-audit.json"
PAGE_SIZE = 100


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_str(value: Any) -> str:
    return str(value or "").strip()


def _paginate(fetcher: Callable[[int, int], Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    offset = 0
    while True:
        response = fetcher(PAGE_SIZE, offset)
        batch = list(response.get(key, []) or [])
        items.extend(batch)
        total = int(response.get("total", len(items)))
        if not batch or len(items) >= total:
            return items
        offset += PAGE_SIZE


def _load_client() -> tuple[Databases, Users, str]:
    load_dotenv(ENV_PATH)
    endpoint = _env("APPWRITE_ENDPOINT")
    project_id = _env("APPWRITE_PROJECT_ID")
    api_key = _env("APPWRITE_API_KEY")
    database_id = _env("APPWRITE_DATABASE_ID")
    if not all([endpoint, project_id, api_key, database_id]):
        raise SystemExit("Missing Appwrite env vars in ProductionSetup/.env")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)
    return Databases(client), Users(client), database_id


def _list_all_docs(databases: Databases, database_id: str, collection_id: str) -> List[Dict[str, Any]]:
    return _paginate(
        lambda limit, offset: databases.list_documents(
            database_id,
            collection_id,
            queries=[Query.limit(limit), Query.offset(offset)],
        ),
        "documents",
    )


def _list_all_auth_users(users: Users) -> List[Dict[str, Any]]:
    return _paginate(
        lambda limit, offset: users.list(queries=[Query.limit(limit), Query.offset(offset)]),
        "users",
    )


@dataclass
class Context:
    user_doc_ids: Set[str]
    auth_user_ids: Set[str]
    account_doc_ids: Set[str]
    account_ref_ids: Set[str]
    automation_ids: Set[str]


def _build_context(databases: Databases, users: Users, database_id: str) -> Context:
    user_docs = _list_all_docs(databases, database_id, "users")
    auth_users = _list_all_auth_users(users)
    accounts = _list_all_docs(databases, database_id, "ig_accounts")
    automations = _list_all_docs(databases, database_id, "automations")

    account_ref_ids: Set[str] = set()
    for account in accounts:
        for value in (
            account.get("$id"),
            account.get("account_id"),
            account.get("ig_user_id"),
        ):
            safe = _safe_str(value)
            if safe:
                account_ref_ids.add(safe)

    return Context(
        user_doc_ids={_safe_str(item.get("$id")) for item in user_docs if _safe_str(item.get("$id"))},
        auth_user_ids={_safe_str(item.get("$id")) for item in auth_users if _safe_str(item.get("$id"))},
        account_doc_ids={_safe_str(item.get("$id")) for item in accounts if _safe_str(item.get("$id"))},
        account_ref_ids=account_ref_ids,
        automation_ids={_safe_str(item.get("$id")) for item in automations if _safe_str(item.get("$id"))},
    )


def _missing_account(doc: Dict[str, Any], ctx: Context) -> bool:
    account_id = _safe_str(doc.get("account_id"))
    return bool(account_id) and account_id not in ctx.account_ref_ids


def _missing_automation(doc: Dict[str, Any], ctx: Context) -> bool:
    automation_id = _safe_str(doc.get("automation_id"))
    automation_type = _safe_str(doc.get("automation_type"))
    if automation_id.startswith("comment_moderation_") or automation_type.startswith("comment_moderation_"):
        return False
    return bool(automation_id) and automation_id not in ctx.automation_ids


def _missing_user(doc: Dict[str, Any], ctx: Context) -> bool:
    user_id = _safe_str(doc.get("user_id") or doc.get("userId"))
    if not user_id:
        return False
    return user_id not in ctx.user_doc_ids and user_id not in ctx.auth_user_ids


def _collect_reasons(doc: Dict[str, Any], ctx: Context, *, check_user: bool = False, check_account: bool = False, check_automation: bool = False) -> List[str]:
    reasons: List[str] = []
    if check_user and _missing_user(doc, ctx):
        reasons.append("missing user")
    if check_account and _missing_account(doc, ctx):
        reasons.append("missing instagram account")
    if check_automation and _missing_automation(doc, ctx):
        reasons.append("missing automation")
    return reasons


COLLECTION_RULES: Dict[str, Dict[str, Any]] = {
    "automations": {
        "check_user": True,
        "check_account": True,
    },
    "automation_collect_destinations": {
        "check_account": True,
        "check_automation": True,
    },
    "keywords": {
        "check_account": True,
        "check_automation": True,
    },
    "keyword_index": {
        "check_account": True,
        "check_automation": True,
    },
    "reply_templates": {
        "check_user": True,
        "check_account": True,
    },
    "super_profiles": {
        "check_user": True,
        "check_account": True,
    },
    "comment_moderation": {
        "check_user": True,
        "check_account": True,
    },
    "logs": {
        "check_account": True,
    },
    "chat_states": {
        "check_account": True,
    },
}


def audit_orphans(databases: Databases, users: Users, database_id: str) -> Dict[str, Any]:
    ctx = _build_context(databases, users, database_id)
    collections_report: List[Dict[str, Any]] = []

    for collection_id, rule in COLLECTION_RULES.items():
        docs = _list_all_docs(databases, database_id, collection_id)
        orphans: List[Dict[str, Any]] = []
        for doc in docs:
            reasons = _collect_reasons(
                doc,
                ctx,
                check_user=bool(rule.get("check_user")),
                check_account=bool(rule.get("check_account")),
                check_automation=bool(rule.get("check_automation")),
            )
            if not reasons:
                continue
            orphans.append(
                {
                    "id": _safe_str(doc.get("$id")),
                    "reasons": reasons,
                    "user_id": _safe_str(doc.get("user_id") or doc.get("userId")),
                    "account_id": _safe_str(doc.get("account_id")),
                    "automation_id": _safe_str(doc.get("automation_id")),
                    "created_at": doc.get("$createdAt"),
                    "updated_at": doc.get("$updatedAt") or doc.get("updated_at") or doc.get("last_seen_at") or doc.get("sent_at"),
                }
            )
        collections_report.append(
            {
                "collection_id": collection_id,
                "total_documents": len(docs),
                "orphan_count": len(orphans),
                "orphans": orphans,
            }
        )

    return {
        "generated_at": _now_iso(),
        "database_id": database_id,
        "context": {
            "users_docs": len(ctx.user_doc_ids),
            "auth_users": len(ctx.auth_user_ids),
            "ig_accounts": len(ctx.account_doc_ids),
            "account_reference_ids": len(ctx.account_ref_ids),
            "automations": len(ctx.automation_ids),
        },
        "collections": collections_report,
    }


def delete_orphans(databases: Databases, database_id: str, report: Dict[str, Any]) -> Dict[str, Any]:
    deleted: List[Dict[str, Any]] = []
    failed: List[Dict[str, Any]] = []
    for collection in report.get("collections", []):
        collection_id = collection.get("collection_id")
        for orphan in collection.get("orphans", []):
            doc_id = _safe_str(orphan.get("id"))
            if not collection_id or not doc_id:
                continue
            try:
                databases.delete_document(database_id, collection_id, doc_id)
                deleted.append(
                    {
                        "collection_id": collection_id,
                        "id": doc_id,
                        "reasons": orphan.get("reasons", []),
                    }
                )
            except Exception as error:  # pragma: no cover - remote API
                failed.append(
                    {
                        "collection_id": collection_id,
                        "id": doc_id,
                        "reasons": orphan.get("reasons", []),
                        "error": str(error),
                    }
                )
    return {"deleted": deleted, "failed": failed}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true", help="Delete audited orphan rows.")
    parser.add_argument("--dry-run", action="store_true", help="Audit only.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Write JSON report to this path.")
    args = parser.parse_args()

    databases, users, database_id = _load_client()
    report = audit_orphans(databases, users, database_id)

    if args.delete:
        report["deletion"] = delete_orphans(databases, database_id, report)
        report["deleted_at"] = _now_iso()
    else:
        report["deletion"] = {"deleted": [], "failed": []}

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = {
        "generated_at": report["generated_at"],
        "deleted_mode": bool(args.delete),
        "collections_with_orphans": sum(1 for item in report["collections"] if item["orphan_count"] > 0),
        "total_orphans": sum(int(item["orphan_count"]) for item in report["collections"]),
        "deleted": len(report["deletion"]["deleted"]),
        "failed": len(report["deletion"]["failed"]),
        "output": str(output_path),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
