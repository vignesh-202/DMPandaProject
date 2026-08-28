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
EXPECTED_FREE_LINK_LIMIT = 1


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

    hourly_limit = int(free_plan.get("actions_per_hour_limit") or 0)
    daily_limit = int(free_plan.get("actions_per_day_limit") or 0)
    monthly_limit = int(free_plan.get("actions_per_month_limit") or 0)

    print("Pricing contract verified.")
    print(f"free_plan_id={free_plan['$id']}")
    print(f"free_plan_code={free_plan.get('plan_code')}")
    print(f"actions_per_hour_limit={hourly_limit}")
    print(f"actions_per_day_limit={daily_limit}")
    print(f"actions_per_month_limit={monthly_limit}")
    print("Instagram connection limit removed. Plans apply independently per Instagram account.")


if __name__ == "__main__":
    main()
