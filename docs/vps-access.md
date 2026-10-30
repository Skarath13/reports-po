# Private VPS access

The ignored root `.env.vps.local` contains only this project's private VPS access settings. Keep it mode `0600`. Do not commit, print, hash, or include it in build or archive inputs. Existing app environment files are unchanged.

Run `python3 scripts/vps-access.py --check` for offline validation. For an already authorized remote operation, use `python3 scripts/vps-access.py -- <command> <arguments>`. Since 2026-10-29 root SSH accepts keys only (password login is disabled). The helper connects with the private key `~/.ssh/checkin-vps-control/id_ed25519` (owned, mode `0600`) using `IdentitiesOnly`, `BatchMode` and publickey authentication; `sshpass` is no longer used. The private file still needs `VPS_HOST` and `VPS_USER`; `VPS_PASS` may remain for the DigitalOcean console but is not used for SSH. It requires the existing trusted SSH host key and does not retry rejected credentials.

Authorized commands reuse a private SSH connection through `~/.ssh/checkin-vps-control/root-24.199.121.72.sock`, with a 60-second idle lifetime. The helper requires an owned `0700` control directory and an owned `0600` Unix socket. Offline `--check` returns before creating the control directory or connecting. Host-key verification is unchanged.

Batch related reads and reuse this helper. The VPS firewall limits new SSH connections to six within 30 seconds; recorded operator connections hit that limit. Connection reuse was verified with two commands sharing the same server-observed TCP peer port. Keep the firewall intact.

Access does not authorize production changes. Coordinate with the active migration owner before connecting; do not run competing SSH checks during benchmarks. Remote command output is shown normally, so never request credential output.

These unprefixed VPS settings must never become `REACT_APP_`, `NEXT_PUBLIC_`, or `VITE_` settings. Use the project's existing source-package allowlists and `.env*` exclusions. Git ignore alone does not protect a manually created whole-directory archive or Docker context. Check-in release rsync excludes `.env.*`; native Check-in, Bloom and TechManager package preparers exclude `.env*`. Reports publishes only its build output and Worker source. Do not bypass those boundaries.
