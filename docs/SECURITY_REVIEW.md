# Security Review - PMQL

Date: 2026-07-09

## Overall Rating

Current security posture: **7/10**

The app has a reasonable baseline for an internal CRM/POS system: API routes require Supabase bearer tokens, server-side privileged work uses `SUPABASE_SERVICE_ROLE_KEY`, admin actions are role-gated, and prior Supabase advisor fixes exist for helper functions. The main remaining risks are operational configuration, stronger auth policy, and production data governance.

## Completed Hardening

- Added `noindex,nofollow,noarchive,nosnippet,noimageindex` metadata to the SPA shell.
- Added `public/robots.txt` to disallow all crawler traffic, including common AI crawlers.
- Added Vercel `X-Robots-Tag` headers for every route, including API routes.
- Added security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: same-origin`
  - restrictive `Permissions-Policy`
  - app-focused `Content-Security-Policy`
- Kept Vercel scheduled cron enabled for internal Google Sheets sync.
- Cron sync requires `CRON_SECRET` bearer authorization for GET calls.
- Google Sheets sync remains available through the authenticated admin manual button.
- Raised admin-created password minimum length from 6 to 8 characters.

## Current Findings

### High Priority

1. **Supabase leaked password protection is disabled**
   - Status: open.
   - Reason: Supabase exposes this under Auth Attack Protection / Email provider. It may require Pro plan.
   - Recommended action: enable "Prevent use of leaked passwords" when the project plan allows it.

2. **MFA should be required for admin users**
   - Status: open.
   - Impact: admin and accountant accounts can perform sensitive finance, inventory and user actions.
   - Recommended action: enable MFA for admin accounts at minimum.

3. **Production database migrations must be tracked**
   - Status: partially open.
   - Impact: features can deploy before required Supabase schema exists.
   - Recommended action: link Supabase CLI or maintain a manual migration checklist before deployment.

### Medium Priority

4. **Role permission model needs a full matrix**
   - Status: open.
   - Impact: current code has role checks, but the product needs a visible admin screen for page/action-level permissions.
   - Recommended action: implement role-policy management for subpages, actions, and data scopes.

5. **CSP should be validated after each third-party integration**
   - Status: ongoing.
   - Impact: the current policy permits Supabase and local assets. Telegram bot, maps, or other integrations will need explicit additions.
   - Recommended action: keep CSP strict and update only for known required domains.

6. **Local POS draft uses browser localStorage**
   - Status: accepted risk for now.
   - Impact: data on the same device/browser can persist until checkout or manual cleanup.
   - Recommended action: avoid storing sensitive personal data in POS drafts or add encrypted/session-scoped drafts later.

### Low Priority

7. **Robots directives are advisory**
   - Status: mitigated, not absolute.
   - Impact: legitimate search engines comply; malicious crawlers may ignore them.
   - Recommended action: keep auth gates strong and do not rely on robots controls for confidentiality.

8. **Service role key exposure remains an operational risk**
   - Status: mitigated in code.
   - Impact: key must stay server-only in Vercel environment variables.
   - Recommended action: rotate if ever pasted into chat/logs or exposed locally.

## Manual Supabase Actions

- Authentication -> Attack Protection -> Prevent use of leaked passwords: enable if available.
- Authentication -> Multi-Factor: enable for admin users.
- Authentication -> Rate Limits: keep conservative limits for sign-in, OTP and recovery.
- Project Settings -> API: rotate leaked or pasted service keys if needed.

## Notes

Search-engine blocking is now applied at multiple layers, but app confidentiality must still come from authentication, authorization, cron secrets, RLS policies and careful server-side API checks.
