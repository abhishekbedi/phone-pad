# Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL WIFI NETWORK                                     │
│                                                                                    │
│  ┌───────────────────┐       WebSocket (ws://)       ┌────────────────────────┐    │
│  │   Phone (PWA)     │ ════════════════════════════▶  │   Server (Node.js)     │    │
│  │                   │ ◀════════════════════════════  │   Port 8888            │    │
│  │  ┌─────────────┐  │    JSON messages over WS      │                        │    │
│  │  │ Touch Layer │  │                               │  ┌──────────────────┐  │    │
│  │  │ (gestures)  │  │                               │  │  Message Router  │  │    │
│  │  └─────────────┘  │                               │  │  (handleMessage) │  │    │
│  │  ┌─────────────┐  │                               │  └────────┬─────────┘  │    │
│  │  │ Settings UI │  │                               │           │             │    │
│  │  └─────────────┘  │                               │  ┌────────▼─────────┐  │    │
│  │  ┌─────────────┐  │       HTTP (static files)     │  │  Gesture Config  │  │    │
│  │  │ Service     │  │ ◀────────────────────────────  │  │  (gestures.js)   │  │    │
│  │  │ Worker      │  │                               │  └────────┬─────────┘  │    │
│  │  └─────────────┘  │                               │           │             │    │
│  └───────────────────┘                               │  ┌────────▼─────────┐  │    │
│                                                      │  │ Platform Handler │  │    │
│                                                      │  │ (platform/index) │  │    │
│                                                      │  └────────┬─────────┘  │    │
│                                                      └───────────┼────────────┘    │
│                                                                  │                  │
│                                          ┌───────────────────────┼──────────────┐   │
│                                          │                       │              │   │
│                                ┌─────────▼────────┐  ┌──────────▼───┐  ┌───────▼──────┐
│                                │  macOS (darwin)   │  │ Linux        │  │ Windows      │
│                                │                  │  │              │  │              │
│                                │  Native Addon    │  │  xdotool     │  │ PowerShell   │
│                                │  (mac_input.node)│  │  CLI calls   │  │ + robotjs    │
│                                │  ┌────────────┐  │  │              │  │              │
│                                │  │ CGEvent    │  │  └──────────────┘  └──────────────┘
│                                │  │ AX API     │  │
│                                │  │ AppKit     │  │
│                                │  └────────────┘  │
│                                │                  │
│                                │  Fallback:       │
│                                │  cliclick +      │
│                                │  osascript       │
│                                └──────────────────┘
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
Phone Touch Event
       │
       ▼
┌─────────────────────┐
│ Gesture Detection   │  (client/index.html — inline JS)
│ • finger count      │
│ • movement deltas   │
│ • tap vs drag vs    │
│   swipe vs pinch    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ JSON Message        │  { type: "move", dx: 5.2, dy: -3.1 }
│ Sent via WebSocket  │  { type: "tap", fingers: 2 }
└─────────┬───────────┘  { type: "swipe", direction: "up", fingers: 3 }
          │
          ▼
┌─────────────────────┐
│ Server Router       │  (server/index.js — handleMessage())
│ • applies           │
│   sensitivity       │
│ • resolves gesture  │
│   to action via     │
│   gestures.json     │
│ • checks hot        │
│   corners           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ executeAction()     │  Translates action name → platform call
│ • click_left        │
│ • mission_control   │
│ • space_left        │
│ • zoom, etc.        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Platform Handler    │  (server/platform/mac.js, linux.js, windows.js)
│ • OS-specific       │
│   implementation    │
│ • native addon or   │
│   CLI fallback      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Operating System    │  Cursor moves, clicks register, windows switch
└─────────────────────┘
```

---

## Component Descriptions

### `client/index.html` — PWA Mobile Client

Self-contained HTML file with inline JavaScript and CSS. No build step.

- **Touch event listeners** — Captures `touchstart`, `touchmove`, `touchend` events
- **Gesture state machine** — Tracks finger count, movement distance, timing (for taps vs drags vs swipes)
- **WebSocket client** — Maintains connection to server, sends JSON messages
- **Settings panel** — Sensitivity, scroll speed, gesture bindings (persisted in localStorage)
- **Service Worker registration** — Enables offline PWA support

### `client/config.html` — Desktop Config UI

Browser-based configuration page served at `/config`:

- QR code display for easy phone connection
- Full gesture mapping editor organized by category
- Server stop button
- Connection URL display

### `server/index.js` — Main Server

The central hub that ties everything together:

- **HTTP server** — Serves static client files and REST API endpoints
- **WebSocket server** — Accepts phone connections, routes messages
- **Message handler (`handleMessage`)** — Dispatches incoming events to the appropriate platform method or action
- **Action executor (`executeAction`)** — Maps action names (from gestures.json) to platform calls and system commands
- **Hot corner checker** — After each `move` event, queries the native addon for corner state and triggers actions on dwell
- **Session management** — Tracks connected clients (max 3)

### `server/gestures.js` — Gesture Configuration

Manages the gesture-to-action mapping:

- Loads `gestures.json` from project root on startup
- Creates default config if file missing
- Hot-reloads on file changes (via `watchFile`)
- Exports `getAction()`, `getConfig()`, `updateGesture()`, `getAvailableActions()`

### `server/platform/index.js` — Platform Dispatcher

Auto-detects `process.platform` and dynamically imports the correct handler:

- `darwin` → `mac.js`
- `linux` → `linux.js`
- `win32` → `windows.js`
- Unknown → no-op stub

### `server/platform/mac.js` — macOS Handler (Primary)

Primary macOS implementation using the native N-API addon:

- **Native addon path** — Loads `build/Release/mac_input.node`
- **Native handler** — Direct calls to CGEvent/AX API for mouse, clicks, scroll, drag, zoom
- **Swipe handling** — Uses `open -a "Mission Control"` and native `keyPress` for system gestures
- **Fallback handler** — If native addon fails, uses `cliclick` for mouse control and `osascript` for everything else
- **Corner state** — Exposes `getCornerState()` / `resetCornerState()` from the native addon

### `server/platform/mac_osascript.js` — macOS Handler (CGEvent-only swipes)

Alternative macOS handler that uses the native addon for mouse input but `CGEvent keyPress` (instead of osascript/applets) for all gesture actions:

- Avoids dependency on System Events automation permission
- All swipe gestures use `nativeAddon.keyPress()` directly
- Simpler permission model but may not work for all system gestures

### `server/platform/linux.js` — Linux Handler

Linux implementation using `xdotool`:

- All input simulation via `xdotool` CLI commands
- Mouse: `mousemove_relative`, `click`, `mousedown`/`mouseup`
- Scroll: simulated via button 4/5 (vertical) and 6/7 (horizontal) clicks
- Zoom: `Ctrl+Plus` / `Ctrl+Minus` keyboard shortcuts
- Workspace switching: `Ctrl+Alt+Left/Right`
- Show desktop / activities: `Super`, `Super+D`

### `server/platform/windows.js` — Windows Handler

Windows implementation using PowerShell and optionally `@jitsi/robotjs`:

- PowerShell scripts for mouse movement and clicks
- `robotjs` used when available for lower latency
- Keyboard shortcuts via `SendKeys`

### `native/mac_input.mm` — Native macOS Addon

Objective-C++ N-API module compiled with `node-gyp`:

- **CGEventCreateMouseEvent** — Absolute/relative mouse moves
- **CGEventPost** — Posts mouse and keyboard events to the system
- **AXUIElementCopyElementAtPosition** — Gets the UI element under cursor
- **AXUIElementPerformAction** — Activates (raises) the window under cursor on click
- **NSRunningApplication** — Activates the owning app of the clicked window
- **Corner detection** — Tracks cursor position relative to screen edges, maintains dwell counter

---

## Touch Event Lifecycle

Detailed flow from finger touching the phone screen to a system action:

```
1. FINGER TOUCHES SCREEN
   └─ Browser fires touchstart event
      └─ JS records: timestamp, finger count, initial positions

2. FINGER MOVES
   └─ Browser fires touchmove events (60Hz)
      └─ JS computes: dx, dy deltas (relative movement)
      └─ JS applies: sensitivity multiplier from settings
      └─ If 1 finger: send { type: "move", dx, dy }
      └─ If 2 fingers: detect scroll or pinch
      └─ If 3-4 fingers: accumulate for swipe detection

3. FINGER LIFTS
   └─ Browser fires touchend event
      └─ JS evaluates: was this a tap, double-tap, swipe, or just a drag ending?
      └─ Timing logic:
         - < 200ms + minimal movement = tap
         - Two taps within 300ms = double-tap
         - Three taps within 400ms = triple-tap
         - > 500ms hold before move = drag mode
      └─ Swipe logic:
         - 3-4 fingers + distance > threshold = swipe (up/down/left/right)

4. MESSAGE SENT
   └─ WebSocket sends JSON to server

5. SERVER PROCESSES
   └─ handleMessage() dispatches based on message type
   └─ For taps: looks up gesture key (e.g., "tap_2") in config
   └─ Calls executeAction() with resolved action name
   └─ For moves: calls platform.moveMouse(dx, dy) directly,
      then checks hot corner state

6. PLATFORM EXECUTES
   └─ Native addon or CLI tool performs the OS action
   └─ Result: cursor moves, click registers, window activates, etc.
```

---

## Gesture Detection Pipeline

The client implements a state machine for gesture recognition:

```
                    touchstart
                        │
                        ▼
              ┌─────────────────┐
              │  IDLE / WAITING │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
     1 finger     2 fingers    3-4 fingers
          │            │            │
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  TRACK   │  │  TRACK   │  │  TRACK   │
   │  SINGLE  │  │  DUAL    │  │  MULTI   │
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │              │              │
   ┌────┼────┐    ┌────┼────┐        │
   │    │    │    │    │    │        │
   ▼    ▼    ▼    ▼    ▼    ▼        ▼
 MOVE  TAP  HOLD SCROLL PINCH    SWIPE
  │         │     │              (direction
  │         ▼     │               detected
  │      DRAG     │               on end)
  │     START     │
  │       │       │
  ▼       ▼       ▼
send    send    send
move   drag_*  scroll/pinch
msgs    msgs    msgs
```

**Key thresholds:**
- Tap: < 200ms duration, < 10px movement
- Double-tap: second tap within 300ms of first
- Hold-to-drag: 500ms hold before movement starts
- Swipe: 3-4 fingers, > 50px in dominant direction
- Pinch: 2+ fingers, distance change > threshold

---

## Hot Corner Detection System

The hot corner system is implemented in the native macOS addon and checked by the server after every `move` event.

```
┌──────────────────────────────────────────────┐
│ ◤                SCREEN                     ◥ │
│ TL                                        TR │
│                                              │
│                                              │
│               (normal area —                 │
│                no corner detection)           │
│                                              │
│                                              │
│ BL                                        BR │
│ ◣                                          ◢ │
└──────────────────────────────────────────────┘
  A corner is detected only when the cursor is
  pushed all the way into it (pinned to both the
  horizontal and vertical edge of the combined
  virtual-display bounds).
```

**Detection algorithm (native addon, `MoveMouse` in `mac_input.mm`):**

1. On each `moveMouse()` call, the addon clamps the new cursor position to the
   combined bounds of all active displays (`CGGetActiveDisplayList` +
   `CGDisplayBounds`).
2. It then checks whether the clamped position sits on an edge — `atLeft`
   (`x <= minX`), `atRight` (`x >= maxX - 1`), `atTop` (`y <= minY`),
   `atBottom` (`y >= maxY - 1`). A corner requires both a horizontal and a
   vertical edge: TL = left+top, TR = right+top, BL = left+bottom, BR = right+bottom.
3. If in the same corner as the previous move: increment the dwell counter.
   Otherwise: reset it (to `1` if newly entering a corner, else `0`).
4. The addon exposes `getCornerState()` → `{ corner: 0-4, dwell: N }`
   (`0` = no corner; `1` = TL, `2` = TR, `3` = BL, `4` = BR).

**Server-side trigger logic:**

1. After dispatching every `move` event, the server calls `platform.getCornerState()`
2. If `dwell >= 8` (8 consecutive move events in the same corner):
   - Look up the corner's action from `gestures.json` (e.g., `hot_corner_tr` → `"mission_control"`)
   - Call `executeAction()` with that action
   - Call `platform.resetCornerState()` to prevent re-triggering
3. The user must move away from the corner and back to trigger again

**Why 8 events?** This provides a ~130ms dwell time at 60Hz touch reporting, which is long enough to avoid accidental triggers when the cursor passes through a corner, but short enough to feel responsive.

**Why not use macOS native hot corners?**

macOS native hot corners only trigger from real hardware mouse input (physical mouse or trackpad). Synthetic `CGEvent` mouse moves — which is how PhonePad moves the cursor — do **not** reliably trigger native hot corners, particularly on secondary displays in multi-monitor setups. Our app-level detection solves this by watching cursor position directly.

---

## Extension Points

### Adding a New Gesture Type

1. **Client** (`client/index.html`): Add touch detection logic in the gesture state machine
2. **Protocol**: Define a new JSON message type (e.g., `{ "type": "rotate", "angle": 15 }`)
3. **Server** (`server/index.js`): Add a `case` in `handleMessage()` to process the new message
4. **Config** (`gestures.json`): Add a gesture key with default action

### Adding a New Action

1. **Server** (`server/index.js`): Add a case in `executeAction()`
2. **Config** (`server/gestures.js`): Add to `available_actions` in DEFAULT_CONFIG
3. **Platform** (if needed): Add platform-specific method to handlers
4. The action automatically appears in the Config UI and PWA settings

### Adding a New Platform

1. Create `server/platform/<platform>.js` exporting the standard handler interface:
   - `moveMouse(dx, dy)`
   - `click(button)`, `doubleClick()`, `tripleClick()`
   - `scroll(dx, dy)`
   - `pinchZoom(scale)`, `pageZoom(scale)`
   - `dragStart()`, `dragMove(dx, dy)`, `dragEnd()`
   - `swipe(direction, fingers)`
   - `launchpad()`
   - `keyPress(keyCode, modifiers)`
2. Add a case in `server/platform/index.js` for the new `process.platform` value
3. Optionally implement `getCornerState()` and `resetCornerState()` for hot corner support

### Adding New Client Features

The client is a single self-contained HTML file — no build step, no external dependencies. Add new UI elements, touch handlers, or settings directly. The service worker (`sw.js`) caches the app for offline use; update its version to bust the cache.

### Native Addon Extensions

The native addon (`native/mac_input.mm`) is a Node.js N-API module. To add new native functionality:

1. Add the function implementation in `mac_input.mm`
2. Register it via `napi_define_properties` in the module init
3. Rebuild with `npm run build` (uses `node-gyp` via `binding.gyp`)
4. Call from `server/platform/mac.js`
