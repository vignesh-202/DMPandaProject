import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from appwrite.client import Client
from appwrite.query import Query
from appwrite.services.databases import Databases
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = Path(__file__).resolve().with_name(".env")

load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID")

PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")
PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")
TRANSACTIONS_COLLECTION_ID = os.getenv("TRANSACTIONS_COLLECTION_ID", "transactions")

PAGE_SIZE = 100
DEFAULT_FREE_PLAN = "free"
SUCCESS_TRANSACTION_STATUSES = {"success", "paid", "captured", "completed", "active"}


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _normalize_plan_code(value):
    return str(value or "").strip().lower() or DEFAULT_FREE_PLAN


def _parse_dt(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _to_iso(value):
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _list_all(databases, collection_id, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        current_queries = list(base_queries) + [Query.limit(PAGE_SIZE)]
        if cursor:
            current_queries.append(Query.cursor_after(cursor))
        result = databases.list_documents(DATABASE_ID, collection_id, queries=current_queries)
        docs = _obj_get(result, "documents", []) or []
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(_obj_get(docs[-1], "$id", "") or "").strip() or None
        if not cursor:
            break
    return rows


def _load_pricing_plan_codes(databases):
    rows = _list_all(databases, PRICING_COLLECTION_ID)
    return {
        _normalize_plan_code(_obj_get(row, "plan_code") or _obj_get(row, "name"))
        for row in rows
    }


def _transaction_user_id(transaction):
    return str(_obj_get(transaction, "userId") or _obj_get(transaction, "user_id") or "").strip()


def _transaction_status(transaction):
    return str(
        _obj_get(transaction, "status")
        or _obj_get(transaction, "payment_status")
        or _obj_get(transaction, "gateway_status")
        or ""
    ).strip().lower()


def _transaction_created_at(transaction):
    return (
        _parse_dt(_obj_get(transaction, "paid_at"))
        or _parse_dt(_obj_get(transaction, "created_at"))
        or _parse_dt(_obj_get(transaction, "$createdAt"))
    )


def _transaction_plan_code(transaction):
    return _normalize_plan_code(
        _obj_get(transaction, "planCode")
        or _obj_get(transaction, "plan_code")
        or _obj_get(transaction, "planName")
        or _obj_get(transaction, "plan_name")
    )


def _transaction_expiry_date(transaction):
    return _parse_dt(_obj_get(transaction, "expiry_date"))


def _build_profile_report(profile, pricing_plan_codes, user_transactions):
    plan_code = _normalize_plan_code(_obj_get(profile, "plan_code"))
    expiry_date = _parse_dt(_obj_get(profile, "expiry_date"))
    plan_source = str(_obj_get(profile, "plan_source") or "").strip().lower() or None
    now = datetime.now(timezone.utc)
    derived_status = "inactive"
    if plan_code != DEFAULT_FREE_PLAN and expiry_date:
        derived_status = "active" if expiry_date > now else "expired"

    latest_valid_transaction = None
    for transaction in sorted(
        user_transactions,
        key=lambda entry: _transaction_created_at(entry) or datetime.fromtimestamp(0, tz=timezone.utc),
        reverse=True
    ):
        if _transaction_status(transaction) not in SUCCESS_TRANSACTION_STATUSES:
            continue
        transaction_plan_code = _transaction_plan_code(transaction)
        transaction_expiry_date = _transaction_expiry_date(transaction)
        if transaction_plan_code == DEFAULT_FREE_PLAN or not transaction_expiry_date:
            continue
        latest_valid_transaction = {
            "plan_code": transaction_plan_code,
            "expiry_date": _to_iso(transaction_expiry_date),
            "is_currently_valid": transaction_expiry_date > now
        }
        break

    problems = []
    if plan_code not in pricing_plan_codes:
        problems.append("unknown_plan_code")
    if plan_source not in {None, "payment", "admin", "system"}:
        problems.append("unknown_plan_source")
    if plan_code == DEFAULT_FREE_PLAN and expiry_date is not None:
        problems.append("free_plan_should_not_have_expiry")
    if plan_code != DEFAULT_FREE_PLAN and expiry_date is None:
        problems.append("paid_plan_missing_expiry")

    return {
        "profile_id": _obj_get(profile, "$id"),
        "user_id": str(_obj_get(profile, "user_id") or _obj_get(profile, "$id") or "").strip() or None,
        "plan_code": plan_code,
        "expiry_date": _to_iso(expiry_date),
        "plan_source": plan_source,
        "derived_status": derived_status,
        "latest_valid_transaction": latest_valid_transaction,
        "problems": problems
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate a subscription consistency report using only plan_code, expiry_date, and plan_source."
    )
    parser.add_argument("--apply", action="store_true", help="Not supported. This script is report-only.")
    parser.add_argument("--dry-run", action="store_true", help="Explicit no-op mode.")
    parser.add_argument(
        "--report",
        default=str(ROOT_DIR / "docs" / "subscription-migration-report.json"),
        help="Path for JSON report output.",
    )
    args = parser.parse_args()
    if args.apply:
        raise SystemExit("This script is report-only. Use live admin/backend flows for subscription updates.")

    missing_env = [
        key for key, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "DATABASE_ID": DATABASE_ID,
        }.items()
        if not value
    ]
    if missing_env:
        raise SystemExit(f"Missing env vars: {', '.join(missing_env)}")

    client = Client().set_endpoint(APPWRITE_ENDPOINT).set_project(APPWRITE_PROJECT_ID).set_key(APPWRITE_API_KEY)
    databases = Databases(client)

    pricing_plan_codes = _load_pricing_plan_codes(databases)
    profiles = _list_all(databases, PROFILES_COLLECTION_ID)
    transactions = _list_all(databases, TRANSACTIONS_COLLECTION_ID)

    transactions_by_user = {}
    for transaction in transactions:
        user_id = _transaction_user_id(transaction)
        if not user_id:
            continue
        transactions_by_user.setdefault(user_id, []).append(transaction)

    rows = [
        _build_profile_report(
            profile,
            pricing_plan_codes,
            transactions_by_user.get(str(_obj_get(profile, "user_id") or _obj_get(profile, "$id") or "").strip(), [])
        )
        for profile in profiles
    ]

    report = {
        "summary": {
            "scanned_profiles": len(rows),
            "profiles_with_problems": sum(1 for row in rows if row["problems"]),
            "active_profiles": sum(1 for row in rows if row["derived_status"] == "active"),
            "expired_profiles": sum(1 for row in rows if row["derived_status"] == "expired"),
            "free_profiles": sum(1 for row in rows if row["plan_code"] == DEFAULT_FREE_PLAN),
        },
        "rows": rows,
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], indent=2))
    print(f"Report written to {report_path}")


if __name__ == "__main__":
    main()
