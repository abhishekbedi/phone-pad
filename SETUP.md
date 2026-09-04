# TrackLink — Setup Guide

This guide walks you through installing and running **TrackLink** on **macOS**,
**Windows**, or **Linux**, from zero to using your phone as a trackpad. Pick your
operating system below and follow the steps in order.

> **The golden rule:** your phone and your computer must be on the **same WiFi
> network**. That's how they talk to each other — no cloud, no accounts, no internet.

---

## Table of Contents

- [What you'll end up with](#what-youll-end-up-with)
- [Step 0 — Install Node.js (all platforms)](#step-0--install-nodejs-all-platforms)
- [macOS setup](#macos-setup)
- [Windows setup](#windows-setup)
- [Linux setup](#linux-setup)
- [Connecting your phone](#connecting-your-phone)
- [Installing the phone app (PWA)](#installing-the-phone-app-pwa)
- [Running it automatically in the background](#running-it-automatically-in-the-background)
- [Building the native macOS addon from source](#building-the-native-macos-addon-from-source)
- [Troubleshooting](#troubleshooting)

---

## What you'll end up with

1. A small **server** running on your computer (Node.js).
2. A **web app** you open on your phone — it installs like a native app (PWA).
3. Your phone becomes a full multi-touch trackpad: move the cursor, tap, scroll,
   pinch-zoom, and use 3/4-finger swipe gestures.

---

## Step 0 — Install Node.js (all platforms)

TrackLink needs **Node.js 18 or newer**. Check whether you already have it:

```bash
node --version
```

If you see `v18.x` or higher, skip to your platform section. Otherwise install it:

- **All platforms:** download the LTS installer from [nodejs.org](https://nodejs.org).
- **macOS (Homebrew):** `brew install node`
- **Windows (winget):** `winget install OpenJS.NodeJS.LTS`
- **Linux (Debian/Ubuntu):** `sudo apt install nodejs npm` (or use [nvm](https://github.com/nvm-sh/nvm) for a newer version)

---

## macOS setup

### 1. Install the build tools

The macOS version uses a small native addon (written in Objective-C++) for
smooth, low-latency cursor control. Building it needs Apple's command line tools:

```bash
xcode-select --install
```

(If they're already installed, macOS will tell you — that's fine.)

### 2. Clone and install

```bash
git clone https://github.com/abhishekbedi/tracklink.git
cd tracklink
npm install
```

`npm install` automatically compiles the native addon. If the build fails for any
reason, TrackLink falls back to `cliclick` — install it with `brew install cliclick`.

### 3. Grant Accessibility permission

macOS requires explicit permission to move the cursor and activate windows:

1. Open **System Settings → Privacy & Security → Accessibility**.
2. Click **+**, and add your terminal app (Terminal, iTerm2, …) **or** the `node`
   binary. Find node's path with:
   ```bash
   which node
   ```
3. Toggle it **on**.

### 4. Start the server

```bash
npm start
```

Then jump to [Connecting your phone](#connecting-your-phone).

---

## Windows setup

### 1. Clone and install

Open **PowerShell** and run:

```powershell
git clone https://github.com/abhishekbedi/tracklink.git
cd tracklink
npm install
```

On Windows there is **no native build step** — input is simulated using built-in
PowerShell APIs out of the box.

### 2. (Optional) Install robotjs for smoother input

For lower-latency, smoother cursor movement:

```powershell
npm install @jitsi/robotjs
```

If it isn't installed, TrackLink automatically uses the PowerShell fallback.

### 3. Start the server

```powershell
npm start
```

> **Note:** some gestures (like certain key combinations) may require running
> PowerShell **as Administrator**. Right-click PowerShell → *Run as administrator*
> if a gesture doesn't respond.

Then jump to [Connecting your phone](#connecting-your-phone).

---

## Linux setup

The Linux version uses **`xdotool`** for all input simulation (X11).

### 1. Install xdotool

```bash
# Debian / Ubuntu
sudo apt install xdotool

# Arch
sudo pacman -S xdotool

# Fedora
sudo dnf install xdotool
```

### 2. Clone and install

```bash
git clone https://github.com/abhishekbedi/tracklink.git
cd tracklink
npm install
```

There is no native build step on Linux.

### 3. Start the server

```bash
npm start
```

> **Wayland note:** `xdotool` targets **X11**. If you're on a Wayland session and
> input doesn't work, log in using an "Xorg"/"X11" session from your login screen.

Then continue below.

---

## Connecting your phone

When the server starts, it prints something like this:

```
╔══════════════════════════════════════════╗
║             TrackLink Server             ║
╚══════════════════════════════════════════╝

  Local:   http://localhost:8888
  Network: http://192.168.1.100:8888
  Config:  http://localhost:8888/config

  Scan to connect:
  █████████████████████
  ...
  URL: http://192.168.1.100:8888?ip=192.168.1.100
```

You have three ways to connect:

- **Scan the QR code** shown in the terminal with your phone's camera.
- **Type the `Network` URL** into your phone's browser.
- **Open the config page** (`http://localhost:8888/config`) on your computer and
  scan the QR code shown there.

---

## Installing the phone app (PWA)

For a full-screen, app-like experience (recommended):

- **iOS (Safari):** tap the **Share** button → **Add to Home Screen**.
- **Android (Chrome):** tap the **⋮** menu → **Install app** / **Add to Home Screen**.

Now launch it from your home screen, touch the dark surface, and start moving the
cursor. It works just like a laptop trackpad.

---

## Running it automatically in the background

### macOS (launchd service)

Keep TrackLink running all the time — it starts on login and survives sleep/wake:

```bash
npm run service:install     # install & start (auto-configures paths for your machine)
npm run service:status      # check it's running
npm run service:logs        # tail the logs
npm run service:restart     # restart after code changes
npm run service:stop        # stop it
npm run service:uninstall   # remove it completely
```

The install script fills in your machine's node path and project directory
automatically, then registers the service as `com.abhishekbedi.tracklink` in launchd.

### Windows / Linux

There's no bundled background-service installer for Windows or Linux yet. Common options:

- **Windows:** use [NSSM](https://nssm.cc/) or Task Scheduler to run
  `node server/index.js` at login.
- **Linux:** create a `systemd --user` service that runs `node server/index.js`.

Contributions adding first-class service installers for these platforms are welcome —
see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Building the native macOS addon from source

You only need this on **macOS**, and `npm install` already does it for you. To
rebuild manually (for example after editing `native/mac_input.mm`):

```bash
npm run build      # runs: node-gyp rebuild
```

Requirements:

- Xcode Command Line Tools (`xcode-select --install`)
- The build config lives in `binding.gyp`; the compiled output goes to `build/`
  (which is git-ignored).

If the build fails, TrackLink still runs using the `cliclick` fallback:

```bash
brew install cliclick
```

---

## Troubleshooting

**Phone can't connect**
- Confirm both devices are on the *same* WiFi network.
- Make sure port `8888` isn't blocked by a firewall.
- Try typing the IP URL directly instead of scanning the QR code.

**Cursor doesn't move (macOS)**
- Grant Accessibility permission (see [macOS setup](#macos-setup) step 3), then
  restart the server.

**Cursor doesn't move (Linux)**
- Confirm `xdotool` is installed (`which xdotool`) and you're on an X11 session.

**Gestures don't respond (Windows)**
- Try running PowerShell as Administrator.

**Port already in use**
- On macOS/Linux, `npm start` automatically frees port 8888. On Windows, close any
  other process using it or restart the machine.

**High latency**
- Prefer a 5 GHz WiFi network, move closer to the router, and lower the sensitivity
  in the app's settings.

For more detail on every gesture and configuration option, see the
[README](README.md).
