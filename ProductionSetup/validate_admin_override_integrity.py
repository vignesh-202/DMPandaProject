import argparse
import json
import os
from pathlib import Path

from appwrite.client import Client
from appwrite.query import Query
from appwrite.services.databases import Databases
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
DATABASE_ID = os.getenv("DATABASE_ID") or os.getenv("APPWRITE_DATABASE_ID")
PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")
PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")
PAGE_SIZE = 100


def _client():
    missing = [
        key
        for key, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "APPWRITE_DATABASE_ID": DATABASE_ID,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing required env values: {', '.join(missing)}")
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)
    return client


def _list_all(databases, collection_id):
    rows = []
    offset = 0
    while True:
        page = databases.list_documents(
            DATABASE_ID,
            collection_id,
            [Query.limit(PAGE_SIZE), Query.offset(offset)],
        )
        docs = page.get("documents", [])
        rows.extend(docs)
        if len(docs) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def _parse_json_object(value):
    if not value:
        return {}
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _normalize_key(value):
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("+", "_")
        .replace("/", "_")
        .replace("-", "_")
        .replace(" ", "_")
    )


def _pricing_defaults(doc):
    features = {}
    limits = {
        "instagram_connections_limit": int(doc.get("instagram_connections_limit") or 0),
        "instagram_link_limit": int(doc.get("instagram_link_limit") or doc.get("instagram_connections_limit") or 0),
        "hourly_action_limit": int(doc.get("actions_per_hour_limit") or 0),
        "daily_action_limit": int(doc.get("actions_per_day_limit") or 0),
        "monthly_action_limit": int(doc.get("actions_per_month_limit") or 0),
    }
    for key, value in doc.items():
        if str(key).startswith("benefit_"):
            normalized = _normalize_key(str(key)[len("benefit_"):])
            if normalized:
                features[normalized] = value is True
    return {"features": features, "limits": limits}


def _profile_overrides(profile):
    parsed = _parse_json_object(profile.get("feature_overrides_json"))
    feature_overrides = _parse_json_object(parsed.get("__feature_overrides"))
    limit_overrides = _parse_json_object(parsed.get("__limit_overrides"))
    for key, value in parsed.items():
        if key.startswith("__"):
            continue
        normalized = _normalize_key(key)
        if normalized and normalized not in feature_overrides:
            feature_overrides[normalized] = value
    sanitized_feature_overrides = {}
    for key, value in feature_overrides.items():
        raw_key = str(key or "").strip()
        if raw_key.startswith("__"):
            continue
        normalized = _normalize_key(raw_key)
        if not normalized or normalized.startswith("__"):
            continue
        if normalized in {"paid_plan_snapshot", "feature_overrides", "limit_overrides"}:
            continue
        sanitized_feature_overrides[normalized] = bool(value)

    return {
        "feature_overrides": sanitized_feature_overrides,
        "limit_overrides": { _normalize_key(k): v for k, v in limit_overrides.items() if _normalize_key(k) },
    }


def main():
    parser = argparse.ArgumentParser(description="Validate admin override precedence and migration persistence.")
    parser.add_argument("--report", default=str(Path(__file__).resolve().parents[1] / "reports" / "admin-override-validation.json"))
    parser.add_argument("--strict", action="store_true", help="Exit with non-zero status when violations are found.")
    args = parser.parse_args()

    databases = Databases(_client())
    pricing_docs = _list_all(databases, PRICING_COLLECTION_ID)
    profiles = _list_all(databases, PROFILES_COLLECTION_ID)
    pricing_map = {}
    for doc in pricing_docs:
        plan_code = _normalize_key(doc.get("plan_code") or doc.get("name") or "free") or "free"
        pricing_map[plan_code] = _pricing_defaults(doc)
    free_defaults = pricing_map.get("free") or {"features": {}, "limits": {}}

    violations = []
    checked_profiles = 0
    profiles_with_overrides = 0

    for profile in profiles:
        overrides = _profile_overrides(profile)
        feature_overrides = overrides["feature_overrides"]
        limit_overrides = overrides["limit_overrides"]
        has_override = bool(feature_overrides or limit_overrides or _parse_json_object(profile.get("admin_override_json")))
        if not has_override:
            continue

        checked_profiles += 1
        profiles_with_overrides += 1
        plan_code = _normalize_key(profile.get("plan_code") or "free") or "free"
        defaults = pricing_map.get(plan_code) or free_defaults
        runtime_features = _parse_json_object(profile.get("features_json"))
        runtime_limits = _parse_json_object(profile.get("limits_json"))

        for key, override_value in feature_overrides.items():
            expected = bool(override_value)
            actual = runtime_features.get(key)
            if bool(actual) != expected:
                violations.append({
                    "type": "override_plan_precedence",
                    "scope": "feature",
                    "profile_id": profile.get("$id"),
                    "user_id": profile.get("user_id"),
                    "plan_code": plan_code,
                    "feature_key": key,
                    "plan_default": bool(defaults["features"].get(key, False)),
                    "override_value": expected,
                    "runtime_value": bool(actual),
                })

        for key, override_value in limit_overrides.items():
            normalized = _normalize_key(key)
            expected = None if override_value is None else int(override_value or 0)
            actual_raw = runtime_limits.get(normalized)
            actual = None if actual_raw is None else int(actual_raw or 0)
            if actual != expected:
                violations.append({
                    "type": "override_plan_precedence",
                    "scope": "limit",
                    "profile_id": profile.get("$id"),
                    "user_id": profile.get("user_id"),
                    "plan_code": plan_code,
                    "limit_key": normalized,
                    "plan_default": defaults["limits"].get(normalized),
                    "override_value": expected,
                    "runtime_value": actual,
                })

        if (feature_overrides or limit_overrides) and not _parse_json_object(profile.get("admin_override_json")):
            violations.append({
                "type": "override_persistence",
                "scope": "metadata",
                "profile_id": profile.get("$id"),
                "user_id": profile.get("user_id"),
                "plan_code": plan_code,
                "reason": "feature_overrides_json exists but admin_override_json is empty",
            })

    report = {
        "profiles_scanned": len(profiles),
        "profiles_with_overrides": profiles_with_overrides,
        "checked_profiles": checked_profiles,
        "violations_count": len(violations),
        "violations": violations,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "profiles_scanned": report["profiles_scanned"],
        "profiles_with_overrides": report["profiles_with_overrides"],
        "checked_profiles": report["checked_profiles"],
        "violations_count": report["violations_count"],
        "report": str(report_path),
    }, indent=2))
    if args.strict and violations:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
