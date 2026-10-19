# Private VPS access

The ignored root `.env.vps.local` contains only this project's private VPS access settings. Keep it mode `0600`. Do not commit, print, hash, or include it in build or archive inputs. Existing app environment files are unchanged.

Run `python3 scripts/vps-access.py --check` for offline validation. For an already authorized remote operation, use `python3 scripts/vps-access.py -- <command> <arguments>`. The helper reads this private file without shell evaluation and passes the password through `SSHPASS` to the existing `sshpass -e` method. It requires the existing trusted SSH host key and does not retry rejected credentials.

Access does not authorize production changes. Coordinate with the active migration owner before connecting; do not run competing SSH checks during benchmarks. Remote command output is shown normally, so never request credential output.

These unprefixed VPS settings must never become `REACT_APP_`, `NEXT_PUBLIC_`, or `VITE_` settings. Use the project's existing source-package allowlists and `.env*` exclusions. Git ignore alone does not protect a manually created whole-directory archive or Docker context. Check-in release rsync excludes `.env.*`; native Check-in, Bloom and TechManager package preparers exclude `.env*`. Reports publishes only its build output and Worker source. Do not bypass those boundaries.
