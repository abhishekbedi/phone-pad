# Contributing to PhonePad

Thanks for your interest in contributing! PhonePad turns your phone into a
wireless trackpad for your computer, and contributions of all kinds are welcome —
bug reports, feature ideas, documentation improvements, and code.

## Code of Conduct

By participating in this project you agree to abide by our
[Code of Conduct](../CODE_OF_CONDUCT.md). Please read it before contributing.

## Ways to Contribute

- **Report bugs** — Open a [GitHub issue](https://github.com/abhishekbedi/tracklink/issues) describing the problem, your OS, and steps to reproduce.
- **Request features** — Open a [GitHub issue](https://github.com/abhishekbedi/tracklink/issues) describing the feature and your use case.
- **Improve docs** — Fix typos, clarify setup steps, add troubleshooting tips.
- **Write code** — Fix bugs, add gestures, or improve platform support.

## Development Setup

**Prerequisites:** Node.js 18+, and platform-specific tools (Xcode Command Line
Tools on macOS, `xdotool` on Linux). See the [Setup Guide](SETUP.md) for full details.

```bash
git clone https://github.com/abhishekbedi/tracklink.git
cd tracklink
npm install          # compiles the native macOS addon automatically
npm run dev          # start the server with verbose logging
```

Open the URL printed in the terminal on your phone (both devices must be on the
same WiFi network) to test your changes live.

## Project Layout

```
client/     PWA mobile client (single self-contained index.html + config UI)
server/     Node.js HTTP + WebSocket server and per-OS input handlers
native/     macOS CoreGraphics/AX API N-API addon (mac_input.mm)
bin/        Pre-built AppleScript applets used at runtime for swipe gestures
scripts/    Helper scripts (launchd service installer)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a deeper dive.

## Making Changes

### Adding a new gesture

1. **Client** (`client/index.html`): add touch detection and send a new message type.
2. **Server** (`server/index.js`): add a `case` in the message handler to dispatch it.
3. **Platform** (`server/platform/*.js`): implement the action for each OS you support.
4. **Config** (`gestures.json`): add the gesture key and its default action.

### Adding a new action

1. Add the handler in the action executor in `server/index.js`.
2. Register it in the available-actions list in `server/gestures.js`.
3. It will automatically appear in the Config UI and PWA settings.

## Coding Guidelines

- Keep the client as a single self-contained HTML file — **no build step** for the client.
- Match the existing code style: 2-space indentation, single quotes, semicolons, and ES modules (`import`/`export`).
- Prefer clear, small, focused changes over large sweeping rewrites.
- Document any new gestures or actions in the README.

## Testing

PhonePad has an end-to-end server smoke test (curl-based, no GUI/permissions
needed). Run it before submitting:

```bash
npm test             # starts the server, checks the API/static assets, stops it
```

On macOS you can also verify the native addon compiles:

```bash
npm run build        # node-gyp rebuild → build/Release/mac_input.node
```

**Continuous integration:** every push and pull request runs
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `npm ci && npm test`
on Linux (Node 18/20/22) plus a native-addon build on macOS. Please make sure
`npm test` passes locally first.

Because the automated suite only covers the HTTP/API surface, also **manually
verify** input behavior (cursor, taps, scroll, swipes) on at least one platform
and state which one in your PR. See [`tests/README.md`](../tests/README.md) for
the manual checklist.

## Submitting a Pull Request

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Commit your changes with a clear, descriptive message.
3. Push your branch and open a Pull Request against `main`.
4. In the PR description, explain **what** changed, **why**, and **how you tested** it.
5. Link any related issues (e.g., `Closes #12`).

Keep PRs focused on a single concern where possible — it makes review faster.

## Questions

Not sure about something? Open an
[issue](https://github.com/abhishekbedi/tracklink/issues) and ask. We're happy to help.
