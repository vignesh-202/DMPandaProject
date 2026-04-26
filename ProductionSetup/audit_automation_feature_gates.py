import argparse
import json
import os
from datetime import datetime, timezone
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
PROFILES_COLLECTION_ID = os.getenv("PROFILES_COLLECTION_ID", "profiles")
AUTOMATIONS_COLLECTION_ID = os.getenv("AUTOMATIONS_COLLECTION_ID", "automations")
PAGE_SIZE = 100

TOGGLE_FEATURE_MAP = {
    "suggest_more_enabled": "suggest_more",
    "collect_email_enabled": "collect_email",
    "seen_typing_enabled": "seen_typing",
    "followers_only": "followers_only",
}
AUTOMATION_TYPE_FEATURE_MAP = {
    "dm": "dm_automation",
    "global": "global_trigger",
    "comment": "post_comment_dm_automation",
    "post": "post_comment_dm_automation",
    "reel": "reel_comment_dm_automation",
    "story": "story_automation",
    "live": "instagram_live_automation",
    "mention": "mentions",
    "mentions": "mentions",
    "welcome_message": "welcome_message",
    "inbox_menu": "inbox_menu",
    "convo_starter": "convo_starters",
    "suggest_more": "suggest_more",
    "comment_moderation": "comment_moderation",
    "moderation_hide": "comment_moderation",
    "moderation_delete": "comment_moderation",
}
COMMENT_REPLY_FEATURE_MAP = {
    "comment": "post_comment_reply_automation",
    "post": "post_comment_reply_automation",
    "reel": "reel_comment_reply_automation",
    "global": "post_comment_reply_automation",
}
SHARE_TRIGGER_FEATURE_MAP = {
    "comment": "share_post_to_dm",
    "post": "share_post_to_dm",
    "reel": "share_reel_to_dm",
}


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
    docs = []
    offset = 0
    while True:
        page = databases.list_documents(DATABASE_ID, collection_id, [Query.limit(PAGE_SIZE), Query.offset(offset)])
        batch = page.get("documents", [])
        docs.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return docs


def _list_collection_attributes(databases, collection_id):
    try:
        collection = databases.get_collection(DATABASE_ID, collection_id)
    except Exception:
        return set()
    return {
        str(attribute.get("key") or "").strip()
        for attribute in collection.get("attributes", [])
        if str(attribute.get("key") or "").strip()
    }


def _parse_json_object(value):
    if not value:
        return {}
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _required_features(automation):
    required = set()
    automation_type = str(automation.get("automation_type") or "dm").strip().lower()
    if AUTOMATION_TYPE_FEATURE_MAP.get(automation_type):
        required.add(AUTOMATION_TYPE_FEATURE_MAP[automation_type])
    for field, feature in TOGGLE_FEATURE_MAP.items():
        if automation.get(field) is True:
            required.add(feature)
    if str(automation.get("comment_reply") or "").strip():
        feature = COMMENT_REPLY_FEATURE_MAP.get(automation_type)
        if feature:
            required.add(feature)
    is_share_trigger = str(automation.get("trigger_type") or "").strip().lower() == "share_to_admin" or automation.get("share_to_admin_enabled") is True or str(automation.get("template_type") or "").strip() == "template_share_post"
    if is_share_trigger:
        required.add(SHARE_TRIGGER_FEATURE_MAP.get(automation_type, "share_post_to_dm"))
    return sorted(required)


def _write_json(path, payload):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_checkpoint(path):
    checkpoint_path = Path(path)
    if not checkpoint_path.exists():
        return {"updated_automations": [], "failed": [], "last_updated_at": None}
    try:
        parsed = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        return {
            "updated_automations": list(parsed.get("updated_automations") or []),
            "failed": list(parsed.get("failed") or []),
            "last_updated_at": parsed.get("last_updated_at"),
        }
    except Exception:
        return {"updated_automations": [], "failed": [], "last_updated_at": None}


def _save_checkpoint(path, checkpoint):
    checkpoint["last_updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    _write_json(path, checkpoint)


def main():
    parser = argparse.ArgumentParser(description="Audit automations against migrated runtime entitlements.")
    parser.add_argument("--apply", action="store_true", help="Deactivate invalid automations instead of reporting only.")
    parser.add_argument("--dry-run", action="store_true", help="Explicitly run in dry-run mode.")
    parser.add_argument("--resume", action="store_true", help="Resume apply mode from checkpoint.")
    parser.add_argument("--checkpoint", default=str(Path(__file__).resolve().parents[1] / "reports" / "automation-feature-audit.checkpoint.json"))
    parser.add_argument("--backup-dir", default=str(Path(__file__).resolve().parents[1] / "reports" / "migration_backups"))
    parser.add_argument("--report", default=str(Path(__file__).resolve().parents[1] / "reports" / "automation-feature-audit.json"))
    args = parser.parse_args()
    should_apply = bool(args.apply) and not bool(args.dry_run)
    if args.resume and not should_apply:
        raise SystemExit("--resume requires --apply and cannot be used with --dry-run.")

    databases = Databases(_client())
    automation_attributes = _list_collection_attributes(databases, AUTOMATIONS_COLLECTION_ID)
    supports_plan_validation_state = "plan_validation_state" in automation_attributes
    supports_invalid_features = "invalid_features" in automation_attributes
    profiles = _list_all(databases, PROFILES_COLLECTION_ID)
    automations = _list_all(databases, AUTOMATIONS_COLLECTION_ID)
    profile_by_user_id = {str(profile.get("user_id") or "").strip(): profile for profile in profiles if profile.get("user_id")}
    checkpoint = _load_checkpoint(args.checkpoint) if should_apply else {"updated_automations": [], "failed": [], "last_updated_at": None}
    completed_ids = set(checkpoint.get("updated_automations") or [])
    backup_path = None
    if should_apply and not args.resume:
        checkpoint = {"updated_automations": [], "failed": [], "last_updated_at": None}
        completed_ids = set()
        now_tag = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = Path(args.backup_dir) / f"automations_feature_audit_backup_{now_tag}.json"
        _write_json(backup_path, {
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "database_id": DATABASE_ID,
            "automations_collection_id": AUTOMATIONS_COLLECTION_ID,
            "documents": automations,
        })
        _save_checkpoint(args.checkpoint, checkpoint)

    invalid = []
    failures = []
    for automation in automations:
        user_id = str(automation.get("user_id") or "").strip()
        profile = profile_by_user_id.get(user_id)
        entitlements = _parse_json_object(profile.get("features_json") if profile else None)
        missing = [feature for feature in _required_features(automation) if entitlements.get(feature) is not True]
        if not missing:
            continue
        item = {
            "automation_id": automation.get("$id"),
            "user_id": user_id,
            "account_id": automation.get("account_id"),
            "title": automation.get("title"),
            "automation_type": automation.get("automation_type"),
            "missing_features": missing,
            "will_deactivate": bool(should_apply),
        }
        invalid.append(item)
        if should_apply and automation.get("$id"):
            document_id = str(automation.get("$id") or "").strip()
            if document_id in completed_ids:
                continue
            existing_invalid_features = []
            if isinstance(automation.get("invalid_features"), list):
                existing_invalid_features = automation.get("invalid_features")
            elif isinstance(automation.get("invalid_features"), str):
                try:
                    parsed_invalid_features = json.loads(automation.get("invalid_features"))
                    if isinstance(parsed_invalid_features, list):
                        existing_invalid_features = parsed_invalid_features
                except Exception:
                    existing_invalid_features = []
            if (
                automation.get("is_active") is False
                and (
                    not supports_plan_validation_state
                    or str(automation.get("plan_validation_state") or "").strip().lower() == "invalid_due_to_plan"
                )
                and (
                    not supports_invalid_features
                    or sorted(str(item).strip() for item in existing_invalid_features) == sorted(str(item).strip() for item in missing)
                )
            ):
                completed_ids.add(document_id)
                checkpoint["updated_automations"] = sorted(completed_ids)
                _save_checkpoint(args.checkpoint, checkpoint)
                continue
            patch = {
                "is_active": False,
            }
            if supports_plan_validation_state:
                patch["plan_validation_state"] = "invalid_due_to_plan"
            if supports_invalid_features:
                patch["invalid_features"] = json.dumps(missing)
            try:
                databases.update_document(DATABASE_ID, AUTOMATIONS_COLLECTION_ID, automation["$id"], patch)
                completed_ids.add(document_id)
                checkpoint["updated_automations"] = sorted(completed_ids)
                _save_checkpoint(args.checkpoint, checkpoint)
            except Exception as error:
                failure = {
                    "phase": "automation_update",
                    "automation_id": automation.get("$id"),
                    "user_id": user_id,
                    "error": str(error),
                }
                failures.append(failure)
                checkpoint["failed"] = checkpoint.get("failed", []) + [failure]
                _save_checkpoint(args.checkpoint, checkpoint)

    report = {
        "apply": bool(should_apply),
        "dry_run": not should_apply,
        "resume": bool(args.resume),
        "schema_support": {
            "plan_validation_state": supports_plan_validation_state,
            "invalid_features": supports_invalid_features,
        },
        "checkpoint": str(Path(args.checkpoint)),
        "backup": str(backup_path) if backup_path else None,
        "profiles_scanned": len(profiles),
        "automations_scanned": len(automations),
        "invalid_automations": invalid,
        "failures": failures,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "apply": report["apply"],
        "dry_run": report["dry_run"],
        "profiles_scanned": report["profiles_scanned"],
        "automations_scanned": report["automations_scanned"],
        "invalid_automations": len(invalid),
        "failures": len(failures),
        "checkpoint": report["checkpoint"],
        "backup": report["backup"],
        "report": str(report_path),
    }, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
