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

## Appwrite CLI login
- `appwrite login --endpoint "https://appwrite.dmpanda.com/v1"`
