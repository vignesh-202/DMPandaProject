# DM Panda Project Docs

## Overview
- Product: `DM Panda`
- Surfaces:
  - `Frontend/` customer dashboard
  - `admin-panel/` admin console
  - `Backend/` Express API
  - `worker-node/` automation execution
  - `functions/` Appwrite jobs and triggers
  - `ProductionSetup/` Appwrite provisioning and migration

## Live Verification
- Verified against live Appwrite on `2026-04-22`.
- Database: `698b09ff002b91aff785`
- Appwrite server observed by CLI: `1.8.1`

## Subscription Architecture
- `profiles` is the only runtime enforcement source.
- `users` no longer stores subscription-plan truth.
- `pricing` is catalog only.

## Effective Plan Flow
- Self-subscription:
  - read selected plan from `pricing`
  - persist successful transaction/subscription state
  - write effective entitlements to `profiles`
- Admin plan change:
  - read selected plan template from `pricing`
  - store compact replacement-state metadata in `profiles.admin_override_json`
  - write effective entitlements to `profiles`
  - custom limits and benefit toggles persist on the runtime `profiles` fields, not inside `admin_override_json`
- Reset plan limits:
  - read effective plan defaults from `pricing`
  - reapply limits and features to `profiles`
- Reset plan:
  - read the single latest transaction only
  - restore that paid plan if that newest transaction is still active, otherwise `free`

## Entitlement Replacement Rules
- Admin override is an entitlement replacement state, not a visual overlay.
- While override is active, it fully controls the account.
- When override expires, user becomes `free`.
- Older paid transactions do not reactivate automatically.
- A paid plan can become active again only when:
  - admin clicks `Reset to Default Plan` and the newest transaction is still active
  - user completes a newer successful payment, which also clears the admin override

## Duration Rules
- Monthly plans run for `30 days`.
- Yearly plans run for `364 days`.
- This is now aligned across:
  - backend expiry logic
  - dashboard pricing and checkout copy
  - support/help copy
  - legal/refund/terms wording
  - admin plan handling
  - live `pricing.monthly_duration_days`
  - live `pricing.yearly_duration_days`

## Runtime Enforcement
- Backend enforces:
  - feature access from `profiles.features_json`
  - limits from `profiles.limits_json`
  - plan/account access on protected routes
- Worker enforces:
  - `profiles` entitlement presence
  - action limits
  - `ig_accounts.effective_access`
  - fail-closed behavior on uncertain state

## Account Access Model
- `ig_accounts` stores:
  - `admin_disabled`
  - `plan_locked`
  - `access_override_enabled`
  - `effective_access`
  - `access_state`
  - `access_reason`
- Overflow behavior:
  - extra linked accounts stay linked
  - unsupported surplus accounts become plan-locked
  - user loses runtime access but can still unlink them
  - worker blocks those accounts
  - admin can re-enable via override when appropriate

## Insights
- Dashboard Insights is now richer than summary-only.
- Current scope:
  - account summary metrics
  - account trends by period
  - audience availability states
  - media insights with filters and unsupported-metric handling
- Integration remains Instagram Business Login / Instagram Graph API aligned.

## Admin
- Admin loaders use one consistent section-loading system.
- Overview/analytics use the frontend gauge style.
- Analytics removed `Delivery Quality`.
- Users modal:
  - uses modern dropdowns
  - blocks past custom dates
  - uses Instagram access toggles
  - updates effective plan actions immediately

## Legal / Support Alignment
- Updated pages/components:
  - pricing
  - support
  - my plan
  - terms
  - refund policy
  - related support/help explanations
- Wording now matches the actual runtime behavior for:
  - durations
  - expiry
  - downgrade behavior
  - refund/support references
  - linked-account access limits

## Functions
- `subscription-manager`
  - 30-minute schedule
  - reminders, last-transaction-only subscription checks, downgrade-to-free on expiry, and account-access recompute
- `payment-reminders`
  - hourly abandoned-checkout reminder and cleanup
- `refresh-instagram-tokens`
  - refreshes token metadata
- `on-user-create`
  - seeds free-plan runtime documents

## Cleanup Completed
- Removed live tables:
  - `affiliate_profiles`
  - `referrals`
  - `payouts`
  - `notification_throttles`
  - `worker_locks`
  - `subscription_reminder_events`
- Removed live columns:
  - `users.referred_by`
  - `users.referral_code`
  - `profiles.no_watermark_enabled`
- Kept live:
  - `payment_attempts`
  - `settings`
  - `admin_settings`

## Tooling
- `ProductionSetup/setup_appwrite.py`
  - provisions the final live schema target
  - includes `pricing.monthly_duration_days`, `pricing.yearly_duration_days`
  - excludes deprecated tables and attributes
- `ProductionSetup/migrate_subscription_truth.py`
  - backfills `users` self-plan memory
  - canonicalizes `profiles` runtime entitlements
  - latest dry-run reports `0` pending updates
