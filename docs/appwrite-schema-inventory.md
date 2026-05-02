# Appwrite Schema Inventory

Generated from live Appwrite verification on `2026-04-22`.

## Database
- `698b09ff002b91aff785`

## Runtime-Critical Tables

### `profiles`
- Runtime truth for:
  - `plan_code`
  - `plan_name`
  - `plan_source`
  - `expiry_date`
  - `limits_json`
  - `features_json`
  - `paid_plan_snapshot_json`
  - `admin_override_json`
  - `kill_switch_enabled`
- Action counters remain here:
  - `hourly_actions_used`
  - `daily_actions_used`
  - `monthly_actions_used`
  - window timestamps
- Legacy mirrored fields still exist live and are transitional only:
  - none after cleanup

### `users`
- Stores identity, moderation, and self-subscription memory:
  - `name`
  - `email`
  - `status`
  - `ban_mode`
  - `ban_reason`
  - `banned_at`
  - `banned_by`
  - `kill_switch_enabled`
  - `plan_id`
  - `plan_expires_at`
- Removed live user columns:
  - `referred_by`
  - `referral_code`

### `pricing`
- Plan catalog only.
- Key columns:
  - `plan_code`
  - `name`
  - price fields
  - `instagram_connections_limit`
  - `actions_per_hour_limit`
  - `actions_per_day_limit`
  - `actions_per_month_limit`
  - `comparison_json`
  - `monthly_duration_days`
  - `yearly_duration_days`
- Live duration values are now:
  - monthly = `30`
  - yearly = `364`

### `ig_accounts`
- Linked Instagram accounts and per-account enforcement state:
  - `admin_disabled`
  - `plan_locked`
  - `access_override_enabled`
  - `effective_access`
  - `access_state`
  - `access_reason`

### `admin_audit_logs`
- Admin-only audit trail.
- Verified live permissions:
  - `read("label:admin")`
  - `create("label:admin")`
  - `update("label:admin")`
  - `delete("label:admin")`

## Tables Kept In Use
- `transactions`
- `payment_attempts`
- `settings`
- `admin_settings`
- `automation_collect_destinations`
- `automation_collected_emails`
- `email_campaigns`

## Live Cleanup Completed
- Removed tables:
  - `subscription_reminder_events`
  - `affiliate_profiles`
  - `referrals`
  - `payouts`
  - `notification_throttles`
  - `worker_locks`
- Removed columns:
  - `users.referred_by`
  - `users.referral_code`
  - `profiles.no_watermark_enabled`
  - `profiles.subscription_plan_id`
  - `profiles.subscription_status`
  - `profiles.subscription_expires`
  - `profiles.subscription_billing_cycle`
  - `profiles.plan_status`
  - `profiles.billing_cycle`
  - `profiles.expires_at`

## Verification Notes
- Verified with Appwrite CLI:
  - `databases list-collections`
  - `databases get-collection`
  - `databases list-attributes`
  - `databases list-documents`
- Verified with setup and migration tooling:
  - `ProductionSetup/setup_appwrite.py`
  - `ProductionSetup/migrate_subscription_truth.py`
- Full machine-readable snapshot:
  - `docs/appwrite-schema-live.json`
