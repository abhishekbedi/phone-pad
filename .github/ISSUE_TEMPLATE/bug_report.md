---
name: Bug report
about: Report something that isn't working as expected
title: "[Bug]: "
labels: [bug]
assignees: []
---

## Describe the bug

A clear and concise description of what the bug is.

## To reproduce

Steps to reproduce the behavior:

1. Start the server with `...`
2. Connect the phone via `...`
3. Perform gesture `...`
4. See error

## Expected behavior

What you expected to happen instead.

## Screenshots / logs

If applicable, add screenshots or paste relevant log output.

```
# Server logs — macOS launchd service:
tail -n 50 logs/server.log
# or run in the foreground with verbose logging:
npm run dev
```

## Environment

- **Computer OS:** <!-- e.g. macOS 14.5 / Ubuntu 24.04 / Windows 11 -->
- **Node.js version:** <!-- node --version -->
- **PhonePad version / commit:** <!-- package.json version or git SHA -->
- **Phone + browser:** <!-- e.g. iPhone 15, Safari / Pixel 8, Chrome -->
- **Install method:** <!-- npm start (foreground) / launchd service / other -->
- **Native addon:** <!-- built OK? saw "Native mac_input addon loaded"? or cliclick fallback? -->

## Checklist

- [ ] Phone and computer are on the **same WiFi network**.
- [ ] Port **8888** is reachable (not blocked by a firewall).
- [ ] I checked [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md).
- [ ] (macOS) Accessibility permission is granted.

## Additional context

Anything else that might help us diagnose the issue.
