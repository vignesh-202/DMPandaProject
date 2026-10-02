# Meta App Review Guide: instagram_business_basic

This guide provides simple, ready-to-copy text for submitting **`instagram_business_basic`** in the Meta Developer Portal. All URLs point to the live production app.

---

## 1. Description: Why You Are Requesting This Permission

**Copy and paste this into the permission description box:**

```text
DMPanda (https://dmpanda.com) is an Instagram automation platform that helps creators and businesses reply to comments, story mentions, and direct messages automatically.

We use the instagram_business_basic permission for two reasons:
1. Profile Display: When a user connects their Instagram Professional account, we fetch their Instagram user ID, username, and profile picture from the Graph API (GET /me?fields=id,user_id,username,profile_picture_url). We display their @username and avatar in their dashboard so they can confirm which account they are managing.
2. Routing Automation: The basic account ID is required to link incoming webhooks (comments and messages) to the correct user account so that our automation engine can send the configured automated reply.

Without this permission, users cannot see or select their connected Instagram accounts, and automated DM replies cannot be delivered.
```

---

## 2. Reviewer Testing Instructions

**Copy and paste this into the reviewer testing instructions box:**

```text
STEP-BY-STEP TESTING INSTRUCTIONS FOR APP REVIEWER:

1. Log in to DMPanda:
   - URL: https://dmpanda.com/login
   - Email: viganesh202@gmail.com
   - Password: Vigu@123456

2. Connect your Instagram Professional Account:
   - Go to Dashboard: https://dmpanda.com/dashboard
   - Click "Connect Instagram Account"
   - Complete the standard Instagram OAuth dialogue to link your test Instagram Professional or Creator account.

3. Verify Profile Information:
   - After authorization, you will be redirected back to the DMPanda dashboard.
   - Look at the top navigation and the connected accounts card.
   - You will see your Instagram handle (@username) and profile avatar clearly displayed.

4. Test Automation Trigger:
   - Click "Automations" -> "+ New Automation"
   - Select your connected Instagram account from the dropdown.
   - Choose a trigger (e.g. Keyword DM) and save.
   - The basic account ID connects this trigger directly to your Instagram profile.

Note: instagram_business_basic is also requested as a required dependent permission for instagram_business_manage_messages and instagram_business_manage_comments.
```

---

## 3. Screencast Video Checklist (60 Seconds)

Record a short screen video showing these 4 steps:
1. **0:00 - 0:15**: Navigate to `https://dmpanda.com/login` and log in with `viganesh202@gmail.com`.
2. **0:15 - 0:35**: Click **"Connect Instagram Account"**, show the Meta OAuth authorization screen with app name **"DM Panda"**, and approve the permissions.
3. **0:35 - 0:45**: Show the redirect back to `https://dmpanda.com/dashboard` showing the connected **@username** and **profile photo**.
4. **0:45 - 0:60**: Go to **Automations**, click **New Automation**, and show the connected Instagram account selected in the dropdown.

---

## 4. Production URLs for App Settings

Enter these live URLs in **Meta App Settings -> Basic**:

| Setting | Production URL |
| :--- | :--- |
| **Privacy Policy URL** | `https://dmpanda.com/privacy` |
| **Terms of Service URL** | `https://dmpanda.com/terms` |
| **User Data Deletion / Instructions URL** | `https://dmpanda.com/delete-account-guide` |
| **Valid OAuth Redirect URI** | `https://dmpanda.com/auth/ig-callback` |
| **Deauthorize Callback URL** | `https://api.dmpanda.com/api/auth/instagram/deauthorize` |
| **Data Deletion Callback URL** | `https://api.dmpanda.com/api/auth/instagram/delete-data` |
