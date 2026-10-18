<div align="center">

# 🖱️ PhonePad

### Your phone is now a trackpad. 📱→💻

Turn any phone into a wireless multi-touch trackpad for your **Mac**, **Windows**, or
**Linux** computer. Taps, swipe gestures, scrolling, pinch-zoom, and drag & drop —
streamed over your local WiFi with **zero cloud**, **zero accounts**, and **zero app-store installs**.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: macOS | Linux | Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg)](docs/SETUP.md)
[![Client: PWA](https://img.shields.io/badge/Client-PWA%20(iOS%20%26%20Android)-orange.svg)](#-install-the-phone-app)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![CI](https://github.com/abhishekbedi/phone-pad/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishekbedi/phone-pad/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

[**Quick Start**](#-quick-start) · [**Setup Guide**](docs/SETUP.md) · [**Gestures**](#-gestures) · [**Troubleshooting**](docs/TROUBLESHOOTING.md) · [**Contributing**](docs/CONTRIBUTING.md)

<!--
  📸 Add a demo GIF/screenshot here to show the phone driving the desktop cursor:
  ![PhonePad demo](docs/assets/demo.gif)
  A 5–10s clip of a swipe triggering Mission Control makes the pitch instantly.
-->

</div>

> **TL;DR** — `npm install && npm start`, scan the QR code with your phone, and start
> swiping. No downloads on the phone, nothing leaves your network.

---

## ✨ Why PhonePad?

- 🚀 **No app store needed** — the phone client is a PWA that installs straight from your browser
- 🔒 **Privacy-first** — everything stays on your local network; no accounts, no cloud, no telemetry
- 🖐️ **Native-feel gestures** — 3/4-finger swipes for Mission Control, Spaces, Exposé, and more
- 💻 **Truly cross-platform** — one server runs on macOS, Windows, or Linux
- ⚡ **Low latency** — a direct WebSocket connection drives native OS input simulation
- 🛠️ **Open source** — hack it, extend it, make it yours

---

## 🚀 Quick Start

> **Prerequisite:** [Node.js 18+](https://nodejs.org), and your phone + computer on the **same WiFi**.

```bash
git clone https://github.com/abhishekbedi/phone-pad.git
cd phone-pad
npm install
npm start
```

Then **scan the QR code** printed in your terminal with your phone — and start swiping.

📖 **New here? Follow the [full step-by-step Setup Guide](docs/SETUP.md)** for macOS, Windows,
and Linux, including permissions, the background service, and building from source.

---

## 📱 Install the phone app

There's **no App Store or Play Store download**. The "app" is a
**PWA (Progressive Web App)** — the page the server already serves at
`http://<your-computer-ip>:8888`. Installing it just adds a home-screen icon and
runs it full-screen (a service worker caches it for offline launch):

- **iOS (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** Menu (⋮) → **Install app**

To remove it later (and stop it auto-reconnecting), see the
[Uninstall Guide](docs/UNINSTALL.md).

---

## 🖐️ Gestures

These are the **default** mappings shipped in [`gestures.json`](gestures.json).
Every gesture is remappable, so your setup may differ.

| Gesture                     | Default Action                   |
| --------------------------- | -------------------------------- |
| 1-finger drag               | Move cursor                      |
| 1-finger tap                | Left click (activates window)    |
| 2-finger tap                | Right click                      |
| 3-finger tap                | Middle click                     |
| 4-finger tap                | Launchpad                        |
| 1-finger double tap         | Double click (select word)       |
| 1-finger triple tap         | Triple click (select line)       |
| 2-finger drag               | Scroll (vertical & horizontal)   |
| 2-finger pinch              | Zoom in/out (Cmd +/Cmd -)        |
| 4-finger pinch              | Page zoom (Cmd +/Cmd -)          |
| 3-finger swipe up           | Mission Control                  |
| 3-finger swipe down         | App Exposé                       |
| 3-finger swipe left         | Switch Desktop right             |
| 3-finger swipe right        | Switch Desktop left              |
| 4-finger swipe up           | Spotlight Search                 |
| 4-finger swipe down         | Mission Control                  |
| 4-finger swipe left         | Launchpad                        |
| 4-finger swipe right        | Show Desktop                     |
| Tap and hold (500ms) + drag | Drag & drop                      |
| Cursor pushed to corner     | Hot corners (configurable)       |

> **Note:** Pinch zoom is detected on the phone and sent as dedicated `pinch`
> (2-finger) and `page_zoom` (4-finger) messages. These always map to zoom and
> page-zoom respectively — the `pinch_2` / `pinch_3` entries in `gestures.json`
> are not used by the current client, which triggers page zoom on a 4-finger pinch.

**Bottom bar buttons:** `L` = left click · `M` = middle click · `R` = right click
(these send 1-, 3-, and 2-finger taps respectively, which resolve through the
`tap_1` / `tap_3` / `tap_2` mappings above).

Every gesture is remappable from the in-app **⚙️ Settings** or the desktop
**Config UI** (`http://localhost:8888/config`).

---

## 🏗️ Architecture

```
┌─────────────────┐         WebSocket         ┌──────────────────────┐
│  Phone (PWA)    │ ──────────────────────────▶│  Server (Node.js)    │
│  Touch Gestures │◀──────────────────────────│  Input Simulation    │
└─────────────────┘      Local WiFi           └──────────────────────┘
                                                        │
                                              ┌─────────┼─────────┐
                                              ▼         ▼         ▼
                                           macOS     Linux     Windows
                                          CGEvent   xdotool   SendInput
                                          + AX API
```

The phone captures multi-touch gestures and sends them as JSON over WebSocket. The server
translates them into native OS input events:

- **macOS** — CGEvent for movement/clicks/scroll/keys, Accessibility API for window
  activation, and pre-built AppleScript applets for swipe gestures
- **Linux** — `xdotool` (X11)
- **Windows** — `@jitsi/robotjs` if available, otherwise a PowerShell fallback

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

---

## ⚙️ Configuration

Gestures are stored in `gestures.json` at the project root and are **hot-reloaded** —
edits take effect immediately, no restart needed. You can edit the file directly or use
the visual editor in the Config UI (`http://localhost:8888/config`).

**Available actions:** `click_left`, `click_right`, `click_middle`, `double_click`,
`triple_click`, `mission_control`, `app_expose`, `show_desktop`, `launchpad`,
`space_left`, `space_right`, `zoom`, `page_zoom`, `screenshot`, `spotlight`,
`lock_screen`, `notification_center`, `none`.

### Hot corners

PhonePad has its **own** hot-corner system, independent of macOS System Settings. This is
necessary because macOS native hot corners rely on real hardware input and don't trigger
reliably from synthetic cursor moves (especially on secondary displays). The server fires a
corner's action after the cursor dwells there for 8 consecutive move events.

| Corner       | Default Action      |
| ------------ | ------------------- |
| Top-left     | None (disabled)     |
| Top-right    | Mission Control     |
| Bottom-left  | None (disabled)     |
| Bottom-right | Show Desktop        |

Configure via the `hot_corner_tl` / `hot_corner_tr` / `hot_corner_bl` / `hot_corner_br`
keys in `gestures.json`. Set any to `"none"` to disable it (top-left and bottom-left are
disabled by default).

---

## 🩺 Troubleshooting

Not sure whether the **server**, the **background service**, or the **phone app**
is actually running? The [Troubleshooting Guide](docs/TROUBLESHOOTING.md) has
copy-paste CLI checks for every platform. Quick ones:

```bash
lsof -i :8888                              # is the server listening?
curl -s http://localhost:8888/api/server/info   # does the API answer?
curl -s http://localhost:8888/api/sessions       # is a phone connected?
launchctl list | grep phonepad            # macOS: is the service loaded?
```

**Tracing the app:** everything a user sees is named **PhonePad** — the phone's
home-screen PWA (`PhonePad`), the browser tab titles, the server startup banner
(`PhonePad Server`), the logs under `logs/`, and the macOS launchd service
(`nz.tentronix.phonepad`).

---

## 🔌 WebSocket Protocol

The client sends JSON messages to the server:

```jsonc
{ "type": "move", "dx": 5.2, "dy": -3.1 }                 // relative cursor movement
{ "type": "tap", "fingers": 2 }                           // tap (1–4 fingers)
{ "type": "double_tap", "fingers": 1 }                    // double tap
{ "type": "triple_tap", "fingers": 1 }                    // triple tap
{ "type": "scroll", "dx": 0, "dy": -12.5 }                // 2-finger scroll
{ "type": "pinch", "scale": 1.05, "center_x": 200, "center_y": 300 }  // pinch zoom
{ "type": "page_zoom", "scale": 0.95 }                    // 4-finger pinch
{ "type": "swipe", "direction": "up", "fingers": 3 }      // multi-finger swipe
{ "type": "drag_start" }                                  // drag & drop
{ "type": "drag_move", "dx": 3.0, "dy": 1.5 }
{ "type": "drag_end" }
{ "type": "sensitivity", "value": 1.5 }                   // settings
```

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/gestures` | GET | Get full gesture configuration |
| `/api/gestures` | POST | Update a gesture mapping |
| `/api/gestures/actions` | GET | List available actions |
| `/api/server/info` | GET | Server IP, port, connection URL |
| `/api/server/stop` | POST | Stop the server |
| `/api/qrcode?url=` | GET | QR code PNG for a connection URL |
| `/api/sessions` | GET | Active WebSocket sessions |
| `/api/sessions/kick` | POST | Disconnect a session |

---

## 📁 Project Structure

```
phone-pad/
├── client/                  # PWA mobile client
│   ├── index.html           # Main app (self-contained, inline JS/CSS)
│   ├── config.html          # Desktop config UI (gesture editor, QR code)
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker for offline support
│   └── icons/               # App icons (SVG)
├── server/                  # Node.js server
│   ├── index.js             # HTTP + WebSocket server, routing, hot corners
│   ├── gestures.js          # Gesture config loader (gestures.json)
│   └── platform/            # OS-specific input handlers
│       ├── index.js         # Platform auto-detection & dispatch
│       ├── mac.js           # macOS — native addon + CGEvent
│       ├── mac_osascript.js # macOS — osascript fallback
│       ├── linux.js         # Linux — xdotool
│       └── windows.js       # Windows — robotjs + PowerShell fallback
├── native/                  # macOS CoreGraphics/AX API N-API addon
│   └── mac_input.mm
├── bin/                     # Pre-built AppleScript applets (macOS swipe gestures)
├── scripts/                 # Helper scripts (launchd service installer)
├── docs/                    # Project documentation
│   ├── QUICKSTART.md        # Shortest path from zero to running
│   ├── SETUP.md             # Full cross-platform setup guide
│   ├── ARCHITECTURE.md      # Design deep dive
│   ├── TROUBLESHOOTING.md   # Check server / service / app status (CLI)
│   ├── UNINSTALL.md         # Removing the server and phone PWA
│   └── CONTRIBUTING.md      # How to contribute
├── tests/                   # Test suite (see tests/README.md)
├── gestures.json            # Gesture → action mapping (hot-reloaded)
├── binding.gyp              # Native addon build configuration
├── CODE_OF_CONDUCT.md       # Community code of conduct
├── Progress.md              # Milestone changelog
└── package.json
```

---

## 🔐 Security

- All communication stays on your local network — no internet traffic
- No authentication: **anyone on your WiFi can connect**, so use a trusted network
- No data is collected, stored, or transmitted externally
- Limited to a small number of simultaneous connections
- For sensitive environments, run over a private hotspot between phone and computer

---

## 🧪 Testing

PhonePad ships with an end-to-end server smoke test (curl-based, no GUI needed):

```bash
npm test
```

It starts the server, asserts the REST API and static assets respond correctly,
then stops the server and confirms the port is freed — handy before publishing or
in CI. See [`tests/`](tests/) for details and the manual gesture checklist.

Build the native macOS addon from source:

```bash
npm run build      # node-gyp rebuild → build/Release/mac_input.node
```

---

## 🤝 Contributing

PhonePad is open source and contributions are very welcome — whether it's a bug
report, a new gesture, a platform fix, or a docs tweak.

- 🐛 **Found a bug?** [Open an issue.](https://github.com/abhishekbedi/phone-pad/issues)
- 💡 **Have an idea?** Start a discussion or open a feature request.
- 🔧 **Want to build?** Read the [Contributing Guide](docs/CONTRIBUTING.md) and the
  [Architecture overview](docs/ARCHITECTURE.md) to get oriented fast.
- ⭐ **Like it?** Star the repo — it genuinely helps others discover the project.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

[MIT](LICENSE) — free, open-source, and private. Use it, fork it, ship it.

Made with ☕ by [Abhishek Bedi](https://github.com/abhishekbedi) at **Tentronix NZ**.
Inspired by commercial remote-trackpad apps — but free and yours to hack.
