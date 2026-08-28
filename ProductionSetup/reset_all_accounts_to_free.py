import os
import json
from pathlib import Path
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException

ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://appwrite.dmpanda.com/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID", "698b02d40000a7c2da7b")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID", "698b09ff002b91aff785")

PRICING_COLLECTION_ID = "pricing"
IG_ACCOUNTS_COLLECTION_ID = "ig_accounts"

PLAN_FEATURES_PATH = Path(__file__).resolve().parent.parent / "shared" / "planFeatures.json"

def get_db():
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return Databases(client)

def list_all_docs(db, collection_id):
    docs = []
    cursor = None
    while True:
        queries = [Query.limit(100)]
        if cursor:
            queries.append(Query.cursor_after(cursor))
        try:
            res = db.list_documents(DATABASE_ID, collection_id, queries=queries)
            items = res.get("documents", []) if isinstance(res, dict) else getattr(res, "documents", [])
            if not items:
                break
            docs.extend(items)
            if len(items) < 100:
                break
            cursor = items[-1]["$id"]
        except Exception as e:
            print(f"Error listing {collection_id}: {e}")
            break
    return docs

def delete_pricing_connection_limit_attributes(db):
    print("\n--- 1. REMOVING CONNECTION LIMIT ATTRIBUTES FROM PRICING SCHEMA ---")
    for attr_key in ["instagram_connections_limit", "instagram_link_limit"]:
        try:
            db.delete_attribute(DATABASE_ID, PRICING_COLLECTION_ID, attr_key)
            print(f"[+] Deleted attribute '{attr_key}' from collection '{PRICING_COLLECTION_ID}'")
        except AppwriteException as e:
            print(f"[-] Could not delete attribute '{attr_key}': {e.message}")

def reseed_pricing_plans(db):
    print("\n--- 2. UPDATING PRICING DOCUMENTS IN APPWRITE ---")
    if not PLAN_FEATURES_PATH.exists():
        print(f"[X] Plan features contract not found at {PLAN_FEATURES_PATH}")
        return
    with PLAN_FEATURES_PATH.open("r", encoding="utf-8") as handle:
        contract = json.load(handle)

    plan_catalog = contract.get("planCatalog", {})
    feature_labels = contract.get("featureLabels", {})
    benefit_keys = contract.get("benefitKeys", [])

    for plan_code, definition in plan_catalog.items():
        enabled = set(definition.get("enabledFeatures") or [])
        prices = definition.get("prices") or {}
        limits = definition.get("limits") or {}
        entitlements = {key: key in enabled for key in benefit_keys}

        feature_items = [
            {
                "key": key,
                "label": feature_labels.get(key, key),
                "value": entitlements[key],
            }
            for key in benefit_keys
        ]

        payload = {
            "name": definition.get("name") or plan_code.capitalize(),
            "plan_code": plan_code,
            "price_monthly_inr": int(prices.get("monthly_inr") or 0),
            "price_yearly_inr": int(prices.get("yearly_inr") or 0),
            "price_yearly_monthly_inr": int(prices.get("yearly_monthly_inr") or 0),
            "is_custom": bool(definition.get("is_custom", False)),
            "is_popular": bool(definition.get("is_popular", False)),
            "display_order": int(definition.get("display_order") or 0),
            "button_text": str(definition.get("button_text") or "Choose Plan"),
            "yearly_bonus": str(definition.get("yearly_bonus") or ""),
            "features": json.dumps(
                [feature_labels.get(key, key) for key in benefit_keys if entitlements[key]]
            ),
            "comparison_json": json.dumps(feature_items),
            "monthly_duration_days": 30,
            "yearly_duration_days": 364,
            "actions_per_hour_limit": int(limits.get("actions_per_hour_limit") or 0),
            "actions_per_day_limit": int(limits.get("actions_per_day_limit") or 0),
            "actions_per_month_limit": int(limits.get("actions_per_month_limit") or 0),
        }

        # Check existing doc
        try:
            res = db.list_documents(DATABASE_ID, PRICING_COLLECTION_ID, [Query.equal("plan_code", plan_code), Query.limit(1)])
            docs = res.get("documents", []) if isinstance(res, dict) else getattr(res, "documents", [])
            if docs:
                doc_id = docs[0]["$id"]
                db.update_document(DATABASE_ID, PRICING_COLLECTION_ID, doc_id, payload)
                print(f"[OK] Updated pricing document '{plan_code}' (ID: {doc_id})")
            else:
                db.create_document(DATABASE_ID, PRICING_COLLECTION_ID, plan_code, payload)
                print(f"[+] Created pricing document '{plan_code}'")
        except Exception as e:
            print(f"[X] Failed updating pricing doc '{plan_code}': {e}")

def reset_all_ig_accounts_to_free(db):
    print("\n--- 3. RESETTING ALL IG ACCOUNTS TO FREE PLAN ---")
    accounts = list_all_docs(db, IG_ACCOUNTS_COLLECTION_ID)
    print(f"Total IG accounts found: {len(accounts)}")

    free_payload = {
        "plan_code": "free",
        "plan_name": "Free Plan",
        "billing_cycle": "monthly",
        "subscription_status": "active",
        "expires_at": None,
        "plan_price": 0,
        "paid_at": None,
        "plan_source": "system"
    }

    updated_count = 0
    for acc in accounts:
        doc_id = acc["$id"]
        username = acc.get("username") or acc.get("name") or doc_id
        old_plan = acc.get("plan_code")
        print(f"Updating account {username} (ID: {doc_id}) from '{old_plan}' to 'free'...")
        try:
            db.update_document(DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, doc_id, free_payload)
            updated_count += 1
            print(f"  [SUCCESS] Account {username} set to Free Plan.")
        except Exception as e:
            print(f"  [ERROR] Failed to update account {doc_id}: {e}")

    print(f"\nTotal accounts successfully reset to Free: {updated_count} / {len(accounts)}")

def main():
    print("=" * 60)
    print("STARTING APPWRITE MIGRATION: REMOVE CONNECTION LIMITS & RESET ACCOUNTS")
    print("=" * 60)
    db = get_db()
    delete_pricing_connection_limit_attributes(db)
    reseed_pricing_plans(db)
    reset_all_ig_accounts_to_free(db)
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == "__main__":
    main()
