# DM Panda Project Documentation

## 🚀 Overview
DM Panda is a state-of-the-art Instagram automation and analytics platform. It leverages the **Instagram Graph API** to provide deep insights, automated messaging, and account management for professional (Business & Creator) accounts.

---

## 🛠 Tech Stack
| Component | Technology |
| :--- | :--- |
| **Web Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, Framer Motion |
| **Admin Panel** | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| **Core Backend** | Python (Flask), Flask-CORS, Requests, Razorpay SDK |
| **Background Worker** | Python, Webhook Handlers |
| **Serverless logic** | Appwrite Functions (Python 3.12) |
| **Database/BaaS** | Appwrite (Auth, Database, Storage) |
| **Deployment** | Coolify on Ubuntu (Hostinger Server) |
| **Integrations** | Instagram Graph API, Razorpay |

---

## 🏗 Project Architecture & Structure
The DM Panda ecosystem is composed of several modular components:

### **1. `/Backend` (Flask API)**
The central operational hub. It handles secure Instagram OAuth, manages complex automation logic, and provides a unified interface for the frontend to interact with Appwrite and Meta.

### **2. `/Frontend` (Web Application)**
The primary user portal built with React. It features high-fidelity analytics dashboards, automation editors, and account management tools.

### **3. `/admin-panel` (System Management)**
A dedicated dashboard for DM Panda administrators. It tracks system performance, user growth (MRR, total users), and active campaigns across the platform.

### **4. `/functions` (Appwrite Serverless)**
Handles event-driven and background tasks like profile initialization, token refreshing every 30 days, and cascading account deletions.

### **5. `/worker` (Background Processing)**
A Python-based component specialized in handling real-time Instagram webhooks and asynchronous message processing.

---

## 🔐 Instagram Authentication & Login Method
### **Crucial Concept: Business Login for Instagram**
DMPanda uses the **Instagram Login for Business** product.
- **NO Facebook Page Dependency**: Unlike traditional integrations, this method does *not* strictly require an Instagram account to be connected to a Facebook Page for basic operations.
- **Instagram Graph API ONLY**: We target the `graph.instagram.com` user node directly. We do **not** use the Facebook Graph API (`graph.facebook.com`) for primary account data.
- **Native Instagram Flow**: The login flow directs users to an Instagram-branded authorization page, making it feel native and trustworthy.

### **Login Workflow**
1. User clicks "Connect Instagram".
2. Backend generates an Instagram Auth URL with scopes: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_insights`, etc.
3. User authorizes. Instagram redirects to our callback with a short-lived code.
4. Backend exchanges the code for a **Long-Lived Access Token** (valid for 60 days).
5. Token is stored securely in Appwrite under the user's document.
6. **Comprehensive Profile Auto-Sync**: The system implements an intelligent synchronization logic that monitors the **Username, Display Name, and Profile Picture URL**. When `fetchStats` detects a change in any of these fields from the live Meta API, it automatically triggers a unified `sync-profile` update to the linked account record in the Appwrite database. This ensures account switchers, sidebars, and settings views always reflect the user's latest Instagram identity without manual intervention.
7. **Dual-ID Stability**: To prevent duplicate accounts and maintain data integrity during re-authorizations, the system uses a **Dual-ID strategy**. It pins accounts to their unique, non-scoped **Legacy User ID** (`ig_user_id`) while also tracking the modern **Scoped ID**. This ensures that automation settings and analytics history remain tethered to the actual Instagram account even if the user's handle or branding changes.
8. **Secure Management Protocols**: Both "Unlink" and "Delete Account" actions are protected by high-visibility consequence modals. Critically, permanent deletion of an account or an Instagram record now requires **Password Verification**. The backend validates the user's credentials via a temporary session before performing any destructive database operations, providing a robust failsafe against accidental or unauthorized data loss.

---

## 📊 Analytics & Insights System
The analytics system is designed for high performance and deep visualization.

- **Global Persistence**: Analytics data is stored in the `DashboardContext`. This means data persists even when the user navigates away to other sections (DM Automation, Inbox, etc.) and returns.
- **Parameter-Aware Caching**: The system uses a sophisticated caching layer where data is keyed by a composite of `accountID`, `startDate`, `endDate`, and `category`. This ensures that different date ranges for the same account are cached independently, preventing redundant API calls while maintaining data accuracy.
- **"Floaty" Date Selection**: A custom, integrated date range picker replaced standard browser inputs, providing predefined range intervals (7d, 30d, etc.) and a polished, theme-adaptive UX.
- **Sectional Insights**: Switching between Overview, Audience, and Activity is instant after the first load due to this granular caching.

### **Data Fetching & Performance**
- **Manual Sync Architecture**: To optimize performance and reduce API rate-limiting risks, the system moved from a 60-second auto-refresh to a **Manual Sync** model.
- **Global `refreshStats`**: All primary dashboard cards (Bio, Live, Stories) feature a "Quick Refresh" button that triggers a global update. This update propagates to all contexts, including the sidebar and account switchers.
- **Backend Concurrency**: Sequential API requests to Meta are slow. The backend uses `concurrent.futures.ThreadPoolExecutor` to fetch stats (followers, reels, stories) and live status in parallel.
- **Unified Account State**: The `DashboardContext` serves as the single source of truth for all linked accounts and their relative statuses. It implements a robust tracking mechanism (`_accountId` metadata) to ensure that fetched statistics are only applied to the dashboard if they correspond to the currently active account, eliminating profile flickering and ensuring a smooth switching experience.
- **Skeleton State Integration**: During data fetching or list refreshing, the system utilizes premium Skeleton loaders (shining rays) instead of generic spinners, maintaining layout stability and providing a high-end visual feedback loop.

### **Critical Limitations & Potential Errors**
- **100 Follower Rule**: Meta does *not* provide demographic or online activity data for accounts with fewer than 100 followers.
- **48h Delay**: Most insights have a processing delay on Meta's end.
- **Full Data Spectrum**: The system now fetches all available Instagram Graph API metrics, including `follower_count`, profile contact clicks (email, phone, directions), reach/interaction breakdowns, and impressions. Note that `saved` is used instead of legacy naming to strictly follow Meta documentation.
- **Non-Exclusive Batching**: Metrics are now fetched as both `time_series` and `total_value` where supported. This ensures that even if daily breakdowns have processing delays, a reliable aggregate is always available for summary cards.
- **Resilient Charting**: The frontend now handles cases where Meta might only return aggregate totals (Reach/Views) instead of daily trends. In such cases, the system generates a high-fidelity single-point visualization to ensure the dashboard remains informative and functional.
- **Activity Intelligence**: Follower online activity now implements the mandatory `hour` breakdown, providing a reliable 24-hour momentum heatmap.
- **Improved Graph Fidelity**: Support for daily trend graphing has been expanded to include `profile_views`, `website_clicks`, `follower_count`, and `accounts_engaged`.
- **Empty Values**: If Meta returns empty arrays, it means the account is too new or lacks enough activity for that period.

---

## 🤖 Automation System (V2)
Automations are structured using **Templates** and **Triggers**.
- **Templates**: Predefined messages (Text, Media, Quick Replies).
- **Triggers**: Events like keyword matches, story mentions, or new followers.
- **Global Triggers**: A unified, account-wide keyword management system. This collection allows users to define keywords that trigger specific templates across the entire account, centralizing automation logic that was previously fragmented.
- **Inbox Menu Refactor**: The persistent menu management system now uses a streamlined list-based UI. Instead of multiple open editors, users interact with a clean list of menu items, opening a modular configuration card only for the item currently being edited. This significantly reduces visual clutter and improves focus during setup.
- **Live Automation**: A specialized module that monitors real-time broadcast status. It features a "Force Sync" capability to immediately detect new live streams and apply automation rules.
- **Media-Type Filtering**: The system utilizes a unified `MediaSection` component that dynamically filters content into Reels, Posts, Stories, and Lives, providing consistent management interfaces across all media types.
- **Execution**: The backend utilizes Instagram Webhooks to listen for events and the `messages` edge to send responses.

---

## 🛡 Security & Rules
1. **CSRF Protection**: Flask-WTF CSRF is active. API routes used by the frontend are exempted ONLY for authenticated sessions.
2. **Session Management**: We use Appwrite session tokens passed via headers or secure cookies.
3. **Admin Panel**: Accessible via specific user roles to manage global users and system stats.

---

## 🐛 Critical Bugs & Solutions (Known History)
- **Username Change Error**: If a user changes their IG username, the existing `ig_user_id` remains the same, but the token might require re-validation.
- **Duplicate Backend Routes**: Always check for duplicate `@app.route` function names in `app.py` to avoid `AssertionError`.
- **JSX Nesting**: Large conditional structures in React often lead to tag mismatch errors. Always keep component chunks small and modular.
- **Infinite Render Loops**: When using complex contexts (like `DashboardContext`), ensure that state updates inside `useEffect` are guarded by value comparisons rather than reference comparisons to prevent cascading re-renders.
- **Mobile Layout Compression**: Use `flex-col` for mobile views in settings and dashboards to prevent horizontal text compression on small screens.
- **Account Settings Refactor**: The settings view now uses a premium two-column layout. The Instagram management section was renamed to **Linked Instagram Accounts** and optimized for mobile alignment (switching to `flex-col` with `items-start` on small screens). Per-account refresh icons were unified into a single, high-bandwidth **"Refresh"** button to streamline the interface and reduce visual noise on mobile devices.

---

## 📝 Important Info for AI "Vibe" Coders
- **Follow the Aesthetics**: The UI must always look premium—use gradients, glassmorphism, and smooth animations.
- **Be Cautious with State**: When modifying the dashboard, ensure you don't break the caching logic in `AnalyticsView.tsx`.
- **Meta Documentation**: Always refer to the [Instagram Graph API Reference](https://developers.facebook.com/docs/instagram-platform/api-reference) for metric availability.
- **No Placeholders**: Never use placeholder images. Use `generate_image` or Lucide icons.

---

## ⚡ Appwrite Serverless Functions (Backend)
DM Panda uses Appwrite Functions for asynchronous and event-driven logic.

### **Function Configuration**
All functions are stored in the `functions/` root directory and connected via Git.

| Function Name | Function ID | Root Directory | Trigger | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **User Creator** | `on-user-create` | `./on-user-create` | **Event**: `users.*.create` | Initializes profile in `profiles` collection with default credits. |
| **Automation Manager**| `automation-manager` | `./automation-manager` | **HTTP Trigger** | Handles automation CRUD and keeps template counts synced. |
| **Account Action** | `on-account-action` | `./on-account-action` | **HTTP Trigger** | Synchronously handles unlinking and cascade deletion of accounts. |
| **Token Refresh** | `token-refresh` | `./token-refresh` | **Schedule**: `0 0 */30 * *` | Automatically refreshes Instagram tokens every 30 days. |

### **Required Environment Variables**
Each function must be configured with the following variables in the Appwrite Console:
1.  `APPWRITE_FUNCTION_ENDPOINT`: Your Appwrite API endpoint.
2.  `APPWRITE_FUNCTION_PROJECT_ID`: Your Appwrite Project ID.
3.  `APPWRITE_API_KEY`: Secret Key with Database and Users permissions.
4.  `APPWRITE_DATABASE_ID`: The unique ID of the DM Panda database.

---

## 📅 Architectural Evolutions
- **Removal of Campaigns**: To streamline the user experience and reduce complexity, the standalone `campaigns` architecture was sunset. The platform now focuses on high-performance **Individual Automations** and **Global Triggers**, allowing for more granular control without the overhead of grouping them into campaigns.
- **Database Idempotency**: The `setup_appwrite.py` script was upgraded to a high-reliability synchronization tool. It now enforces a strict, manually-verified collection order and attribute schema, ensuring that the development and live environments remain perfectly in sync.
- **DM Automation Evolution**: 
  - **Case-Sensitive Keywords**: Logic updated to respect exact casing (e.g., "Price" vs "price").
  - **Template Logic**: Template IDs are now strictly synchronized during updates, creating new template versions when types change.
  - **Schema Cleanup**: Removed redundant `created_at` fields from automation collections, relying on the native Appwrite `$createdAt` attribute.
  - **Validation**: Strict validation added for media templates (requires min 1 button per card with valid URLs) and preventing deletion of the last remaining elements.

---

*This documentation is living and should be updated whenever significant architectural changes occur.*

## 🔄 Recent Updates (User Request)
- **DM Automation Edit Sync**: Now fetches the latest automation data from the server immediately upon clicking "Edit". This prevents errors if the rule was deleted or modified in another session. If the rule is not found (404), the list automatically refreshes.
- **Inbox Menu Enhancements**:
  - **Item Limit**: Increased from 5 to 20 menu items.
  - **Add Item Workflow**: New guided flow allows users to choose between a "Web URL" or a "Keyword Action" (linked to an existing DM Automation).
  - **Keyword Linking**: Automatically maps DM Automation titles and IDs to menu payloads, simplifying the setup of persistent menu triggers.
  - **Automated Button Title Logic**: The Inbox Menu system now intelligently pre-fills button titles based on linked automation keywords, while allowing manual overrides.
  - **Inline Editor Optimization**: The "Add Menu Item" workflow was streamlined to skip modal steps and default immediately to an inline editing experience for faster configuration.
  - **Inbox Menu Endpoints**:
  - `GET /api/instagram/inbox-menu/<account_id>`: Fetches and compares IG vs DB menu.
  - `POST /api/instagram/inbox-menu/<account_id>/save`: Saves local menu changes to Appwrite.
  - `POST /api/instagram/inbox-menu/<account_id>/sync`: Pushes DB menu to Instagram Graph API.
  - `DELETE /api/instagram/inbox-menu/<account_id>`: Deletes the menu from Instagram using the versioned endpoint: `https://graph.instagram.com/v24.0/<IG_ID>/messenger_profile?fields=['persistent_menu']&platform=instagram`.
- **Backend Endpoints**: Added `GET /api/instagram/automations/<id>` to support granular automation fetching.
- **Unified Loading States**: The premium `ModernLoader` animation is now consistently used for both initial list loading and editor preparation in the DM Automation view.
- **Appwrite Functions Integration**: Migrated heavy backend logic (automation management, cascade deletes) to serverless functions for better performance and reliability.
- **Profile Collection Migration**: Shifted subscription data (`plan_id`, `status`, `expires`) and referral data (`referred_by`, `referral_code`) from the `users` collection to a dedicated `profiles` collection for better data isolation.
- **Automation Manager (Sync)**: A unified function now handles automation saving and reply template usage counting in a single atomic-style operation, preventing count drifting.
- **Re-authorization Alert**: The Sidebar account switcher now displays a `RefreshCw` icon for accounts with invalid or expired tokens, providing a direct shortcut to the re-link section in Settings.
- **Project Structure**: Consolidated all serverless logic into a root-level `functions/` directory, managed as a separate Git repository for CI/CD.
