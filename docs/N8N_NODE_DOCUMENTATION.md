# 🐼 DM Panda n8n Integration & Community Node Guide

The `n8n-nodes-dmpanda` package seamlessly connects **DM Panda** with **n8n**, enabling powerful, multi-platform automated marketing workflows.

---

## 🚀 Installation Guide

### Option 1: Community Node Installation (Recommended)
1. Open your self-hosted **n8n** instance.
2. Go to **Settings > Community Nodes**.
3. Click **Install**.
4. Enter `n8n-nodes-dmpanda` in the npm package name field and accept the risk notice.
5. Click **Install**. The **DM Panda** node will now be available in your workflow node palette!

### Option 2: Self-Hosted Docker Mount
If running n8n in Docker, copy `n8n-nodes-dmpanda` into your n8n custom nodes directory:

```bash
cd ~/.n8n/custom/
git clone https://github.com/vignesh-202/DMPandaProject.git
cp -r DMPandaProject/n8n-nodes-dmpanda ~/.n8n/custom/n8n-nodes-dmpanda
cd ~/.n8n/custom/n8n-nodes-dmpanda
npm run build
```

Then restart your n8n container.

---

## 🔑 Credential Setup

1. In n8n, click **Credentials > New Credential**.
2. Search for **DM Panda API Key**.
3. Fill in the required fields:
   - **API Key**: Copy your `dmp_live_...` key from **DM Panda Dashboard > API & Integrations**.
   - **Base URL**: Your DM Panda backend URL (e.g., `https://api.yourdomain.com/api/v1`).
4. Click **Save**.

---

## ⚡ Supported Resources & Actions

| Resource | Action / Operation | Description |
|---|---|---|
| **Account** | `Get Many` | Fetch list of connected Instagram accounts |
| **Automation** | `Get Many` | List all DM and Comment automations |
| **Automation** | `Get` | Get single automation details |
| **Automation** | `Create` | Dynamically create a new DM automation flow |
| **Automation** | `Toggle Status` | Activate or pause an automation flow |
| **Automation** | `Delete` | Remove an automation flow |
| **Automation** | `Trigger DM` | Dispatch an automated DM payload directly to a user |
| **Analytics** | `Get Overview` | Retrieve 24h & 30d DM send statistics |
| **Execution Log** | `Get Many` | Inspect execution history and deliverability logs |

---

## 💡 Practical Workflow Use-Cases

### 1. Save Instagram DM Lead Submissions to HubSpot / Airtable / Google Sheets
```
[Webhook / Meta Trigger] ➔ [DM Panda: Trigger DM] ➔ [Google Sheets: Add Row] ➔ [Slack: Send Notification]
```

### 2. Auto-Create Instagram Campaign Automations on Webhook Event
When a new marketing product launches on Shopify or WooCommerce, n8n automatically creates a corresponding Instagram keyword trigger automation in DM Panda.

### 3. Automated Performance Digest
Schedule a daily cron trigger in n8n that queries DM Panda `Analytics > Get Overview` and sends a summary report to your Telegram or Discord team channel.

---

## 📋 Sample n8n Workflow Blueprint (JSON)

Save the following JSON into a file and import it into n8n via **Workflows > Import from File**:

```json
{
  "name": "DM Panda — Lead Alert Workflow",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 24
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "analytics",
        "operation": "get"
      },
      "name": "DM Panda Analytics",
      "type": "n8n-nodes-dmpanda.dmPanda",
      "typeVersion": 1,
      "position": [450, 300],
      "credentials": {
        "dmPandaApi": {
          "id": "1",
          "name": "DM Panda Production"
        }
      }
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "DM Panda Analytics",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```
