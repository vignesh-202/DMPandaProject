import os
import json
from pathlib import Path
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://appwrite.dmpanda.com/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID", "698b02d40000a7c2da7b")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID", "698b09ff002b91aff785")

PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")
SLOTS_COLLECTION_ID = "subscription_slots"

def get_db():
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return Databases(client)

def _list_all(databases, collection_id):
    rows = []
    cursor = None
    page_size = 100
    while True:
        queries = [Query.limit(page_size)]
        if cursor:
            queries.append(Query.cursor_after(cursor))
        try:
            res = databases.list_documents(DATABASE_ID, collection_id, queries=queries)
            docs = res.get("documents", []) if isinstance(res, dict) else getattr(res, "documents", [])
            if not docs:
                break
            rows.extend(docs)
            if len(docs) < page_size:
                break
            last_doc = docs[-1]
            cursor = last_doc.get("$id") if isinstance(last_doc, dict) else getattr(last_doc, "$id", None)
            if not cursor:
                break
        except Exception as e:
            print(f"Error listing {collection_id}: {e}")
            break
    return rows

def _get_val(doc, key, default=None):
    if isinstance(doc, dict):
        return doc.get(key, default)
    return getattr(doc, key, default)

def main():
    db = get_db()
    print("=" * 60)
    print("ANALYZING USER PROFILES & SUBSCRIPTION SLOTS")
    print("=" * 60)

    profiles = _list_all(db, PROFILES_COLLECTION_ID)
    print(f"Total user profiles found: {len(profiles)}")

    updated_profiles_count = 0
    for profile in profiles:
        doc_id = _get_val(profile, "$id")
        user_id = _get_val(profile, "user_id") or _get_val(profile, "userId") or doc_id
        plan_code = str(_get_val(profile, "plan_code") or _get_val(profile, "plan_id") or "").strip().lower()
        admin_override = str(_get_val(profile, "admin_override_json") or "")
        
        needs_update = False
        update_payload = {}

        # Check if plan_code is ultra or contains ultra
        if "ultra" in plan_code or "ultra" in admin_override.lower():
            needs_update = True
        
        # Check all profiles to see plan status
        print(f"User: {user_id} | doc_id: {doc_id} | Current Plan: '{plan_code}' | Admin Override: '{admin_override}'")

        if needs_update or plan_code == "ultra":
            print(f"  --> Resetting user {user_id} ({doc_id}) from 'ultra' to 'free'")
            update_payload["plan_code"] = "free"
            update_payload["plan_name"] = "Free Plan"
            update_payload["plan_source"] = "system"
            update_payload["expiry_date"] = None
            update_payload["admin_override_json"] = None

            try:
                db.update_document(DATABASE_ID, PROFILES_COLLECTION_ID, doc_id, update_payload)
                updated_profiles_count += 1
                print(f"  [SUCCESS] Reset user {user_id} to Free tier.")
            except Exception as e:
                print(f"  [ERROR] Failed to update profile {doc_id}: {e}")

    print(f"\nTotal profiles reset to Free: {updated_profiles_count}")

    # Inspect subscription_slots collection
    print("\n" + "=" * 60)
    print("CHECKING SUBSCRIPTION SLOTS")
    print("=" * 60)
    slots = _list_all(db, SLOTS_COLLECTION_ID)
    print(f"Total subscription slots found: {len(slots)}")

    updated_slots_count = 0
    for slot in slots:
        slot_id = _get_val(slot, "$id")
        plan_code = str(_get_val(slot, "planCode") or _get_val(slot, "plan_code") or "").strip().lower()
        paired_acc = _get_val(slot, "pairedAccountId")
        print(f"Slot: {slot_id} | Plan: '{plan_code}' | Paired Account: {paired_acc}")

        if "ultra" in plan_code:
            print(f"  --> Resetting slot {slot_id} from 'ultra' to 'free'")
            try:
                db.update_document(DATABASE_ID, SLOTS_COLLECTION_ID, slot_id, {
                    "planCode": "free",
                    "status": "expired"
                })
                updated_slots_count += 1
                print(f"  [SUCCESS] Slot {slot_id} updated.")
            except Exception as e:
                print(f"  [ERROR] Failed to update slot {slot_id}: {e}")

    print(f"Total slots updated: {updated_slots_count}")
    
    # Inspect pricing collection
    print("\n" + "=" * 60)
    print("CHECKING PRICING PLANS")
    print("=" * 60)
    PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")
    pricing_plans = _list_all(db, PRICING_COLLECTION_ID)
    print(f"Total pricing plan documents found: {len(pricing_plans)}")
    for plan in pricing_plans:
        p_id = _get_val(plan, "$id")
        p_code = _get_val(plan, "plan_code")
        p_name = _get_val(plan, "name")
        print(f"Pricing Doc: {p_id} | Plan Code: '{p_code}' | Name: '{p_name}'")

    # Inspect transactions collection
    print("\n" + "=" * 60)
    print("CHECKING TRANSACTIONS")
    print("=" * 60)
    TRANSACTIONS_COLLECTION_ID = os.getenv("TRANSACTIONS_COLLECTION_ID", "transactions")
    transactions = _list_all(db, TRANSACTIONS_COLLECTION_ID)
    print(f"Total transaction documents found: {len(transactions)}")
    for tx in transactions:
        t_id = _get_val(tx, "$id")
        t_user = _get_val(tx, "userId") or _get_val(tx, "user_id")
        t_plan = _get_val(tx, "planCode") or _get_val(tx, "plan_code")
        t_status = _get_val(tx, "status")
        print(f"Transaction: {t_id} | User: {t_user} | Plan: {t_plan} | Status: {t_status}")

    print("=" * 60)

if __name__ == "__main__":
    main()
