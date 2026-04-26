import argparse
import json
import os
from datetime import datetime, timedelta, timezone
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

USERS_COLLECTION_ID = os.getenv("USERS_COLLECTION_ID", "users")
PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")
PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")
TRANSACTIONS_COLLECTION_ID = os.getenv("TRANSACTIONS_COLLECTION_ID", "transactions")

PAGE_SIZE = 100
DEFAULT_FREE_PLAN = "free"
ACTIVE_PLAN_STATUSES = {"trial", "active", "past_due"}
SUCCESS_TRANSACTION_STATUSES = {"success", "paid", "captured", "completed", "active"}


def _obj_get(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _normalize_plan_code(value):
    return str(value or "").strip().lower() or DEFAULT_FREE_PLAN


def _normalize_status(value, default="inactive"):
    normalized = str(value or "").strip().lower()
    if normalized in {"trial", "active", "inactive", "cancelled", "expired", "past_due"}:
        return normalized
    return default


def _normalize_billing_cycle(value, default=None):
    normalized = str(value or "").strip().lower()
    if normalized in {"monthly", "yearly"}:
        return normalized
    return default


def _parse_dt(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _to_iso(value):
    if not value:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_json_object(value, fallback=None):
    if value in (None, "", []):
        return {} if fallback is None else fallback
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {} if fallback is None else fallback


def _parse_json_array(value):
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _to_json(value):
    if value is None:
        return None
    return json.dumps(value, separators=(",", ":"))


def _snapshot_runtime(snapshot):
    parsed = _parse_json_object(snapshot, None)
    if not isinstance(parsed, dict):
        return {}
    runtime = parsed.get("__rt")
    return runtime if isinstance(runtime, dict) else {}


def _with_snapshot_runtime(snapshot, runtime_patch):
    parsed = _parse_json_object(snapshot, None)
    if not isinstance(parsed, dict):
        return snapshot
    runtime = _snapshot_runtime(parsed)
    next_runtime = {**runtime, **_parse_json_object(runtime_patch, {})}
    next_runtime = {key: value for key, value in next_runtime.items() if value not in (None, {}, [])}
    if next_runtime:
        parsed["__rt"] = next_runtime
    else:
        parsed.pop("__rt", None)
    return parsed


def _normalize_feature_key(value):
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("+", "_")
        .replace("/", "_")
        .replace("-", "_")
        .replace(" ", "_")
    )


def _normalize_boolean(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized = str(value or "").strip().lower()
    if normalized in {"true", "yes", "enabled", "active", "included", "available", "unlimited"}:
        return True
    if normalized in {"false", "no", "disabled", "inactive", "excluded"}:
        return False
    return False


def _parse_number(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _list_all(databases, collection_id, queries=None):
    rows = []
    cursor = None
    base_queries = list(queries or [])
    while True:
        current_queries = list(base_queries) + [Query.limit(PAGE_SIZE)]
        if cursor:
            current_queries.append(Query.cursor_after(cursor))
        result = databases.list_documents(DATABASE_ID, collection_id, queries=current_queries)
        docs = _obj_get(result, "documents", []) or []
        if not docs:
            break
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        cursor = str(_obj_get(docs[-1], "$id", "") or "").strip() or None
        if not cursor:
            break
    return rows


def _load_pricing_map(databases):
    rows = _list_all(databases, PRICING_COLLECTION_ID)
    pricing_map = {}
    for row in rows:
        plan_code = _normalize_plan_code(_obj_get(row, "plan_code") or _obj_get(row, "name"))
        comparison = _parse_json_array(_obj_get(row, "comparison_json") or _obj_get(row, "comparison"))
        entitlements = {}
        for item in comparison:
            key = _normalize_feature_key(_obj_get(item, "key") or _obj_get(item, "label"))
            if not key:
                continue
            if key in {
                "instagram_connections_limit",
                "actions_per_hour_limit",
                "actions_per_day_limit",
                "actions_per_month_limit",
                "hourly_action_limit",
                "daily_action_limit",
                "monthly_action_limit",
            }:
                continue
            if _normalize_boolean(_obj_get(item, "value")):
                entitlements[key] = True

        pricing_map[plan_code] = {
            "plan_code": plan_code,
            "plan_name": str(_obj_get(row, "name") or plan_code.title()).strip() or "Free Plan",
            "instagram_connections_limit": _parse_number(_obj_get(row, "instagram_connections_limit"), 0),
            "instagram_link_limit": _parse_number(_obj_get(row, "instagram_link_limit"), _parse_number(_obj_get(row, "instagram_connections_limit"), 0)),
            "hourly_action_limit": _parse_number(_obj_get(row, "actions_per_hour_limit"), 0),
            "daily_action_limit": _parse_number(_obj_get(row, "actions_per_day_limit"), 0),
            "monthly_action_limit": _parse_number(_obj_get(row, "actions_per_month_limit"), 0),
            "monthly_duration_days": _parse_number(_obj_get(row, "monthly_duration_days"), 30),
            "yearly_duration_days": _parse_number(_obj_get(row, "yearly_duration_days"), 364),
            "entitlements": entitlements,
        }

    if DEFAULT_FREE_PLAN not in pricing_map:
        raise RuntimeError("Pricing collection is missing the free plan.")
    return pricing_map


def _resolve_profile_config(profile):
    config = _parse_json_object(_obj_get(profile, "feature_overrides_json"), {})
    return {
        "feature_overrides": _parse_json_object(config.get("__feature_overrides"), {}),
        "limit_overrides": _parse_json_object(config.get("__limit_overrides"), {}),
        "paid_plan_snapshot": _parse_json_object(config.get("__paid_plan_snapshot"), None),
    }


def _resolve_profile_runtime_state(profile):
    return {
        "plan_code": _normalize_plan_code(_obj_get(profile, "plan_code") or _obj_get(profile, "subscription_plan_id")),
        "plan_status": _normalize_status(_obj_get(profile, "plan_status") or _obj_get(profile, "subscription_status")),
        "billing_cycle": _normalize_billing_cycle(_obj_get(profile, "billing_cycle") or _obj_get(profile, "subscription_billing_cycle")),
        "expires_at": _parse_dt(_obj_get(profile, "expires_at") or _obj_get(profile, "subscription_expires")),
    }


def _resolve_current_user_memory(user):
    return {
        "plan_id": _normalize_plan_code(_obj_get(user, "plan_id")),
        "plan_expires_at": _parse_dt(_obj_get(user, "plan_expires_at")),
    }


def _transaction_status(transaction):
    return str(
        _obj_get(transaction, "status")
        or _obj_get(transaction, "payment_status")
        or _obj_get(transaction, "gateway_status")
        or ""
    ).strip().lower()


def _transaction_user_id(transaction):
    return str(
        _obj_get(transaction, "userId")
        or _obj_get(transaction, "user_id")
        or ""
    ).strip()


def _transaction_plan_id(transaction):
    return _normalize_plan_code(
        _obj_get(transaction, "planCode")
        or _obj_get(transaction, "plan_code")
        or _obj_get(transaction, "planId")
        or _obj_get(transaction, "plan_id")
    )


def _transaction_billing_cycle(transaction):
    return _normalize_billing_cycle(
        _obj_get(transaction, "billingCycle")
        or _obj_get(transaction, "billing_cycle"),
        "monthly",
    )


def _transaction_created_at(transaction):
    return (
        _parse_dt(_obj_get(transaction, "paid_at"))
        or _parse_dt(_obj_get(transaction, "created_at"))
        or _parse_dt(_obj_get(transaction, "$createdAt"))
    )


def _transaction_expires_at(transaction):
    return (
        _parse_dt(_obj_get(transaction, "expiresAt"))
        or _parse_dt(_obj_get(transaction, "expires_at"))
        or _parse_dt(_obj_get(transaction, "subscription_expires"))
    )


def _calculate_expiry_from_transaction(transaction, pricing_map):
    plan_code = _transaction_plan_id(transaction)
    if plan_code == DEFAULT_FREE_PLAN:
        return None
    plan = pricing_map.get(plan_code) or pricing_map[DEFAULT_FREE_PLAN]
    existing = _transaction_expires_at(transaction)
    if existing:
        return existing
    paid_at = _transaction_created_at(transaction)
    if not paid_at:
        return None
    duration = plan["yearly_duration_days"] if _transaction_billing_cycle(transaction) == "yearly" else plan["monthly_duration_days"]
    return paid_at + timedelta(days=duration)


def _is_successful_self_subscription(transaction):
    status = _transaction_status(transaction)
    if status not in SUCCESS_TRANSACTION_STATUSES:
        return False
    plan_code = _transaction_plan_id(transaction)
    return bool(plan_code and plan_code != DEFAULT_FREE_PLAN)


def _pick_self_subscription_memory(user, profile, user_transactions, pricing_map):
    current = _resolve_current_user_memory(user)
    if current["plan_id"] and current["plan_id"] != DEFAULT_FREE_PLAN:
        return current

    successful = [tx for tx in user_transactions if _is_successful_self_subscription(tx)]
    successful.sort(
        key=lambda tx: _transaction_created_at(tx) or datetime.fromtimestamp(0, tz=timezone.utc),
        reverse=True,
    )
    if successful:
        latest = successful[0]
        return {
            "plan_id": _transaction_plan_id(latest),
            "plan_expires_at": _calculate_expiry_from_transaction(latest, pricing_map),
        }

    runtime = _resolve_profile_runtime_state(profile or {})
    overrides = _parse_json_object(_obj_get(profile, "admin_override_json"), None)
    if (
        runtime["plan_code"] != DEFAULT_FREE_PLAN
        and not overrides
        and runtime["plan_status"] in ACTIVE_PLAN_STATUSES
    ):
        return {
            "plan_id": runtime["plan_code"],
            "plan_expires_at": runtime["expires_at"],
        }

    return {"plan_id": DEFAULT_FREE_PLAN, "plan_expires_at": None}


def _build_effective_limits(profile, plan_defaults, limit_overrides):
    runtime_limits = _parse_json_object(_obj_get(profile, "limits_json"), None)
    if runtime_limits:
        return {
            "instagram_connections_limit": _parse_number(runtime_limits.get("instagram_connections_limit"), 0),
            "instagram_link_limit": _parse_number(runtime_limits.get("instagram_link_limit"), runtime_limits.get("instagram_connections_limit")),
            "hourly_action_limit": _parse_number(runtime_limits.get("hourly_action_limit"), 0),
            "daily_action_limit": _parse_number(runtime_limits.get("daily_action_limit"), 0),
            "monthly_action_limit": _parse_number(runtime_limits.get("monthly_action_limit"), 0),
        }

    def _limit(name, default):
        if name in limit_overrides:
            return _parse_number(limit_overrides.get(name), default)
        return _parse_number(default, 0)

    return {
        "instagram_connections_limit": _limit("instagram_connections_limit", plan_defaults["instagram_connections_limit"]),
        "instagram_link_limit": _limit("instagram_link_limit", plan_defaults["instagram_link_limit"]),
        "hourly_action_limit": _limit("hourly_action_limit", plan_defaults["hourly_action_limit"]),
        "daily_action_limit": _limit("daily_action_limit", plan_defaults["daily_action_limit"]),
        "monthly_action_limit": _limit("monthly_action_limit", plan_defaults["monthly_action_limit"]),
    }


def _build_effective_features(profile, plan_defaults, feature_overrides):
    runtime_features = _parse_json_object(_obj_get(profile, "features_json"), None)
    if runtime_features:
        return {key: True for key, value in runtime_features.items() if _normalize_boolean(value)}

    features = {key: True for key, value in (plan_defaults.get("entitlements") or {}).items() if value is True}
    for key, value in feature_overrides.items():
        normalized = _normalize_feature_key(key)
        if not normalized or normalized == "watermark_text":
            continue
        if _normalize_boolean(value):
            features[normalized] = True
        else:
            features.pop(normalized, None)
    return features


def _build_profile_payload(user, profile, pricing_map):
    runtime = _resolve_profile_runtime_state(profile or {})
    plan_code = runtime["plan_code"]
    if plan_code not in pricing_map:
        plan_code = DEFAULT_FREE_PLAN
    defaults = pricing_map[plan_code]
    is_free = plan_code == DEFAULT_FREE_PLAN
    config = _resolve_profile_config(profile or {})
    plan_status = "inactive" if is_free else _normalize_status(runtime["plan_status"], "active")
    billing_cycle = None if is_free else _normalize_billing_cycle(runtime["billing_cycle"], "monthly")
    expires_at = None if is_free else runtime["expires_at"]
    if not is_free and not expires_at and plan_status in ACTIVE_PLAN_STATUSES:
        plan_status = "inactive"
    limits = _build_effective_limits(profile or {}, defaults, config["limit_overrides"])
    features = _build_effective_features(profile or {}, defaults, config["feature_overrides"])

    paid_snapshot = config["paid_plan_snapshot"]
    if plan_code != DEFAULT_FREE_PLAN and not paid_snapshot:
        paid_snapshot = {
            "plan_id": plan_code,
            "billing_cycle": billing_cycle,
            "status": plan_status,
            "expires": _to_iso(expires_at),
            "limits": limits,
        }
    elif plan_code != DEFAULT_FREE_PLAN and paid_snapshot:
        paid_snapshot = _with_snapshot_runtime(
            {
                **_parse_json_object(paid_snapshot, {}),
                "plan_id": plan_code,
                "plan_name": defaults["plan_name"],
                "billing_cycle": billing_cycle,
                "status": plan_status,
                "expires": _to_iso(expires_at),
                "limits": limits,
            },
            _snapshot_runtime(paid_snapshot),
        )

    admin_override = _parse_json_object(_obj_get(profile, "admin_override_json"), None)

    return {
        "plan_code": plan_code,
        "plan_name": defaults["plan_name"],
        "plan_status": plan_status,
        "billing_cycle": billing_cycle,
        "expires_at": _to_iso(expires_at),
        "limits_json": _to_json(limits),
        "features_json": _to_json(features),
        "paid_plan_snapshot_json": _to_json(paid_snapshot),
        "admin_override_json": _to_json(admin_override),
        "kill_switch_enabled": _obj_get(profile or {}, "kill_switch_enabled") is not False and _obj_get(user, "kill_switch_enabled") is not False,
        "hourly_action_limit": limits["hourly_action_limit"],
        "daily_action_limit": limits["daily_action_limit"],
        "monthly_action_limit": limits["monthly_action_limit"],
        "feature_overrides_json": _obj_get(profile or {}, "feature_overrides_json") or None,
    }


def _sanitize_existing_profile(profile):
    paid_snapshot = _parse_json_object(_obj_get(profile, "paid_plan_snapshot_json"), None)
    if isinstance(paid_snapshot, dict) and len(paid_snapshot) == 0:
        paid_snapshot = None
    admin_override = _parse_json_object(_obj_get(profile, "admin_override_json"), None)
    if isinstance(admin_override, dict) and len(admin_override) == 0:
        admin_override = {}
    return {
        "plan_code": _normalize_plan_code(_obj_get(profile, "plan_code")),
        "plan_name": str(_obj_get(profile, "plan_name") or "").strip() or None,
        "plan_status": _normalize_status(_obj_get(profile, "plan_status")),
        "billing_cycle": _normalize_billing_cycle(_obj_get(profile, "billing_cycle")),
        "expires_at": _to_iso(_parse_dt(_obj_get(profile, "expires_at"))),
        "limits_json": _to_json(_parse_json_object(_obj_get(profile, "limits_json"), None)),
        "features_json": _to_json(_parse_json_object(_obj_get(profile, "features_json"), None)),
        "paid_plan_snapshot_json": _to_json(paid_snapshot),
        "admin_override_json": _to_json(admin_override),
        "kill_switch_enabled": _obj_get(profile, "kill_switch_enabled") is not False,
        "hourly_action_limit": _parse_number(_obj_get(profile, "hourly_action_limit"), 0),
        "daily_action_limit": _parse_number(_obj_get(profile, "daily_action_limit"), 0),
        "monthly_action_limit": _parse_number(_obj_get(profile, "monthly_action_limit"), 0),
        "feature_overrides_json": _obj_get(profile, "feature_overrides_json") or None,
    }


def _sanitize_existing_user(user):
    return {
        "plan_id": _normalize_plan_code(_obj_get(user, "plan_id")),
        "plan_expires_at": _to_iso(_parse_dt(_obj_get(user, "plan_expires_at"))),
    }


def main():
    parser = argparse.ArgumentParser(
        description=(
            "LEGACY dry-run report for the old users-table subscription model. "
            "Use migrate_pricing_benefits.py for the transaction-derived subscription model."
        )
    )
    parser.add_argument("--apply", action="store_true", help="Apply updates to Appwrite.")
    parser.add_argument("--dry-run", action="store_true", help="Explicitly run in dry-run mode.")
    parser.add_argument(
        "--report",
        default=str(ROOT_DIR / "docs" / "subscription-migration-report.json"),
        help="Path for JSON report output.",
    )
    args = parser.parse_args()
    if args.apply and args.dry_run:
        raise SystemExit("Cannot use --apply with --dry-run.")
    if args.apply:
        raise SystemExit(
            "Refusing to apply legacy users.plan_id/users.plan_expires_at writes. "
            "Run ProductionSetup/migrate_pricing_benefits.py instead."
        )

    missing_env = [
        key for key, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "DATABASE_ID": DATABASE_ID,
        }.items()
        if not value
    ]
    if missing_env:
        raise SystemExit(f"Missing env vars: {', '.join(missing_env)}")

    client = Client().set_endpoint(APPWRITE_ENDPOINT).set_project(APPWRITE_PROJECT_ID).set_key(APPWRITE_API_KEY)
    databases = Databases(client)

    pricing_map = _load_pricing_map(databases)
    users = _list_all(databases, USERS_COLLECTION_ID)
    profiles = _list_all(databases, PROFILES_COLLECTION_ID)
    transactions = _list_all(databases, TRANSACTIONS_COLLECTION_ID)

    profiles_by_user = {
        str(_obj_get(profile, "user_id") or _obj_get(profile, "$id") or "").strip(): profile
        for profile in profiles
        if str(_obj_get(profile, "user_id") or _obj_get(profile, "$id") or "").strip()
    }
    transactions_by_user = {}
    for transaction in transactions:
        user_id = _transaction_user_id(transaction)
        if not user_id:
            continue
        transactions_by_user.setdefault(user_id, []).append(transaction)

    summary = {
        "scanned_users": 0,
        "user_updates_needed": 0,
        "profile_updates_needed": 0,
        "profile_creates_needed": 0,
        "applied_user_updates": 0,
        "applied_profile_updates": 0,
        "applied_profile_creates": 0,
    }
    rows = []

    for user in users:
        user_id = str(_obj_get(user, "$id") or "").strip()
        if not user_id:
            continue
        summary["scanned_users"] += 1

        profile = profiles_by_user.get(user_id)
        user_transactions = transactions_by_user.get(user_id, [])
        next_user_memory = _pick_self_subscription_memory(user, profile, user_transactions, pricing_map)
        next_user_payload = {
            "plan_id": next_user_memory["plan_id"],
            "plan_expires_at": _to_iso(next_user_memory["plan_expires_at"]),
        }
        existing_user_payload = _sanitize_existing_user(user)

        next_profile_payload = _build_profile_payload(user, profile, pricing_map)
        existing_profile_payload = _sanitize_existing_profile(profile or {})

        user_needs_update = existing_user_payload != next_user_payload
        profile_missing = profile is None
        profile_needs_update = profile_missing or existing_profile_payload != next_profile_payload

        if user_needs_update:
            summary["user_updates_needed"] += 1
        if profile_missing:
            summary["profile_creates_needed"] += 1
        elif profile_needs_update:
            summary["profile_updates_needed"] += 1

        rows.append(
            {
                "user_id": user_id,
                "user_memory_current": existing_user_payload,
                "user_memory_target": next_user_payload,
                "profile_exists": not profile_missing,
                "profile_current": None if profile_missing else existing_profile_payload,
                "profile_target": next_profile_payload,
                "user_needs_update": user_needs_update,
                "profile_needs_write": profile_needs_update,
            }
        )

        if not args.apply:
            continue

        if user_needs_update:
            databases.update_document(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                user_id,
                {
                    "plan_id": next_user_payload["plan_id"],
                    "plan_expires_at": next_user_payload["plan_expires_at"],
                },
            )
            summary["applied_user_updates"] += 1

        if profile_missing:
            databases.create_document(
                DATABASE_ID,
                PROFILES_COLLECTION_ID,
                user_id,
                {
                    "user_id": user_id,
                    "hourly_actions_used": 0,
                    "daily_actions_used": 0,
                    "monthly_actions_used": 0,
                    "hourly_window_started_at": None,
                    "daily_window_started_at": None,
                    "monthly_window_started_at": None,
                    **next_profile_payload,
                },
            )
            summary["applied_profile_creates"] += 1
        elif profile_needs_update:
            databases.update_document(
                DATABASE_ID,
                PROFILES_COLLECTION_ID,
                _obj_get(profile, "$id"),
                next_profile_payload,
            )
            summary["applied_profile_updates"] += 1

    report = {"summary": summary, "rows": rows}
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(summary, indent=2))
    print(f"Report written to {report_path}")


if __name__ == "__main__":
    main()
