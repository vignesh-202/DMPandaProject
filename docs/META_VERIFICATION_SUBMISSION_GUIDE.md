# Meta App Review Guide: DMPanda Permissions

This guide provides simple, ready-to-copy text and instructions for submitting App Review in the Meta Developer Portal. All URLs point to the live production app.

---

## 1. Permission: `instagram_business_manage_messages`

### A. Description: Why You Are Requesting This Permission
**Copy and paste this into the text area:**

```text
DMPanda (https://dmpanda.com) is a customer engagement and Instagram automation platform built for creators, businesses, and digital agencies.

How our app uses instagram_business_manage_messages:
1. Receiving & Responding to Messages: When followers send a Direct Message (DM), story reply, or specific trigger keyword (such as "PRICE", "LINK", or "INFO") to a connected Instagram Professional account, our application receives the webhook message event and automatically delivers the user's pre-configured reply template (e.g. text replies, button links, interactive quick replies, or media resources) via the Messenger API for Instagram (POST /{ig-user-id}/messages).
2. Conversation Starters & Inbox Workflow: Our app allows business owners to configure automated greeting messages and interactive conversation starter menus, enabling prospective customers to self-serve information 24/7.
3. Follower Verification Prompts: For creators hosting gated content or exclusive promotions, our app checks follow status and delivers custom guidance messages directly inside Instagram Direct.

Value for people using our app:
- Solves response time bottlenecks: Small businesses and creators often receive hundreds of DMs daily. DMPanda enables instant, 24/7 response times so customers receive answers immediately.
- Boosts conversion and customer satisfaction: Automated responses ensure inquiries about products, appointments, and services are answered before leads drop off.

Why it is necessary for app functionality:
Without instagram_business_manage_messages, DMPanda cannot receive message webhooks or send direct messages back to users on Instagram. Because automated direct messaging is the core service our platform provides, this permission is strictly required for the application to function.
```

### B. Screencast Video Requirements (60–90 seconds)
Meta requires a screen recording showing the permission in action. Upload a clean video file showing:
1. **0:00 - 0:15**: Navigate to `https://dmpanda.com/login` and log in with test credentials:
   - Email: `test.kqpdjy2dut@dmpanda.test`
   - Password: `DmPanda!kQpDJy2duT9x`
2. **0:15 - 0:35**: Go to **Dashboard** &rarr; show connected Instagram handle `@username`. Navigate to **DM Automation** on the left menu, show an active automation rule (e.g. keyword "LINK" or "HELP") connected to a reply template.
3. **0:35 - 0:65**: Open Instagram (on phone or browser side-by-side) with a test user account. Send a direct message with the keyword `"LINK"` to the business Instagram account.
4. **0:65 - 0:80**: Show the business account automatically sending the response back in Instagram Direct within 1-2 seconds.
5. **0:80 - 0:90**: Switch back to the DMPanda dashboard and show the activity reflected in the dashboard or automation log.

### C. Checkbox
- Check the box: **"If approved, I agree that any data I receive through instagram_business_manage_messages will be used in accordance with the allowed usage."**
- Click **Save**.

---

## 2. Reviewer Testing Credentials & Instructions

**Copy and paste this into the "Reviewer Instructions" / "Testing Credentials" box in the App Review submission:**

```text
STEP-BY-STEP TESTING INSTRUCTIONS FOR META APP REVIEWER:

1. Test Account Login Credentials:
   - Application URL: https://dmpanda.com/login
   - User ID: test_prod_kQpDJy2duT
   - Email: test.kqpdjy2dut@dmpanda.test
   - Password: DmPanda!kQpDJy2duT9x

2. Instagram Connection:
   - Once logged in, go to Dashboard: https://dmpanda.com/dashboard
   - Click "Connect Instagram Account" or open "Account Settings" -> "IG Accounts" tab.
   - Complete the standard Meta OAuth authorization window to connect your Instagram Professional/Creator test account.
   - You will be redirected back to the dashboard with your @username and profile avatar displayed.

3. Testing Direct Message Automation:
   - Navigate to "DM Automation" from the left sidebar.
   - Select an existing automation or click "New Automation".
   - Set the trigger keyword to "DEMO" and select a reply template (e.g., "Thanks for messaging us! Here is the link you requested: https://dmpanda.com").
   - Click "Save & Activate".
   - From any external test Instagram account, send a direct message containing the word "DEMO" to your connected Instagram Professional account.
   - The automated response will be delivered instantly in the Instagram Direct thread.

4. Testing Comment Reply (if reviewing instagram_business_manage_comments):
   - Navigate to "Post Automation" or "Reel Automation".
   - Configure a trigger keyword and reply message.
   - Comment on any published post or reel with that keyword to observe the public comment reply and DM delivery.

Thank you for reviewing DMPanda!
```

---

## 3. Production URLs for App Settings

Enter these live URLs in **Meta App Settings -> Basic**:

| Setting | Production URL |
| :--- | :--- |
| **Privacy Policy URL** | `https://dmpanda.com/privacy` |
| **Terms of Service URL** | `https://dmpanda.com/terms` |
| **User Data Deletion / Instructions URL** | `https://dmpanda.com/delete-account-guide` |
| **Valid OAuth Redirect URI** | `https://dmpanda.com/auth/ig-callback` |
| **Deauthorize Callback URL** | `https://api.dmpanda.com/api/auth/instagram/deauthorize` |
| **Data Deletion Callback URL** | `https://api.dmpanda.com/api/auth/instagram/delete-data` |
