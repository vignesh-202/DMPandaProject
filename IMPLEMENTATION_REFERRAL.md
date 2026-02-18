# Implementation Summary: Referral System

## 1. Overview
Implemented a complete referral system allowing users to:
- Generate unique referral links.
- Share links to invite new users.
- Track referrals, commissions, and payouts via a dedicated Affiliate Dashboard.
- Earn commissions (tracked as pending/active).

## 2. Backend Changes (`Backend/app.py`)
- **New helper**: `generate_referral_code()`
- **Updated `register()`**:
  - Auto-creates an `affiliate_profiles` document for every new user.
  - Checks for `referral_code` in the request body.
  - Creates a `referrals` document linking the new user to the referrer if a valid code is provided.
- **New API Endpoints**:
  - `GET /api/affiliate/stats`: Returns profile, stats, and referral history.
  - `POST /api/affiliate/activate`: Activates affiliate status (Subscriber/Influencer).
  - `GET /api/affiliate/payouts`: Lists payout history.
  - `POST /api/affiliate/payouts`: Requests a new payout.

## 3. Frontend Changes (`Frontend/src`)
- **Login (`app/login/page.tsx`)**:
  - Added logic to detect `?ref=CODE` from the URL.
  - Passes `referral_code` to the `/api/register` endpoint during signup.
- **Affiliate Dashboard (`app/dashboard/AffiliateView.tsx`)**:
  - Fully integrated with real backend APIs.
  - Displays:
    - Referral Link (copy to clipboard).
    - Stats (Total Earnings, Pending, Referrals).
    - Referral History List.
    - Payout Management (Request Payout, Payout History).
  - Onboarding flow for "Subscriber" (instant) vs "Influencer" (manual application).

## 4. Database Schema (Appwrite)
- **`affiliate_profiles`**: Stores user affiliate status, type, referral code, and earnings.
- **`referrals`**: Stores the link between referrer and referred user, status, and commission.
- **`payouts`**: Stores payout requests and their status.

## 5. Verification
1. **Get Link**: Log in -> Affiliate Tab -> Copy Link.
2. **Register**: Incognito -> Paste Link -> Sign up.
3. **Verify**: Log in as Referrer -> Affiliate Tab -> Check "Recent Activity" and "Referrals" tab.
