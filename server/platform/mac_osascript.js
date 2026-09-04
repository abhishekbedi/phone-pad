// macOS platform handler (CGEvent-only swipes) — uses native addon for mouse input
// but relies on CGEvent keyPress for all gesture actions instead of osascript/applets.
// Simpler permission model; avoids needing System Events automation access.
import { execSync, execFileSync } from 'child_process';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let nativeAddon = null;
let useCliclick = false;

// Try to load the native addon
try {
  nativeAddon = require(join(__dirname, '..', '..', 'build', 'Release', 'mac_input.node'));
  console.log('✓ Native mac_input addon loaded (osascript mode)');
} catch (err) {
  console.warn('⚠ Native addon not available:', err.message);
  try {
    execSync('which cliclick', { stdio: 'pipe' });
    useCliclick = true;
    console.log('✓ cliclick found, using as fallback');
  } catch {
    console.error('✗ cliclick not found!');
  }
}

// Helper to get current mouse position
function getCurrentPosition() {
  try {
    const script = `
      const app = Application.currentApplication();
      app.includeStandardAdditions = true;
      const info = ObjC.deepUnwrap($.NSEvent.mouseLocation);
      const screenHeight = ObjC.deepUnwrap($.NSScreen.mainScreen.frame.size.height);
      return JSON.stringify({x: info.x, y: screenHeight - info.y});
    `;
    const result = execSync(`osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return JSON.parse(result);
  } catch {
    return { x: 500, y: 500 };
  }
}

// All gesture commands use osascript
const handler = {
  moveMouse(dx, dy) {
    if (nativeAddon) {
      nativeAddon.moveMouse(dx, dy);
    } else if (useCliclick) {
      try {
        execFileSync('cliclick', [`m:+${Math.round(dx)},+${Math.round(dy)}`], { stdio: 'pipe' });
      } catch {}
    }
  },

  getCornerState() {
    if (nativeAddon && nativeAddon.getCornerState) return nativeAddon.getCornerState();
    return { corner: 0, dwell: 0 };
  },

  resetCornerState() {
    if (nativeAddon && nativeAddon.resetCornerState) nativeAddon.resetCornerState();
  },

  click(button = 'left') {
    if (nativeAddon) {
      nativeAddon.click(button);
    } else if (useCliclick) {
      try {
        const pos = getCurrentPosition();
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);
        if (button === 'right') execFileSync('cliclick', [`rc:${x},${y}`], { stdio: 'pipe' });
        else execFileSync('cliclick', [`c:${x},${y}`], { stdio: 'pipe' });
      } catch {}
    }
  },

  doubleClick() {
    if (nativeAddon && nativeAddon.doubleClick) {
      nativeAddon.doubleClick();
    } else {
      this.click('left');
      this.click('left');
    }
  },

  tripleClick() {
    if (nativeAddon && nativeAddon.tripleClick) {
      nativeAddon.tripleClick();
    } else {
      this.click('left');
      this.click('left');
      this.click('left');
    }
  },

  scroll(dx, dy) {
    if (nativeAddon) {
      nativeAddon.scroll(dx, dy);
    }
  },

  pinchZoom(scale) {
    if (nativeAddon) {
      nativeAddon.pinchZoom(scale);
    }
  },

  pageZoom(scale) {
    if (nativeAddon) {
      nativeAddon.pageZoom(scale);
    }
  },

  dragStart() {
    if (nativeAddon) nativeAddon.dragStart();
  },

  dragMove(dx, dy) {
    if (nativeAddon) nativeAddon.dragMove(dx, dy);
  },

  dragEnd() {
    if (nativeAddon) nativeAddon.dragEnd();
  },

  swipe(direction, fingers) {
    try {
      if (fingers === 3) {
        switch (direction) {
          case 'up':
            // Mission Control - use native CGEvent (bypasses System Events)
            if (nativeAddon) nativeAddon.keyPress(126, ['control']);
            break;
          case 'down':
            // App Exposé: Ctrl+Down
            if (nativeAddon) nativeAddon.keyPress(125, ['control']);
            break;
          case 'left':
            // Desktop 2: Ctrl+2
            if (nativeAddon) nativeAddon.keyPress(19, ['control']);
            break;
          case 'right':
            // Desktop 1: Ctrl+1
            if (nativeAddon) nativeAddon.keyPress(18, ['control']);
            break;
        }
      } else if (fingers === 4) {
        switch (direction) {
          case 'up':
            // Mission Control
            if (nativeAddon) nativeAddon.keyPress(126, ['control']);
            break;
          case 'down':
            // Show Desktop: F11
            if (nativeAddon) nativeAddon.keyPress(103, []);
            break;
          case 'left':
            // Desktop 2: Ctrl+2
            if (nativeAddon) nativeAddon.keyPress(19, ['control']);
            break;
          case 'right':
            // Desktop 1: Ctrl+1
            if (nativeAddon) nativeAddon.keyPress(18, ['control']);
            break;
        }
      }
    } catch (err) {
      console.error('swipe failed:', err.message);
    }
  },

  launchpad() {
    if (nativeAddon) nativeAddon.keyPress(131, []);
  },

  keyPress(keyCode, modifiers = []) {
    if (nativeAddon) {
      try { nativeAddon.keyPress(keyCode, modifiers); } catch {}
    }
  },
};

export default handler;
