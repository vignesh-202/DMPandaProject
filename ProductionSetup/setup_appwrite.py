import json
import os
import time
from copy import deepcopy
from pathlib import Path

from appwrite.client import AppwriteException, Client
from appwrite.id import ID
from appwrite.permission import Permission
from appwrite.role import Role
from appwrite.services.databases import Databases
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT_DIR / "docs" / "appwrite-schema-live.json"
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

AUTOMATION_COLLECTED_EMAILS_COLLECTION = {
    "id": "automation_collected_emails",
    "name": "Automation Collected Emails",
    "enabled": True,
    "documentSecurity": False,
    "permissions": DEFAULT_COLLECTION_PERMISSIONS,
    "attributes": [
        {"key": "user_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "account_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "automation_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "conversation_key", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "sender_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "recipient_id", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "email", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "normalized_email", "type": "string", "size": 255, "required": True, "array": False, "default": None},
        {"key": "send_to", "type": "string", "size": 50, "required": False, "array": False, "default": None},
        {"key": "sender_profile_url", "type": "string", "size": 500, "required": False, "array": False, "default": None},
        {"key": "receiver_name", "type": "string", "size": 255, "required": False, "array": False, "default": None},
        {"key": "automation_title", "type": "string", "size": 255, "required": False, "array": False, "default": None},
        {"key": "automation_type", "type": "string", "size": 50, "required": False, "array": False, "default": None},
        {"key": "collected_at", "type": "datetime", "required": True, "array": False, "default": None},
        {"key": "updated_at", "type": "datetime", "required": True, "array": False, "default": None},
    ],
    "indexes": [
        {"key": "idx_normalized_email", "type": "key", "attributes": ["normalized_email"], "orders": []},
        {"key": "idx_account_collected_at", "type": "key", "attributes": ["account_id", "collected_at"], "orders": []},
        {"key": "idx_automation_collected_at", "type": "key", "attributes": ["automation_id", "collected_at"], "orders": []},
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

ADDITIONAL_ATTRIBUTES = {
    "users": [
        {"key": "plan_id", "type": "string", "required": False, "array": False, "default": "free", "size": 32},
        {"key": "plan_expires_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "kill_switch_enabled", "type": "boolean", "required": False, "array": False, "default": True},
        {"key": "last_active_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "cleanup_protected", "type": "boolean", "required": False, "array": False, "default": False},
        {"key": "cleanup_state_json", "type": "string", "required": False, "array": False, "default": None, "size": 4000},
    ],
    "profiles": [
        {"key": "plan_code", "type": "string", "required": False, "array": False, "default": None, "size": 32},
        {"key": "plan_name", "type": "string", "required": False, "array": False, "default": None, "size": 100},
        {
            "key": "plan_status",
            "type": "string",
            "required": False,
            "array": False,
            "default": "inactive",
            "elements": ["trial", "active", "inactive", "cancelled", "expired", "past_due"],
        },
        {
            "key": "billing_cycle",
            "type": "string",
            "required": False,
            "array": False,
            "default": None,
            "elements": ["monthly", "yearly"],
        },
        {"key": "expires_at", "type": "datetime", "required": False, "array": False, "default": None},
        {"key": "limits_json", "type": "string", "required": False, "array": False, "default": None, "size": 1200},
        {"key": "features_json", "type": "string", "required": False, "array": False, "default": None, "size": 600},
        {"key": "paid_plan_snapshot_json", "type": "string", "required": False, "array": False, "default": None, "size": 600},
        {"key": "admin_override_json", "type": "string", "required": False, "array": False, "default": None, "size": 140},
        {"key": "kill_switch_enabled", "type": "boolean", "required": False, "array": False, "default": True},
        *deepcopy(BENEFIT_ATTRIBUTES),
    ],
    "pricing": [
        {"key": "monthly_duration_days", "type": "integer", "required": False, "array": False, "default": 30, "min": 1, "max": 366},
        {"key": "yearly_duration_days", "type": "integer", "required": False, "array": False, "default": 364, "min": 1, "max": 366},
        {"key": "instagram_link_limit", "type": "integer", "required": False, "array": False, "default": 0, "min": 0, "max": 1000},
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
    "automations": [
        {
            "key": "plan_validation_state",
            "type": "string",
            "required": False,
            "array": False,
            "default": "valid",
            "elements": ["valid", "invalid_due_to_plan"],
        },
        {
            "key": "invalid_features",
            "type": "string",
            "required": False,
            "array": False,
            "default": None,
            "size": 2000,
        },
    ],
}

ADDITIONAL_INDEXES = {
    "users": [
        {"key": "idx_users_email_search", "type": "fulltext", "attributes": ["email"], "orders": []},
        {"key": "idx_users_name_search", "type": "fulltext", "attributes": ["name"], "orders": []},
        {"key": "idx_users_plan_id", "type": "key", "attributes": ["plan_id"], "orders": []},
        {"key": "idx_users_plan_expiry", "type": "key", "attributes": ["plan_id", "plan_expires_at"], "orders": []},
        {"key": "idx_users_last_active", "type": "key", "attributes": ["last_active_at"], "orders": []},
        {"key": "idx_users_cleanup_candidate", "type": "key", "attributes": ["cleanup_protected", "plan_id", "last_active_at"], "orders": []},
    ],
    "profiles": [
        {"key": "idx_profiles_expires_at", "type": "key", "attributes": ["expires_at"], "orders": []},
        {"key": "idx_profiles_plan_cycle", "type": "key", "attributes": ["plan_code", "billing_cycle"], "orders": []},
        {"key": "idx_profiles_plan_expiry", "type": "key", "attributes": ["plan_code", "expires_at"], "orders": []},
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
    ],
    "coupons": [
        {"key": "idx_coupons_code_search", "type": "fulltext", "attributes": ["code"], "orders": []},
        {"key": "idx_coupons_active_expiry", "type": "key", "attributes": ["active", "expires_at"], "orders": []},
    ],
    "admin_audit_logs": [
        {"key": "idx_target_user_created", "type": "key", "attributes": ["target_user_id", "created_at"], "orders": []},
    ],
}

COLLECTION_OVERRIDES = {
    "admin_audit_logs": {
        "permissions": [
            "read(\"label:admin\")",
            "create(\"label:admin\")",
            "update(\"label:admin\")",
            "delete(\"label:admin\")",
        ],
        "documentSecurity": False,
        "enabled": True,
    }
}

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
        AUTOMATION_COLLECTED_EMAILS_COLLECTION,
        JOB_LOCKS_COLLECTION,
        INACTIVE_USER_CLEANUP_AUDIT_COLLECTION,
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
        databases.update_enum_attribute(DATABASE_ID, collection_id, key, elements, required, default)
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


def ensure_admin_settings_seed(databases):
    collection_id = "admin_settings"
    try:
        response = databases.list_documents(DATABASE_ID, collection_id)
        documents = response.get("documents", [])
        if documents:
            print("[OK] admin_settings already has at least one document. Seed skipped.")
            return
        print("[+] Creating default admin_settings seed document...")
        databases.create_document(
            DATABASE_ID,
            collection_id,
            ID.unique(),
            {
                "default_text": "Automation made by DMPanda",
                "enabled": True,
                "enforcement_mode": "fallback_secondary_message",
                "updated_by": "setup_appwrite.py",
                "allow_user_override": True,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
    except AppwriteException as error:
        print(f"[WARN] Could not seed admin_settings: {error}")


def main():
    require_env()
    client = build_client()
    databases = Databases(client)

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

    for definition in definitions:
        ensure_indexes(databases, definition)

    ensure_admin_settings_seed(databases)
    print("\n[COMPLETE] Provisioning finished without deleting or overwriting existing data.")


if __name__ == "__main__":
    main()
