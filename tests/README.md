# Tests

## End-to-end server test

`tests/e2e-server.sh` is a self-contained, CI-friendly smoke test. It:

1. Checks port **8888** is free and that `node` + `curl` are available.
2. Starts the server (`node server/index.js`) and waits for the HTTP API.
3. Asserts the REST API responses:
   - `GET /api/server/info` → `port`, `platform`, `url`
   - `GET /api/sessions` → `active`, `max`
   - `GET /api/gestures/actions` → includes `click_left`, `mission_control`
   - `GET /api/gestures` → includes `tap_1`
4. Asserts the static assets: `GET /`, `/manifest.json`, `/config` return 200,
   the page is branded **PhonePad**, and an unknown path returns **404**.
5. Stops the server and confirms port 8888 is released.

It requires **no GUI input or accessibility permissions** — it only exercises the
HTTP/static surface, so it runs cleanly on macOS, Linux, and CI.

### Run it

```bash
npm test
# or directly:
bash tests/e2e-server.sh
```

Exit code is `0` when all checks pass, `1` on a failed assertion, and `2` on a
precondition error (missing `curl`/`node`, or port 8888 already in use). If it
reports the port is in use, stop any running server first — see
[docs/UNINSTALL.md](../docs/UNINSTALL.md).

Example output:

```
PhonePad end-to-end server test
===============================
  ✓ server started and is answering on :8888

API endpoints:
  ✓ /api/server/info returns port 8888
  ...
All 15 checks passed.
```

## Manual verification checklist

The e2e test covers the server/API. Input simulation (cursor moves, clicks,
gestures) needs a real phone + OS permissions, so verify those by hand before a
release:

- [ ] A phone can connect via the QR code / network URL.
- [ ] Cursor movement, taps (1–4 finger), scroll, and drag all work.
- [ ] Swipe gestures trigger the expected system actions on your OS.
- [ ] Hot corners fire after dwelling in a corner (macOS).
- [ ] Editing `gestures.json` hot-reloads without a server restart.
- [ ] The Config UI (`http://localhost:8888/config`) loads and can remap a gesture.

State which platform(s) you verified on in your pull request.

## Suggested structure

```
tests/
├── README.md          # this file
├── e2e-server.sh      # end-to-end HTTP/API smoke test (npm test)
├── unit/              # (future) pure logic, e.g. gesture config resolution
└── integration/       # (future) server + WebSocket message handling
```

Keep tests fast and deterministic. Prefer exercising the gesture-config and
message-routing logic directly over anything that needs real OS input.
