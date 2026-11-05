# Moving the live shop to another Windows machine (24/7 host)

modeluniverse.vn is one web process on port 6050, a PostgreSQL database, the `uploads` folder, env files and a
Cloudflare named tunnel (`model-universe`). These scripts move all of it from the current host to a new one. Only one
host may serve at a time: two would split orders across two databases.

| Script | Where | What |
|---|---|---|
| `export-host.ps1` | old host | stops the site there, packs DB + uploads + all env files + tunnel credentials into one AES-256 encrypted file |
| `setup-host.ps1 -Step check` | new host | lists what is missing (Git, Node 22, PostgreSQL 18, cloudflared, admin shell, key) |
| `setup-host.ps1 -Step build` | new host | `yarn install` + release build (the old host keeps serving meanwhile) |
| `setup-host.ps1 -Step restore -Bundle <file>` | new host | decrypts and restores everything; refuses while the old host still answers |
| `setup-host.ps1 -Step service` | new host | boot task "ModelUniverse Host" (as SYSTEM, no login needed) + no sleep / lid does nothing |
| `run-host.ps1` | new host | the supervisor the boot task runs: restarts the web or the tunnel when they die |

The encrypted file and its key never go into git (this repository is public). The key is
`%USERPROFILE%\.model-universe-bundle-key` on the old host; copy it **separately** from the bundle (e.g. type it, or a
different USB stick), into the same path on the new host.

## Order of operations

1. New host: install Claude Code, sign in, clone `git@github.com:bobbibao/model-universe.git` (or https), open it and
   give Claude the prompt below. It checks, installs what is missing (asks you for admin / passwords) and builds.
2. Old host, when the new one says it is built: `powershell -ExecutionPolicy Bypass -File scripts\host\export-host.ps1`
   The site goes down here; the file `Desktop\model-universe-host.enc` is written.
3. Copy that file and the key file to the new host; tell its Claude where the file is. It restores and starts the
   service. Downtime: from step 2 until the restore finishes (a few minutes).
4. Later deploys on the new host: commit/pull, `$env:MODEL_UNIVERSE_BUILD_SNAPSHOT='true'; yarn build:production`, then
   `yarn deploy:zero-downtime` (in an Administrator shell; the supervisor leaves the swap alone).

Moving back works the same way in the other direction (export on the new host, setup on the old one). After a move,
the old host must not start the site again: nothing starts it automatically there.

## Prompt for Claude Code on the new host

```
This machine becomes the 24/7 host of the live shop modeluniverse.vn (repository bobbibao/model-universe, Windows).
Follow scripts/host/README.md. Work carefully: it is a live shop with real customers and payments.

1. Make sure the repository is cloned and on the latest main (git pull).
2. Run `powershell -ExecutionPolicy Bypass -File scripts\host\setup-host.ps1 -Step check`. Install what is missing
   (winget hints are printed). When something needs an Administrator shell, a UAC prompt or a password — in particular
   the PostgreSQL superuser "postgres" password, which must equal DB_PASSWORD of the old host — stop and ask me; never
   invent or print secrets. Re-run the check until all lines say ok (the bundle key file I will copy in myself).
3. Run `-Step build`. If it fails, read the output, fix the cause (not the shop's code) and retry. Tell me when the
   release is built: I will then run export-host.ps1 on the old laptop and copy the bundle here.
4. When I give you the bundle path, run `-Step restore -Bundle "<path>"`, then (Administrator) `-Step service`.
   Report: the product count it restored, and that https://modeluniverse.vn/api/products/filters answers 200.
5. Afterwards check D:\ModelUniverseRuntime\host\host.log (or C:\ if there is no D: drive), the latest web-*.log and
   cloudflared.log, and confirm the scheduled task "ModelUniverse Host" is Running. Explain to me how to see the
   status later, and remind me to set Windows Update active hours so it does not reboot at a bad time.

Never commit, upload or print the bundle, the key, .env files, uploads or ~/.cloudflared. Do not change the shop's
code or data unless I ask.
```
