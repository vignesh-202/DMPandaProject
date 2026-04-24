import os
from datetime import datetime, timezone

from appwrite.client import Client
from appwrite.query import Query
from appwrite.services.databases import Databases
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID") or os.getenv("DATABASE_ID")

USERS_COLLECTION_ID = os.getenv("USERS_COLLECTION_ID", "users")
TRANSACTIONS_COLLECTION_ID = os.getenv("TRANSACTIONS_COLLECTION_ID", "transactions")
PAGE_SIZE = 100


def parse_dt(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def to_iso(value):
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_client():
    missing = [name for name, value in {
        "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
        "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
        "APPWRITE_API_KEY": APPWRITE_API_KEY,
        "DATABASE_ID": DATABASE_ID,
    }.items() if not value]
    if missing:
        raise SystemExit(f"Missing env vars: {', '.join(missing)}")

    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return client


def list_all(databases, collection_id, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        page_queries = [Query.limit(PAGE_SIZE), Query.order_asc("$id"), *base_queries]
        if cursor:
            page_queries.append(Query.cursor_after(cursor))
        response = databases.list_documents(DATABASE_ID, collection_id, page_queries)
        docs = response.get("documents", [])
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(docs[-1].get("$id") or "").strip() or None
        if not cursor:
            break
    return rows


def main():
    databases = Databases(build_client())
    users = list_all(databases, USERS_COLLECTION_ID)
    transactions = list_all(databases, TRANSACTIONS_COLLECTION_ID)

    latest_transaction_by_user = {}
    for transaction in transactions:
        user_id = str(transaction.get("userId") or transaction.get("user_id") or "").strip()
        if not user_id:
            continue
        candidate = (
            parse_dt(transaction.get("transactionDate"))
            or parse_dt(transaction.get("created_at"))
            or parse_dt(transaction.get("$createdAt"))
        )
        if not candidate:
            continue
        current = latest_transaction_by_user.get(user_id)
        if current is None or candidate > current:
            latest_transaction_by_user[user_id] = candidate

    updated = 0
    scanned = 0
    for user in users:
        scanned += 1
        user_id = str(user.get("$id") or "").strip()
        if not user_id:
            continue
        current_last_active = parse_dt(user.get("last_active_at"))
        fallback_last_active = max(
            [value for value in [
                current_last_active,
                parse_dt(user.get("last_login")),
                parse_dt(user.get("first_login")),
                latest_transaction_by_user.get(user_id),
            ] if value],
            default=None
        )
        if not fallback_last_active:
            continue
        if current_last_active and fallback_last_active <= current_last_active:
            continue

        databases.update_document(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            user_id,
            {"last_active_at": to_iso(fallback_last_active)}
        )
        updated += 1

    print(f"scanned={scanned}")
    print(f"updated={updated}")


if __name__ == "__main__":
    main()
