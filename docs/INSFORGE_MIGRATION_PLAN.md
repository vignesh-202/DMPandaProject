# DM Panda: Appwrite to Insforge Migration Plan

## Executive Summary

This document outlines the migration strategy from Appwrite (self-hosted) to Insforge for the DM Panda application. The migration is feasible but requires careful planning due to architectural differences between the platforms.

**Migration Complexity:** Medium-High  
**Estimated Files to Modify:** 40+  
**Key Risk:** Database paradigm shift (NoSQL → SQL)

---

## 1. Platform Comparison

### Insforge Backend Metadata (Current State)
```
Base URL: https://kkqnp7i4.ap-southeast.insforge.app
Auth: Email/Password + OAuth (Google, GitHub)
Email Verification: Required (6-digit code method)
Password Policy: Min 6 chars, no special requirements
Database: PostgreSQL (currently empty)
Storage: No buckets configured yet
Functions: None deployed yet
AI Models: DeepSeek, Minimax, Grok, Claude, GPT-4o-mini, Gemini
```

### Feature Mapping

| Feature | Appwrite | Insforge | Migration Effort |
|---------|----------|----------|------------------|
| **Authentication** | |||
| Email/Password | ✅ | ✅ | Low |
| Google OAuth | ✅ | ✅ | Low |
| Email Verification | ✅ | ✅ (code-based) | Low |
| Password Reset | ✅ | ✅ (code-based) | Low |
| Session Management | JWT + Cookies | JWT + httpOnly cookies | Low |
| **Custom SMTP** | ✅ Supported | ❌ Not configurable | **HIGH - See Section 6** |
| **Database** | |||
| Data Model | Document Collections | PostgreSQL Tables | High |
| Permissions | Document-level | Row-Level Security (RLS) | Medium |
| Queries | Appwrite Query DSL | PostgREST filters | Medium |
| Relationships | Manual references | Foreign Keys + Joins | Medium |
| **Functions** | |||
| Runtime | Python (custom) | Deno (TypeScript) | High |
| Event Triggers | users.*.create etc. | Database triggers | Medium |
| Deployment | GitHub VCS | MCP tool or manual | Medium |
| **Storage** | |||
| Buckets | ✅ | ✅ | Low |
| File Operations | Similar API | Similar API | Low |
| **Realtime** | |||
| Subscriptions | Collection events | Channel pub/sub + triggers | Medium |

---

## 2. Database Schema Migration

### Current Appwrite Collections → Insforge Tables

#### 2.1 Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_login TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Insforge has built-in auth.users table
-- This custom users table stores app-specific data
-- Link via: user_id references auth user id
```

#### 2.2 Profiles Table
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    credits INTEGER DEFAULT 10,
    tier VARCHAR(50) DEFAULT 'free',
    referral_code VARCHAR(50) UNIQUE,
    referred_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());
```

#### 2.3 Settings Table
```sql
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    dark_mode BOOLEAN DEFAULT false,
    notification_preference VARCHAR(255),
    timezone VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
ON settings FOR ALL
TO authenticated
USING (user_id = auth.uid());
```

#### 2.4 Transactions Table
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL,
    campaign_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
ON transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all transactions"
ON transactions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND tier = 'admin'
    )
);
```

#### 2.5 Instagram Accounts Table
```sql
CREATE TABLE ig_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ig_user_id VARCHAR(255) NOT NULL,
    ig_username VARCHAR(255),
    ig_name VARCHAR(255),
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT true,
    followers_count INTEGER,
    following_count INTEGER,
    media_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ig_user_id)
);

ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own IG accounts"
ON ig_accounts FOR ALL
TO authenticated
USING (user_id = auth.uid());
```

#### 2.6 Campaigns Table
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ig_account_id UUID NOT NULL REFERENCES ig_accounts(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'dm', 'post', 'reel', 'story', 'live', 'mention'
    status VARCHAR(50) DEFAULT 'active',
    trigger_type VARCHAR(50),
    trigger_keywords TEXT[], -- PostgreSQL array
    response_template JSONB,
    media_ids TEXT[],
    settings JSONB,
    stats JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns"
ON campaigns FOR ALL
TO authenticated
USING (user_id = auth.uid());
```

---

## 3. Authentication Migration

### 3.1 Frontend Changes

**Current (Appwrite):**
```typescript
// Frontend/src/contexts/AuthContext.tsx
// Uses custom JWT token stored in localStorage
// Communicates with Flask backend for auth
```

**New (Insforge):**
```typescript
// Option 1: Use @insforge/react components (Recommended)
import { InsforgeProvider, SignInButton, useUser } from '@insforge/react';

// Option 2: Use SDK directly for custom UI
import { createClient } from '@insforge/sdk';
const insforge = createClient({
  baseUrl: 'https://kkqnp7i4.ap-southeast.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});

// Sign in
const { data, error } = await insforge.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// OAuth
await insforge.auth.signInWithOAuth({
  provider: 'google',
  redirectTo: 'http://localhost:5173/dashboard'
});
```

### 3.2 Backend Changes

**Current (Flask + Appwrite SDK):**
```python
from appwrite.client import Client
from appwrite.services.account import Account
```

**New (Flask + Insforge REST API or Python requests):**
```python
# Insforge doesn't have official Python SDK
# Use REST API directly or create wrapper
import requests

INSFORGE_BASE_URL = "https://kkqnp7i4.ap-southeast.insforge.app"

def verify_token(token):
    response = requests.get(
        f"{INSFORGE_BASE_URL}/api/auth/session",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.json()
```

---

## 4. Functions Migration

### Current Appwrite Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| on-user-create | users.*.create | Create user + profile docs |
| token-refresh | Scheduled | Refresh Instagram tokens |
| on-account-action | Manual | Handle account events |
| automation-manager | Manual | Manage automations |

### Insforge Equivalent

**on-user-create → Database Trigger + Edge Function**

```sql
-- Database trigger approach
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile for new user
    INSERT INTO profiles (user_id, credits, tier)
    VALUES (NEW.id, 10, 'free');
    
    -- Create settings for new user
    INSERT INTO settings (user_id, language)
    VALUES (NEW.id, 'en');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to Insforge's internal users table
-- Note: May need to use Edge Function instead
```

**Edge Function Alternative:**

```typescript
// functions/on-user-create.ts
import { createClient } from 'npm:@insforge/sdk';

export default async function(req: Request): Promise<Response> {
    const client = createClient({
        baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
        anonKey: Deno.env.get('ANON_KEY')
    });
    
    const { user } = await req.json();
    
    // Create profile
    await client.database.from('profiles').insert({
        user_id: user.id,
        credits: 10,
        tier: 'free'
    });
    
    return new Response(JSON.stringify({ success: true }));
}
```

---

## 5. Storage Migration

### Create Buckets
```
Required buckets:
- media (for campaign media files)
- avatars (for user profile pictures)
```

### File Upload Pattern Change

**Appwrite:**
```typescript
import { Storage } from 'appwrite';
const result = await storage.createFile(bucketId, ID.unique(), file);
```

**Insforge:**
```typescript
const { data } = await insforge.storage
    .from('media')
    .upload(`campaigns/${campaignId}/${filename}`, file);
// Save data.url and data.key to database
```

---

## 6. SMTP / Email Configuration

### ⚠️ Critical Finding: Custom SMTP Not Directly Configurable

Insforge handles authentication emails (verification, password reset) internally. There's no direct way to configure custom SMTP like Appwrite allows.

### Workarounds

1. **Use Insforge's built-in email** for auth flows
   - Email verification codes
   - Password reset codes
   - Works out of the box

2. **Custom transactional emails via Edge Functions**
   ```typescript
   // For custom emails (notifications, receipts, etc.)
   // Use a third-party service like SendGrid, Resend, or Mailgun
   
   export default async function(req: Request) {
       const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
       
       const response = await fetch('https://api.resend.com/emails', {
           method: 'POST',
           headers: {
               'Authorization': `Bearer ${RESEND_API_KEY}`,
               'Content-Type': 'application/json'
           },
           body: JSON.stringify({
               from: 'DM Panda <no-reply@dmpanda.com>',
               to: ['user@example.com'],
               subject: 'Your automation report',
               html: '<p>Here is your report...</p>'
           })
       });
       
       return new Response(JSON.stringify({ sent: true }));
   }
   ```

3. **Keep Flask backend for email**
   - Continue using your existing SMTP setup in Flask
   - Route email-related requests through your backend

### Recommendation
For DM Panda, I recommend **Option 3** - keep using your Flask backend with Hostinger SMTP for custom emails, while letting Insforge handle auth-related emails.

---

## 7. Migration Phases

### Phase 1: Infrastructure Setup (Current)
- [x] Document current Appwrite usage
- [x] Get Insforge backend metadata
- [x] Create migration plan
- [ ] Set up database schema
- [ ] Create storage buckets
- [ ] Deploy initial functions

### Phase 2: Authentication Migration
- [ ] Create Insforge client config
- [ ] Update AuthContext for Insforge SDK
- [ ] Migrate login page
- [ ] Test OAuth flows
- [ ] Update backend token verification

### Phase 3: Database Migration
- [ ] Export data from Appwrite
- [ ] Transform to SQL format
- [ ] Import to Insforge
- [ ] Update all database queries in:
  - Frontend components
  - Backend API endpoints
  - Worker processes

### Phase 4: Functions Migration
- [ ] Convert Python functions to Deno/TypeScript
- [ ] Set up database triggers
- [ ] Deploy edge functions
- [ ] Test all automation flows

### Phase 5: Storage Migration
- [ ] Create buckets
- [ ] Migrate existing files
- [ ] Update file upload/download code

### Phase 6: Testing & Cutover
- [ ] Full end-to-end testing
- [ ] Performance comparison
- [ ] DNS cutover (if needed)
- [ ] Monitor for issues

---

## 8. Files Requiring Changes

### Frontend (React/TypeScript)
```
src/lib/appwrite.ts → src/lib/insforge.ts (NEW)
src/contexts/AuthContext.tsx
src/contexts/DashboardContext.tsx
src/app/login/page.tsx
src/app/dashboard/*.tsx (all views)
src/components/dashboard/*.tsx
```

### Backend (Flask/Python)
```
Backend/app.py (major changes)
Backend/setup_appwrite.py → setup_insforge.py
functions/*.py → functions/*.ts (rewrite)
worker/main.py
```

### Admin Panel
```
admin-panel/src/pages/*.tsx
admin-panel/src/components/*.tsx
```

---

## 9. Risk Mitigation

1. **Run parallel systems** during migration
2. **Feature flags** to toggle between backends
3. **Comprehensive testing** before cutover
4. **Data backup** from Appwrite before migration
5. **Rollback plan** if issues arise

---

## 10. Environment Variables

### New .env Configuration
```env
# Insforge
VITE_INSFORGE_BASE_URL=https://kkqnp7i4.ap-southeast.insforge.app
VITE_INSFORGE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Keep for Flask backend
FLASK_SECRET_KEY=your-secret
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret

# Instagram (unchanged)
INSTAGRAM_APP_ID=your-app-id
INSTAGRAM_APP_SECRET=your-secret

# Email (for custom emails via Flask)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contact@dmpanda.com
SMTP_PASS=your-password

# Third-party email service (optional)
RESEND_API_KEY=your-key
```

---

## Appendix A: Insforge SDK Quick Reference

```typescript
// Initialize
const insforge = createClient({ baseUrl, anonKey });

// Auth
await insforge.auth.signUp({ email, password, name });
await insforge.auth.signInWithPassword({ email, password });
await insforge.auth.signInWithOAuth({ provider: 'google' });
await insforge.auth.signOut();
await insforge.auth.getCurrentSession();

// Database
await insforge.database.from('table').select();
await insforge.database.from('table').insert([{...}]).select();
await insforge.database.from('table').update({...}).eq('id', id);
await insforge.database.from('table').delete().eq('id', id);

// Storage
await insforge.storage.from('bucket').upload(path, file);
await insforge.storage.from('bucket').download(path);
await insforge.storage.from('bucket').remove(path);

// Functions
await insforge.functions.invoke('function-slug', { body: {...} });

// Realtime
await insforge.realtime.connect();
await insforge.realtime.subscribe('channel');
insforge.realtime.on('event', callback);
```

---

*Document created: February 9, 2026*
*Last updated: February 9, 2026*
