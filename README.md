# Elegant Lashes Reports

Standalone reports dashboard and Cloudflare Worker for `reports.elegantlashesbykatie.com`.

The Express `/api/reports` backend remains in the checkin repo/VPS. This project only owns the reports React app, the `checkin-reports` Worker shell, and shared Cloudflare gateway code.

## Commands

```bash
npm ci
npm test -- --watchAll=false
npm run build
npm run test:cloudflare-shell
npm run cf:dry-run
npm run cf:deploy
```

## Cloudflare

Production deploy command:

```bash
npx wrangler deploy --config cloudflare/reports/wrangler.jsonc
```

Last push-trigger verification: 2026-06-22.

Worker secrets should only be:

- `ORIGIN_ACCESS_CLIENT_ID`
- `ORIGIN_ACCESS_CLIENT_SECRET`

Do not add Supabase service-role, Square, Twilio, Brevo, Bloom, deploy-health, or VPS secrets to this browser app or Worker.
