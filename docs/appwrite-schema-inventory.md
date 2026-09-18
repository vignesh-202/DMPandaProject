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
  - `admin_override_json`
  - `kill_switch_enabled`
- `admin_override_json` stores compact admin replacement metadata only:
  - plan id
  - billing cycle
  - expiry
- Runtime custom limits and benefit toggles remain on the normal `profiles` fields.
- Action counters remain here:
  - `hourly_actions_used`
  - `daily_actions_used`
  - `monthly_actions_used`
  - window timestamps
- Legacy mirrored fields still exist live and are transitional only:
  - none after cleanup

### `users`
- Stores identity and moderation state:
  - `name`
  - `email`
  - `status`
  - `ban_mode`
  - `ban_reason`
  - `banned_at`
  - `banned_by`
  - `kill_switch_enabled`
- Removed live user columns:
  - `referred_by`
  - `referral_code`
  - `ig_accounts`: `account_id`, `admin_status`, `daily_actions_used`, `daily_window_started_at`, `hourly_actions_used`, `hourly_window_started_at`, `ig_scoped_id`, `monthly_actions_used`, `monthly_window_started_at`, `status`, `api_token`, `api_enabled`, `webhook_url`, `webhook_secret`, `api_created_at`, `api_last_used_at`

### `pricing`
- Plan catalog only.
- Key columns:
  - `plan_code`
  - `name`
  - `price_monthly_inr`
  - `price_yearly_inr`
  - `price_yearly_monthly_inr`
  - `benefit_*`
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
- `email_campaigns`

## Deprecated / Removed
- Removed collections:
  - `automation_collected_emails`
  - `automation_collect_destinations`
- Removed attributes:
  - `automations.collect_email_*`
  - `pricing.benefit_collect_email`
- Kept in setup tooling only as deprecated collection/attribute ids so they are not recreated accidentally.

## Live Cleanup Completed
- Removed tables:
  - `subscription_reminder_events`
  - `affiliate_profiles`
  - `referrals`
  - `payouts`
  - `notification_throttles`
  - `worker_locks`
- Removed columns (audited & pruned):
  - `ig_accounts`: `account_id`, `admin_status`, `daily_actions_used`, `daily_window_started_at`, `hourly_actions_used`, `hourly_window_started_at`, `ig_scoped_id`, `monthly_actions_used`, `monthly_window_started_at`, `status`, `api_token`, `api_enabled`, `webhook_url`, `webhook_secret`, `api_created_at`, `api_last_used_at`
  - `automations`: `action_type`, `action_config_json`, `execution_count`
  - `pricing`: `price_monthly_usd`, `price_yearly_usd`, `price_yearly_monthly_usd`, `stripe_product_id`, `stripe_price_id_monthly`, `stripe_price_id_yearly`
  - `logs`: `recipient_id`, `source`, `response_status_code`
  - `settings`: `notification_email`, `smtp_host`, `smtp_port`
  - `users`: `referred_by`, `referral_code`
  - `profiles`: `no_watermark_enabled`, `subscription_plan_id`, `subscription_status`, `subscription_expires`, `subscription_billing_cycle`, `plan_status`, `billing_cycle`, `expires_at`

## Database Orphan Sweeper Immutability Rules
- Implemented in `functions/database-orphan-sweeper/main.py`
- Hardcoded Immutable Collections: `{"transactions", "payment_attempts", "pricing", "system_config", "users", "profiles"}`
- Transactions and payment attempts are **never deleted**; orphaned user references are anonymized to `userId = deleted:<hash>`
- Deterministic pagination (`Query.order_asc("$id")`) guarantees zero cursor-skipping
- Sweeper automatically removes orphaned records across:
  `campaigns`, `email_campaigns`, `super_profiles`, `reply_templates`, `inbox_menus`, `convo_starters`, `subscription_slots`, `comment_moderation`, `chat_states`, `logs`, `coupon_redemptions`, `email_change_tokens`
- Stale `job_locks` (> 2 hours old) are pruned automatically

## Verification Notes
- Verified with Appwrite CLI:
  - `databases list-collections`
  - `databases get-collection`
  - `databases list-attributes`
  - `databases list-documents`
- Subscription resolution rule:
  - only the newest transaction is considered for paid-plan restoration
  - if that newest transaction is inactive or expired, the user resolves to `free`
- Verified with setup and migration tooling:
  - `ProductionSetup/setup_appwrite.py`
  - `ProductionSetup/migrate_subscription_truth.py`
- Full machine-readable snapshot:
  - `docs/appwrite-schema-live.json`
