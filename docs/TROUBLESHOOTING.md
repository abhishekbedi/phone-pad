# Troubleshooting Guide

A step-by-step, command-driven guide to check whether each part of **PhonePad**
is running: the **npm server**, the **background service** (macOS launchd), and
the **phone app (PWA)** connection. Work top to bottom; each section tells you the
expected output and what to do if it's wrong.

PhonePad has three moving parts:

| Part | What it is | How it's named (for tracing) |
| ---- | ---------- | ---------------------------- |
| **Server** | The Node.js process (`server/index.js`) listening on **port 8888** | Startup banner: `PhonePad Server`; logs in `logs/server.log` |
| **Service** | The macOS launchd agent that auto-starts the server | Label: `nz.tentronix.phonepad` |
| **App (PWA)** | The phone client served at `http://<computer-ip>:8888` | Home-screen name: **PhonePad** |

> Throughout, the server runs on **port 8888**. Replace `<computer-ip>` with your
> computer's LAN IP (printed in the startup banner, e.g. `192.168.1.100`).

---

## 0. Quick health check (one-shot)

From the project directory, this confirms the server is up and responding:

```bash
# Is something listening on 8888?  (macOS/Linux)
lsof -i :8888

# Does the HTTP API answer?  (any OS with curl)
curl -s http://localhost:8888/api/server/info
```

Expected `server/info` response (JSON):

```json
{"ip":"192.168.1.100","port":8888,"url":"http://192.168.1.100:8888?ip=192.168.1.100","platform":"darwin"}
```

If you get JSON back, the server is running — skip to [section 3](#3-check-the-phone-app-pwa-connection).
If the connection is refused, continue below.

---

## 1. Check the npm server

### 1a. Is the process running?

**macOS / Linux:**
```bash
# Look for the node process running server/index.js
ps aux | grep "[s]erver/index.js"

# Or check the port directly
lsof -i :8888
lsof -ti :8888        # prints just the PID, empty if nothing is listening
```

**Windows (PowerShell):**
```powershell
# Find the process owning port 8888
Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess

# Map the PID to a process name
Get-Process -Id (Get-NetTCPConnection -LocalPort 8888).OwningProcess
```

**Expected:** one `node` process. **If empty:** the server isn't running — start it
(see 1c).

### 1b. Does the server answer HTTP?

```bash
# Server info (IP, port, platform)
curl -s http://localhost:8888/api/server/info

# Available actions and current gesture config
curl -s http://localhost:8888/api/gestures/actions
curl -s http://localhost:8888/api/gestures

# Active phone sessions (how many clients are connected)
curl -s http://localhost:8888/api/sessions
```

Expected `sessions` response:

```json
{"active":1,"max":3,"sessions":[{"id":"session_1_abc","addr":"::ffff:192.168.1.50","connectedAt":"..."}]}
```

**If curl fails but the process exists:** the process may be starting, crashed, or
bound to a different interface — check the logs (1d).

### 1c. Start the server manually

```bash
cd /path/to/tracklink
npm start            # frees port 8888, then starts the server
# or, with verbose logging:
npm run dev
```

Expected terminal output:

```
╔══════════════════════════════════════════╗
║             PhonePad Server             ║
╚══════════════════════════════════════════╝

  Local:   http://localhost:8888
  Network: http://192.168.1.100:8888
  Config:  http://localhost:8888/config
  Platform: darwin
  ...QR code...
```

### 1d. Read the logs

```bash
# If started via the launchd service (macOS), logs are files:
tail -n 50 logs/server.log
tail -n 50 logs/server-error.log
tail -f  logs/server.log          # live tail
npm run service:logs              # shortcut for tail -f logs/server.log
```

Look for: `✓ Gesture config loaded`, `✓ Native mac_input addon loaded` (macOS),
and `✓ Client connected` lines. Common warnings:

- `⚠ Native addon not available` (macOS) → falls back to `cliclick`; install with
  `brew install cliclick` or rebuild with `npm run build`.
- `✗ xdotool not found` (Linux) → `sudo apt install xdotool`.
- `❌ Port 8888 is already in use` → another instance is running (see 1e).

### 1e. "Port already in use" / kill a stray server

```bash
# macOS / Linux
lsof -ti :8888 | xargs kill -9 2>/dev/null

# Linux alternative
fuser -k 8888/tcp

# Windows (PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8888).OwningProcess -Force
```

---

## 2. Check the background service

> The launchd service exists **only on macOS**, and only if you ran
> `npm run service:install`. On **Linux/Windows** there is no bundled service — if
> you created your own (systemd / NSSM / Task Scheduler), check that instead
> (see 2c).

### 2a. macOS — is the service loaded and running?

```bash
# Is it registered? (prints a line if loaded, nothing if not)
launchctl list | grep phonepad
npm run service:status            # same thing, via npm

# Detailed state (exit code, PID) — macOS 10.11+
launchctl print gui/$(id -u)/nz.tentronix.phonepad 2>/dev/null | \
  grep -E "state|pid|program"
```

Interpreting `launchctl list | grep phonepad` output — three columns `PID  Status  Label`:

- **`12345  0  nz.tentronix.phonepad`** → running (has a PID, last exit 0). ✅
- **`-  0  nz.tentronix.phonepad`** → loaded but **not currently running**
  (idle or crashed cleanly).
- **`-  78  nz.tentronix.phonepad`** → loaded but **last run exited with
  error 78** — check `logs/server-error.log`.
- **(no output)** → the service isn't installed/loaded. Install with
  `npm run service:install`.

### 2b. macOS — control the service

```bash
npm run service:install     # install + load (auto-fills node path & project dir)
npm run service:start       # bootstrap (load) the agent
npm run service:restart     # kickstart -k (restart now)
npm run service:stop        # bootout (unload)
npm run service:uninstall   # unload + delete the plist
npm run service:status      # launchctl list | grep phonepad
npm run service:logs        # tail -f logs/server.log
```

Verify the plist is installed:

```bash
ls -l ~/Library/LaunchAgents/nz.tentronix.phonepad.plist
cat   ~/Library/LaunchAgents/nz.tentronix.phonepad.plist   # check paths are real, not __PLACEHOLDERS__
```

If the plist still contains `__NODE_PATH__` / `__PROJECT_DIR__` placeholders, the
install script didn't run — re-run `npm run service:install`.

### 2c. Linux / Windows — self-created services

**Linux (systemd --user), if you made one:**
```bash
systemctl --user status  tracklink.service
systemctl --user restart tracklink.service
journalctl --user -u tracklink.service -n 50 --no-pager
```

**Windows (NSSM or Task Scheduler), if you made one:**
```powershell
# NSSM
nssm status PhonePad

# Windows service query (if registered as a service)
Get-Service -Name PhonePad -ErrorAction SilentlyContinue

# Scheduled task
Get-ScheduledTask -TaskName "PhonePad" | Get-ScheduledTaskInfo
```

---

## 3. Check the phone app (PWA) connection

The "app" is a **PWA** — the page served at `http://<computer-ip>:8888`. Checking
it has two sides: the **server's view** of connections, and the **phone's view**.

### 3a. Server side — is the phone connected?

```bash
curl -s http://localhost:8888/api/sessions
```

- `"active": 0` → no phone connected. Check WiFi and the app (3b).
- `"active": 1..3` → connected. `max` is 3 simultaneous clients.

You can also watch connections live in the log:

```bash
tail -f logs/server.log | grep -E "connected|disconnected"
```

Expected lines: `✓ Client connected: ::ffff:192.168.1.50 [session_1_...]`.

### 3b. Phone side — can it reach the server?

1. Confirm the phone and computer are on the **same WiFi network / subnet**.
2. From the phone's browser, open `http://<computer-ip>:8888` directly.
   - If the trackpad page loads → networking is fine; the issue is the app state.
   - If it times out → firewall or wrong IP (see 3c).
3. The app auto-reconnects to the **last server IP** saved in its `localStorage`
   (`phonepad_server_ip`) every ~2 seconds. The status dot shows
   **Connected** / **Reconnecting…** / **Disconnected**.

### 3c. Network reachability tests

**From the phone or another computer on the same WiFi:**
```bash
# Can you reach the host at all?
ping <computer-ip>

# Is the port open? (from a computer)
nc -vz <computer-ip> 8888          # macOS/Linux
Test-NetConnection <computer-ip> -Port 8888   # Windows PowerShell
```

**Check the firewall on the server machine:**
```bash
# macOS — is the app firewall on?
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Linux — ufw status
sudo ufw status
sudo ufw allow 8888/tcp            # if blocked

# Windows — add an inbound rule for 8888
New-NetFirewallRule -DisplayName "PhonePad 8888" -Direction Inbound `
  -LocalPort 8888 -Protocol TCP -Action Allow
```

### 3d. Reset the phone app connection

- In the app, use **Disconnect** — this clears the saved IP
  (`phonepad_server_ip`) and shows the connect prompt again.
- Re-scan the QR code from the terminal or from `http://localhost:8888/config`.
- If the app is stale after a server update, remove and reinstall the PWA (it
  caches via a service worker). Full steps: [UNINSTALL.md](UNINSTALL.md).

---

## 4. Platform-specific gesture issues

**Cursor doesn't move (macOS):** grant Accessibility permission
(System Settings → Privacy & Security → Accessibility) to your terminal or the
`node` binary, then restart the server. Verify node's path:

```bash
which node
```

**Cursor doesn't move (Linux):** confirm `xdotool` and an X11 session.

```bash
which xdotool
echo "$XDG_SESSION_TYPE"           # should print 'x11', not 'wayland'
```

**Gestures don't respond (Windows):** try running PowerShell **as Administrator**;
optionally install `@jitsi/robotjs` for smoother input:

```powershell
npm install @jitsi/robotjs
```

---

## 5. Decision checklist

Run these in order; the first failure points to the problem area:

```bash
# 1) Server listening?
lsof -i :8888 || echo "SERVER DOWN -> section 1"

# 2) HTTP answering?
curl -sf http://localhost:8888/api/server/info >/dev/null \
  && echo "HTTP OK" || echo "HTTP FAIL -> section 1b/1d"

# 3) macOS service loaded?
launchctl list | grep -q phonepad \
  && echo "SERVICE LOADED" || echo "SERVICE NOT LOADED -> section 2"

# 4) Any phone connected?
curl -s http://localhost:8888/api/sessions | grep -q '"active":0' \
  && echo "NO PHONE -> section 3" || echo "PHONE CONNECTED"
```

Still stuck? Capture context for a bug report:

```bash
node --version
uname -a                           # macOS/Linux  (Windows: $PSVersionTable)
tail -n 100 logs/server-error.log
```

See also: [SETUP.md](SETUP.md) · [UNINSTALL.md](UNINSTALL.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md) · root [README](../README.md).
