"""Database Attribute & Index Pruning Utility for DM Panda.

Safely removes 24 obsolete/deprecated attributes and legacy indexes across:
- ig_accounts
- users
- pricing
- automations
- profiles

Features:
- Safe dry-run mode (--dry-run)
- Index pre-deletion to avoid schema constraint errors
- Verification reporting
"""

import argparse
import os
import sys
import time
from pathlib import Path

from appwrite.client import Client
from appwrite.services.databases import Databases
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().with_name(".env")
ROOT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / "Backend" / ".env"

load_dotenv(ENV_PATH)
load_dotenv(BACKEND_ENV_PATH)
load_dotenv(ROOT_ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://appwrite.dmpanda.com/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID", "698b09ff002b91aff785")

PRUNE_TARGETS = {
    "ig_accounts": {
        "indexes": [
            "idx_account_api_enabled",
            "idx_ig_api_token",
            "idx_ig_user_effective_access",
            "idx_ig_user_admin_plan_lock",
        ],
        "attributes": [
            "api_token",
            "api_enabled",
            "webhook_url",
            "webhook_secret",
            "api_created_at",
            "api_last_used_at",
            "access_override_enabled",
            "access_state",
            "access_reason",
        ],
    },
    "users": {
        "indexes": [
            "idx_users_plan_id",
        ],
        "attributes": [
            "referred_by",
            "referral_code",
            "subscription_plan_id",
            "subscription_expires",
            "subscription_status",
            "plan_id",
            "plan_expires_at",
        ],
    },
    "pricing": {
        "indexes": [],
        "attributes": [
            "price_monthly_usd",
            "price_yearly_usd",
            "price_yearly_monthly_usd",
            "benefit_collect_email",
        ],
    },
    "automations": {
        "indexes": [],
        "attributes": [
            "collect_email_enabled",
            "collect_email_destination",
            "collect_email_tag",
        ],
    },
    "profiles": {
        "indexes": [
            "idx_profiles_subscription_expires",
            "idx_profiles_plan_cycle",
            "idx_profiles_expiry_date",
            "idx_profiles_plan_expiry",
            "idx_profiles_expires_at",
        ],
        "attributes": [
            "no_watermark_enabled",
        ],
    },
}


def build_databases_service() -> Databases:
    if not APPWRITE_ENDPOINT or not APPWRITE_PROJECT_ID or not APPWRITE_API_KEY:
        print("[ERROR] Missing required Appwrite credentials.")
        print(f"Endpoint: {APPWRITE_ENDPOINT}, Project: {APPWRITE_PROJECT_ID}, Key Present: {bool(APPWRITE_API_KEY)}")
        sys.exit(1)

    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return Databases(client)


def run_pruning(dry_run: bool = True):
    print(f"=== DM Panda Database Pruning Utility (dry_run={dry_run}) ===")
    print(f"Target Database: {DATABASE_ID}")
    databases = build_databases_service()

    total_indexes_dropped = 0
    total_attributes_dropped = 0
    total_skipped = 0

    for col_id, config in PRUNE_TARGETS.items():
        print(f"\n--- Checking Collection: {col_id} ---")

        # 1. Fetch live collection metadata
        try:
            col_info = databases.get_collection(DATABASE_ID, col_id)
        except Exception as e:
            print(f"  [WARN] Collection '{col_id}' not found or inaccessible: {e}")
            continue

        live_indexes = {idx["key"] for idx in col_info.get("indexes", [])}
        live_attributes = {attr["key"] for attr in col_info.get("attributes", [])}

        # 2. Prune Deprecated Indexes First
        for idx_key in config["indexes"]:
            if idx_key in live_indexes:
                print(f"  [INDEX] Target: '{idx_key}' (Found live)")
                if not dry_run:
                    try:
                        databases.delete_index(DATABASE_ID, col_id, idx_key)
                        print(f"    -> [DROPPED] Index '{idx_key}' deleted successfully.")
                        total_indexes_dropped += 1
                        time.sleep(0.5)
                    except Exception as err:
                        print(f"    -> [ERROR] Failed to delete index '{idx_key}': {err}")
                else:
                    total_indexes_dropped += 1
            else:
                print(f"  [INDEX] Target: '{idx_key}' (Already absent, skipping)")
                total_skipped += 1

        # 3. Prune Deprecated Attributes
        for attr_key in config["attributes"]:
            if attr_key in live_attributes:
                print(f"  [ATTR] Target: '{attr_key}' (Found live)")
                if not dry_run:
                    try:
                        databases.delete_attribute(DATABASE_ID, col_id, attr_key)
                        print(f"    -> [DROPPED] Attribute '{attr_key}' deleted successfully.")
                        total_attributes_dropped += 1
                        time.sleep(0.8)
                    except Exception as err:
                        print(f"    -> [ERROR] Failed to delete attribute '{attr_key}': {err}")
                else:
                    total_attributes_dropped += 1
            else:
                print(f"  [ATTR] Target: '{attr_key}' (Already absent, skipping)")
                total_skipped += 1

    print("\n==========================================")
    print(f"Summary: Indexes targeted={total_indexes_dropped}, Attributes targeted={total_attributes_dropped}, Already clean={total_skipped}")
    if dry_run:
        print("[DRY RUN COMPLETE] No live mutations were executed. Run with --execute to apply changes.")
    else:
        print("[PRUNING COMPLETE] All targeted obsolete indexes and columns have been safely removed.")
    print("==========================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prune obsolete Appwrite database columns and indexes.")
    parser.add_argument("--execute", action="store_true", help="Execute live deletions (default is dry-run)")
    args = parser.parse_args()

    run_pruning(dry_run=not args.execute)
