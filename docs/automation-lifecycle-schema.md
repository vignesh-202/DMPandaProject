# Automation Lifecycle Schema

## Goal

One reliable structure for every automation create, update, and delete path.

## Core Table

`automations`

Required identity:
- `user_id`
- `account_id`
- `automation_type`
- `trigger_type`
- `title`
- `is_active`

Recommended normalized fields:
- `title_normalized`
- `template_id`
- `template_type`
- `template_content`
- `keyword`
- `keywords`
- `keyword_match_type`

Behavior toggles:
- `followers_only`
- `followers_only_message`
- `followers_only_primary_button_text`
- `followers_only_secondary_button_text`
- `suggest_more_enabled`
- `private_reply_enabled`
- `share_to_admin_enabled`
- `once_per_user_24h`
- `collect_email_enabled`
- `collect_email_only_gmail`
- `collect_email_prompt_message`
- `collect_email_fail_retry_message`
- `collect_email_success_reply_message`
- `seen_typing_enabled`

Message payload fields:
- `buttons`
- `replies`
- `template_elements`
- `media_id`
- `media_url`
- `comment_reply`
- `story_scope`

## Dependent Tables

`keywords`
- one row per normalized keyword for keyword-driven automations
- parent: `automations.$id`

`keyword_index`
- one row per normalized keyword hash for fast conflict checks
- parent: `automations.$id`

`automation_collect_destinations`
- one row per collect-email automation destination
- parent: `automations.$id`

`logs`
- append-only execution history
- references `automation_id` when available

## Type Modes

Standard automations:
- `dm`
- `global`
- `post`
- `reel`
- `story`
- `live`
- `comment`

Config singleton automations:
- `mentions`
- `suggest_more`

Config multi-row automations:
- `inbox_menu`
- `convo_starter`

## Lifecycle Rules

Create:
1. Validate account ownership and plan access.
2. Normalize payload through a single schema layer.
3. Write `automations` row first.
4. Sync dependent rows:
   - keywords
   - keyword index
   - collector destination only when collect-email is configured later
5. If dependency sync fails, roll back the automation row.

Update:
1. Load existing automation.
2. Rebuild the next full normalized state, not just partial patches.
3. Validate uniqueness and plan gating against the next state.
4. Update `automations`.
5. Re-sync dependency tables from source of truth.

Delete:
1. Delete collector-destination rows.
2. Delete keyword rows and keyword-index rows.
3. Delete automation row.

## Production Structure

Use a dedicated lifecycle service for:
- schema lookup by `automation_type`
- singleton vs multi-row enforcement
- normalized defaults
- dependency cleanup hooks
- rollback on create failures

Current implementation:
- [Backend/utils/automationLifecycle.js](/c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/utils/automationLifecycle.js)

Primary route integrations:
- [Backend/routes/instagram.js](/c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/routes/instagram.js)
