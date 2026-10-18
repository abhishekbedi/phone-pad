# Quickstart

The shortest path from zero to using your phone as a trackpad. For the full,
platform-by-platform guide (permissions, background service, building from source,
troubleshooting), see [SETUP.md](SETUP.md).

## Prerequisites

- [Node.js 18+](https://nodejs.org) — check with `node --version`.
- Your **phone and computer on the same WiFi network**.
- Platform-specific tools:
  - **macOS** — Xcode Command Line Tools (`xcode-select --install`) to build the
    native addon. Optional fallback: `brew install cliclick`.
  - **Linux** — `xdotool` (X11): `sudo apt install xdotool` (or your distro's
    equivalent).
  - **Windows** — nothing extra; PowerShell is used out of the box.

## 1. Clone and install

```bash
git clone https://github.com/abhishekbedi/tracklink.git
cd tracklink
npm install
```

On macOS, `npm install` also compiles the native addon. If it fails, PhonePad
falls back to `cliclick` — the server still runs.

## 2. Start the server

```bash
npm start
```

Expected output (abridged):

```
╔══════════════════════════════════════════╗
║             PhonePad Server             ║
╚══════════════════════════════════════════╝

  Local:   http://localhost:8888
  Network: http://192.168.1.100:8888
  Config:  http://localhost:8888/config
  Platform: darwin

  Scan to connect:
  █▀▀▀▀▀█ ... (QR code)
  URL: http://192.168.1.100:8888?ip=192.168.1.100
```

> **macOS only:** the first time you run it, grant **Accessibility** permission
> (System Settings → Privacy & Security → Accessibility) to your terminal or the
> `node` binary, then restart the server. Without it, the cursor won't move.

## 3. Connect your phone

Do any one of these:

- **Scan the QR code** in the terminal with your phone's camera.
- Open the **Network URL** (e.g. `http://192.168.1.100:8888`) in your phone's browser.
- Open `http://localhost:8888/config` on your computer and scan the QR code shown there.

## 4. (Optional) Install as an app

For a full-screen experience:

- **iOS (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** Menu (⋮) → **Install app**

## 5. Try it

Touch the dark surface and move your finger — the cursor moves. Then:

- **1-finger tap** → left click
- **2-finger tap** → right click
- **2-finger drag** → scroll
- **3-finger swipe up** → Mission Control (macOS)
- **4-finger tap** → Launchpad (macOS)

Remap anything from the in-app **⚙️ Settings** or the Config UI
(`http://localhost:8888/config`). The full default gesture table lives in the root
[README](../README.md#-gestures).

## Something not working?

- **Phone can't connect** — confirm both devices share the same WiFi and port `8888`
  isn't firewalled.
- **Cursor won't move (macOS)** — grant Accessibility permission, then restart.
- **Cursor won't move (Linux)** — confirm `xdotool` is installed and you're on an
  X11 (not Wayland) session.

See [SETUP.md](SETUP.md#troubleshooting) for the full troubleshooting list.
