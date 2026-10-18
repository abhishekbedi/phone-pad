# Uninstalling PhonePad

This guide removes PhonePad completely — both the **server** on your computer
(macOS / Linux / Windows) and the **phone app** (the PWA) on iOS / Android.

> **Why does my phone auto-connect?** Two things work together:
>
> 1. On macOS, if you ran `npm run service:install`, the server is registered as a
>    **launchd background service** (`nz.tentronix.phonepad`) with
>    `RunAtLoad` and `KeepAlive` enabled — so it starts at login and restarts
>    itself automatically.
> 2. The phone PWA remembers the last server IP in its browser `localStorage`
>    (key `phonepad_server_ip`) and silently reconnects every ~2 seconds whenever
>    both devices are on the same WiFi.
>
> To fully stop the auto-connect you must remove **both** sides. Follow the
> relevant computer section **and** the phone section below.

---

## Part 1 — Remove the server

### macOS

**1. Stop and remove the background service (if you installed it).**

If you set up the launchd service with `npm run service:install`, remove it:

```bash
npm run service:uninstall
```

This unloads the launchd agent and deletes
`~/Library/LaunchAgents/nz.tentronix.phonepad.plist`.

If `npm run` isn't available (e.g. you deleted the project), do it manually:

```bash
launchctl bootout gui/$(id -u)/nz.tentronix.phonepad 2>/dev/null
rm -f ~/Library/LaunchAgents/nz.tentronix.phonepad.plist
```

**1b. Find and remove ANY stale/old-label service (important).**

Earlier versions of this project used different launchd labels (e.g.
`com.abhishekbedi.tracklink`, `com.abhishekbedi.mobile_trackpad`). Because the
service has `KeepAlive`, a leftover job will **silently respawn the server every
time you kill it** — so you must find and remove it by its *actual* label, not
just the current one.

```bash
# 1) List every LaunchAgent plist that points at this project:
grep -rl "server/index.js" ~/Library/LaunchAgents/ 2>/dev/null

# 2) List any loaded launchd job that looks related (adjust the pattern):
launchctl list | grep -iE "trackpad|tracklink|phonepad|mobile_trackpad"

# 3) For EACH label found above, boot it out and delete its plist:
launchctl bootout gui/$(id -u)/<LABEL> 2>/dev/null
rm -f ~/Library/LaunchAgents/<LABEL>.plist
```

Replace `<LABEL>` with each label you found (the plist filename matches the
label, e.g. `com.abhishekbedi.mobile_trackpad.plist`).

**Symptom check:** if `lsof -ti:8888 | xargs kill -9` frees the port but a new
`node` process (parent PID 1 / launchd) immediately reclaims it, a KeepAlive
launchd job is still installed — repeat steps 1–3 above until none remain.

**2. Confirm nothing is listening on port 8888.**

```bash
launchctl list | grep -iE "trackpad|tracklink|phonepad"   # should print nothing
lsof -ti:8888 | xargs kill -9 2>/dev/null                 # kill any stray foreground server
lsof -i :8888                                             # should print nothing
ps aux | grep "[s]erver/index.js"                         # should print nothing
```

**3. Delete the project folder.**

```bash
rm -rf /path/to/tracklink
```

**4. (Optional) Revoke the Accessibility permission.**

System Settings → Privacy & Security → **Accessibility** → select the entry you
added (your terminal app or the `node` binary) → click **–** to remove it.

**5. (Optional) Remove the fallback tool** if you installed it just for PhonePad:

```bash
brew uninstall cliclick
```

---

### Linux

PhonePad on Linux has **no background-service installer** by default, so there's
usually nothing registered system-wide to remove.

**1. Stop the server.** If it's running in a terminal, press `Ctrl+C`. Otherwise:

```bash
pkill -f "server/index.js"        # stop the node process
# or free the port directly:
fuser -k 8888/tcp 2>/dev/null
```

**2. If you created your own service, remove it.** For example, a user systemd
unit you added manually:

```bash
systemctl --user stop tracklink.service
systemctl --user disable tracklink.service
rm -f ~/.config/systemd/user/tracklink.service
systemctl --user daemon-reload
```

**3. Delete the project folder.**

```bash
rm -rf /path/to/tracklink
```

**4. (Optional) Remove `xdotool`** if you installed it only for PhonePad:

```bash
sudo apt remove xdotool      # Debian/Ubuntu
sudo pacman -R xdotool       # Arch
sudo dnf remove xdotool      # Fedora
```

---

### Windows

PhonePad on Windows has **no bundled service installer**, so there's usually
nothing registered to remove unless you set one up yourself.

**1. Stop the server.** If it's running in a PowerShell window, press `Ctrl+C`.
Otherwise free port 8888:

```powershell
# Find the process using port 8888
Get-NetTCPConnection -LocalPort 8888 | Select-Object OwningProcess
# Stop it (replace <PID> with the value above)
Stop-Process -Id <PID> -Force
```

**2. If you created a service/scheduled task, remove it.**

- **NSSM:** `nssm remove PhonePad confirm`
- **Task Scheduler:** open Task Scheduler → find your PhonePad task → **Delete**.

**3. Delete the project folder.**

```powershell
Remove-Item -Recurse -Force C:\path\to\tracklink
```

**4. (Optional) Remove the optional dependency** if you installed it globally:

```powershell
npm uninstall -g @jitsi/robotjs
```

---

## Part 2 — Remove the phone app (PWA)

The phone "app" is a **Progressive Web App** — a website installed to your home
screen, not an App Store / Play Store download. Removing it has two parts:
deleting the home-screen app **and** clearing the saved server IP so it stops
auto-reconnecting.

### First: disconnect inside the app (clears the saved server IP)

Before deleting, open PhonePad on your phone and use its **Disconnect** action
(in the connection panel / settings). This removes the stored `phonepad_server_ip`
value so the app won't silently reconnect. If you can't open the app, the steps
below (clearing site data / uninstalling) also remove this.

### iOS (Safari)

1. On the Home Screen, **touch and hold** the PhonePad icon.
2. Tap **Remove App** → **Delete App** (or **Delete from Home Screen**).
3. Clear any cached site data: **Settings → Safari → Advanced → Website Data**,
   search for the server IP/host, swipe to delete it (or **Remove All Website
   Data** to clear everything).

### Android (Chrome)

1. **Touch and hold** the PhonePad icon → **Uninstall** / **Remove**, or go to
   **Settings → Apps → PhonePad → Uninstall**.
2. Clear Chrome's saved data for the site: **Chrome → ⋮ → Settings → Privacy and
   security → Clear browsing data**, or **Site settings → All sites**, find the
   server IP/host, and **Delete** its data.

### Any browser (if you only opened it as a tab, never installed)

Clear the site's data so the saved IP is forgotten:

- **Chrome/Edge:** `⋮` → Settings → Privacy → **Clear browsing data** (or Site
  settings → the PhonePad host → **Clear data**).
- **Safari:** Settings → Safari → **Clear History and Website Data**.

---

## Verify it's fully gone

- **Computer:** nothing listening on port 8888.
  - macOS/Linux: `lsof -i:8888` prints nothing
    (`launchctl list | grep -iE "phonepad|tracklink|trackpad"` is empty on macOS).
  - Windows: `Get-NetTCPConnection -LocalPort 8888` returns nothing.
- **Phone:** the PhonePad icon is gone from the home screen, and reopening the
  server URL in the browser shows the **connect prompt** again (no silent
  auto-connect), confirming the saved IP was cleared.
