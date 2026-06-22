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

Production Workers Builds trigger:

- Repository: `Skarath13/reports-po`
- Branch: `main`
- Root directory: `/`
- Build command: `echo "Cloudflare auto-install complete; Wrangler deploy runs npm run build"`
- Deploy command: `npx wrangler deploy --config cloudflare/reports/wrangler.jsonc`

Cloudflare auto-installs dependencies before the configured build command. The no-op build command prevents a duplicate `npm ci`; the deploy command still runs the `cloudflare/reports/wrangler.jsonc` custom build once through Wrangler.

Manual production deploy command:

```bash
npx wrangler deploy --config cloudflare/reports/wrangler.jsonc
```

Last push-trigger verification: 2026-06-22 after explicit reports Wrangler config restore.

Worker secrets should only be:

- `ORIGIN_ACCESS_CLIENT_ID`
- `ORIGIN_ACCESS_CLIENT_SECRET`

Do not add Supabase service-role, Square, Twilio, Brevo, Bloom, deploy-health, or VPS secrets to this browser app or Worker.

## Dependency Audit

Runtime dependency audit:

```bash
npm audit --omit=dev
```

The runtime audit is clean. The full `npm audit` still reports moderate CRA/react-scripts development-tooling advisories under Jest, SVGO/js-yaml, and webpack-dev-server. Do not run `npm audit fix --force`; npm proposes `react-scripts@0.0.0`, which would break the app instead of upgrading CRA.
