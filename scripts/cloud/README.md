# Running modeluniverse.vn from a Claude cloud session

Moves the live shop (database, uploads, env files, Cloudflare tunnel credentials) from the laptop to a Claude cloud
session and back. The data never goes into this repository (it is public): it travels as an AES-256 encrypted bundle
through a separate **private** repository, and the key lives only on the laptop and in the cloud environment settings.

| Script | Where | What |
|---|---|---|
| `start-cloud.sh` | cloud | installs Node 22, PostgreSQL, cloudflared; builds; waits for the hand-off; restores; starts web + tunnel |
| `watchdog.sh` | cloud | restarts web/tunnel when they die; hourly encrypted backup to branch `cloud-backup` |
| `handoff-laptop.ps1` | laptop | stops the laptop web + connector, dumps and encrypts everything, pushes branch `handoff` |
| `handback-cloud.sh` | cloud | stops cloud web + connector, pushes the final data to branch `handback` |
| `restore-laptop.ps1` | laptop | saves the laptop DB, restores the cloud data, starts web + connector on the laptop |

Only one place serves the shop at a time: two copies would split orders across two databases.

## One-time setup

1. GitHub: create an empty **private** repository, e.g. `bobbibao/model-universe-handoff`.
2. GitHub: create a fine-grained token with access to **only that repository**, permission *Contents: Read and write*.
3. Laptop: save the repository name once:
   `Set-Content $env:USERPROFILE\.model-universe-handoff-repo 'bobbibao/model-universe-handoff'`
   The bundle key is in `%USERPROFILE%\.model-universe-bundle-key` (created by the first run of `handoff-laptop.ps1`).
4. Claude cloud environment (Choose environment → new/edit environment):
   - network access that allows the open internet (apt, deb.nodesource.com, apt.postgresql.org, GitHub releases, and
     Cloudflare tunnel edges on port 7844);
   - environment variables `MU_HANDOFF_REPO` (`bobbibao/model-universe-handoff`), `MU_HANDOFF_TOKEN` (the token),
     `MU_BUNDLE_KEY` (the content of the key file).

## Hand-off (leaving the laptop)

1. Start a cloud session on `bobbibao/model-universe`, branch `main`, with the prompt below. Wait until it reports
   *Waiting for a laptop hand-off* (the laptop keeps serving while the cloud installs and builds).
2. On the laptop: `powershell -ExecutionPolicy Bypass -File scripts\cloud\handoff-laptop.ps1`
   The site is down from here until the cloud restores (about 2 minutes). Then the laptop can be shut down.

## Hand-back (back at the laptop)

1. In the cloud session: "hand back" (runs `bash scripts/cloud/handback-cloud.sh`).
2. On the laptop: `powershell -ExecutionPolicy Bypass -File scripts\cloud\restore-laptop.ps1`
   If the cloud session died instead, add `-FromBackup` to restore the last hourly backup (up to one hour of orders
   could be missing: check them in the PayOS and carrier dashboards).

## The prompt for the cloud session

```
You are the operator of the live shop modeluniverse.vn for the next 24 hours, running it from this session.

1. Check that MU_HANDOFF_REPO, MU_HANDOFF_TOKEN and MU_BUNDLE_KEY are set (never print their values). If one is
   missing, stop and tell me.
2. Run `bash scripts/cloud/start-cloud.sh` in the background and follow ~/mu/start.log. It installs and builds while my
   laptop still serves the site, then prints "Waiting for a laptop hand-off". Tell me when it reaches that line: I will
   then run the hand-off on my laptop. After it, the script restores the data and starts the web and the tunnel.
3. If a step fails, read the logs in ~/mu (start.log, build.log, restore.log, web.log, tunnel.log), fix the cause and
   re-run the script (it skips finished steps). You may fix scripts/cloud/*.sh, but never commit or print anything from
   ~/mu, apps/web-ecommerce/.env*, apps/web-ecommerce/uploads or ~/.cloudflared, and never push them to any repository
   except through the scripts' encrypted bundle.
4. When https://modeluniverse.vn/api/products/filters answers 200 from here, report it. Then keep this session alive:
   every 10 minutes check the public URL, `tail -3 ~/mu/watchdog.log` and that the web and cloudflared are running;
   restart them with ~/mu/run-web.sh / ~/mu/run-tunnel.sh if needed, and tell me only about problems.
5. Do not change the shop's code or data unless I ask. When I say "hand back", run
   `bash scripts/cloud/handback-cloud.sh` and confirm the `handback` push, so I can restore on the laptop.
```
