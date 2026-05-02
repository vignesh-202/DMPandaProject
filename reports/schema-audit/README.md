# Appwrite Schema Audit

Generated from live Appwrite CLI inventory on `2026-04-29`.

## Scope

- Checked every live collection in Appwrite.
- Dumped every live collection's attributes and indexes into this folder.
- Cross-checked live schema against checked-in backend, frontend, functions, and production setup code.
- Cross-checked live schema against `ProductionSetup/setup_appwrite.py`.

## Live Collections Reviewed

| Collection | Attributes | Indexes | Status |
| --- | ---: | ---: | --- |
| `admin_audit_logs` | 5 | 2 | Keep |
| `admin_settings` | 6 | 1 | Keep |
| `automation_collect_destinations` | 8 | 3 | Keep |
| `automation_collected_emails` | 14 | 3 | Keep |
| `automations` | 36 | 12 | Keep |
| `chat_states` | 4 | 2 | Keep |
| `comment_moderation` | 3 | 2 | Keep |
| `coupon_redemptions` | 13 | 2 | Keep |
| `coupons` | 12 | 4 | Keep |
| `email_campaigns` | 13 | 2 | Keep |
| `ig_accounts` | 18 | 7 | Keep |
| `inactive_user_cleanup_audit` | 11 | 3 | Keep |
| `job_locks` | 7 | 2 | Keep |
| `keyword_index` | 5 | 3 | Keep |
| `keywords` | 7 | 3 | Keep |
| `logs` | 10 | 3 | Keep |
| `payment_attempts` | 17 | 8 | Keep |
| `pricing` | 50 | 2 | Keep |
| `profiles` | 54 | 3 | Keep |
| `reply_templates` | 8 | 2 | Keep |
| `settings` | 3 | 1 | Keep |
| `super_profiles` | 7 | 2 | Keep |
| `transactions` | 24 | 9 | Keep |
| `users` | 15 | 6 | Keep |

## Deletion Result

- Additional live collections safe to delete: `0`
- Additional live attributes safe to delete: `0`
- Additional live indexes safe to delete: `0`

## Remaining Manual Review Fields

These were not deleted because they are still part of compatibility or rollback flows:

- `users.plan_id`
- `users.plan_expires_at`
- `coupon_redemptions.plan_id`

## Important Notes

- The live schema already matches the current cleanup rules in `ProductionSetup/setup_appwrite.py`.
- The previously removed legacy `profiles` subscription mirror fields and old profile indexes are no longer present live.
- Some collection names are still referenced in older code paths but are not present live, notably `campaigns`, `inbox_menus`, and `convo_starters`. Those are missing-live references, not extra-live cleanup candidates.

## Artifacts

- Raw CLI attribute dumps: `reports/schema-audit/*.attributes.txt`
- Raw CLI index dumps: `reports/schema-audit/*.indexes.txt`
- Structured full JSON audit: `ProductionSetup/reports/appwrite-cleanup-report-full.json`
