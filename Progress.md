# Progress

A running changelog of milestones for TrackLink. Newest entries first.

## 2026-10-18 16:24 — GitHub issue/PR templates + CI workflow

- What changed:
  - Added `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, and
    `config.yml` (issue chooser with Discussions + Troubleshooting links).
  - Added `.github/PULL_REQUEST_TEMPLATE.md` (summary, test checklist incl.
    `npm test` / `npm run build`, type-of-change, style checklist).
  - Added `.github/workflows/ci.yml`:
    - `test-linux`: `npm ci --ignore-scripts` + `npm test` on Node 18/20/22.
      (Native addon not needed on Linux — server falls back — so scripts skipped.)
    - `build-macos`: full `npm ci` + `npm run build` + artifact check + `npm test`.
    - Concurrency cancel-in-progress to save CI minutes.
  - **Fixed a CI blocker:** `package-lock.json` still carried the old name
    `remote-trackpad`, which would make `npm ci` fail against
    `@tentronix/phonepad`. Regenerated the lockfile (`npm install
    --package-lock-only --ignore-scripts`); top-level and `packages[""]` names
    now both `@tentronix/phonepad`.
  - Updated `docs/CONTRIBUTING.md` Testing section (was "no automated test suite
    yet") to document `npm test`, `npm run build`, and the CI workflow.
  - Replaced the README static "tested e2e" badge with a live GitHub Actions CI
    badge (points at the existing `abhishekbedi/tracklink` repo path, per the
    keep-URLs instruction).
- Verification (local simulation of CI):
  - Linux job: `npm ci --ignore-scripts` OK → `npm test` 17/17 PASS.
  - macOS step: `npm run build` OK → `build/Release/mac_input.node` present.
  - YAML lint OK for `ci.yml` and `config.yml`; node_modules intact; port freed.
- Files touched: `.github/ISSUE_TEMPLATE/{bug_report.md,feature_request.md,config.yml}`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/ci.yml`,
  `package-lock.json` (name sync), `docs/CONTRIBUTING.md`, `README.md`,
  `Progress.md`.

## 2026-10-18 16:23 — Upgraded Code of Conduct to Contributor Covenant 3.0

- What changed: replaced `CODE_OF_CONDUCT.md` (was Contributor Covenant v1.4)
  with the **Contributor Covenant 3.0** text. Filled the template's placeholder
  NOTES so the file is publish-ready:
  - Reporting: concrete method — email `conduct@tentronix.nz` (placeholder;
    update to the real address), plus reporting privately to any Community
    Moderator.
  - Addressing and Repairing Harm: removed the `[NOTE: ...]` editorial line, kept
    the full 4-rung enforcement ladder intact.
  - Attribution preserved (Contributor Covenant 3.0, CC BY-SA 4.0).
- Effect: README and `docs/CONTRIBUTING.md` Code-of-Conduct links still resolve.
- Files touched: `CODE_OF_CONDUCT.md`, `Progress.md`.

## 2026-10-18 14:41 — Added Code of Conduct (resolves dangling links)

- What changed: created root `CODE_OF_CONDUCT.md` from the Contributor Covenant
  v1.4 text, with the enforcement contact set to `conduct@tentronix.nz`
  (placeholder — update to the real address).
- Effect: the previously-dangling `CODE_OF_CONDUCT.md` links in `README.md` and
  `docs/CONTRIBUTING.md` now resolve. The only non-resolving reference left is the
  `docs/assets/demo.gif` placeholder, which lives inside an HTML comment (not a
  live link).
- Verification: internal link scan across README + docs shows no live broken
  links; port 8888 free; `npm test` → 17/17 pass.
- Files touched: `CODE_OF_CONDUCT.md` (new), `Progress.md`.

## 2026-10-18 11:21 — E2E tests, publish-readiness lifecycle check, README polish

- What changed:
  - Added `tests/e2e-server.sh` — a curl-based end-to-end smoke test (17
    assertions): starts the server, asserts `/api/server/info`, `/api/sessions`,
    `/api/gestures`, `/api/gestures/actions`, static `/`, `/manifest.json`,
    `/config`, PhonePad branding, and a 404 for unknown paths; then stops the
    server and confirms port 8888 is freed. No GUI/permissions needed → CI-safe.
  - Wired `npm test` → `bash tests/e2e-server.sh`; documented in `tests/README.md`.
  - Polished `README.md` for open source: new tagline ("Your phone is now a
    trackpad"), TL;DR, a demo-GIF placeholder (HTML comment), a `tested e2e`
    badge, a Troubleshooting nav link, a Testing section, a stronger Contributing
    call-to-action (bug/idea/build/star), and company attribution (Tentronix NZ).
- Verification (publish readiness):
  - `npm test` → **All 17 checks passed**, exit 0, port 8888 freed.
  - `npm run build` → `gyp info ok`, `build/Release/mac_input.node` produced.
  - Full launchd lifecycle with the new id: `service:install` → `service:status`
    showed `nz.tentronix.phonepad` running (PID, exit 0) + API responded →
    `service:uninstall` → final state clean (no service loaded, port free, plist
    removed, no node process). Mac left clean.
- Known/intentional: README still links `CODE_OF_CONDUCT.md` (file creation
  skipped by request) and a `docs/assets/demo.gif` placeholder inside an HTML
  comment (not a live link). Attribution kept as "Abhishek Bedi" + Tentronix NZ.
- Files touched: `tests/e2e-server.sh` (new), `tests/README.md`, `package.json`
  (test script), `README.md`, `Progress.md`.

## 2026-10-18 11:09 — Removed running server + full footprint rebrand to PhonePad (Tentronix NZ)

- Part A — removed the running server on this Mac:
  - Found a **stale KeepAlive launchd service** from an earlier version
    (`com.abhishekbedi.mobile_trackpad`, plist in `~/Library/LaunchAgents`) that
    was respawning `server/index.js` on port 8888 each time it was killed.
  - `launchctl bootout` the job + removed the plist (backed up to `/tmp`). Port
    8888 is now free; no launchd job, no node process.
  - Hardened `docs/UNINSTALL.md`: added robust discovery of ANY stale/old-label
    service (`grep -rl "server/index.js" ~/Library/LaunchAgents`, bootout each
    label) and documented the "server respawns after kill = KeepAlive job" symptom.
- Part B — option 2 footprint rebrand (display name was already PhonePad):
  - **Service id** `com.tracklink.server` → **`nz.tentronix.phonepad`** (reverse-DNS
    for Tentronix NZ): plist renamed (`git mv`) + `<Label>`/comment, `package.json`
    scripts, `server/index.js` self-shutdown bootout, `scripts/install-service.mjs`.
  - **npm package** `tracklink` → **`@tentronix/phonepad`**; description mentions
    PhonePad. (`service:status` now `grep phonepad`.)
  - **WebSocket handshake** `server: 'tracklink'` → `server: 'phonepad'`.
  - **Service-worker cache** `mobile-trackpad-v1` → `phonepad-v1` (forces fresh
    rebranded assets on existing PWAs).
  - **localStorage keys** `trackpad_*` → `phonepad_*` with a **one-time migration**
    (`migrateLegacyStorage()`) so existing users keep their saved IP/sensitivity/
    scroll settings; all 6 usages routed through a `STORE` constant.
  - **Docs**: swept README + all `docs/` + `tests/README.md` — "TrackLink" →
    "PhonePad", service-id and `trackpad_server_ip` references updated, all
    current-service `grep` patterns switched to `phonepad`.
- Intentionally left unchanged per instruction: **GitHub URLs** and **repo name**
  (`github.com/abhishekbedi/tracklink`, `cd tracklink`, `tracklink/` tree root),
  and **attribution** ("Abhishek Bedi"). The English word "trackpad" (the device
  concept) was left in prose where appropriate.
- Files touched: `nz.tentronix.phonepad.plist` (renamed), `package.json`,
  `server/index.js`, `scripts/install-service.mjs`, `client/sw.js`,
  `client/index.html`, `README.md`, all `docs/*.md`, `tests/README.md`,
  `Progress.md`.
- Verification: see the 11:09 verification run — `node --check`, JSON valid,
  `plutil -lint`, banner width 42, live start smoke test, and greps confirming no
  stray old identifiers outside allowed URLs/attribution/repo-name.

## 2026-10-18 10:58 — Rebrand display name to "PhonePad" (Tentronix NZ), user-facing only

- What changed: renamed only the **user-facing display name** from "TrackLink" to
  **PhonePad** (company: Tentronix NZ). Scope deliberately limited to display
  strings — identifiers, service id, URLs, and docs were intentionally NOT
  touched (option 1).
  - `client/manifest.json` — PWA `name` + `short_name` → PhonePad
  - `client/index.html` — `<title>` → PhonePad
  - `client/config.html` — `<title>`, `<h1>`, footer version label → PhonePad
    (GitHub URL left unchanged)
  - `server/index.js` — startup banner → "PhonePad Server" (re-centered to keep
    the 42-char box aligned)
- Intentionally left as-is (still "tracklink"/"TrackLink"): service id
  `com.tracklink.server` + plist, npm package name `tracklink`, WebSocket
  handshake field `server: 'tracklink'`, service-worker `CACHE_NAME`
  (`mobile-trackpad-v1`), localStorage keys (`trackpad_*`), GitHub URLs,
  attribution ("Abhishek Bedi"), and all documentation.
- Files touched: `client/manifest.json`, `client/index.html`,
  `client/config.html`, `server/index.js`, `Progress.md`.
- Verification: banner inner width still exactly 42 chars; `node --check
  server/index.js` OK; `manifest.json` valid JSON; `grep` confirms internal
  identifiers (`server: 'tracklink'`, package `name`, `com.tracklink.server`)
  unchanged.
- Note: because the service worker `CACHE_NAME` was not bumped, returning PWA
  users may need to refresh / reinstall to see the new "PhonePad" name (the old
  bundle is cached). Bumping `CACHE_NAME` would be part of option 2.
- Next: if desired, proceed to option 2 (full footprint: `nz.tentronix.phonepad`
  service id, `@tentronix/phonepad` npm, cache/localStorage keys, docs) — note
  the service-id and localStorage repercussions documented in chat.

## 2026-10-18 10:51 — Renamed launchd service id (removed personal id from system code)

- What changed: renamed the macOS launchd service identity from
  `com.abhishekbedi.tracklink` to the neutral **`com.tracklink.server`** across
  all system/service code. `<username>` could not be used as the literal id —
  `<`/`>` are illegal in a launchd Label and in a filename — so a valid neutral
  id was chosen.
  - Renamed `com.abhishekbedi.tracklink.plist` → `com.tracklink.server.plist`
    (`git mv`, history preserved) and updated its `<Label>`.
  - Updated `package.json` service scripts (`start`, `dev`, `service:*`),
    `server/index.js` (self-shutdown `launchctl bootout`), and
    `scripts/install-service.mjs` (template/target plist filename + comment).
  - Updated doc references to the label/filename in `README.md`, `docs/SETUP.md`,
    `docs/UNINSTALL.md`, `docs/TROUBLESHOOTING.md`.
  - Left unchanged per scope: attribution text (`author`, LICENSE copyright,
    "Built by Abhishek Bedi"), all GitHub URLs (`github.com/abhishekbedi/...`),
    and git internals (`.git/`).
- Files touched: `com.tracklink.server.plist` (renamed), `package.json`,
  `server/index.js`, `scripts/install-service.mjs`, `README.md`,
  `docs/SETUP.md`, `docs/UNINSTALL.md`, `docs/TROUBLESHOOTING.md`, `Progress.md`.
- Verification: `grep -ri "com.abhishekbedi.tracklink"` returns no hits outside
  this changelog's historical entries. No service is currently installed on this
  machine (`launchctl list | grep tracklink` empty; no plist in
  `~/Library/LaunchAgents`), so no live migration was needed. Note: if a user has
  the OLD service installed, they must run `npm run service:uninstall` while on
  the old code (or `launchctl bootout gui/$(id -u)/com.abhishekbedi.tracklink` +
  delete the old plist), then `npm run service:install` to register the new id.
- Next: optionally add `CODE_OF_CONDUCT.md`.

## 2026-10-18 10:31 — Naming review + Troubleshooting guide

- What changed:
  - Reviewed all app/server naming for traceability. Confirmed every
    **user-facing** name is already "TrackLink": the PWA (`manifest.json` name /
    short_name), browser titles (`index.html`, `config.html`), the server banner
    (`TrackLink Server`), the logs (`logs/`), and the launchd label
    (`com.abhishekbedi.tracklink`). Remaining `tracklink`/`trackpad` strings are
    internal identifiers only (npm package name, `sw.js` CACHE_NAME, localStorage
    keys `trackpad_*`, WebSocket `server` field). Left those unchanged per the
    standing "do not change the code" instruction — renaming the localStorage
    keys in particular would orphan users' saved IP/settings. Documented the
    traceable names in the README.
  - Added `docs/TROUBLESHOOTING.md`: comprehensive CLI guide to verify the npm
    server, the background service, and the phone app (PWA) connection, with
    per-platform commands (macOS/Linux/Windows), expected outputs, a one-shot
    health check, and a decision checklist. Commands verified against the code:
    port 8888, API routes (`/api/server/info`, `/api/sessions`,
    `/api/gestures*`), service scripts in `package.json`, and launchd label.
  - Linked the guide from the README (new Troubleshooting section + Project
    Structure) and from `docs/SETUP.md`.
- Files touched: `README.md`, `docs/SETUP.md`, `docs/TROUBLESHOOTING.md` (new),
  `Progress.md`.
- Verification: `git diff` empty for `server/`, `native/`, `client/`,
  `gestures.json` (no code changed); internal doc links re-checked.
- Next: optionally add `CODE_OF_CONDUCT.md`; optionally apply internal
  `tracklink`/`trackpad` renames as a separate reviewed code change with a
  localStorage migration.

## 2026-10-18 10:20 — PWA clarification + Uninstall guide

- What changed:
  - Clarified in `README.md` that the "phone app" is a **PWA** served by the
    server (no App Store / Play Store download); linked to the new uninstall guide.
  - Added `docs/UNINSTALL.md` covering full removal of the **server** on
    macOS/Linux/Windows and the **phone PWA** on iOS/Android. Documents the
    auto-connect mechanism verified from code: macOS launchd service
    (`RunAtLoad` + `KeepAlive`) keeps the server running, and the client
    persists the server IP in `localStorage` (`trackpad_server_ip`) and
    reconnects every ~2s (`reconnectDelay: 2000`).
  - Added an "Uninstalling" pointer to `docs/SETUP.md` and listed `UNINSTALL.md`
    in the README Project Structure.
- Code confirmed (no changes): `client/manifest.json` (`display: standalone`) +
  `client/sw.js` (cache `mobile-trackpad-v1`) = PWA; `client/index.html`
  `init()`/`connect()`/`scheduleReconnect()` = auto-reconnect from saved IP;
  `com.abhishekbedi.tracklink.plist` = launchd auto-start.
- Files touched: `README.md`, `docs/SETUP.md`, `docs/UNINSTALL.md` (new),
  `Progress.md`.
- Verification: `git diff` empty for `server/`, `native/`, `client/`,
  `gestures.json`; internal links re-checked.
- Next: optionally add `CODE_OF_CONDUCT.md`; add an automated test runner.

## 2026-10-18 10:17 — Root README is the single source of truth

- What changed: removed `docs/README.md`; the root [`README.md`](README.md) is now
  the one canonical overview. Updated the Project Structure block in the root README
  to drop the `docs/README.md` entry.
- Files touched: `README.md`, `docs/README.md` (deleted), `Progress.md`.
- Verification: `docs/` now contains only QUICKSTART, SETUP, ARCHITECTURE,
  CONTRIBUTING. Re-ran the internal-link check — all links resolve except the
  three intentional `CODE_OF_CONDUCT.md` references (file creation skipped by
  request). No application source code changed.
- Next: optionally add `CODE_OF_CONDUCT.md`; add a real automated test runner.

## 2026-10-18 10:13 — Documentation overhaul & docs/ reorganization

- What changed:
  - Moved `ARCHITECTURE.md`, `SETUP.md`, and `CONTRIBUTING.md` into a new `docs/`
    folder (via `git mv`, preserving history). `README.md` stays at the root.
  - Updated `README.md` to match the actual code:
    - Gesture table corrected against `gestures.json` (e.g. 3-finger tap →
      middle click, 4-finger swipe up → Spotlight, 4-finger swipe down →
      Mission Control, 4-finger swipe right → Show Desktop).
    - Hot-corner defaults fixed (top-left & bottom-left = none, top-right =
      Mission Control, bottom-right = Show Desktop).
    - Clarified that 2-finger `pinch` and 4-finger `page_zoom` are sent as
      dedicated messages by the client.
    - All cross-reference links repointed to `docs/`; Project Structure updated.
  - Fixed links inside moved docs (`docs/SETUP.md` → `../README.md`,
    `docs/CONTRIBUTING.md` → `../CODE_OF_CONDUCT.md`).
  - Corrected technical inaccuracies in `docs/ARCHITECTURE.md`: the hot-corner
    detection is an edge-clamp (cursor pinned to the virtual-display bounds),
    not a 20px band; corner-state example aligned to the real default config.
  - Cleaned up `docs/CONTRIBUTING.md`: removed references to a non-existent
    `.editorconfig` and to issue templates that don't exist; described the code
    style inline.
  - Added scaffolding docs: `docs/README.md` (documentation index / overview)
    and `docs/QUICKSTART.md` (shortest path to a running trackpad).
  - Added `tests/README.md` with a manual verification checklist and suggested
    structure (no automated suite exists yet).
- Files touched: `README.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`,
  `docs/CONTRIBUTING.md`, `docs/README.md` (new), `docs/QUICKSTART.md` (new),
  `tests/README.md` (new), `Progress.md` (new).
- Verification: no application source code changed — `git diff` is empty for
  `server/`, `native/`, and `client/`. Docs were cross-checked against
  `server/index.js`, `server/gestures.js`, `server/platform/*.js`,
  `native/mac_input.mm`, `client/index.html`, and `gestures.json`.
- Next: optionally add `CODE_OF_CONDUCT.md` (currently referenced but not
  present — skipped by request), and introduce a real automated test runner.
