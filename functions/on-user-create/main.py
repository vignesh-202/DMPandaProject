import os
import json
import datetime
from appwrite.client import Client
from appwrite.query import Query
from appwrite.permission import Permission
from appwrite.role import Role
from appwrite.id import ID

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


def _benefit_field(key):
    return f"benefit_{BENEFIT_STORAGE_KEYS.get(key, key)}"


def _env(key, default=""):
    runtime_key = {
        "APPWRITE_ENDPOINT": "APPWRITE_FUNCTION_API_ENDPOINT",
        "APPWRITE_PROJECT_ID": "APPWRITE_FUNCTION_PROJECT_ID",
        "APPWRITE_API_KEY": "APPWRITE_FUNCTION_API_KEY",
    }.get(key, key.replace("APPWRITE_", "APPWRITE_FUNCTION_"))
    return str(
        os.environ.get(key)
        or os.environ.get(runtime_key)
        or default
        or ""
    ).strip()


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _list_documents(client, db_id, collection_id, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _get_document(client, db_id, collection_id, document_id):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
    )


def _create_document(client, db_id, collection_id, document_id, data, permissions=None):
    return _call_appwrite(
        client,
        "post",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {
            "documentId": document_id or ID.unique(),
            "data": data,
            "permissions": permissions or [],
        },
    )


def _safe_int(value, fallback=0):
    try:
        if value is None:
            return fallback
        return int(float(str(value)))
    except Exception:
        return fallback


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _request_header(context, key):
    headers = getattr(getattr(context, "req", None), "headers", None) or {}
    return str(
        _obj_get(headers, key)
        or _obj_get(headers, key.lower())
        or _obj_get(headers, key.upper())
        or ""
    ).strip()


def _load_free_plan_snapshot(client, db_id, pricing_collection_id):
    pricing = _list_documents(
        client,
        db_id,
        pricing_collection_id,
        [Query.limit(100)]
    )
    free_plan = next(
        (
            doc for doc in (_obj_get(pricing, "documents", []) or [])
            if str(_obj_get(doc, "plan_code") or _obj_get(doc, "name") or "").strip().lower() == "free"
        ),
        None
    )
    if not free_plan:
        raise ValueError("Pricing collection does not contain a free plan row.")

    monthly_limit = _safe_int(_obj_get(free_plan, "actions_per_month_limit"), 0)
    linked_limit = _safe_int(_obj_get(free_plan, "instagram_link_limit"), _safe_int(_obj_get(free_plan, "instagram_connections_limit"), 0))
    limits_snapshot = {
        "instagram_connections_limit": _safe_int(_obj_get(free_plan, "instagram_connections_limit"), 0),
        "instagram_link_limit": linked_limit,
        "hourly_action_limit": _safe_int(_obj_get(free_plan, "actions_per_hour_limit"), 0),
        "daily_action_limit": _safe_int(_obj_get(free_plan, "actions_per_day_limit"), 0),
        "monthly_action_limit": monthly_limit if monthly_limit > 0 else None,
    }
    entitlements = {
        key: bool(_obj_get(free_plan, _benefit_field(key)))
        for key in BENEFIT_KEYS
    }
    if not any(entitlements.values()):
        comparison = _obj_get(free_plan, "comparison_json") or "[]"
        try:
            parsed = json.loads(comparison) if isinstance(comparison, str) else comparison
        except Exception:
            parsed = []
        for item in parsed if isinstance(parsed, list) else []:
            key = str(_obj_get(item, "key") or _obj_get(item, "label") or "").strip().lower().replace(" ", "_")
            if key in entitlements:
                entitlements[key] = bool(_obj_get(item, "value"))
    return {
        "plan_code": "free",
        "plan_name": str(_obj_get(free_plan, "name") or "Free Plan").strip() or "Free Plan",
        "plan_status": "inactive",
        "billing_cycle": None,
        "expires_at": None,
        "limits_json": json.dumps(limits_snapshot),
        "features_json": json.dumps(entitlements),
        "paid_plan_snapshot_json": None,
        "admin_override_json": None,
        "kill_switch_enabled": True,
        "instagram_connections_limit": limits_snapshot["instagram_connections_limit"],
        "hourly_action_limit": limits_snapshot["hourly_action_limit"],
        "daily_action_limit": limits_snapshot["daily_action_limit"],
        "monthly_action_limit": monthly_limit if monthly_limit > 0 else 0,
        "hourly_actions_used": 0,
        "daily_actions_used": 0,
        "monthly_actions_used": 0,
        "hourly_window_started_at": None,
        "daily_window_started_at": None,
        "monthly_window_started_at": None,
        "feature_overrides_json": None,
        **{_benefit_field(key): value for key, value in entitlements.items()},
    }

# This function is triggered by users.*.create event in Appwrite.
# It creates a corresponding document in both 'users' and 'profiles' collections.
def main(context):
    try:
        # Appwrite sends the event payload as JSON in the request body.
        # In most runtimes this is a string, so normalize to a dict.
        raw_body = getattr(context.req, "body", None)
        if isinstance(raw_body, dict):
            user = raw_body
        else:
            try:
                user = json.loads(raw_body or "{}")
            except Exception:
                context.error(f"on-user-create: Failed to parse request body: {raw_body!r}")
                return context.res.json(
                    {"status": "error", "message": "Invalid event payload received."},
                    400,
                )

        user_id = user.get("$id")
        user_name = user.get("name", "")
        user_email = user.get("email", "")

        if not user_id:
            context.error(f"on-user-create: Missing user id in payload: {user}")
            return context.res.json(
                {"status": "error", "message": "Missing user id in event payload."},
                400,
            )

        context.log(f"New user created event received for userId: {user_id}")

        endpoint = _env("APPWRITE_ENDPOINT")
        project_id = _env("APPWRITE_PROJECT_ID")
        api_key = _request_header(context, "x-appwrite-key") or _env("APPWRITE_API_KEY")
        db_id = _env("APPWRITE_DATABASE_ID")
        users_collection_id = _env("USERS_COLLECTION_ID", "users")
        profiles_collection_id = _env("PROFILES_COLLECTION_ID", "profiles")
        pricing_collection_id = _env("PRICING_COLLECTION_ID", "pricing")
        if not endpoint or not project_id or not api_key or not db_id:
            raise ValueError("Missing required Appwrite runtime configuration.")

        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        free_plan_profile = _load_free_plan_snapshot(client, db_id, pricing_collection_id)

        # 1. Create Users document (idempotent)
        try:
            _get_document(client, db_id, users_collection_id, user_id)
            context.log(f"User document already exists for userId: {user_id}")
        except Exception:
            context.log(f"Creating user document for userId: {user_id}")
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            _create_document(
                client,
                db_id,
                users_collection_id,
                user_id,
                {
                    "name": user_name,
                    "email": user_email,
                    "first_login": now,
                    "last_login": now,
                    "status": "active",
                    "kill_switch_enabled": True,
                },
                [
                    Permission.read(Role.user(user_id)),
                    Permission.update(Role.user(user_id)),
                ],
            )

        # 2. Create Profiles document (idempotent)
        try:
            _get_document(client, db_id, profiles_collection_id, user_id)
            context.log(f"Profile document already exists for userId: {user_id}")
        except Exception:
            context.log(f"Creating profile document for userId: {user_id}")
            _create_document(
                client,
                db_id,
                profiles_collection_id,
                user_id,
                {
                    "user_id": user_id,
                    **free_plan_profile,
                },
                [
                    Permission.read(Role.user(user_id)),
                    Permission.update(Role.user(user_id)),
                ],
            )

        context.log(f"Successfully processed user and profile creation for {user_id}")
        return context.res.json({"status": "success", "user_id": user_id})

    except Exception as e:
        context.error(f"Error in on-user-create function: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
