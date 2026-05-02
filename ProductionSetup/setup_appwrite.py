import argparse
import json
import os
import time
from copy import deepcopy
from pathlib import Path

from appwrite.client import AppwriteException, Client
from appwrite.id import ID
from appwrite.permission import Permission
from appwrite.query import Query
from appwrite.role import Role
from appwrite.services.databases import Databases
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT_DIR / "docs" / "appwrite-schema-live.json"
PLAN_FEATURES_PATH = ROOT_DIR / "shared" / "planFeatures.json"
ENV_PATH = Path(__file__).resolve().with_name(".env")

load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID")

REQUIRED_ENV = {
    "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
    "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
    "APPWRITE_API_KEY": APPWRITE_API_KEY,
    "DATABASE_ID": DATABASE_ID,
}

DEFAULT_COLLECTION_PERMISSIONS = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
]

BENEFIT_KEYS = [
    "unlimited_contacts",
    "post_comment_dm_reply",
    "post_comment_reply_automation",
    "reel_comment_dm_reply",
    "reel_comment_reply_automation",
    "share_reel_to_admin",
    "share_post_to_admin",
    "super_profile",
    "inbox_menu",
    "collect_email",
    "suggest_more",
    "followers_only",
    "once_per_user_24h",
    "comment_moderation",
    "seen_typing",
    "welcome_message",
    "convo_starters",
    "dm_automation",
    "story_automation",
    "no_watermark",
    "global_trigger",
    "mentions",
    "instagram_live_automation",
    "priority_support",
]

BENEFIT_STORAGE_KEYS = {
    "post_comment_reply_automation": "post_comment_reply",
    "reel_comment_reply_automation": "reel_comment_reply",
}


def benefit_attribute_key(key):
    return f"benefit_{BENEFIT_STORAGE_KEYS.get(key, key)}"

BENEFIT_ATTRIBUTES = [
    {"key": benefit_attribute_key(key), "type": "boolean", "required": False, "array": False, "default": False}
    for key in BENEFIT_KEYS
]

EMAIL_CAMPAIGNS_COLLECTION = {
    "id": "email_campaigns",
    "name": "Email Campaigns",
    "enabled": True,
    "documentSecurity": False,
    "permissions": [
        "read(\"label:admin\")",
        "create(\"label:admin\")",
        "update(\"label:admin\")",
        "delete(\"label:admin\")",
    ],
    "attributes": [
        {"key": "admin_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "appwrite_message_id", "type": "string", "size": 255, "required": False, "array": False, "default": None},
        {"key": "subject", "type": "string", "size": 500, "required": True, "array": False, "default": None},
        {
            "key": "status",
            "type": "string",
            "required": False,
            "array": False,
            "default": "sent",
            "elements": ["draft", "queued", "scheduled", "sent", "failed"],
        },
        {"key": "target_total", "type": "integer", "required": False, "array": False, "default": 0},
        {"key": "queued_total", "type": "integer", "required": False, "array": False, "default": 0},
        {"key": "delivered_total", "type": "integer", "required": False, "array": False, "default": 0},
        {"key": "failed_total", "type": "integer", "required": False, "array": False, "default": 0},
        {"key": "scheduled_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "sent_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "created_at", "type": "datetime", "required": True, "array": False, "default": None},
        {"key": "updated_at", "type": "datetime", "required": True, "array": False, "default": None},
        {"key": "segment_key", "type": "string", "size": 120, "required": False, "array": False, "default": "all"},
        {"key": "filters_json", "type": "string", "size": 20000, "required": False, "array": False, "default": None},
        {"key": "metrics_json", "type": "string", "size": 20000, "required": False, "array": False, "default": None},
    ],
    "indexes": [
        {"key": "idx_campaign_created_at", "type": "key", "attributes": ["created_at"], "orders": []},
        {"key": "idx_campaign_status_created", "type": "key", "attributes": ["status", "created_at"], "orders": []},
        {"key": "idx_campaign_admin_created", "type": "key", "attributes": ["admin_id", "created_at"], "orders": []},
        {"key": "idx_campaign_message_id", "type": "key", "attributes": ["appwrite_message_id"], "orders": []},
    ],
}

JOB_LOCKS_COLLECTION = {
    "id": "job_locks",
    "name": "Job Locks",
    "enabled": True,
    "documentSecurity": False,
    "permissions": [
        "read(\"label:admin\")",
        "create(\"label:admin\")",
        "update(\"label:admin\")",
        "delete(\"label:admin\")",
    ],
    "attributes": [
        {"key": "job_name", "type": "string", "size": 120, "required": True, "array": False, "default": None},
        {"key": "run_window", "type": "string", "size": 120, "required": True, "array": False, "default": None},
        {"key": "lock_key", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "expires_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "created_at", "type": "datetime", "required": True, "array": False, "default": None},
    ],
    "indexes": [
        {"key": "idx_job_lock_key", "type": "unique", "attributes": ["lock_key"], "orders": []},
        {"key": "idx_job_name_window", "type": "key", "attributes": ["job_name", "run_window"], "orders": []},
        {"key": "idx_job_lock_expiry", "type": "key", "attributes": ["expires_at"], "orders": []},
    ],
}

INACTIVE_USER_CLEANUP_AUDIT_COLLECTION = {
    "id": "inactive_user_cleanup_audit",
    "name": "Inactive User Cleanup Audit",
    "enabled": True,
    "documentSecurity": False,
    "permissions": [
        "read(\"label:admin\")",
        "create(\"label:admin\")",
        "update(\"label:admin\")",
        "delete(\"label:admin\")",
    ],
    "attributes": [
        {"key": "user_hash", "type": "string", "size": 64, "required": True, "array": False, "default": None},
        {"key": "email_hash", "type": "string", "size": 64, "required": False, "array": False, "default": None},
        {
            "key": "action",
            "type": "string",
            "required": True,
            "array": False,
            "default": None,
            "elements": [
                "warning_30d",
                "warning_7d",
                "warning_1d",
                "warning_final",
                "dry_run_candidate",
                "skip_paid",
                "skip_protected",
                "skip_uncertain",
                "delete_started",
                "delete_completed",
                "delete_failed",
            ],
        },
        {"key": "plan_code", "type": "string", "size": 32, "required": False, "array": False, "default": None},
        {"key": "reason", "type": "string", "size": 255, "required": False, "array": False, "default": None},
        {"key": "last_active_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "scheduled_delete_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "dry_run", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "details_json", "type": "string", "size": 4000, "required": False, "array": False, "default": None},
        {"key": "created_at", "type": "datetime", "required": True, "array": False, "default": None},
    ],
    "indexes": [
        {"key": "idx_cleanup_audit_user_created", "type": "key", "attributes": ["user_hash", "created_at"], "orders": []},
        {"key": "idx_cleanup_audit_action_created", "type": "key", "attributes": ["action", "created_at"], "orders": []},
        {"key": "idx_cleanup_audit_schedule", "type": "key", "attributes": ["scheduled_delete_at"], "orders": []},
    ],
}

SYSTEM_CONFIG_COLLECTION = {
    "id": "system_config",
    "name": "System Config",
    "enabled": True,
    "documentSecurity": False,
    "permissions": [
        "read(\"label:admin\")",
        "create(\"label:admin\")",
        "update(\"label:admin\")",
        "delete(\"label:admin\")",
    ],
    "attributes": [
        {"key": "key", "type": "string", "size": 120, "required": True, "array": False, "default": None},
        {"key": "enabled", "type": "boolean", "required": False, "array": False, "default": True},
        {"key": "type", "type": "string", "size": 32, "required": False, "array": False, "default": "text"},
        {"key": "position", "type": "string", "size": 64, "required": False, "array": False, "default": "secondary_message"},
        {"key": "opacity", "type": "double", "required": False, "array": False, "default": 1.0, "min": 0.0, "max": 1.0},
        {"key": "updated_by", "type": "string", "size": 255, "required": False, "array": False, "default": None},
        {"key": "updated_at", "type": "datetime", "required": False, "array": False, "default": None},
    ],
    "indexes": [
        {"key": "idx_system_config_key", "type": "unique", "attributes": ["key"], "orders": []},
    ],
}

ADDITIONAL_ATTRIBUTES = {
    "users": [
        {"key": "kill_switch_enabled", "type": "boolean", "required": False, "array": False, "default": True},
        {"key": "last_active_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "cleanup_protected", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "cleanup_state_json", "type": "string", "required": False, "array": False, "default": None, "size": 4000},
    ],
    "profiles": [
        {"key": "plan_code", "type": "string", "required": False, "array": False, "default": None, "size": 32},
        {"key": "plan_source", "type": "string", "required": False, "array": False, "default": None, "size": 32},
        {"key": "plan_name", "type": "string", "required": False, "array": False, "default": None, "size": 100},
        {"key": "expiry_date", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "features_json", "type": "string", "required": False, "array": False, "default": None, "size": 600},
        {"key": "paid_plan_snapshot_json", "type": "string", "required": False, "array": False, "default": None, "size": 600},
        {"key": "admin_override_json", "type": "string", "required": False, "array": False, "default": None, "size": 140},
        {"key": "kill_switch_enabled", "type": "boolean", "required": False, "array": False, "default": True},
        *deepcopy(BENEFIT_ATTRIBUTES),
    ],
    "transactions": [
        {"key": "user_id", "type": "string", "required": False, "array": False, "default": None, "size": 255},
        {"key": "plan_code", "type": "string", "required": False, "array": False, "default": None, "size": 32},
        {"key": "expiry_date", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "created_at", "type": "datetime", "required": False, "array": False, "default": None},
        {
            "key": "status",
            "type": "string",
            "required": False,
            "array": False,
            "default": "success",
            "elements": ["created", "success", "paid", "captured", "completed", "failed", "cancelled", "expired", "refunded"],
        },
    ],
    "pricing": [
        {"key": "monthly_duration_days", "type": "integer", "required": False, "array": False, "default": 30, "min": 1, "max": 366},
        {"key": "yearly_duration_days", "type": "integer", "required": False, "array": False, "default": 364, "min": 1, "max": 366},
        *deepcopy(BENEFIT_ATTRIBUTES),
    ],
    "ig_accounts": [
        {"key": "admin_disabled", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "plan_locked", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "access_override_enabled", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "effective_access", "type": "boolean", "required": False, "array": False, "default": True},
        {
            "key": "access_state",
            "type": "string",
            "required": False,
            "array": False,
            "default": "active",
            "elements": ["active", "inactive", "admin_disabled", "plan_locked", "override_enabled"],
        },
        {"key": "access_reason", "type": "string", "required": False, "array": False, "default": None, "size": 120},
    ],
    "coupons": [
        {
            "key": "billing_cycle_targets",
            "type": "string",
            "required": False,
            "array": True,
            "default": None,
            "size": 32,
        },
    ],
    "payment_attempts": [
        {
            "key": "status",
            "type": "string",
            "required": True,
            "array": False,
            "default": "created",
            "elements": ["created", "paid", "failed", "cancelled", "expired"],
        },
    ],
}

REQUIRED_PROFILE_SUBSCRIPTION_ATTRIBUTES = (
    "plan_code",
    "expiry_date",
    "plan_source",
)

ADDITIONAL_INDEXES = {
    "users": [
        {"key": "idx_users_email_search", "type": "fulltext", "attributes": ["email"], "orders": []},
        {"key": "idx_users_name_search", "type": "fulltext", "attributes": ["name"], "orders": []},
        {"key": "idx_users_last_active", "type": "key", "attributes": ["last_active_at"], "orders": []},
        {"key": "idx_users_cleanup_candidate", "type": "key", "attributes": ["cleanup_protected", "last_active_at"], "orders": []},
    ],
    "profiles": [
        {"key": "idx_profiles_expiry_date", "type": "key", "attributes": ["expiry_date"], "orders": []},
        {"key": "idx_profiles_plan_expiry", "type": "key", "attributes": ["plan_code", "expiry_date"], "orders": []},
    ],
    "ig_accounts": [
        {"key": "idx_ig_user_linked_at", "type": "key", "attributes": ["user_id", "linked_at"], "orders": []},
        {"key": "idx_ig_user_effective_access", "type": "key", "attributes": ["user_id", "effective_access"], "orders": []},
        {"key": "idx_ig_user_admin_plan_lock", "type": "key", "attributes": ["user_id", "admin_disabled", "plan_locked"], "orders": []},
    ],
    "payment_attempts": [
        {"key": "idx_payment_attempt_status_created", "type": "key", "attributes": ["status", "created_at"], "orders": []},
        {"key": "idx_pay_att_user_status_created", "type": "key", "attributes": ["user_id", "status", "created_at"], "orders": []},
        {"key": "idx_pay_att_gateway_payment", "type": "key", "attributes": ["gateway_payment_id"], "orders": []},
    ],
    "transactions": [
        {"key": "idx_payment_attempt", "type": "key", "attributes": ["paymentAttemptId"], "orders": []},
        {"key": "idx_gateway_order", "type": "key", "attributes": ["gatewayOrderId"], "orders": []},
        {"key": "idx_transaction_id_unique", "type": "unique", "attributes": ["transactionId"], "orders": []},
        {"key": "idx_transactions_user_id", "type": "key", "attributes": ["user_id"], "orders": []},
        {"key": "idx_transactions_user_created_at", "type": "key", "attributes": ["user_id", "created_at"], "orders": []},
    ],
    "coupons": [
        {"key": "idx_coupons_code_search", "type": "fulltext", "attributes": ["code"], "orders": []},
        {"key": "idx_coupons_active_expiry", "type": "key", "attributes": ["active", "expires_at"], "orders": []},
    ],
}

COLLECTION_OVERRIDES = {}

DEPRECATED_COLLECTIONS = {
    "subscription_reminder_events",
    "affiliate_profiles",
    "referrals",
    "payouts",
    "notification_throttles",
    "worker_locks",
}

DEPRECATED_ATTRIBUTES = {
    "users": {
        "referred_by",
        "referral_code",
        "subscription_plan_id",
        "subscription_expires",
        "subscription_status",
    },
    "profiles": {
        "no_watermark_enabled",
    },
}

DEPRECATED_INDEXES = {}


def _filter_schema_items(collection_id, items, deprecated_items):
    blocked = deprecated_items.get(collection_id, set())
    if not blocked:
        return list(items)
    return [item for item in items if item.get("key") not in blocked]


def require_env():
    missing = [key for key, value in REQUIRED_ENV.items() if not value]
    if missing:
        raise SystemExit(f"Missing required env vars: {', '.join(missing)}")


def build_client():
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return client


def parse_numeric(value, value_type):
    if value is None:
        return None
    if value_type == "integer":
        return int(value)
    if value_type == "double":
        return float(value)
    return value


def load_schema_definitions():
    if not SCHEMA_PATH.exists():
        raise SystemExit(f"Schema snapshot not found at {SCHEMA_PATH}")

    with SCHEMA_PATH.open("r", encoding="utf-8") as handle:
        base = json.load(handle)

    merged = {collection["id"]: deepcopy(collection) for collection in base}
    for extra in (
        EMAIL_CAMPAIGNS_COLLECTION,
        JOB_LOCKS_COLLECTION,
        INACTIVE_USER_CLEANUP_AUDIT_COLLECTION,
        SYSTEM_CONFIG_COLLECTION,
    ):
        if extra["id"] not in merged:
            merged[extra["id"]] = deepcopy(extra)
        else:
            for key in ("attributes", "indexes"):
                current = {item["key"]: item for item in merged[extra["id"]].get(key, [])}
                for item in extra.get(key, []):
                    current[item["key"]] = item
                merged[extra["id"]][key] = list(current.values())

    for collection_id, attributes in ADDITIONAL_ATTRIBUTES.items():
        if collection_id not in merged:
            continue
        current = {item["key"]: item for item in merged[collection_id].get("attributes", [])}
        for item in attributes:
            current[item["key"]] = item
        merged[collection_id]["attributes"] = list(current.values())

    for collection_id, indexes in ADDITIONAL_INDEXES.items():
        if collection_id not in merged:
            continue
        current = {item["key"]: item for item in merged[collection_id].get("indexes", [])}
        for item in indexes:
            current[item["key"]] = item
        merged[collection_id]["indexes"] = list(current.values())

    for collection_id, override in COLLECTION_OVERRIDES.items():
        if collection_id in merged:
            merged[collection_id].update(deepcopy(override))

    for collection_id, definition in merged.items():
        definition["attributes"] = _filter_schema_items(
            collection_id,
            definition.get("attributes", []),
            DEPRECATED_ATTRIBUTES,
        )
        definition["indexes"] = _filter_schema_items(
            collection_id,
            definition.get("indexes", []),
            DEPRECATED_INDEXES,
        )

    return [definition for collection_id, definition in merged.items() if collection_id not in DEPRECATED_COLLECTIONS]


def ensure_database(databases):
    try:
        databases.get(DATABASE_ID)
        print(f"[OK] Database '{DATABASE_ID}' already exists.")
    except AppwriteException as error:
        if "404" not in str(error) and "could not be found" not in str(error).lower():
            raise
        print(f"[+] Creating database '{DATABASE_ID}'...")
        databases.create(DATABASE_ID, DATABASE_ID)
        time.sleep(2)


def list_collections(databases):
    response = databases.list_collections(DATABASE_ID)
    return {collection["$id"]: collection for collection in response.get("collections", [])}


def list_attributes(databases, collection_id):
    try:
        collection = databases.get_collection(DATABASE_ID, collection_id)
        return {attribute["key"]: attribute for attribute in collection.get("attributes", [])}
    except AppwriteException:
        return {}


def list_indexes(databases, collection_id):
    try:
        collection = databases.get_collection(DATABASE_ID, collection_id)
        return {index["key"]: index for index in collection.get("indexes", [])}
    except AppwriteException:
        return {}


def print_schema_inventory(databases):
    print("\n[INVENTORY] Collections, attributes, and indexes")
    collections = list_collections(databases)
    for collection_id in sorted(collections):
        attributes = sorted(list_attributes(databases, collection_id).keys())
        indexes = sorted(list_indexes(databases, collection_id).keys())
        print(f" - {collection_id}")
        print(f"   attributes: {', '.join(attributes) if attributes else '(none)'}")
        print(f"   indexes: {', '.join(indexes) if indexes else '(none)'}")


def report_schema_cleanup(databases, definitions):
    print("\n[CLEANUP REPORT] Deprecated schema objects")
    desired_collections = {definition["id"] for definition in definitions}
    existing_collections = list_collections(databases)
    deprecated_collection_hits = sorted(collection_id for collection_id in DEPRECATED_COLLECTIONS if collection_id in existing_collections)
    extra_collection_hits = sorted(
        collection_id
        for collection_id in existing_collections
        if collection_id not in desired_collections and collection_id not in DEPRECATED_COLLECTIONS
    )

    if deprecated_collection_hits:
        for collection_id in deprecated_collection_hits:
            print(f" - deprecated collection: {collection_id}")
    else:
        print(" - deprecated collections: none found")

    if extra_collection_hits:
        for collection_id in extra_collection_hits:
            print(f" - unmanaged collection: {collection_id}")
    else:
        print(" - unmanaged collections: none found")

    for collection_id, attribute_keys in sorted(DEPRECATED_ATTRIBUTES.items()):
        existing_attributes = list_attributes(databases, collection_id)
        matches = sorted(key for key in attribute_keys if key in existing_attributes)
        if matches:
            print(f" - deprecated attributes in {collection_id}: {', '.join(matches)}")

    for collection_id, index_keys in sorted(DEPRECATED_INDEXES.items()):
        existing_indexes = list_indexes(databases, collection_id)
        matches = sorted(key for key in index_keys if key in existing_indexes)
        if matches:
            print(f" - deprecated indexes in {collection_id}: {', '.join(matches)}")


def _delete_attribute_if_supported(databases, collection_id, key):
    delete_attribute = getattr(databases, "delete_attribute", None)
    if not callable(delete_attribute):
        print(f" [WARN] Attribute deletion is not supported by this SDK: {collection_id}.{key}")
        return
    delete_attribute(DATABASE_ID, collection_id, key)


def apply_schema_cleanup(databases):
    print("\n[APPLY CLEANUP] Removing deprecated schema objects")
    existing_collections = list_collections(databases)

    for collection_id, index_keys in sorted(DEPRECATED_INDEXES.items()):
        existing_indexes = list_indexes(databases, collection_id)
        for key in sorted(index_keys):
            if key not in existing_indexes:
                continue
            try:
                print(f" [-] Deleting deprecated index '{collection_id}.{key}'...")
                databases.delete_index(DATABASE_ID, collection_id, key)
                wait_for_index(databases, collection_id, key, should_exist=False)
            except AppwriteException as error:
                print(f" [X] Failed deleting deprecated index '{collection_id}.{key}': {error}")

    for collection_id, attribute_keys in sorted(DEPRECATED_ATTRIBUTES.items()):
        existing_attributes = list_attributes(databases, collection_id)
        for key in sorted(attribute_keys):
            if key not in existing_attributes:
                continue
            try:
                print(f" [-] Deleting deprecated attribute '{collection_id}.{key}'...")
                _delete_attribute_if_supported(databases, collection_id, key)
            except AppwriteException as error:
                print(f" [X] Failed deleting deprecated attribute '{collection_id}.{key}': {error}")

    for collection_id in sorted(DEPRECATED_COLLECTIONS):
        if collection_id not in existing_collections:
            continue
        try:
            print(f" [-] Deleting deprecated collection '{collection_id}'...")
            databases.delete_collection(DATABASE_ID, collection_id)
        except AppwriteException as error:
            print(f" [X] Failed deleting deprecated collection '{collection_id}': {error}")


def wait_for_attribute(databases, collection_id, key, timeout_seconds=45):
    started_at = time.time()
    while time.time() - started_at < timeout_seconds:
        attribute = list_attributes(databases, collection_id).get(key)
        if attribute and attribute.get("status") == "available":
            return True
        time.sleep(1)
    return False


def wait_for_index(databases, collection_id, key, *, should_exist=True, timeout_seconds=45):
    started_at = time.time()
    while time.time() - started_at < timeout_seconds:
        index = list_indexes(databases, collection_id).get(key)
        if should_exist:
            if index and index.get("status") == "available":
                return True
        elif not index:
            return True
        time.sleep(1)
    return False


def ensure_collection(databases, definition, existing_collections):
    collection_id = definition["id"]
    if collection_id in existing_collections:
        print(f"\n[OK] Collection '{collection_id}' already exists.")
        return

    print(f"\n[+] Creating collection '{collection_id}'...")
    try:
        databases.create_collection(
            DATABASE_ID,
            collection_id,
            definition.get("name", collection_id),
            permissions=definition.get("permissions") or DEFAULT_COLLECTION_PERMISSIONS,
            document_security=definition.get("documentSecurity", False),
            enabled=definition.get("enabled", True),
        )
    except AppwriteException as error:
        message = str(error).lower()
        if "already exists" not in message and "409" not in message:
            raise
        print(f" [OK] Collection '{collection_id}' was created by a previous run.")
    existing_collections[collection_id] = {"$id": collection_id}
    time.sleep(1)


def ensure_collection_configuration(databases, definition):
    collection_id = definition["id"]
    try:
        databases.update_collection(
            DATABASE_ID,
            collection_id,
            definition.get("name", collection_id),
            permissions=definition.get("permissions") or DEFAULT_COLLECTION_PERMISSIONS,
            document_security=definition.get("documentSecurity", False),
            enabled=definition.get("enabled", True),
        )
        print(f" [OK] Collection '{collection_id}' configuration aligned.")
    except AppwriteException as error:
        print(f" [WARN] Could not update collection config for '{collection_id}': {error}")


def create_attribute(databases, collection_id, attribute_definition):
    key = attribute_definition["key"]
    attr_type = attribute_definition["type"]
    required = bool(attribute_definition.get("required", False))
    default = attribute_definition.get("default")
    is_array = bool(attribute_definition.get("array", False))
    elements = attribute_definition.get("elements") or []

    if elements:
        databases.create_enum_attribute(DATABASE_ID, collection_id, key, elements, required, default, is_array)
        return

    if attr_type == "string":
        databases.create_string_attribute(
            DATABASE_ID,
            collection_id,
            key,
            int(attribute_definition.get("size") or 255),
            required,
            default,
            is_array,
        )
        return

    if attr_type == "boolean":
        databases.create_boolean_attribute(DATABASE_ID, collection_id, key, required, default, is_array)
        return

    if attr_type == "datetime":
        databases.create_datetime_attribute(DATABASE_ID, collection_id, key, required, default, is_array)
        return

    if attr_type == "integer":
        databases.create_integer_attribute(
            DATABASE_ID,
            collection_id,
            key,
            required,
            parse_numeric(attribute_definition.get("min"), "integer"),
            parse_numeric(attribute_definition.get("max"), "integer"),
            parse_numeric(default, "integer"),
            is_array,
        )
        return

    if attr_type == "double":
        databases.create_float_attribute(
            DATABASE_ID,
            collection_id,
            key,
            required,
            parse_numeric(attribute_definition.get("min"), "double"),
            parse_numeric(attribute_definition.get("max"), "double"),
            parse_numeric(default, "double"),
            is_array,
        )
        return

    raise ValueError(f"Unsupported attribute type '{attr_type}' for {collection_id}.{key}")


def attribute_needs_update(existing_attribute, attribute_definition):
    if not existing_attribute:
        return False
    if str(existing_attribute.get("type") or "").strip() != str(attribute_definition.get("type") or "").strip():
        return False
    if bool(existing_attribute.get("array", False)) != bool(attribute_definition.get("array", False)):
        return False

    expected_required = bool(attribute_definition.get("required", False))
    if bool(existing_attribute.get("required", False)) != expected_required:
        return True

    expected_default = attribute_definition.get("default")
    if existing_attribute.get("default") != expected_default:
        return True

    attr_type = attribute_definition.get("type")
    if attribute_definition.get("elements"):
        return list(existing_attribute.get("elements") or []) != list(attribute_definition.get("elements") or [])

    if attr_type == "string":
        return int(existing_attribute.get("size") or 0) != int(attribute_definition.get("size") or 0)

    if attr_type in {"integer", "double"}:
        return (
            parse_numeric(existing_attribute.get("min"), attr_type) != parse_numeric(attribute_definition.get("min"), attr_type)
            or parse_numeric(existing_attribute.get("max"), attr_type) != parse_numeric(attribute_definition.get("max"), attr_type)
        )

    return False


def update_attribute(databases, collection_id, attribute_definition):
    key = attribute_definition["key"]
    attr_type = attribute_definition["type"]
    required = bool(attribute_definition.get("required", False))
    default = attribute_definition.get("default")
    elements = attribute_definition.get("elements") or []

    if elements:
        try:
            databases.update_enum_attribute(DATABASE_ID, collection_id, key, elements, required, default)
        except AppwriteException as error:
            if required and "cannot set default value for required attribute" in str(error).lower():
                databases.update_enum_attribute(DATABASE_ID, collection_id, key, elements, required, None)
                return
            raise
        return

    if attr_type == "string":
        databases.update_string_attribute(
            DATABASE_ID,
            collection_id,
            key,
            required,
            default,
            int(attribute_definition.get("size") or 255),
        )
        return

    if attr_type == "boolean":
        databases.update_boolean_attribute(DATABASE_ID, collection_id, key, required, default)
        return

    if attr_type == "datetime":
        databases.update_datetime_attribute(DATABASE_ID, collection_id, key, required, default)
        return

    if attr_type == "integer":
        databases.update_integer_attribute(
            DATABASE_ID,
            collection_id,
            key,
            required,
            parse_numeric(default, "integer"),
            parse_numeric(attribute_definition.get("min"), "integer"),
            parse_numeric(attribute_definition.get("max"), "integer"),
        )
        return

    if attr_type == "double":
        databases.update_float_attribute(
            DATABASE_ID,
            collection_id,
            key,
            required,
            parse_numeric(default, "double"),
            parse_numeric(attribute_definition.get("min"), "double"),
            parse_numeric(attribute_definition.get("max"), "double"),
        )
        return

    raise ValueError(f"Unsupported attribute type '{attr_type}' for {collection_id}.{key}")


def index_needs_rebuild(existing_index, index_definition):
    if not existing_index:
        return False
    return (
        str(existing_index.get("type") or "").strip() != str(index_definition.get("type") or "").strip()
        or list(existing_index.get("attributes") or []) != list(index_definition.get("attributes") or [])
        or list(existing_index.get("orders") or []) != list(index_definition.get("orders") or [])
    )


def ensure_attributes(databases, definition):
    collection_id = definition["id"]
    existing = list_attributes(databases, collection_id)

    for attribute in definition.get("attributes", []):
        key = attribute["key"]
        if key in existing:
            if attribute_needs_update(existing.get(key), attribute):
                if bool(existing[key].get("array", False)) != bool(attribute.get("array", False)):
                    print(f" [WARN] Attribute '{collection_id}.{key}' array mode differs. Manual migration required.")
                    continue
                print(f" [~] Updating attribute '{collection_id}.{key}' to match desired schema...")
                try:
                    update_attribute(databases, collection_id, attribute)
                    wait_for_attribute(databases, collection_id, key)
                except AppwriteException as error:
                    print(f" [X] Failed updating '{collection_id}.{key}': {error}")
                continue
            print(f" [OK] Attribute '{collection_id}.{key}' already exists.")
            continue

        print(f" [+] Creating attribute '{collection_id}.{key}'...")
        try:
            create_attribute(databases, collection_id, attribute)
            wait_for_attribute(databases, collection_id, key)
        except AppwriteException as error:
            if "already exists" in str(error).lower():
                print(f" [OK] Attribute '{collection_id}.{key}' already exists.")
                continue
            print(f" [X] Failed creating '{collection_id}.{key}': {error}")


def verify_required_attributes(databases, collection_id, required_keys):
    existing = list_attributes(databases, collection_id)
    missing = [key for key in required_keys if key not in existing]
    if missing:
        raise SystemExit(
            f"Missing required attributes in '{collection_id}': {', '.join(missing)}"
        )
    print(f" [OK] Verified required attributes for '{collection_id}': {', '.join(required_keys)}")


def ensure_indexes(databases, definition):
    collection_id = definition["id"]
    existing = list_indexes(databases, collection_id)

    for index in definition.get("indexes", []):
        key = index["key"]
        if key in existing:
            if index_needs_rebuild(existing.get(key), index):
                print(f" [~] Rebuilding index '{collection_id}.{key}' to match desired schema...")
                try:
                    databases.delete_index(DATABASE_ID, collection_id, key)
                    wait_for_index(databases, collection_id, key, should_exist=False)
                except AppwriteException as error:
                    print(f" [X] Failed deleting index '{collection_id}.{key}': {error}")
                    continue
                try:
                    databases.create_index(
                        DATABASE_ID,
                        collection_id,
                        key,
                        index["type"],
                        index.get("attributes", []),
                        index.get("orders") or None,
                    )
                    wait_for_index(databases, collection_id, key, should_exist=True)
                except AppwriteException as error:
                    print(f" [X] Failed recreating index '{collection_id}.{key}': {error}")
                continue
            print(f" [OK] Index '{collection_id}.{key}' already exists.")
            continue

        print(f" [+] Creating index '{collection_id}.{key}'...")
        try:
            databases.create_index(
                DATABASE_ID,
                collection_id,
                key,
                index["type"],
                index.get("attributes", []),
                index.get("orders") or None,
            )
        except AppwriteException as error:
            if "already exists" in str(error).lower():
                print(f" [OK] Index '{collection_id}.{key}' already exists.")
                continue
            print(f" [X] Failed creating index '{collection_id}.{key}': {error}")


def _titleize_feature_key(key):
    return " ".join(part.capitalize() for part in str(key or "").replace("_", " ").split())


def load_pricing_contract():
    if not PLAN_FEATURES_PATH.exists():
        raise SystemExit(f"Plan feature contract not found at {PLAN_FEATURES_PATH}")
    with PLAN_FEATURES_PATH.open("r", encoding="utf-8") as handle:
        contract = json.load(handle)
    plan_catalog = contract.get("planCatalog") or {}
    feature_labels = contract.get("featureLabels") or {}
    benefit_keys = contract.get("benefitKeys") or BENEFIT_KEYS
    required_plan_codes = ["free", "basic", "pro", "ultra"]
    missing = [plan_code for plan_code in required_plan_codes if plan_code not in plan_catalog]
    if missing:
        raise SystemExit(f"Pricing contract missing plans: {', '.join(missing)}")
    return {
        "plan_catalog": plan_catalog,
        "feature_labels": feature_labels,
        "benefit_keys": benefit_keys,
    }


def build_pricing_seed_documents():
    contract = load_pricing_contract()
    feature_labels = contract["feature_labels"]
    benefit_keys = contract["benefit_keys"]
    documents = []
    for plan_code in ("free", "basic", "pro", "ultra"):
        definition = contract["plan_catalog"][plan_code]
        enabled = set(definition.get("enabledFeatures") or [])
        prices = definition.get("prices") or {}
        limits = definition.get("limits") or {}
        entitlements = {key: key in enabled for key in benefit_keys}
        feature_items = [
            {
                "key": key,
                "label": feature_labels.get(key) or _titleize_feature_key(key),
                "value": entitlements[key],
            }
            for key in benefit_keys
        ]
        payload = {
            "name": definition.get("name") or _titleize_feature_key(plan_code),
            "plan_code": plan_code,
            "price_monthly_inr": int(prices.get("monthly_inr") or 0),
            "price_yearly_inr": int(prices.get("yearly_inr") or 0),
            "price_monthly_usd": int(prices.get("monthly_usd") or 0),
            "price_yearly_usd": int(prices.get("yearly_usd") or 0),
            "price_yearly_monthly_inr": int(prices.get("yearly_monthly_inr") or 0),
            "price_yearly_monthly_usd": int(prices.get("yearly_monthly_usd") or 0),
            "is_custom": bool(definition.get("is_custom", False)),
            "is_popular": bool(definition.get("is_popular", False)),
            "display_order": int(definition.get("display_order") or 0),
            "button_text": str(definition.get("button_text") or "Choose Plan"),
            "yearly_bonus": str(definition.get("yearly_bonus") or ""),
            "features": json.dumps(
                [feature_labels.get(key) or _titleize_feature_key(key) for key in benefit_keys if entitlements[key]]
            ),
            "comparison_json": json.dumps(feature_items),
            "monthly_duration_days": 30,
            "yearly_duration_days": 364,
            "instagram_connections_limit": int(limits.get("instagram_connections_limit") or 0),
            "instagram_link_limit": int(limits.get("instagram_link_limit") or limits.get("instagram_connections_limit") or 0),
            "actions_per_hour_limit": int(limits.get("actions_per_hour_limit") or 0),
            "actions_per_day_limit": int(limits.get("actions_per_day_limit") or 0),
            "actions_per_month_limit": int(limits.get("actions_per_month_limit") or 0),
        }
        for key, enabled_value in entitlements.items():
            payload[benefit_attribute_key(key)] = bool(enabled_value)
        documents.append((plan_code, payload))
    return documents


def ensure_pricing_seed(databases):
    collection_id = "pricing"
    for plan_code, payload in build_pricing_seed_documents():
        try:
            response = databases.list_documents(
                DATABASE_ID,
                collection_id,
                [Query.equal("plan_code", plan_code), Query.limit(1)],
            )
            existing = (response.get("documents") or [None])[0]
            if existing:
                databases.update_document(DATABASE_ID, collection_id, existing["$id"], payload)
                print(f"[OK] Pricing plan '{plan_code}' aligned.")
                continue
            databases.create_document(DATABASE_ID, collection_id, plan_code, payload)
            print(f"[+] Pricing plan '{plan_code}' seeded.")
        except AppwriteException as error:
            print(f"[X] Failed seeding pricing plan '{plan_code}': {error}")


def parse_args():
    parser = argparse.ArgumentParser(description="Provision Appwrite collections and pricing contract.")
    parser.add_argument("--apply", action="store_true", help="Explicitly apply non-destructive schema provisioning.")
    parser.add_argument("--inventory", action="store_true", help="Print the current collection, attribute, and index inventory.")
    parser.add_argument("--cleanup-report", action="store_true", help="Print deprecated and unmanaged schema objects without deleting them.")
    parser.add_argument("--apply-cleanup", action="store_true", help="Delete deprecated collections, attributes, and indexes.")
    return parser.parse_args()


def main():
    args = parse_args()
    require_env()
    client = build_client()
    databases = Databases(client)

    if args.apply:
        print("Starting non-destructive Appwrite provisioning in explicit apply mode...")
    else:
        print("Starting non-destructive Appwrite provisioning...")
    ensure_database(databases)

    definitions = load_schema_definitions()
    existing_collections = list_collections(databases)

    for definition in definitions:
        ensure_collection(databases, definition, existing_collections)

    for definition in definitions:
        ensure_collection_configuration(databases, definition)

    for definition in definitions:
        ensure_attributes(databases, definition)

    verify_required_attributes(
        databases,
        "profiles",
        REQUIRED_PROFILE_SUBSCRIPTION_ATTRIBUTES,
    )

    for definition in definitions:
        ensure_indexes(databases, definition)

    if args.inventory:
        print_schema_inventory(databases)

    if args.cleanup_report or args.apply_cleanup:
        report_schema_cleanup(databases, definitions)

    if args.apply_cleanup:
        apply_schema_cleanup(databases)

    ensure_pricing_seed(databases)
    if args.apply_cleanup:
        print("\n[COMPLETE] Provisioning finished with deprecated schema cleanup applied.")
    else:
        print("\n[COMPLETE] Provisioning finished without deleting or overwriting existing data.")


if __name__ == "__main__":
    main()
