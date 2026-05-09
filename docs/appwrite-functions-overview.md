# Appwrite Functions Overview

This is the short operational map of the Appwrite functions used in this project.

## Function Summary

| Function | Trigger / Schedule | Main Job | Primary Collections | Primary Columns / Fields |
| --- | --- | --- | --- | --- |
| `on-user-create` | Appwrite event `users.*.create` | Creates the initial profile and free-plan defaults for a new user. | `users`, `profiles`, `pricing` | `profiles.user_id`, `plan_code`, `plan_name`, `instagram_connections_limit`, `hourly_action_limit`, `daily_action_limit`, `monthly_action_limit`, benefit flags |
| `reset-user-action-budgets` | Every hour `0 * * * *` | Resets expired hourly, daily, and monthly usage windows on linked IG accounts. | `ig_accounts` | `hourly_actions_used`, `daily_actions_used`, `monthly_actions_used`, `hourly_window_started_at`, `daily_window_started_at`, `monthly_window_started_at` |
| `subscription-manager` | Every 30 minutes `*/30 * * * *` | Sends expiry reminders, downgrades expired paid plans, keeps paid/free state aligned. | `profiles`, `users`, `pricing`, `transactions`, `job_locks` | `plan_code`, `plan_source`, `expiry_date`, `billing_cycle`, benefit flags, reminder timestamps, transaction status and plan metadata |
| `payment-reminders` | Every hour `0 * * * *` | Follows pending payment attempts and reminder messaging. | `payment_attempts`, `transactions`, `job_locks` | `status`, `user_id`, `plan_code`, `billing_cycle`, gateway IDs, created / verified timestamps |
| `refresh-instagram-tokens` | Monthly `0 0 1 * *` | Refreshes long-lived Instagram tokens before expiry. | `ig_accounts` | `access_token`, `token_expires_at`, `account_id`, `ig_user_id` |
| `remind-link-instagram` | Every hour `0 * * * *` | Nudges users who signed up but still have no linked Instagram account. | `users`, `profiles`, `ig_accounts` | `user_id`, `linked_at`, reminder timing fields, plan state |
| `remove-instagram` | Manual / backend-triggered | Removes a linked Instagram account and related connected artifacts. | `ig_accounts` and related automation collections | `account_id`, `user_id`, linked automation/account-scoped references |
| `audit-media-automations` | Every hour `0 * * * *` | Audits automation/media consistency and keyword integrity. | `automations`, `keywords`, `keyword_index`, `ig_accounts` | `automation_type`, `account_id`, `keyword`, `keyword_hash`, template/media references |
| `cleanup-logs-chat-state` | Every 6 hours `0 */6 * * *` | Deletes or trims stale logs and transient conversation state. | `logs`, `chat_states` | `sent_at`, `last_seen_at`, `account_id`, `recipient_id` |
| `cleanup-audit-job-locks` | Every 6 hours at minute 30 `30 */6 * * *` | Cleans old job locks and stale audit rows. | `job_locks`, `inactive_user_cleanup_audit` | `job_name`, `run_window`, `expires_at`, audit timestamps |
| `inactive-user-cleanup` | Daily `0 2 * * *` | Cleans or downgrades inactive users under retention rules. | `users`, `profiles`, `transactions`, `payment_attempts`, `coupon_redemptions`, `inactive_user_cleanup_audit`, `job_locks` | activity and billing timestamps, cleanup protection flags, audit metadata |

## Practical Notes

| Area | Current Rule |
| --- | --- |
| Profile limits | `profiles` stores plan limits and benefit state. Admin changes here affect runtime limits. |
| IG usage counters | `ig_accounts` stores used counters and reset windows. This is the live usage source. |
| Hourly / daily / monthly resets | The reset function only works on `ig_accounts` counters now. |
| Plan expiry enforcement | `subscription-manager` handles paid-plan expiry and reminder timing. |
| Instagram connection health | Token maintenance is handled by `refresh-instagram-tokens`, while account reminders are handled by `remind-link-instagram`. |

## Deployment Notes

| Function | Runtime | Deploy Path |
| --- | --- | --- |
| All listed functions | `python-3.9` | `functions/<function-name>/main.py` |

CLI deploy flow in this repo:

1. Variables sync: `functions/sync-function-variables.ps1`
2. Deploy/update: `functions/deploy-functions.ps1`
3. Manifest source: `functions/function-manifest.json`
