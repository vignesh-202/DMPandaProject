import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCTION_PATH = ROOT / "functions" / "inactive-user-cleanup" / "main.py"


def load_function_module():
    spec = importlib.util.spec_from_file_location("inactive_user_cleanup_main", FUNCTION_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def check_behavior(module):
    now = datetime(2026, 4, 24, 0, 0, tzinfo=timezone.utc)

    paid_user = {"$id": "user-paid"}
    active_paid_profile = {"plan_code": "pro", "plan_source": "payment", "expiry_date": "2026-05-24T00:00:00Z"}
    paid_result = module._evaluate_user(paid_user, active_paid_profile, None, now)
    assert_true(paid_result["decision"] == "skip_paid", "Active paid user should never be eligible for cleanup.")

    free_profile = {"plan_code": "free", "plan_source": "system", "expiry_date": None}

    active_free_user = {
        "$id": "user-active",
        "last_active_at": "2026-04-20T00:00:00Z",
        "cleanup_state_json": None,
    }
    recent_result = module._evaluate_user(active_free_user, free_profile, None, now)
    assert_true(recent_result["decision"] == "skip_not_due", "Recently active free user should not enter cleanup workflow.")

    stale_free_user = {
        "$id": "user-stale",
        "last_active_at": "2025-09-01T00:00:00Z",
        "cleanup_state_json": None,
    }
    stale_result = module._evaluate_user(stale_free_user, free_profile, None, now)
    assert_true(stale_result["decision"] == "candidate", "Inactive free user inside warning window should become a cleanup candidate.")
    assert_true(stale_result["days_until_delete"] == 30, "Backfilled overdue user should get a safe 30-day warning runway before deletion.")

    refreshed_user = {
        "$id": "user-reset",
        "last_active_at": "2026-04-24T00:00:00Z",
        "cleanup_state_json": json.dumps({
            "v": 1,
            "activity_at": "2025-09-01T00:00:00Z",
            "scheduled_delete_at": "2026-04-24T00:00:00Z",
            "warnings": {"30d": "2026-03-25T00:00:00Z"},
        }),
    }
    reset_result = module._evaluate_user(refreshed_user, free_profile, None, now)
    assert_true(reset_result["decision"] == "skip_not_due", "Fresh activity should reset the deletion countdown.")

    expired_paid_profile = {"plan_code": "pro", "plan_source": "payment", "expiry_date": "2026-04-01T00:00:00Z"}
    uncertain_result = module._evaluate_user({"$id": "user-uncertain"}, expired_paid_profile, None, now)
    assert_true(uncertain_result["decision"] == "skip_uncertain", "Uncertain non-free runtime state must fail closed.")

    assert_true(module._warning_key_for_days(30) == "30d", "30-day warning key mismatch.")
    assert_true(module._warning_key_for_days(7) == "7d", "7-day warning key mismatch.")
    assert_true(module._warning_key_for_days(1) == "1d", "1-day warning key mismatch.")
    assert_true(module._warning_key_for_days(0) == "day0", "Final-day warning key mismatch.")

    deleted_ref = module._build_deleted_user_ref("user-123")
    assert_true(deleted_ref.startswith("deleted:"), "Deleted transaction reference must be anonymized.")


def check_static_wiring():
    manifest = json.loads((ROOT / "functions" / "function-manifest.json").read_text(encoding="utf-8"))
    manifest_ids = {entry["functionId"] for entry in manifest}
    assert_true("inactive-user-cleanup" in manifest_ids, "Function manifest is missing inactive-user-cleanup.")

    setup_text = (ROOT / "ProductionSetup" / "setup_appwrite.py").read_text(encoding="utf-8")
    for token in ("last_active_at", "cleanup_protected", "cleanup_state_json", "inactive_user_cleanup_audit"):
        assert_true(token in setup_text, f"Schema setup is missing {token}.")

    sync_text = (ROOT / "functions" / "sync-function-variables.ps1").read_text(encoding="utf-8")
    assert_true("inactive-user-cleanup" in sync_text, "Function variable sync is missing inactive-user-cleanup.")

    required_touch_files = [
        ROOT / "Backend" / "middleware" / "auth.js",
        ROOT / "Backend" / "routes" / "auth.js",
        ROOT / "Backend" / "routes" / "payment.js",
        ROOT / "Backend" / "routes" / "admin.js",
    ]
    for file_path in required_touch_files:
        text = file_path.read_text(encoding="utf-8")
        assert_true("touchUserActivity" in text or "ensureUserActivityDocument" in text, f"Activity refresh hook missing from {file_path.name}.")

    cleanup_text = (ROOT / "Backend" / "utils" / "userCleanup.js").read_text(encoding="utf-8")
    for token in ("PAYMENT_ATTEMPTS_COLLECTION_ID", "COUPON_REDEMPTIONS_COLLECTION_ID", "LOGS_COLLECTION_ID", "anonymizeTransactionsForUser"):
        assert_true(token in cleanup_text, f"userCleanup.js is missing {token}.")


def main():
    module = load_function_module()
    check_behavior(module)
    check_static_wiring()
    print("inactive_cleanup_verification=passed")


if __name__ == "__main__":
    main()
