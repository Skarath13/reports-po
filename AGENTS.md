# Reports agent instructions

## Cloudflare CLI: cf is primary

Use Cloudflare's `cf` CLI as the primary Cloudflare CLI going forward. Prefer `cf` for supported account, Worker, deployment inspection, D1, R2, KV, and other resource operations. This instruction takes precedence over older Wrangler CLI examples below; existing release authorization and Git-linked Workers Builds remain in force.

Discover commands with `cf cli search "<anonymous task description>"`, inspect the selected request with `cf schema <command path>`, and use its `--help` and `--dry-run` where supported before a consequential action. Verify the exact account, target, and resulting state. Never put credentials or identifying values into search text or logs.

Wrangler is an exception only when a needed operation has no verified suitable `cf` equivalent or the existing project build/deploy still depends on Wrangler configuration. State that concrete reason and keep the exception narrow. Do not run `cf dev`, `cf build`, or `cf deploy` against a Wrangler-only project until its configuration migration has been deliberately implemented and verified; adopting `cf` does not itself authorize configuration changes or a production deploy. Preserve pending imports, receipts, and ordinary uncertain-write handling.


## Standing independent critique

For material changes, use an independent read-only collaboration critique agent with inherited model/settings. Review code, authentication/data boundaries, state and recovery races, performance claims, and whether actual user-flow evidence proves the stated result. Resolve demonstrated findings and independently recheck fixes before declaring readiness. Preserve production/deployment/billing authority and unrelated work.

## Private VPS access

Local credentials are in ignored `.env.vps.local`. Use `python3 scripts/vps-access.py --check` for offline validation and see [VPS access](docs/vps-access.md) before connecting. Access does not authorize production changes.
