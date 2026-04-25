#!/usr/bin/env python3
"""Ensure plan benefit boolean attributes exist on pricing and profiles.

Read-only by default. With --apply this only creates missing optional boolean
attributes; it never deletes or changes existing attributes/indexes/data.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from appwrite.client import Client
from appwrite.exception import AppwriteException
from appwrite.services.databases import Databases
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID")

COLLECTION_IDS = [
    os.getenv("PRICING_COLLECTION_ID", "pricing"),
    os.getenv("PROFILES_COLLECTION_ID", "profiles"),
]

BENEFIT_KEYS = [
    "unlimited_contacts",
    "post_comment_dm_automation",
    "post_comment_reply_automation",
    "reel_comment_dm_automation",
    "reel_comment_reply_automation",
    "share_reel_to_dm",
    "share_post_to_dm",
    "super_profile",
    "welcome_message",
    "convo_starters",
    "inbox_menu",
    "dm_automation",
    "story_automation",
    "suggest_more",
    "comment_moderation",
    "global_trigger",
    "mentions",
    "collect_email",
    "instagram_live_automation",
    "priority_support",
    "followers_only",
    "seen_typing",
    "no_watermark",
]

BENEFIT_STORAGE_KEYS = {
    "post_comment_reply_automation": "post_comment_reply",
    "reel_comment_reply_automation": "reel_comment_reply",
}


def benefit_attribute_key(key):
    return f"benefit_{BENEFIT_STORAGE_KEYS.get(key, key)}"


def require_env():
    missing = [
        name for name, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "APPWRITE_DATABASE_ID": DATABASE_ID,
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


def list_attribute_keys(databases, collection_id):
    collection = databases.get_collection(DATABASE_ID, collection_id)
    return {str(attribute.get("key") or "") for attribute in collection.get("attributes", [])}


def wait_for_attribute(databases, collection_id, key, timeout_seconds=45):
    started = time.time()
    while time.time() - started < timeout_seconds:
        collection = databases.get_collection(DATABASE_ID, collection_id)
        for attribute in collection.get("attributes", []):
            if attribute.get("key") == key and attribute.get("status") == "available":
                return True
        time.sleep(1)
    return False


def main():
    parser = argparse.ArgumentParser(description="Ensure pricing/profile benefit boolean attributes.")
    parser.add_argument("--apply", action="store_true", help="Create missing optional benefit boolean attributes.")
    args = parser.parse_args()
    require_env()
    databases = build_databases()
    summary = {"apply": bool(args.apply), "created": [], "existing": [], "failed": []}

    for collection_id in COLLECTION_IDS:
        existing = list_attribute_keys(databases, collection_id)
        for benefit_key in BENEFIT_KEYS:
            attribute_key = benefit_attribute_key(benefit_key)
            item = {"collection": collection_id, "attribute": attribute_key}
            if attribute_key in existing:
                summary["existing"].append(item)
                continue
            if not args.apply:
                summary["created"].append({**item, "dry_run": True})
                continue
            try:
                databases.create_boolean_attribute(
                    DATABASE_ID,
                    collection_id,
                    attribute_key,
                    False,
                    False,
                    False,
                )
                wait_for_attribute(databases, collection_id, attribute_key)
                summary["created"].append(item)
            except AppwriteException as error:
                if "already exists" in str(error).lower() or getattr(error, "code", None) == 409:
                    summary["existing"].append(item)
                else:
                    summary["failed"].append({**item, "error": str(error)})

    print(json.dumps({
        "apply": summary["apply"],
        "created": len(summary["created"]),
        "existing": len(summary["existing"]),
        "failed": len(summary["failed"]),
        "details": summary,
    }, indent=2, sort_keys=True))
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
