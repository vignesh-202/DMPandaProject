# Google Search Console Verification Guide for DM Panda

This guide outlines the steps to verify ownership of **dmpanda.com** in Google Search Console using DNS verification on Hostinger.

---

### Step 1: Open Google Search Console
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Sign in with your administrative Google account.

---

### Step 2: Add a Domain Property
1. Click the property dropdown in the top-left corner and select **Add property**.
2. Under the **Domain** option (the left box, which covers `https://`, `http://`, `www`, and all subdomains), enter:
   ```text
   dmpanda.com
   ```
3. Click **Continue**.

---

### Step 3: Copy the DNS TXT Verification Record
1. Google Search Console will display a modal titled **"Verify domain ownership via DNS record"**.
2. Select **TXT** as the record type.
3. Copy the TXT value provided by Google (it will look similar to `google-site-verification=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`).

---

### Step 4: Add the TXT Record in Hostinger DNS Zone
1. Log into your [Hostinger hPanel](https://hpanel.hostinger.com/).
2. Go to **Domains** and select **dmpanda.com**.
3. Under the left menu, select **DNS / Nameservers**.
4. In the **Manage DNS records** section, add a new record:
   - **Type**: `TXT`
   - **Name**: `@` (or leave empty if Hostinger defaults to root domain)
   - **TXT Value**: Paste the string copied from Google Search Console.
   - **TTL**: `3600` (or default 14400)
5. Click **Add Record**.

---

### Step 5: Verify Ownership in Search Console
1. Return to the Google Search Console modal.
2. Click **Verify**.
   *(Note: DNS propagation usually takes 2–15 minutes, but can take up to a few hours in rare cases. If it doesn't verify immediately, wait a few minutes and click Verify again).*

---

### Step 6: Submit the Sitemap
Once domain ownership is verified:
1. In the left navigation menu of Google Search Console, go to **Sitemaps**.
2. In the **Add a new sitemap** input field, enter:
   ```text
   sitemap.xml
   ```
   *(The full URL will be `https://dmpanda.com/sitemap.xml`).*
3. Click **Submit**.

---

### Step 7: Request Indexing for Key Pages
1. Use the **URL Inspection** search bar at the very top.
2. Enter:
   ```text
   https://dmpanda.com/
   ```
3. Click **Request Indexing**.
4. Repeat for key public landing pages such as `/features`, `/pricing`, and `/blog`.
