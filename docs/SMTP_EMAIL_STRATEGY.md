# DM Panda: Email Strategy with Insforge

## SMTP Configuration Status

### Finding: Custom SMTP Not Directly Supported in Insforge

Unlike Appwrite where you can configure custom SMTP settings (`_APP_SMTP_HOST`, `_APP_SMTP_PORT`, etc.), **Insforge handles authentication emails internally** without exposing SMTP configuration options.

## Current Appwrite SMTP Configuration
```
Host: smtp.hostinger.com
Port: 465
Secure: SSL
Username: contact@dmpanda.com
From: DM Panda: Appwrite <no-reply@dmpanda.com>
```

## Insforge Email Capabilities

### What Insforge Handles Automatically:
1. **Email Verification** - 6-digit code sent to users during registration
2. **Password Reset** - 6-digit code for password recovery
3. **OAuth Email** - Handled by OAuth providers (Google, GitHub)

### Configuration Available:
- `verifyEmailMethod`: "code" (current) or "link"
- `resetPasswordMethod`: "code" (current) or "link"
- `requireEmailVerification`: true (enabled)

## Recommended Email Strategy for DM Panda

### Tier 1: Authentication Emails (Use Insforge)
Let Insforge handle all authentication-related emails:
- Registration verification codes
- Password reset codes
- Account-related notifications

**Pros:**
- Zero configuration needed
- Built-in rate limiting and security
- Reliable delivery

**Cons:**
- Generic email templates
- Cannot use your custom domain (no-reply@dmpanda.com)

### Tier 2: Transactional Emails (Use Flask + Hostinger SMTP)
Continue using your existing Flask backend for custom emails:
- Welcome emails
- Subscription confirmations
- Payment receipts
- Automation reports
- Weekly summaries

**Implementation:**
Keep your existing SMTP code in Flask:
```python
# Backend/app.py - Keep this for transactional emails
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = "smtp.hostinger.com"
SMTP_PORT = 465
SMTP_USER = "contact@dmpanda.com"
SMTP_PASS = os.getenv("SMTP_PASSWORD")

def send_custom_email(to_email, subject, html_content):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = "DM Panda <no-reply@dmpanda.com>"
    msg['To'] = to_email
    
    msg.attach(MIMEText(html_content, 'html'))
    
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
```

### Tier 3: Marketing Emails (Use Third-Party Service)
For marketing campaigns, consider a dedicated email service:

| Service | Free Tier | Pros | Integration |
|---------|-----------|------|-------------|
| **Resend** | 3,000/month | Modern API, great DX | Edge function compatible |
| **SendGrid** | 100/day | Robust, templates | REST API |
| **Mailgun** | 5,000/month | Reliable, analytics | REST API |
| **Postmark** | - | Excellent deliverability | REST API |

**Insforge Edge Function Example (Resend):**
```typescript
// functions/send-email.ts
export default async function(req: Request): Promise<Response> {
    const { to, subject, html } = await req.json();
    
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'DM Panda <no-reply@dmpanda.com>',
            to: [to],
            subject,
            html
        })
    });
    
    return new Response(JSON.stringify(await response.json()), {
        headers: { 'Content-Type': 'application/json' }
    });
}
```

## Email Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Auth Actions  │   │ App Actions     │   │ Marketing       │
│               │   │                 │   │                 │
│ - Register    │   │ - Welcome       │   │ - Newsletters   │
│ - Login       │   │ - Payment       │   │ - Promotions    │
│ - Reset PWD   │   │ - Reports       │   │ - Updates       │
└───────┬───────┘   └────────┬────────┘   └────────┬────────┘
        │                    │                     │
        ▼                    ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   INSFORGE    │   │  FLASK + SMTP   │   │  RESEND/OTHER   │
│   (Built-in)  │   │  (Hostinger)    │   │  (Third-party)  │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## Migration Recommendations

### Phase 1: Keep Hybrid Approach
1. Use Insforge for auth emails (auto-handled)
2. Keep Flask + Hostinger SMTP for transactional emails
3. This minimizes migration risk

### Phase 2: Optional Consolidation (Future)
If you want unified email handling:
1. Set up Resend or similar service
2. Create Insforge Edge Function for email sending
3. Migrate Flask email functions to Edge Functions
4. Keep Hostinger SMTP as backup

## Environment Variables Update

```env
# Insforge (handles auth emails automatically)
VITE_INSFORGE_BASE_URL=https://kkqnp7i4.ap-southeast.insforge.app

# Flask Backend (for transactional emails)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contact@dmpanda.com
SMTP_PASS=your-password-here

# Optional: Third-party email service
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## Summary

| Email Type | Current (Appwrite) | Migrated (Insforge) |
|------------|-------------------|---------------------|
| Verification | Custom SMTP | Insforge built-in |
| Password Reset | Custom SMTP | Insforge built-in |
| Welcome Email | Custom SMTP | Flask + Hostinger |
| Payment Receipt | Custom SMTP | Flask + Hostinger |
| Automation Reports | Custom SMTP | Flask + Hostinger |
| Marketing | - | Resend (optional) |

**Bottom Line:** You can successfully migrate to Insforge. Auth emails will use Insforge's built-in system, while your transactional emails continue through Flask/Hostinger SMTP without any changes.

---

*Document created: February 9, 2026*
