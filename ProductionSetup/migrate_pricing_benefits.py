import argparse
import json
import os
from datetime import datetime, timezone
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

PRICING_COLLECTION_ID = os.getenv("PRICING_COLLECTION_ID", "pricing")
PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")

PAGE_SIZE = 100
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

BENEFIT_LABELS = {
    "unlimited_contacts": "Unlimited Contacts",
    "post_comment_dm_automation": "Post Comment DM Automation",
    "post_comment_reply_automation": "Post Comment Reply Automation",
    "reel_comment_dm_automation": "Reel Comment DM Automation",
    "reel_comment_reply_automation": "Reel Comment Reply Automation",
    "share_reel_to_dm": "Share Reel To DM",
    "share_post_to_dm": "Share Post To DM",
    "super_profile": "Super Profile",
    "welcome_message": "Welcome Message",
    "convo_starters": "Convo Starters",
    "inbox_menu": "Inbox Menu",
    "dm_automation": "DM Automation",
    "story_automation": "Story Automation",
    "suggest_more": "Suggest More",
    "comment_moderation": "Comment Moderation",
    "global_trigger": "Global Trigger",
    "mentions": "Mentions",
    "collect_email": "Collect Email",
    "instagram_live_automation": "Instagram Live Automation",
    "priority_support": "Priority Support",
    "followers_only": "Followers Only",
    "seen_typing": "Seen + Typing",
    "no_watermark": "No Watermark",
}

BENEFIT_STORAGE_KEYS = {
    "post_comment_reply_automation": "post_comment_reply",
    "reel_comment_reply_automation": "reel_comment_reply",
}


def benefit_attribute_key(key):
    return f"benefit_{BENEFIT_STORAGE_KEYS.get(key, key)}"

PLAN_DEFINITIONS = {
    "free": {
        "name": "Free Plan",
        "limits": (3, 100, 100, 1000),
        "benefits": [
            "unlimited_contacts",
            "post_comment_dm_automation",
            "reel_comment_dm_automation",
            "super_profile",
            "welcome_message",
            "convo_starters",
            "inbox_menu",
        ],
    },
    "basic": {
        "name": "Basic Plan",
        "limits": (3, 100, 1000, 25000),
        "benefits": [
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
            "seen_typing",
            "no_watermark",
        ],
    },
    "pro": {
        "name": "Pro Plan",
        "limits": (5, 200, 2500, 70000),
        "benefits": [
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
            "global_trigger",
            "mentions",
            "story_automation",
            "collect_email",
            "suggest_more",
            "comment_moderation",
            "instagram_live_automation",
            "priority_support",
            "followers_only",
            "seen_typing",
            "no_watermark",
        ],
    },
    "ultra": {
        "name": "Ultra Plan",
        "limits": (10, 400, 5000, 100000),
        "benefits": [
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
            "global_trigger",
            "mentions",
            "story_automation",
            "collect_email",
            "suggest_more",
            "comment_moderation",
            "instagram_live_automation",
            "priority_support",
            "followers_only",
            "seen_typing",
            "no_watermark",
        ],
    },
}


def _client():
    missing = [
        key
        for key, value in {
            "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
            "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
            "APPWRITE_API_KEY": APPWRITE_API_KEY,
            "DATABASE_ID": DATABASE_ID,
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


def _list_all(databases, collection_id, queries=None):
    docs = []
    offset = 0
    while True:
        page = databases.list_documents(
            DATABASE_ID,
            collection_id,
            [Query.limit(PAGE_SIZE), Query.offset(offset), *(queries or [])],
        )
        docs.extend(page.get("documents", []))
        if len(page.get("documents", [])) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return docs


def _parse_json_object(value):
    if not value:
        return {}
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _json_compact(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _profile_config(profile):
    config = _parse_json_object(profile.get("feature_overrides_json"))
    return {
        "feature_overrides": _parse_json_object(config.get("__feature_overrides")),
        "limit_overrides": _parse_json_object(config.get("__limit_overrides")),
    }


def _benefit_payload(enabled_keys):
    enabled = set(enabled_keys or [])
    return {benefit_attribute_key(key): key in enabled for key in BENEFIT_KEYS}


def _comparison_json(enabled_keys):
    enabled = set(enabled_keys or [])
    return _json_compact([
        {"key": key, "label": BENEFIT_LABELS.get(key, key.replace("_", " ").title()), "value": key in enabled}
        for key in BENEFIT_KEYS
    ])


def _features_json(enabled_keys):
    return _json_compact([BENEFIT_LABELS.get(key, key.replace("_", " ").title()) for key in enabled_keys])


def _normalize_plan_code(value):
    normalized = str(value or "").strip().lower()
    return normalized or "free"


def _pricing_payload(plan_code, existing):
    definition = PLAN_DEFINITIONS[plan_code]
    instagram, hourly, daily, monthly = definition["limits"]
    benefits = definition["benefits"]
    payload = {
        "name": str(existing.get("name") or definition["name"]),
        "plan_code": plan_code,
        "yearly_bonus": "",
        "instagram_connections_limit": instagram,
        "instagram_link_limit": instagram,
        "actions_per_hour_limit": hourly,
        "actions_per_day_limit": daily,
        "actions_per_month_limit": monthly,
        "monthly_duration_days": int(existing.get("monthly_duration_days") or 30),
        "yearly_duration_days": int(existing.get("yearly_duration_days") or 364),
        "features": _features_json(benefits),
        "comparison_json": _comparison_json(benefits),
        **_benefit_payload(benefits),
    }
    return payload


def _pricing_value_matches(existing, key, value):
    current = existing.get(key)
    if key == "yearly_bonus":
        return str(current or "") == str(value or "")
    return current == value


def _profile_has_admin_override(profile, pricing_defaults):
    if _parse_json_object(profile.get("admin_override_json")):
        return True
    config = _profile_config(profile)
    if config["feature_overrides"] or config["limit_overrides"]:
        return True
    for key in BENEFIT_KEYS:
        field = benefit_attribute_key(key)
        if field in profile and bool(profile.get(field)) != bool(pricing_defaults.get(field)):
            return True
    return False


def _pricing_limits(pricing):
    return {
        "instagram_connections_limit": int(pricing.get("instagram_connections_limit") or 0),
        "instagram_link_limit": int(pricing.get("instagram_link_limit") or pricing.get("instagram_connections_limit") or 0),
        "hourly_action_limit": int(pricing.get("actions_per_hour_limit") or 0),
        "daily_action_limit": int(pricing.get("actions_per_day_limit") or 0),
        "monthly_action_limit": int(pricing.get("actions_per_month_limit") or 0) or None,
    }


def _runtime_features(pricing, profile):
    config = _profile_config(profile)
    feature_overrides = config["feature_overrides"]
    runtime = {}
    for key in BENEFIT_KEYS:
        field = benefit_attribute_key(key)
        runtime[key] = bool(profile.get(field, pricing.get(field)))
        if key in feature_overrides:
            runtime[key] = bool(feature_overrides[key])
    return runtime


def _runtime_limits(pricing, profile):
    config = _profile_config(profile)
    limit_overrides = config["limit_overrides"]
    runtime = _pricing_limits(pricing)
    for key in list(runtime.keys()):
        if key in limit_overrides:
            override = limit_overrides[key]
            runtime[key] = None if override is None else int(override or 0)
    return runtime


def _profile_payload(profile, pricing_by_code):
    plan_code = _normalize_plan_code(profile.get("plan_code"))
    pricing = pricing_by_code.get(plan_code) or pricing_by_code.get("free") or {}
    defaults = {benefit_attribute_key(key): bool(pricing.get(benefit_attribute_key(key))) for key in BENEFIT_KEYS}
    keep_custom = _profile_has_admin_override(profile, defaults)
    if keep_custom:
        benefits = {
            benefit_attribute_key(key): bool(profile.get(benefit_attribute_key(key), defaults[benefit_attribute_key(key)]))
            for key in BENEFIT_KEYS
        }
        override = _parse_json_object(profile.get("admin_override_json"))
        override.setdefault("benefits_preserved_at", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
        runtime_features = _runtime_features(pricing, profile)
        runtime_limits = _runtime_limits(pricing, profile)
        return {
            **benefits,
            "admin_override_json": _json_compact(override),
            "features_json": _json_compact(runtime_features),
            "limits_json": _json_compact(runtime_limits),
            "instagram_link_limit": int(runtime_limits["instagram_link_limit"] or 0),
            "hourly_action_limit": int(runtime_limits["hourly_action_limit"] or 0),
            "daily_action_limit": int(runtime_limits["daily_action_limit"] or 0),
            "monthly_action_limit": 0 if runtime_limits["monthly_action_limit"] is None else int(runtime_limits["monthly_action_limit"] or 0),
        }
    runtime_features = _runtime_features(pricing, profile)
    runtime_limits = _runtime_limits(pricing, profile)
    return {
        **defaults,
        "features_json": _json_compact(runtime_features),
        "limits_json": _json_compact(runtime_limits),
        "instagram_link_limit": int(runtime_limits["instagram_link_limit"] or 0),
        "hourly_action_limit": int(runtime_limits["hourly_action_limit"] or 0),
        "daily_action_limit": int(runtime_limits["daily_action_limit"] or 0),
        "monthly_action_limit": 0 if runtime_limits["monthly_action_limit"] is None else int(runtime_limits["monthly_action_limit"] or 0),
    }


def _write_json(path, payload):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_checkpoint(path):
    checkpoint_path = Path(path)
    if not checkpoint_path.exists():
        return {
            "pricing_updated": [],
            "profiles_updated": [],
            "failed": [],
            "last_updated_at": None,
        }
    try:
        parsed = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        return {
            "pricing_updated": list(parsed.get("pricing_updated") or []),
            "profiles_updated": list(parsed.get("profiles_updated") or []),
            "failed": list(parsed.get("failed") or []),
            "last_updated_at": parsed.get("last_updated_at"),
        }
    except Exception:
        return {
            "pricing_updated": [],
            "profiles_updated": [],
            "failed": [],
            "last_updated_at": None,
        }


def _save_checkpoint(path, checkpoint):
    checkpoint["last_updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    _write_json(path, checkpoint)


def main():
    parser = argparse.ArgumentParser(description="Update DM Panda pricing limits/benefits and profile benefit booleans.")
    parser.add_argument("--apply", action="store_true", help="Apply changes. Omit for dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Explicitly run in dry-run mode.")
    parser.add_argument("--resume", action="store_true", help="Resume apply mode from checkpoint.")
    parser.add_argument("--checkpoint", default=str(ROOT_DIR / "reports" / "pricing-benefit-migration.checkpoint.json"))
    parser.add_argument("--backup-dir", default=str(ROOT_DIR / "reports" / "migration_backups"))
    parser.add_argument("--report", default=str(ROOT_DIR / "reports" / "pricing-benefit-migration.json"))
    args = parser.parse_args()
    should_apply = bool(args.apply) and not bool(args.dry_run)
    if args.resume and not should_apply:
        raise SystemExit("--resume requires --apply and cannot be used with --dry-run.")

    databases = Databases(_client())
    pricing_docs = _list_all(databases, PRICING_COLLECTION_ID)
    pricing_by_code = {
        _normalize_plan_code(doc.get("plan_code") or doc.get("name")): doc
        for doc in pricing_docs
    }
    profiles = _list_all(databases, PROFILES_COLLECTION_ID)

    backup_path = None
    checkpoint = _load_checkpoint(args.checkpoint) if should_apply else {
        "pricing_updated": [],
        "profiles_updated": [],
        "failed": [],
        "last_updated_at": None,
    }
    completed_pricing = set(checkpoint.get("pricing_updated") or [])
    completed_profiles = set(checkpoint.get("profiles_updated") or [])
    if should_apply and not args.resume:
        checkpoint = {
            "pricing_updated": [],
            "profiles_updated": [],
            "failed": [],
            "last_updated_at": None,
        }
        completed_pricing = set()
        completed_profiles = set()
        now_tag = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = Path(args.backup_dir) / f"pricing_profiles_backup_{now_tag}.json"
        _write_json(backup_path, {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "database_id": DATABASE_ID,
            "pricing_collection_id": PRICING_COLLECTION_ID,
            "profiles_collection_id": PROFILES_COLLECTION_ID,
            "pricing_documents": pricing_docs,
            "profile_documents": profiles,
        })
        _save_checkpoint(args.checkpoint, checkpoint)

    report = {
        "apply": bool(should_apply),
        "dry_run": not should_apply,
        "resume": bool(args.resume),
        "checkpoint": str(Path(args.checkpoint)),
        "backup": str(backup_path) if backup_path else None,
        "pricing_updates": [],
        "profiles_scanned": 0,
        "profiles_updated": 0,
        "manual_review": [],
        "failures": [],
    }

    for plan_code in ["free", "basic", "pro", "ultra"]:
        existing = pricing_by_code.get(plan_code)
        if not existing:
            report["manual_review"].append({
                "collection": PRICING_COLLECTION_ID,
                "reason": f"Missing pricing document for plan_code={plan_code}; create manually via approved script before apply.",
            })
            continue
        payload = _pricing_payload(plan_code, existing)
        changed = {key: value for key, value in payload.items() if not _pricing_value_matches(existing, key, value)}
        if changed:
            report["pricing_updates"].append({"plan_code": plan_code, "document_id": existing.get("$id"), "changes": changed})
        if should_apply and changed:
            document_id = str(existing.get("$id") or "").strip()
            if document_id and document_id in completed_pricing:
                pricing_by_code[plan_code] = {**existing, **payload}
                continue
            try:
                updated = databases.update_document(DATABASE_ID, PRICING_COLLECTION_ID, existing["$id"], changed)
                pricing_by_code[plan_code] = {**existing, **updated}
                if document_id:
                    completed_pricing.add(document_id)
                    checkpoint["pricing_updated"] = sorted(completed_pricing)
                    _save_checkpoint(args.checkpoint, checkpoint)
            except Exception as error:
                failure = {
                    "phase": "pricing_update",
                    "plan_code": plan_code,
                    "document_id": existing.get("$id"),
                    "error": str(error),
                }
                report["failures"].append(failure)
                checkpoint["failed"] = checkpoint.get("failed", []) + [failure]
                _save_checkpoint(args.checkpoint, checkpoint)
        else:
            pricing_by_code[plan_code] = {**existing, **payload}

    for profile in profiles:
        report["profiles_scanned"] += 1
        payload = _profile_payload(profile, pricing_by_code)
        changed = {key: value for key, value in payload.items() if profile.get(key) != value}
        if not changed:
            continue
        report["profiles_updated"] += 1
        if should_apply:
            document_id = str(profile.get("$id") or "").strip()
            if document_id and document_id in completed_profiles:
                continue
            try:
                databases.update_document(DATABASE_ID, PROFILES_COLLECTION_ID, profile["$id"], changed)
                if document_id:
                    completed_profiles.add(document_id)
                    checkpoint["profiles_updated"] = sorted(completed_profiles)
                    _save_checkpoint(args.checkpoint, checkpoint)
            except Exception as error:
                failure = {
                    "phase": "profile_update",
                    "document_id": profile.get("$id"),
                    "user_id": profile.get("user_id"),
                    "error": str(error),
                }
                report["failures"].append(failure)
                checkpoint["failed"] = checkpoint.get("failed", []) + [failure]
                _save_checkpoint(args.checkpoint, checkpoint)

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "apply": report["apply"],
        "dry_run": report["dry_run"],
        "pricing_updates": len(report["pricing_updates"]),
        "profiles_scanned": report["profiles_scanned"],
        "profiles_updated": report["profiles_updated"],
        "manual_review": len(report["manual_review"]),
        "failures": len(report["failures"]),
        "checkpoint": report["checkpoint"],
        "backup": report["backup"],
        "report": str(report_path),
    }, indent=2))
    if report["failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
