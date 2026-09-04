// Linux platform handler — uses xdotool for all input simulation.
// xdotool provides mouse control, keyboard events, and window management on X11.
import { execSync, execFileSync } from 'child_process';

let xdotoolAvailable = false;

// Check if xdotool is installed and accessible on the system PATH
try {
  execSync('which xdotool', { stdio: 'pipe' });
  xdotoolAvailable = true;
  console.log('✓ xdotool found');
} catch {
  console.error('✗ xdotool not found!');
  console.error('  Install it with: sudo apt install xdotool');
  console.error('  Or: sudo pacman -S xdotool');
}

/**
 * Helper to execute xdotool with given arguments.
 * Silently no-ops if xdotool is not installed.
 * @param {...string} args - Command-line arguments passed to xdotool
 */
function xdotool(...args) {
  if (!xdotoolAvailable) return;
  try {
    execFileSync('xdotool', args, { stdio: 'pipe' });
  } catch (err) {
    console.error(`xdotool ${args.join(' ')} failed:`, err.message);
  }
}

const handler = {
  /**
   * Move the mouse cursor by relative offset.
   * Uses xdotool's mousemove_relative with '--' to allow negative values.
   */
  moveMouse(dx, dy) {
    const rdx = Math.round(dx);
    const rdy = Math.round(dy);
    xdotool('mousemove_relative', '--', String(rdx), String(rdy));
  },

  /**
   * Perform a mouse click.
   * xdotool button mapping: 1=left, 2=middle, 3=right
   */
  click(button = 'left') {
    const buttonMap = {
      left: '1',
      middle: '2',
      right: '3',
    };
    const btn = buttonMap[button] || '1';
    xdotool('click', btn);
  },

  /**
   * Simulate scroll events.
   * xdotool doesn't have a native scroll command, so we simulate it by
   * clicking mouse buttons 4/5 (vertical) and 6/7 (horizontal).
   * Each click represents one scroll "notch".
   */
  scroll(dx, dy) {
    const scrollY = Math.round(dy);
    const scrollX = Math.round(dx);

    // Vertical: button 4 = scroll up, button 5 = scroll down
    if (scrollY < 0) {
      for (let i = 0; i < Math.abs(scrollY); i++) {
        xdotool('click', '4');
      }
    } else if (scrollY > 0) {
      for (let i = 0; i < scrollY; i++) {
        xdotool('click', '5');
      }
    }

    // Horizontal: button 6 = scroll left, button 7 = scroll right
    if (scrollX < 0) {
      for (let i = 0; i < Math.abs(scrollX); i++) {
        xdotool('click', '6');
      }
    } else if (scrollX > 0) {
      for (let i = 0; i < scrollX; i++) {
        xdotool('click', '7');
      }
    }
  },

  /**
   * Zoom in/out via Ctrl+Plus / Ctrl+Minus keyboard shortcuts.
   * This is a discrete step per call (no smooth/continuous zoom).
   */
  pinchZoom(scale) {
    if (scale > 1) {
      xdotool('key', 'ctrl+plus');
    } else {
      xdotool('key', 'ctrl+minus');
    }
  },

  /**
   * Page-level zoom (same implementation as pinchZoom on Linux).
   */
  pageZoom(scale) {
    if (scale > 1) {
      xdotool('key', 'ctrl+plus');
    } else {
      xdotool('key', 'ctrl+minus');
    }
  },

  /**
   * Begin a drag operation by pressing and holding left mouse button.
   */
  dragStart() {
    xdotool('mousedown', '1');
  },

  /**
   * Continue dragging — move the cursor while button remains held.
   */
  dragMove(dx, dy) {
    const rdx = Math.round(dx);
    const rdy = Math.round(dy);
    xdotool('mousemove_relative', '--', String(rdx), String(rdy));
  },

  /**
   * End a drag operation by releasing the left mouse button.
   */
  dragEnd() {
    xdotool('mouseup', '1');
  },

  /**
   * Multi-finger swipe actions mapped to common Linux desktop shortcuts:
   * - left/right: Switch workspaces (Ctrl+Alt+Arrow)
   * - up: Activities/overview (Super key)
   * - down: Show desktop (Super+D)
   * Works with GNOME, KDE, and most X11 desktop environments.
   */
  swipe(direction, fingers) {
    try {
      if (fingers === 3 || fingers === 4) {
        switch (direction) {
          case 'left':
            xdotool('key', 'ctrl+alt+Right');
            break;
          case 'right':
            xdotool('key', 'ctrl+alt+Left');
            break;
          case 'up':
            xdotool('key', 'super');
            break;
          case 'down':
            xdotool('key', 'super+d');
            break;
        }
      }
    } catch (err) {
      console.error('swipe failed:', err.message);
    }
  },

  /**
   * Open app launcher / activities overview via Super key.
   */
  launchpad() {
    try {
      xdotool('key', 'super');
    } catch (err) {
      console.error('launchpad failed:', err.message);
    }
  },
};
