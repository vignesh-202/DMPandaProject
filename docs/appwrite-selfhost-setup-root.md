# Appwrite Self-Host Setup (DM Panda)

This document captures the Appwrite self-host settings used for DM Panda so the environment can be re-created quickly.

## Domains & Console
- `_APP_OPTIONS_FORCE_HTTPS=enabled` (used to set SSL for Google auth)
- `_APP_OPTIONS_FUNCTIONS_FORCE_HTTPS=enabled` (used to set SSL for functions)
- `_APP_DOMAIN=appwrite.dmpanda.com`
- `_APP_DOMAIN_FUNCTIONS=functions.appwrite.dmpanda.com`
- `_APP_DOMAIN_SITES=sites.appwrite.dmpanda.com`
- `_APP_DOMAIN_TARGET=appwrite.dmpanda.com`
- `_APP_DOMAIN_TARGET_CNAME=appwrite.dmpanda.com`
- `_APP_EMAIL_CERTIFICATES=viganesh202@gmail.com` (used to generate SSL certifcates)
- `_APP_SYSTEM_SECURITY_EMAIL_ADDRESS=viganesh202@gmail.com` (used to receive security alerts from self-hosted Appwrite)

## SMTP
- `_APP_SYSTEM_EMAIL_NAME=DM Panda: Appwrite`
- `_APP_SYSTEM_EMAIL_ADDRESS=no-reply@dmpanda.com`
- `_APP_SMTP_HOST=smtp.hostinger.com`
- `_APP_SMTP_PORT=465`
- `_APP_SMTP_SECURE=ssl`
- `_APP_SMTP_USERNAME=contact@dmpanda.com`
- `_APP_SMTP_PASSWORD=<redacted>` stored only in the server `.env`

## DNS records
- `appwrite.dmpanda.com` (Appwrite sub domain for appwrite console)
- `*.functions.dmpanda.com` (Wildcard for functions subdomain)
- `*.sites.dmpanda.com` (Wildcard for sites subdomain)
-
- Add a CNAME record for the functions domain using the value provided by Appwrite.

Note: If Appwrite Functions SSL is not working, first confirm the CNAME record exists, then in .env file verify `_APP_OPTIONS_FUNCTIONS_FORCE_HTTPS=enabled`.

## GitHub App
- `_APP_VCS_GITHUB_APP_NAME=dm-panda-appwrite`
- `_APP_VCS_GITHUB_PRIVATE_KEY="<redacted>"` stored only in the server `.env` and never committed
- `_APP_VCS_GITHUB_APP_ID=2816895`
- `_APP_VCS_GITHUB_CLIENT_ID=Iv23liSXCngBVaMahXJG`
- `_APP_VCS_GITHUB_CLIENT_SECRET=<redacted>` stored only in the server `.env`
- `_APP_VCS_GITHUB_WEBHOOK_SECRET=<redacted>` stored only in the server `.env`

Note: The private key must be wrapped in double quotes, and new lines must be replaced with `\n`.

* PowerShell helper to format a .pem into the required inline string:
`(Get-Content <file_name>.pem -Raw) -replace "`r?`n", "\n" | ForEach-Object { '"' + $_ + '"' }`
Replace `<file_name>` with the file name.

## Appwrite CLI login command
- `appwrite login --endpoint "https://appwrite.dmpanda.com/v1"`

## Appwrite Custom Domain to the project setup

Project: VV Deals – Appwrite Custom Domain & Google OAuth Investigation

Environment:

* Self-hosted Appwrite 1.9.0
* Console version: 7.8.37
* Browser SDK version: 0.3.2
* Primary Appwrite instance domain: appwrite.dmpanda.com

Current Appwrite server configuration:

_APP_DOMAIN=appwrite.dmpanda.com
_APP_DOMAIN_SITES=sites.appwrite.dmpanda.com
_APP_DOMAIN_TARGET_CNAME=appwrite.dmpanda.com
_APP_DOMAIN_FUNCTIONS=functions.appwrite.dmpanda.com

Goal:
Configure a custom Appwrite domain for the VV Deals project so that OAuth and API traffic use appwrite.vvdeals.cloud instead of appwrite.dmpanda.com.

Actions Taken:

1. Added a custom domain:
   https://appwrite.vvdeals.cloud

2. Updated the VV Deals frontend application configuration to use:
   https://appwrite.vvdeals.cloud/v1

   instead of:

   https://appwrite.dmpanda.com/v1

3. Attempted to access the Appwrite Console through:
   https://appwrite.vvdeals.cloud

4. Received the Appwrite Console error:

   "Invalid Origin. Register your new client (appwrite.vvdeals.cloud) as a new Web platform on your project console dashboard"

5. Verified that the Appwrite instance itself is still configured with:

   _APP_DOMAIN=appwrite.dmpanda.com

   meaning dmpanda.com remains the primary Appwrite instance domain.

6. Manually changed the Google OAuth redirect URI configuration from the Appwrite-generated dmpanda.com callback URL to the vvdeals.cloud callback URL.

7. After updating Google OAuth settings, Google Sign-In successfully worked.

Observed Behavior:

* Authentication works successfully.
* API requests through appwrite.vvdeals.cloud reach the Appwrite server.
* The custom domain is operational.
* However, Appwrite Console still displays OAuth callback URLs and endpoints using appwrite.dmpanda.com instead of appwrite.vvdeals.cloud.

Verification Results:

Request:
https://appwrite.vvdeals.cloud/v1/health

Response:
{
"message":"User (role: guests) missing scopes (["health.read"])",
"code":401
}

Interpretation:

* DNS is working.
* SSL is working.
* Reverse proxy is working.
* Requests reach Appwrite successfully.

Request:
https://appwrite.vvdeals.cloud/v1/account/sessions/oauth2/callback/google

Response:
{
"message":"Route not found. Please ensure the endpoint is configured correctly and that the API route is valid for this SDK version.",
"code":404
}

Interpretation:

* Direct access to OAuth callback URLs is expected to fail because they require OAuth parameters generated during the login flow.
* This does not indicate a broken OAuth configuration.

Current Understanding:

* The VV Deals custom domain is functional.

* Google OAuth works after updating the redirect URI.

* Appwrite Console continues displaying dmpanda.com URLs because the Appwrite instance itself is still configured with:

  _APP_DOMAIN=appwrite.dmpanda.com

* Project-level custom domains do not automatically replace all Console-generated URLs in Appwrite 1.9.0.

* The displayed URLs are derived from the Appwrite instance configuration, while the actual project can still operate through appwrite.vvdeals.cloud.


