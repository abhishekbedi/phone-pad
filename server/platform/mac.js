// macOS platform handler (primary) — uses the native CoreGraphics/AX API addon for
// mouse control and window activation, with cliclick + osascript as fallback.
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
  console.log('✓ Native mac_input addon loaded');
} catch (err) {
  console.warn('⚠ Native addon not available:', err.message);
  console.warn('  Falling back to cliclick. Install with: brew install cliclick');
  console.warn('  For full functionality, build the native addon: npm run build');

  // Check if cliclick is available
  try {
    execSync('which cliclick', { stdio: 'pipe' });
    useCliclick = true;
    console.log('✓ cliclick found, using as fallback');
  } catch {
    console.error('✗ cliclick not found!');
    console.error('  Install it with: brew install cliclick');
    console.error('  Or build the native addon for full functionality.');
  }
}

// Helper to get current mouse position via AppleScript
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
    // Fallback: try cliclick to get position
    if (useCliclick) {
      try {
        const result = execSync('cliclick p', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const [x, y] = result.split(',').map(Number);
        return { x, y };
      } catch {
        return { x: 500, y: 500 };
      }
    }
    return { x: 500, y: 500 };
  }
}

// Native implementation
const nativeHandler = nativeAddon ? {
  moveMouse(dx, dy) {
    nativeAddon.moveMouse(dx, dy);
  },

  getCornerState() {
    return nativeAddon.getCornerState();
  },

  resetCornerState() {
    nativeAddon.resetCornerState();
  },

  click(button = 'left') {
    nativeAddon.click(button);
  },

  doubleClick() {
    nativeAddon.doubleClick();
  },

  tripleClick() {
    nativeAddon.tripleClick();
  },

  scroll(dx, dy) {
    nativeAddon.scroll(dx, dy);
  },

  pinchZoom(scale) {
    nativeAddon.pinchZoom(scale);
  },

  pageZoom(scale) {
    nativeAddon.pageZoom(scale);
  },

  dragStart() {
    nativeAddon.dragStart();
  },

  dragMove(dx, dy) {
    nativeAddon.dragMove(dx, dy);
  },

  dragEnd() {
    nativeAddon.dragEnd();
  },

  swipe(direction, fingers) {
    // Use native CGEvent keyPress — no osascript or applets needed
    try {
      if (fingers === 3) {
        switch (direction) {
          case 'up':
            execSync(`open -a "Mission Control"`, { stdio: 'pipe' });
            break;
          case 'down':
            nativeAddon.keyPress(125, ['control']);
            break;
          case 'left':
            nativeAddon.keyPress(19, ['control']);
            break;
          case 'right':
            nativeAddon.keyPress(18, ['control']);
            break;
        }
      } else if (fingers === 4) {
        switch (direction) {
          case 'up':
            execSync(`open -a "Mission Control"`, { stdio: 'pipe' });
            break;
          case 'down':
            nativeAddon.keyPress(103, []);
            break;
          case 'left':
            nativeAddon.keyPress(19, ['control']);
            break;
          case 'right':
            nativeAddon.keyPress(18, ['control']);
            break;
        }
      }
    } catch (err) {
      console.error('swipe failed:', err.message);
    }
  },

  launchpad() {
    try {
      execSync(`osascript -e 'tell application "System Events" to key code 131'`, { stdio: 'pipe' });
    } catch (err) {
      console.error('launchpad failed:', err.message);
    }
  },

  keyPress(keyCode, modifiers = []) {
    // Use osascript for key presses — more reliable for system shortcuts
    try {
      if (modifiers.length > 0) {
        const modMap = { command: 'command down', control: 'control down', shift: 'shift down', option: 'option down', alt: 'option down', cmd: 'command down', ctrl: 'control down' };
        const mapped = modifiers.map(m => modMap[m] || `${m} down`);
        const modStr = `using {${mapped.join(', ')}}`;
        execSync(`osascript -e 'tell application "System Events" to key code ${keyCode} ${modStr}'`, { stdio: 'pipe' });
      } else {
        execSync(`osascript -e 'tell application "System Events" to key code ${keyCode}'`, { stdio: 'pipe' });
      }
    } catch (err) {
      console.error('keyPress failed:', err.message);
      // Fallback to native addon if available
      if (nativeAddon) {
        try { nativeAddon.keyPress(keyCode, modifiers); } catch {}
      }
    }
  },
} : null;

// Fallback pinch accumulator
let fallbackPinchAccum = 0;

// Fallback implementation using cliclick + osascript
const fallbackHandler = {
  moveMouse(dx, dy) {
    if (!useCliclick) return;
    try {
      // cliclick relative move: m:+dx,+dy
      const rdx = Math.round(dx);
      const rdy = Math.round(dy);
      execFileSync('cliclick', [`m:+${rdx},+${rdy}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('moveMouse failed:', err.message);
    }
  },

  click(button = 'left') {
    if (!useCliclick) return;
    try {
      const pos = getCurrentPosition();
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      switch (button) {
        case 'right':
          execFileSync('cliclick', [`rc:${x},${y}`], { stdio: 'pipe' });
          break;
        case 'middle':
          // cliclick doesn't natively support middle-click, simulate with osascript
          execFileSync('cliclick', [`c:${x},${y}`], { stdio: 'pipe' });
          break;
        case 'left':
        default:
          execFileSync('cliclick', [`c:${x},${y}`], { stdio: 'pipe' });
          break;
      }
    } catch (err) {
      console.error('click failed:', err.message);
    }
  },

  doubleClick() {
    if (!useCliclick) return;
    try {
      const pos = getCurrentPosition();
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      execFileSync('cliclick', [`dc:${x},${y}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('doubleClick failed:', err.message);
    }
  },

  tripleClick() {
    if (!useCliclick) return;
    try {
      const pos = getCurrentPosition();
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      execFileSync('cliclick', [`tc:${x},${y}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('tripleClick failed:', err.message);
    }
  },

  scroll(dx, dy) {
    try {
      // Use AppleScript to simulate scrolling
      const scrollY = Math.round(-dy);
      const scrollX = Math.round(-dx);
      const script = `
        ObjC.import('CoreGraphics');
        const event = $.CGEventCreateScrollWheelEvent(null, 0, 2, ${scrollY}, ${scrollX});
        $.CGEventPost(0, event);
      `;
      execSync(`osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    } catch (err) {
      console.error('scroll failed:', err.message);
    }
  },

  pinchZoom(scale) {
    // Accumulate small deltas, only fire when threshold reached
    fallbackPinchAccum += (scale - 1.0) * 10;
    if (Math.abs(fallbackPinchAccum) < 1.0) return;
    try {
      const key = fallbackPinchAccum > 0 ? '24' : '27'; // 24 = '=', 27 = '-'
      execSync(`osascript -e 'tell application "System Events" to key code ${key} using command down'`, { stdio: 'pipe' });
      fallbackPinchAccum = 0;
    } catch (err) {
      console.error('pinchZoom failed:', err.message);
    }
  },

  pageZoom(scale) {
    try {
      // Cmd+Plus or Cmd+Minus using osascript
      const key = scale > 1 ? '24' : '27'; // keycode for = and -
      const script = `
        tell application "System Events"
          key code ${key} using command down
        end tell
      `;
      execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
    } catch (err) {
      console.error('pageZoom failed:', err.message);
    }
  },

  dragStart() {
    if (!useCliclick) return;
    try {
      const pos = getCurrentPosition();
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      execFileSync('cliclick', [`dd:${x},${y}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('dragStart failed:', err.message);
    }
  },

  dragMove(dx, dy) {
    if (!useCliclick) return;
    try {
      const rdx = Math.round(dx);
      const rdy = Math.round(dy);
      execFileSync('cliclick', [`m:+${rdx},+${rdy}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('dragMove failed:', err.message);
    }
  },

  dragEnd() {
    if (!useCliclick) return;
    try {
      const pos = getCurrentPosition();
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      execFileSync('cliclick', [`du:${x},${y}`], { stdio: 'pipe' });
    } catch (err) {
      console.error('dragEnd failed:', err.message);
    }
  },

  swipe(direction, fingers) {
    const binDir = join(__dirname, '..', '..', 'bin');
    try {
      if (fingers === 3) {
        switch (direction) {
          case 'up':
            execFileSync(join(binDir, 'mission_control.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'down':
            execFileSync(join(binDir, 'app_expose.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'left':
            execFileSync(join(binDir, 'space_right.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'right':
            execFileSync(join(binDir, 'space_left.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
        }
      } else if (fingers === 4) {
        switch (direction) {
          case 'up':
            execFileSync(join(binDir, 'mission_control.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'down':
            execFileSync(join(binDir, 'show_desktop.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'left':
            execFileSync(join(binDir, 'space_right.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
          case 'right':
            execFileSync(join(binDir, 'space_left.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' });
            break;
        }
      }
    } catch (err) {
      console.error('swipe failed:', err.message);
    }
  },

  launchpad() {
    try {
      execSync(`osascript -e 'tell application "System Events" to key code 160'`, { stdio: 'pipe' });
    } catch (err) {
      console.error('launchpad failed:', err.message);
    }
  },

  keyPress(keyCode, modifiers = []) {
    try {
      let modStr = '';
      if (modifiers.length > 0) {
        const modMap = { command: 'command down', control: 'control down', shift: 'shift down', option: 'option down', alt: 'option down', cmd: 'command down', ctrl: 'control down' };
        const mapped = modifiers.map(m => modMap[m] || `${m} down`);
        modStr = ` using {${mapped.join(', ')}}`;
      }
      execSync(`osascript -e 'tell application "System Events" to key code ${keyCode}${modStr}'`, { stdio: 'pipe' });
    } catch (err) {
      console.error('keyPress failed:', err.message);
    }
  },
};

const handler = nativeAddon ? nativeHandler : fallbackHandler;

export default handler;
