import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parent / "main.py"
SPEC = importlib.util.spec_from_file_location("subscription_manager_main", MODULE_PATH)
subscription_manager = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(subscription_manager)


class SubscriptionManagerTests(unittest.TestCase):
    def setUp(self):
        self.now = subscription_manager.datetime(2026, 5, 7, 12, 0, 0, tzinfo=subscription_manager.timezone.utc)
        self.pricing_map = {
            "free": {
                "plan_name": "Free Plan",
                "instagram_connections_limit": 0,
                "hourly_action_limit": 0,
                "daily_action_limit": 0,
                "monthly_action_limit": 0,
                "monthly_duration_days": 30,
                "yearly_duration_days": 364,
            },
            "basic": {
                "plan_name": "Basic Plan",
                "instagram_connections_limit": 1,
                "hourly_action_limit": 10,
                "daily_action_limit": 100,
                "monthly_action_limit": 1000,
                "monthly_duration_days": 30,
                "yearly_duration_days": 364,
            },
            "pro": {
                "plan_name": "Pro Plan",
                "instagram_connections_limit": 3,
                "hourly_action_limit": 25,
                "daily_action_limit": 500,
                "monthly_action_limit": 7000,
                "monthly_duration_days": 30,
                "yearly_duration_days": 364,
            },
        }

    def build_transaction(self, **overrides):
        payload = {
            "$id": overrides.get("$id", "tx"),
            "plan_code": overrides.get("plan_code", "pro"),
            "status": overrides.get("status", "success"),
            "created_at": overrides.get("created_at", "2026-05-01T00:00:00Z"),
            "billing_cycle": overrides.get("billing_cycle", "monthly"),
            "expiry_date": overrides.get("expiry_date"),
        }
        return payload

    def test_latest_transaction_only_drops_to_free_when_newest_is_expired(self):
        transactions = [
            self.build_transaction(
                **{
                    "$id": "tx-older-valid",
                    "plan_code": "pro",
                    "created_at": "2026-04-01T00:00:00Z",
                    "expiry_date": "2026-07-01T00:00:00Z",
                }
            ),
            self.build_transaction(
                **{
                    "$id": "tx-newer-expired",
                    "plan_code": "basic",
                    "created_at": "2026-05-06T00:00:00Z",
                    "expiry_date": "2026-05-06T06:00:00Z",
                }
            ),
        ]

        result = subscription_manager._self_subscription_from_transactions(transactions, self.pricing_map, self.now)
        self.assertEqual(result["plan_id"], "free")
        self.assertIsNone(result["expiry_date"])

    def test_refunded_and_cancelled_transactions_are_ignored(self):
        transactions = [
            self.build_transaction(
                **{
                    "$id": "tx-refunded",
                    "plan_code": "pro",
                    "status": "refunded",
                    "created_at": "2026-05-06T00:00:00Z",
                    "expiry_date": "2026-08-01T00:00:00Z",
                }
            ),
            self.build_transaction(
                **{
                    "$id": "tx-cancelled",
                    "plan_code": "basic",
                    "status": "cancelled",
                    "created_at": "2026-05-05T00:00:00Z",
                    "expiry_date": "2026-08-01T00:00:00Z",
                }
            ),
        ]

        result = subscription_manager._self_subscription_from_transactions(transactions, self.pricing_map, self.now)
        self.assertEqual(result["plan_id"], "free")
        self.assertIsNone(result["expiry_date"])

    def test_parse_admin_override_reads_compact_payload(self):
        profile = {
            "admin_override_json": '{"p":"basic","n":"Basic Plan","b":"monthly","e":"2026-06-01T00:00:00Z","l":{"hourly_action_limit":99},"f":{"no_watermark":true}}'
        }
        parsed = subscription_manager._parse_admin_override(profile)
        self.assertEqual(parsed["plan_id"], "basic")
        self.assertEqual(parsed["plan_name"], "Basic Plan")
        self.assertEqual(parsed["billing_cycle"], "monthly")
        self.assertEqual(parsed["expires_at"], subscription_manager.datetime(2026, 6, 1, 0, 0, tzinfo=subscription_manager.timezone.utc))
        self.assertEqual(parsed["limit_overrides"]["hourly_action_limit"], 99)
        self.assertTrue(parsed["feature_overrides"]["no_watermark"])

    def test_downgrade_to_free_clears_admin_override(self):
        captured = {}
        original_update_document = subscription_manager._update_document
        try:
            def fake_update_document(_client, _db_id, _collection_id, _document_id, data):
                captured.update(data)
                return data

            subscription_manager._update_document = fake_update_document
            subscription_manager._downgrade_profile_to_free(
                None,
                "db",
                "profiles",
                self.pricing_map,
                {"$id": "profile-1", "admin_override_json": '{"p":"basic"}'},
                preserve_expired_snapshot=True,
            )
        finally:
            subscription_manager._update_document = original_update_document

        self.assertEqual(captured["plan_code"], "free")
        self.assertEqual(captured["plan_source"], "system")
        self.assertIsNone(captured["admin_override_json"])

    def test_build_profile_patch_for_plan_updates_benefits(self):
        patch = subscription_manager._build_profile_patch_for_plan(
            {"benefit_no_watermark": True},
            self.pricing_map["free"],
            plan_code="free",
            plan_name="Free Plan",
            plan_source="system",
            billing_cycle=None,
            expiry_date=None,
            status="inactive",
            preserve_expired_snapshot=False,
        )
        self.assertFalse(patch["benefit_no_watermark"])


if __name__ == "__main__":
    unittest.main()
