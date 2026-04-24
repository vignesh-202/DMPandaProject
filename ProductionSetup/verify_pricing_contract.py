import argparse
import os
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
PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")

FREE_PLAN_CODE = "free"
EXPECTED_FREE_LINK_LIMIT = 10


def require_env():
    missing = [
        key
        for key, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "DATABASE_ID": DATABASE_ID,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}")


def build_databases():
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return Databases(client)


def get_free_plan(databases: Databases):
    result = databases.list_documents(
        DATABASE_ID,
        PRICING_COLLECTION_ID,
        [Query.equal("plan_code", FREE_PLAN_CODE), Query.limit(1)],
    )
    return (result.get("documents") or [None])[0]


def main():
    parser = argparse.ArgumentParser(description="Verify or enforce the production pricing contract.")
    parser.add_argument("--apply", action="store_true", help="Update the free-plan instagram_link_limit to the contract value.")
    args = parser.parse_args()

    require_env()
    databases = build_databases()
    free_plan = get_free_plan(databases)
    if not free_plan:
        raise SystemExit("Pricing collection is missing the free plan row.")

    if "instagram_connections_limit" not in free_plan or "instagram_link_limit" not in free_plan:
        raise SystemExit("Free plan row is missing instagram_connections_limit or instagram_link_limit.")

    active_limit = int(free_plan.get("instagram_connections_limit") or 0)
    linked_limit = int(free_plan.get("instagram_link_limit") or 0)

    if args.apply and linked_limit != EXPECTED_FREE_LINK_LIMIT:
        free_plan = databases.update_document(
            DATABASE_ID,
            PRICING_COLLECTION_ID,
            free_plan["$id"],
            {"instagram_link_limit": EXPECTED_FREE_LINK_LIMIT},
        )
        linked_limit = int(free_plan.get("instagram_link_limit") or 0)

    if linked_limit != EXPECTED_FREE_LINK_LIMIT:
        raise SystemExit(
            f"Free plan instagram_link_limit is {linked_limit}, expected {EXPECTED_FREE_LINK_LIMIT}."
        )

    print("Pricing contract verified.")
    print(f"free_plan_id={free_plan['$id']}")
    print(f"free_plan_code={free_plan.get('plan_code')}")
    print(f"instagram_connections_limit={active_limit}")
    print(f"instagram_link_limit={linked_limit}")
    print("instagram_link_limit and instagram_connections_limit remain separate stored fields.")


if __name__ == "__main__":
    main()
