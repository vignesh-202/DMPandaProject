#!/usr/bin/env python3
"""
Script to update Appwrite database pricing collection documents with new prices:
- Basic: 150 monthly / 99 yearly per month (1188 yr)
- Pro: 250 monthly / 199 yearly per month (2388 yr)
- Ultra: 350 monthly / 299 yearly per month (3588 yr)
- Free: 0 monthly / 0 yearly

Also ensures the `subscription_slots` collection exists with correct attributes and indexes.
"""

import json
import os
import sys
import time
from pathlib import Path

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.permission import Permission
from appwrite.role import Role
from appwrite.client import AppwriteException
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID")

if not (APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID and APPWRITE_API_KEY and DATABASE_ID):
    print("[!] Appwrite credentials not set in environment. Skipping remote database update.")
    sys.exit(0)

client = Client()
client.set_endpoint(APPWRITE_ENDPOINT)
client.set_project(APPWRITE_PROJECT_ID)
client.set_key(APPWRITE_API_KEY)
client.set_self_signed(True)

databases = Databases(client)

PRICING_UPDATES = {
    "free": {
        "price_monthly_inr": 0,
        "price_yearly_inr": 0,
        "price_yearly_monthly_inr": 0,
        "benefit_api_access": False,
        "benefit_n8n_flow": False,
        "features": json.dumps([
            "Unlimited Contacts",
            "Post Comment DM Reply",
            "Reel Comment DM Reply",
            "Super Profile",
            "Welcome Message",
            "Convo Starters",
            "Inbox Menu"
        ])
    },
    "basic": {
        "price_monthly_inr": 150,
        "price_yearly_inr": 1188,
        "price_yearly_monthly_inr": 99,
        "benefit_api_access": False,
        "benefit_n8n_flow": False,
        "features": json.dumps([
            "Unlimited Contacts",
            "Post Comment DM Reply",
            "Post Comment Reply Automation",
            "Reel Comment DM Reply",
            "Reel Comment Reply Automation",
            "Share Reel To Admin",
            "Share Post To Admin",
            "Super Profile",
            "Welcome Message",
            "Convo Starters",
            "Inbox Menu",
            "DM Automation",
            "Story Automation",
            "Suggest More",
            "Comment Moderation",
            "Once Per User / 24h"
        ])
    },
    "pro": {
        "price_monthly_inr": 250,
        "price_yearly_inr": 2388,
        "price_yearly_monthly_inr": 199,
        "benefit_api_access": False,
        "benefit_n8n_flow": False,
        "features": json.dumps([
            "Unlimited Contacts",
            "Post Comment DM Reply",
            "Post Comment Reply Automation",
            "Reel Comment DM Reply",
            "Reel Comment Reply Automation",
            "Share Reel To Admin",
            "Share Post To Admin",
            "Super Profile",
            "Welcome Message",
            "Convo Starters",
            "Inbox Menu",
            "DM Automation",
            "Story Automation",
            "Suggest More",
            "Comment Moderation",
            "Seen + Typing",
            "No Watermark",
            "Once Per User / 24h"
        ])
    },
    "ultra": {
        "price_monthly_inr": 350,
        "price_yearly_inr": 3588,
        "price_yearly_monthly_inr": 299,
        "benefit_api_access": True,
        "benefit_n8n_flow": True,
        "features": json.dumps([
            "Unlimited Contacts",
            "Post Comment DM Reply",
            "Post Comment Reply Automation",
            "Reel Comment DM Reply",
            "Reel Comment Reply Automation",
            "Share Reel To Admin",
            "Share Post To Admin",
            "Super Profile",
            "Welcome Message",
            "Convo Starters",
            "Inbox Menu",
            "DM Automation",
            "Story Automation",
            "Suggest More",
            "Comment Moderation",
            "Global Trigger",
            "Mentions",
            "Collect Email",
            "Instagram Live Automation",
            "Priority Support",
            "Followers Only",
            "Seen + Typing",
            "No Watermark",
            "Once Per User / 24h",
            "n8n Flow / Integration",
            "Developer API Access"
        ])
    }
}

def sync_pricing_documents():
    print("[*] Updating 'pricing' collection documents in Appwrite...")

    # Ensure benefit_n8n_flow attribute exists on pricing and profiles collections
    for collection in ["pricing", "profiles"]:
        try:
            databases.create_boolean_attribute(
                DATABASE_ID, collection, "benefit_n8n_flow", False, None
            )
            print(f" [+] Created attribute '{collection}.benefit_n8n_flow'")
            time.sleep(0.5)
        except AppwriteException as err:
            if "already exists" in str(err).lower():
                print(f" [OK] Attribute '{collection}.benefit_n8n_flow' exists.")
            else:
                print(f" [!] Could not create '{collection}.benefit_n8n_flow': {err}")

    try:
        response = databases.list_documents(DATABASE_ID, "pricing", [Query.limit(100)])
        docs = response.get("documents", [])
        for doc in docs:
            plan_code = str(doc.get("plan_code") or "").strip().lower()
            if plan_code in PRICING_UPDATES:
                patch = PRICING_UPDATES[plan_code]
                databases.update_document(DATABASE_ID, "pricing", doc["$id"], patch)
                print(f" [+] Updated '{plan_code}' pricing: monthly={patch['price_monthly_inr']}, yearly={patch['price_yearly_inr']} ({patch['price_yearly_monthly_inr']}/mo)")
    except Exception as err:
        print(f" [!] Error updating pricing collection: {err}")

def ensure_subscription_slots_collection():
    print("[*] Ensuring 'subscription_slots' collection exists in Appwrite...")
    collection_id = "subscription_slots"

    try:
        databases.get_collection(DATABASE_ID, collection_id)
        print(f" [OK] Collection '{collection_id}' already exists.")
    except AppwriteException:
        print(f" [+] Creating collection '{collection_id}'...")
        try:
            databases.create_collection(
                DATABASE_ID,
                collection_id,
                "Subscription Slots",
                permissions=[
                    Permission.read(Role.users()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users()),
                ],
                document_security=False,
            )
            print(f" [OK] Created collection '{collection_id}'.")
        except Exception as err:
            print(f" [!] Failed creating collection '{collection_id}': {err}")
            return

    attributes = [
        {"key": "user_id", "type": "string", "size": 255, "required": True},
        {"key": "plan_code", "type": "string", "size": 32, "required": True},
        {"key": "billing_cycle", "type": "string", "size": 32, "required": False, "default": "monthly"},
        {"key": "status", "type": "string", "size": 32, "required": False, "default": "active"},
        {"key": "expires_at", "type": "datetime", "required": False},
        {"key": "paired_account_id", "type": "string", "size": 255, "required": False},
        {"key": "paired_at", "type": "datetime", "required": False},
        {"key": "transaction_id", "type": "string", "size": 255, "required": False},
        {"key": "created_at", "type": "datetime", "required": True},
        {"key": "updated_at", "type": "datetime", "required": True},
    ]

    for attr in attributes:
        key = attr["key"]
        try:
            if attr["type"] == "string":
                databases.create_string_attribute(
                    DATABASE_ID, collection_id, key, attr["size"], attr["required"], attr.get("default")
                )
            elif attr["type"] == "datetime":
                databases.create_datetime_attribute(
                    DATABASE_ID, collection_id, key, attr["required"], attr.get("default")
                )
            print(f" [+] Created attribute '{collection_id}.{key}'")
            time.sleep(0.2)
        except AppwriteException as err:
            if "already exists" in str(err).lower():
                print(f" [OK] Attribute '{collection_id}.{key}' exists.")
            else:
                print(f" [!] Failed attribute '{collection_id}.{key}': {err}")

    indexes = [
        {"key": "idx_slots_user_id", "type": "key", "attributes": ["user_id"]},
        {"key": "idx_slots_paired_account", "type": "key", "attributes": ["paired_account_id"]},
        {"key": "idx_slots_status_expires", "type": "key", "attributes": ["status", "expires_at"]},
    ]

    for idx in indexes:
        try:
            databases.create_index(
                DATABASE_ID, collection_id, idx["key"], idx["type"], idx["attributes"]
            )
            print(f" [+] Created index '{collection_id}.{idx['key']}'")
            time.sleep(0.2)
        except AppwriteException as err:
            if "already exists" in str(err).lower():
                print(f" [OK] Index '{collection_id}.{idx['key']}' exists.")
            else:
                print(f" [!] Failed index '{collection_id}.{idx['key']}': {err}")

if __name__ == "__main__":
    sync_pricing_documents()
    ensure_subscription_slots_collection()
    print("[+] All database schema & pricing updates complete!")
