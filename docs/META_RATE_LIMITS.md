# Meta Rate Limits Guide for DMPanda

This guide explains the official Meta Instagram rate limits that directly apply to DMPanda's features, written in plain English with practical examples.

---

> ### 💡 Golden Rule: Every Limit is PER INSTAGRAM ACCOUNT (Not Shared)
> **None** of the limits below are shared across DMPanda.  
> Meta assigns limits individually to each connected **Instagram Professional Account**:
> * **Account A** has its own independent limits.
> * **Account B** has its own independent limits.
> * If Account A experiences a huge viral spike, it **never** affects, slows down, or drains the limits of Account B.

---

## 1. Summary: Rate Limits by Feature

| DMPanda Feature | What the Bot Does | Meta Limit | Scope | Practical Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Comment-to-DM** | Follower comments keyword on Post/Reel $\rightarrow$ bot sends DM | **750 DMs / hour** | **Per IG Account** | **Hard ceiling.** If a reel goes viral, that specific account can send max 750 private replies per hour. |
| **Direct Message Chat** | Follower DMs account $\rightarrow$ bot replies (text, buttons, links) | **100 msgs / sec** | **Per IG Account** | **Extremely high.** Account A can send 100/sec, Account B can send 100/sec. Normal chats will never hit this. |
| **Media Messages** | Bot sends audio or video files in DM | **10 msgs / sec** | **Per IG Account** | **High.** 10 media files per second per account. |
| **Comment Actions & Checks** | Public comment replies, hide/delete comments, follower checks | **4,800 $\times$ Impressions** (Rolling 24h) | **Per IG Account** | **Virtually unlimited.** Calculated from that specific account's impressions. |

---

## 2. What Does "4,800 $\times$ Impressions" Actually Mean?

Meta uses this formula for all standard Instagram actions **other than DMs** (such as posting a public reply to a comment, hiding spam comments, or checking if someone follows the account).

### What is an "Impression"?
An **impression** is counted every single time any content from that specific Instagram account (a post, reel, story, or profile) appears on someone's screen.
* If 1 person sees your reel 3 times = **3 impressions**.
* If 500 people scroll past your photo today = **500 impressions**.

### How Meta Calculates the Daily Budget
Meta looks at that specific account's total impressions over the last 24 hours and multiplies by **4,800**:

$$\text{Daily API Budget} = 4,800 \times \text{Impressions of that Account in last 24h}$$

### Real-World Examples (Per Account):

* **Brand new or tiny account (only 10 impressions in 24 hours):**
  $$\text{Budget} = 4,800 \times 10 = \mathbf{48,000 \text{ calls per day}} \quad (\approx 2,000 \text{ calls per hour})$$
  *Even an account with almost zero views gets 48,000 actions every day.*

* **Small creator account (1,000 impressions in 24 hours):**
  $$\text{Budget} = 4,800 \times 1,000 = \mathbf{4,800,000 \text{ calls per day}}$$
  *Can perform 4.8 million comment replies and follower checks every single day.*

* **Active business account (50,000 impressions in 24 hours):**
  $$\text{Budget} = 4,800 \times 50,000 = \mathbf{240,000,000 \text{ calls per day}}$$
  *Virtually infinite allowance.*

> **Key Point:** This budget belongs **only to that account**. Account A's impressions only power Account A.

---

## 3. Detailed Breakdown with Practical Scenarios

### Feature 1: Comment-to-DM Automations (Private Replies)
* **What it does:** When a user comments a keyword (e.g. `"PRICE"`, `"LINK"`) on a Post or Reel, DMPanda automatically sends them a private direct message.
* **The Limit:** **750 private replies per hour** per connected Instagram account.
* **Scope:** **Per Account.** If Account A hits the 750/hour ceiling, Account B can still send its full 750 replies without interruption.
* **Window:** Rolling 60-minute window (continuous, not reset at top of the hour).

#### Real-World Example:
> **Account A** posts a viral reel: *"Comment 'WIN' for giveaway entry."*
> * **Hour 1:** 600 people comment `"WIN"`.  
>   $\rightarrow$ **Result:** All 600 users get their DM immediately ($600 < 750$).
> * **Hour 2:** 1,200 people comment `"WIN"`.  
>   $\rightarrow$ **Result:** The first 750 users receive their DM immediately. The next 450 wait until the 60-minute window rolls forward.
> * **Meanwhile on Account B:** Receives 200 comments $\rightarrow$ all 200 get their DMs instantly. Account A's spike has **zero effect** on Account B.

---

### Feature 2: Standard Direct Message Automations
* **What it does:**
  - Automated replies to incoming direct messages.
  - Interactive Button clicks and Quick Replies.
  - Story Mention and Story Reply automations.
  - Multi-step email collection conversations.
* **The Limit:**
  - **Text, buttons, links, quick replies, carousels:** **100 messages per second** per connected account.
  - **Audio or video files:** **10 messages per second** per connected account.
* **Scope:** **Per Account.**

#### Real-World Example:
> * **Account A** has 40 followers message at the exact same second $\rightarrow$ all 40 messages are delivered within that 1 second.
> * **Account B** also has 50 followers message at the exact same second $\rightarrow$ all 50 messages are delivered within that 1 second.
> * Across DMPanda, $40 + 50 = 90$ messages were sent in 1 second. Both accounts are completely within their respective 100/sec limit.

---

### Feature 3: Public Comment Replies & Comment Moderation
* **What it does:**
  - Posting a public reply under a comment (e.g., *"Sent to your DM! Check your inbox ✨"*).
  - Automatically hiding offensive or banned keyword comments.
  - Automatically deleting toxic or spam comments.
* **The Limit:** Governed by that account's **$4,800 \times \text{Impressions}$** formula (rolling 24h).
* **Scope:** **Per Account.**

#### Real-World Example:
> Today, **Account A** receives 400 customer inquiries and 150 spam comments:
> * DMPanda automatically posts 400 public replies and hides the 150 spam comments (550 total API calls).
> * Account A had 2,000 impressions yesterday, giving it a budget of $9,600,000$ calls.
> $\rightarrow$ **Result:** 550 calls used out of 9.6 million ($< 0.01\%$). Operates effortlessly.

---

### Feature 4: Follower Verification (`followers_only` feature)
* **What it does:** Checks `is_user_follow_business` before delivering exclusive discount codes or links to ensure the user is an active follower.
* **The Limit:** Governed by that account's **$4,800 \times \text{Impressions}$** formula.
* **Scope:** **Per Account.**

#### Real-World Example:
> 1,000 people comment on **Account A's** post. DMPanda checks each commenter's follower status before triggering the DM.
> $\rightarrow$ **Result:** Uses 1,000 lookup calls from Account A's multi-million daily allowance. Never gets blocked.

---

## 4. Non-Rate-Limit Meta Policies to Remember

1. **The 24-Hour Messaging Window:**
   - For standard DMs, Meta allows automated messages only within **24 hours** of the user's last message to the account.
   - Outside 24 hours, Meta returns error code `10` (*"outside 24-hour window"*).
   - *Exception:* Comment-to-DM Private Replies do not require a prior DM history; the comment itself grants a one-time token.

2. **Per-Recipient Anti-Spam (Single-Thread Throttling):**
   - Even though an account can send 100 messages/sec globally, sending 5 rapid messages to the **same recipient** in 2 seconds triggers temporary user-level throttling by Meta. DMPanda handles conversations sequentially to avoid this.

---

## 5. Frequently Asked Questions

#### Q1: Is there any rate limit that is shared across all DMPanda accounts?
**No.** Every Meta rate limit for messaging, comment replies, and profile lookups is strictly calculated and enforced **per connected Instagram Professional Account**. Account A will never exhaust Account B's budget.

#### Q2: What about the rule "Calls within one hour = 200 $\times$ Number of Users"?
**That rule does not apply to DMPanda.**  
That is Meta's generic limit for apps calling Facebook Graph API endpoints with App Access Tokens (like Facebook Login checks or Hashtag Search). Meta's documentation explicitly states that Instagram Platform automations use **Business Use Case (BUC)** limits instead.

#### Q3: How does DMPanda monitor rate limit health?
Meta returns an HTTP header with every API response called `X-Business-Use-Case-Usage`:
```json
{
  "{instagram_account_id}": [
    {
      "type": "instagram",
      "call_count": 42,
      "total_cputime": 8,
      "total_time": 10,
      "estimated_time_to_regain_access": 0
    }
  ]
}
```
* **`call_count`**: The percentage of the limit currently used (e.g. `42` means 42% used).
* If `call_count` reaches `100`, Meta pauses new calls until the window rolls forward.
