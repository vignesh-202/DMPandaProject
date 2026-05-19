# Appwrite Functions Guide

This document explains what each Appwrite function does in DM Panda, when it runs, how it is usually triggered, and what a normal example flow looks like.

It is written as an operator/developer guide, not just a code inventory.

## Quick Summary

| Function | Trigger | Schedule / Event | Main Purpose |
| --- | --- | --- | --- |
| `on-user-create` | Event | `users.*.create` | Creates the initial `users` and `profiles` records for a new user and assigns free-plan defaults. |
| `reset-user-action-budgets` | Scheduled | `0 * * * *` | Resets hourly, daily, and monthly usage counters for Instagram accounts when their windows expire. |
| `subscription-manager` | Scheduled | `*/30 * * * *` | Sends plan-expiry emails, downgrades expired paid plans, and keeps profile subscription state aligned. |
| `payment-reminders` | Scheduled | `0 * * * *` | Cleans stale payment attempts, reconciles successful payments, and reminds users about abandoned checkouts. |
| `refresh-instagram-tokens` | Scheduled | `0 0 1 * *` | Refreshes long-lived Instagram access tokens for linked accounts. |
| `sync-instagram-account-profiles` | Scheduled | `0 2 * * *` | Pulls fresh Instagram profile data like username, display name, and profile photo into `ig_accounts`. |
| `remind-link-instagram` | Scheduled | `0 * * * *` | Sends reminders to users who signed up but have not linked Instagram yet, and to users whose subscription state needs IG-link nudges. |
| `remove-instagram` | Manual / API-triggered | No schedule | Unlinks or fully deletes a linked Instagram account and cleans related account-scoped records. |
| `audit-media-automations` | Scheduled | `0 * * * *` | Checks whether media-linked automations still point to valid Instagram media and removes invalid automations. |
| `cleanup-logs-chat-state` | Scheduled | `0 */6 * * *` | Removes stale logs and chat state data, including resolved collect-email link errors. |
| `cleanup-audit-job-locks` | Scheduled | `30 */6 * * *` | Clears expired job locks and old audit rows so scheduled jobs do not accumulate stale lock documents. |
| `inactive-user-cleanup` | Scheduled | `0 2 * * *` | Warns and eventually deletes long-inactive free users under the project’s retention rules. |

## Common Execution Pattern

Most scheduled functions follow this pattern:

1. Read Appwrite runtime config from environment variables.
2. Build an Appwrite client using endpoint, project ID, API key, and database ID.
3. Read the collections they need.
4. Process records in batches or full scans.
5. Update state, send email if needed, and return a JSON summary.

Many of the stateful jobs also use `job_locks` so the same job does not run twice for the same schedule window.

## Function Details

### `on-user-create`

**When it runs**

- Automatically when Appwrite emits `users.*.create`

**What it does**

- Reads the newly created Appwrite Auth user payload
- Creates a matching document in the `users` collection if it does not already exist
- Creates a matching document in the `profiles` collection if it does not already exist
- Loads the free plan from the `pricing` collection
- Stores default free-plan limits and benefit flags in the new user profile

**Main collections**

- `users`
- `profiles`
- `pricing`

**Example flow**

1. A new user signs up.
2. Appwrite creates the auth account.
3. `on-user-create` runs.
4. The app gets a `users/<userId>` record and a `profiles/<userId>` record.
5. The profile starts on the free plan.

**Typical result**

- A user can immediately be treated as a valid app user without waiting for manual setup.

### `reset-user-action-budgets`

**When it runs**

- Every hour at minute `0`
- Cron: `0 * * * *`

**What it does**

- Scans all `ig_accounts`
- Looks at:
  - `hourly_actions_used` and `hourly_window_started_at`
  - `daily_actions_used` and `daily_window_started_at`
  - `monthly_actions_used` and `monthly_window_started_at`
- If a window has expired, it resets that usage counter to `0`
- Starts a new window timestamp

**Main collection**

- `ig_accounts`

**Example flow**

1. An account uses 87 actions during the current hour.
2. The hourly window expires.
3. `reset-user-action-budgets` runs.
4. `hourly_actions_used` becomes `0`.
5. A fresh hourly window begins.

**Manual execution example**

```powershell
appwrite functions create-execution --function-id reset-user-action-budgets --async false --path / --method POST
```

**Dry-run example**

```powershell
appwrite functions create-execution --function-id reset-user-action-budgets --async false --path / --method POST --headers "{\"x-dry-run\":\"true\"}"
```

### `subscription-manager`

**When it runs**

- Every 30 minutes
- Cron: `*/30 * * * *`

**What it does**

- Scans user profiles
- Ignores free-plan profiles
- For paid or non-free profiles:
  - checks expiry date
  - checks transactions
  - checks admin override data
  - sends reminder emails
  - downgrades expired users to the free plan

**Mail behavior**

- Sends a mail 3 days before expiry
- Sends a mail on the day of expiry
- Sends a mail immediately after expiry is detected
- Downgrades the user right after that post-expiry mail

**Main collections**

- `profiles`
- `transactions`
- `pricing`
- `job_locks`
- `ig_accounts`

**Example flow**

1. A user has a paid plan that expires on May 17.
2. On May 14, the 3-day reminder goes out.
3. On May 17, the expiry-day reminder goes out.
4. On the first run after expiry is detected, the post-expiry mail goes out.
5. The profile is downgraded to the free plan.

**Manual execution example**

```powershell
appwrite functions create-execution --function-id subscription-manager --async false --path / --method POST
```

### `payment-reminders`

**When it runs**

- Every hour at minute `0`
- Cron: `0 * * * *`

**What it does**

- Scans `payment_attempts`
- Groups attempts by user
- Looks at the latest attempt for each user
- Checks whether that attempt was already paid, reconciled, superseded, or abandoned
- If abandoned for more than 24 hours:
  - sends one reminder email
  - marks the attempt group as expired/cancelled
  - deletes stale attempt documents

**Main collections**

- `payment_attempts`
- `transactions`
- `profiles`
- `job_locks`

**Example flow**

1. A user opens checkout but never completes payment.
2. A payment attempt is stored.
3. After 24 hours, `payment-reminders` runs.
4. If no successful transaction exists, the user gets a reminder email.
5. The stale attempt records are cleaned up.

**Manual execution example**

```powershell
appwrite functions create-execution --function-id payment-reminders --async false --path / --method POST
```

### `refresh-instagram-tokens`

**When it runs**

- Monthly at midnight on day 1
- Cron: `0 0 1 * *`

**What it does**

- Scans all linked Instagram accounts with status `active` or `inactive`
- Calls the Instagram token refresh endpoint
- Stores the new `access_token`
- Stores `token_expires_at` if Instagram returns expiry duration

**Main collection**

- `ig_accounts`

**Example flow**

1. An IG account is linked and has a long-lived token.
2. On the monthly refresh job, the function calls Instagram’s refresh endpoint.
3. The latest token is saved back to Appwrite.
4. Users can continue using the connection without reconnecting manually.

**Manual execution example**

```powershell
appwrite functions create-execution --function-id refresh-instagram-tokens --async false --path / --method POST
```

### `sync-instagram-account-profiles`

**When it runs**

- Daily at 2:00 UTC
- Cron: `0 2 * * *`

**What it does**

- Scans `ig_accounts`
- Filters to accounts that are sync-eligible and have an access token
- Calls Instagram Graph for:
  - `user_id`
  - `username`
  - `name`
  - `profile_picture_url`
- Updates stored account profile fields if they changed

**Main collection**

- `ig_accounts`

**Example flow**

1. A user changes their Instagram display name or profile picture.
2. The next daily sync runs.
3. DM Panda updates the local `ig_accounts` record to match Instagram.

**Manual execution example**

```powershell
appwrite functions create-execution --function-id sync-instagram-account-profiles --async false --path / --method POST
```

### `remind-link-instagram`

**When it runs**

- Every hour at minute `0`
- Cron: `0 * * * *`

**What it does**

- Scans users and profiles
- Finds users who signed up but did not link Instagram yet
- Decides whether they should receive:
  - a signup reminder
  - an expiring-subscription reminder related to linking
  - an expired-state reminder related to linking
- Sends email reminders through Appwrite Messaging

**Main collections**

- `users`
- `profiles`
- `ig_accounts`

**Example flow**

1. A user signs up but never links Instagram.
2. After the configured delay, `remind-link-instagram` runs.
3. The user gets an email with a direct link back to the dashboard/account setup.

### `remove-instagram`

**When it runs**

- Manual or backend-triggered
- No schedule

**What it does**

- Accepts a request body with:
  - `action = unlink` or `delete`
  - `account_doc_id`
- `unlink`
  - marks the IG account as inactive
- `delete`
  - deletes the IG account document
  - deletes related records for automations and account-scoped artifacts
  - recomputes access state

**Main collections**

- `ig_accounts`
- `automations`
- `keywords`
- `keyword_index`
- `reply_templates`
- `super_profiles`
- `comment_moderation`
- `logs`
- `chat_states`

**Request example**

```json
{
  "action": "unlink",
  "account_doc_id": "your_ig_account_doc_id"
}
```

**Delete example**

```json
{
  "action": "delete",
  "account_doc_id": "your_ig_account_doc_id"
}
```

### `audit-media-automations`

**When it runs**

- Every hour at minute `0`
- Cron: `0 * * * *`

**What it does**

- Scans automations tied to Instagram media
- Checks whether the media still exists or is still accessible
- If the media is invalid:
  - removes the automation
  - removes related keyword records
  - removes related keyword index records
  - sends a cleanup report email to the affected user

**Main collections**

- `automations`
- `keywords`
- `keyword_index`
- `ig_accounts`

**Example flow**

1. A user deletes an Instagram post that an automation depends on.
2. `audit-media-automations` runs.
3. It detects the missing media.
4. It removes the broken automation and related keyword artifacts.
5. The user receives a cleanup report email.

### `cleanup-logs-chat-state`

**When it runs**

- Every 6 hours
- Cron: `0 */6 * * *`

**What it does**

- Deletes old or stale log records
- Deletes old chat state records
- Scans for resolved collect-email link error logs
- Removes those resolved error logs when the underlying issue is no longer active

**Main collections**

- `logs`
- `chat_states`
- `automations`

**Example flow**

1. Temporary conversation state builds up during automations.
2. Old state is no longer needed.
3. `cleanup-logs-chat-state` runs.
4. Old transient state and stale logs are pruned.

### `cleanup-audit-job-locks`

**When it runs**

- Every 6 hours at minute 30
- Cron: `30 */6 * * *`

**What it does**

- Cleans old `job_locks`
- Cleans old audit rows for inactive cleanup tracking
- Prevents scheduled functions from being blocked by ancient lock documents

**Main collections**

- `job_locks`
- `inactive_user_cleanup_audit`

### `inactive-user-cleanup`

**When it runs**

- Daily at 2:00 UTC
- Cron: `0 2 * * *`

**What it does**

- Evaluates a batch of users
- Skips:
  - protected users
  - admin users
  - users with active paid state
  - uncertain users with missing required state
- For free inactive users:
  - computes a scheduled deletion date
  - stores `cleanup_state_json`
  - sends warning emails at 30 days, 7 days, 1 day, and day 0
  - deletes the user and anonymizes transaction references when the delete date arrives

**Main collections**

- `users`
- `profiles`
- `transactions`
- `payment_attempts`
- `coupon_redemptions`
- `inactive_user_cleanup_audit`
- `job_locks`

**Example flow**

1. A free user stays inactive for 6+ months.
2. `inactive-user-cleanup` schedules deletion.
3. Warning mails are sent at the configured checkpoints.
4. If the user still does not return, the function deletes user-linked records and anonymizes transaction references.

## Manual CLI Usage

For scheduled HTTP-style functions, the normal CLI pattern is:

```powershell
appwrite functions create-execution --function-id <function-id> --async false --path / --method POST
```

Examples:

```powershell
appwrite functions create-execution --function-id subscription-manager --async false --path / --method POST
appwrite functions create-execution --function-id payment-reminders --async false --path / --method POST
appwrite functions create-execution --function-id refresh-instagram-tokens --async false --path / --method POST
```

## Functions That Accept Request Payloads

### `remove-instagram`

Accepts JSON body:

```json
{
  "action": "unlink",
  "account_doc_id": "account_document_id"
}
```

or:

```json
{
  "action": "delete",
  "account_doc_id": "account_document_id"
}
```

### `inactive-user-cleanup`

Optional JSON body:

```json
{
  "dry_run": true,
  "batch_size": 50
}
```

### `audit-media-automations`

Optional JSON body:

```json
{
  "dry_run": true
}
```

## Functions That Accept Dry-Run Headers

### `reset-user-action-budgets`

```powershell
appwrite functions create-execution --function-id reset-user-action-budgets --async false --path / --method POST --headers "{\"x-dry-run\":\"true\"}"
```

### `refresh-instagram-tokens`

```powershell
appwrite functions create-execution --function-id refresh-instagram-tokens --async false --path / --method POST --headers "{\"x-dry-run\":\"true\"}"
```

## Operational Notes

- `subscription-manager`, `payment-reminders`, and `inactive-user-cleanup` are the most stateful functions and should be treated carefully during changes.
- `job_locks` are important for avoiding duplicate scheduled runs.
- Several functions use Appwrite Messaging for email delivery, so `messages.write` scope must stay intact where required.
- For debugging, the most useful commands are:

```powershell
appwrite functions list
appwrite functions list-executions --function-id subscription-manager
appwrite functions get-execution --function-id subscription-manager --execution-id <execution-id>
```

## Recommended Reading

- [appwrite-functions-overview.md](/c:/Users/vigan/PycharmProjects/DMPandaProject/docs/appwrite-functions-overview.md)
- [function-manifest.json](/c:/Users/vigan/PycharmProjects/DMPandaProject/functions/function-manifest.json)
