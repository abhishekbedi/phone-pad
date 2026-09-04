import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let robotjs = null;
let useRobotjs = false;

// Try to load @jitsi/robotjs
try {
  robotjs = require('@jitsi/robotjs');
  useRobotjs = true;
  console.log('✓ @jitsi/robotjs loaded');
} catch {
  console.warn('⚠ @jitsi/robotjs not available, using PowerShell fallback');
  console.warn('  For better performance: npm install @jitsi/robotjs');
}

// PowerShell helpers
function powershell(command) {
  try {
    execSync(`powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`, {
      stdio: 'pipe',
    });
  } catch (err) {
    console.error('PowerShell command failed:', err.message);
  }
}

function powershellOutput(command) {
  try {
    return execSync(
      `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
  } catch (err) {
    console.error('PowerShell command failed:', err.message);
    return '';
  }
}

// Add-Type for mouse/keyboard operations (cached)
const MOUSE_INTEROP = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class NativeInput {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    public const uint MOUSEEVENTF_MOVE = 0x0001;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
    public const uint MOUSEEVENTF_HWHEEL = 0x1000;
    public const uint KEYEVENTF_KEYUP = 0x0002;
}
'@ -ErrorAction SilentlyContinue;
`;

// robotjs implementation
const robotjsHandler = robotjs ? {
  moveMouse(dx, dy) {
    const pos = robotjs.getMousePos();
    robotjs.moveMouse(pos.x + Math.round(dx), pos.y + Math.round(dy));
  },

  click(button = 'left') {
    robotjs.mouseClick(button);
  },

  scroll(dx, dy) {
    if (dy !== 0) robotjs.scrollMouse(0, Math.round(-dy));
    if (dx !== 0) robotjs.scrollMouse(Math.round(dx), 0);
  },

  pinchZoom(scale) {
    // Ctrl + scroll to zoom
    robotjs.keyToggle('control', 'down');
    const amount = scale > 1 ? 3 : -3;
    robotjs.scrollMouse(0, amount);
    robotjs.keyToggle('control', 'up');
  },

  pageZoom(scale) {
    if (scale > 1) {
      robotjs.keyTap('=', ['control']);
    } else {
      robotjs.keyTap('-', ['control']);
    }
  },

  dragStart() {
    robotjs.mouseToggle('down');
  },

  dragMove(dx, dy) {
    const pos = robotjs.getMousePos();
    robotjs.moveMouse(pos.x + Math.round(dx), pos.y + Math.round(dy));
  },

  dragEnd() {
    robotjs.mouseToggle('up');
  },

  swipe(direction, fingers) {
    // Windows: Win+Tab for task view, Win+Ctrl+Left/Right for virtual desktops
    if (fingers === 3 || fingers === 4) {
      switch (direction) {
        case 'up':
          robotjs.keyTap('tab', ['meta']);
          break;
        case 'down':
          robotjs.keyTap('d', ['meta']);
          break;
        case 'left':
          robotjs.keyTap('right', ['meta', 'control']);
          break;
        case 'right':
          robotjs.keyTap('left', ['meta', 'control']);
          break;
      }
    }
  },

  launchpad() {
    robotjs.keyTap('command');
  },
} : null;

// PowerShell fallback implementation
const powershellHandler = {
  moveMouse(dx, dy) {
    const rdx = Math.round(dx);
    const rdy = Math.round(dy);
    const cmd = `${MOUSE_INTEROP}
      $p = New-Object NativeInput+POINT;
      [NativeInput]::GetCursorPos([ref]$p) | Out-Null;
      [NativeInput]::SetCursorPos($p.X + ${rdx}, $p.Y + ${rdy}) | Out-Null;
    `;
    powershell(cmd);
  },

  click(button = 'left') {
    let downFlag, upFlag;
    switch (button) {
      case 'right':
        downFlag = '[NativeInput]::MOUSEEVENTF_RIGHTDOWN';
        upFlag = '[NativeInput]::MOUSEEVENTF_RIGHTUP';
        break;
      case 'middle':
        downFlag = '[NativeInput]::MOUSEEVENTF_MIDDLEDOWN';
        upFlag = '[NativeInput]::MOUSEEVENTF_MIDDLEUP';
        break;
      case 'left':
      default:
        downFlag = '[NativeInput]::MOUSEEVENTF_LEFTDOWN';
        upFlag = '[NativeInput]::MOUSEEVENTF_LEFTUP';
        break;
    }
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::mouse_event(${downFlag}, 0, 0, 0, [IntPtr]::Zero);
      [NativeInput]::mouse_event(${upFlag}, 0, 0, 0, [IntPtr]::Zero);
    `;
    powershell(cmd);
  },

  scroll(dx, dy) {
    const scrollAmount = Math.round(-dy * 120);
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_WHEEL, 0, 0, ${scrollAmount}, [IntPtr]::Zero);
    `;
    powershell(cmd);

    if (dx !== 0) {
      const hScrollAmount = Math.round(dx * 120);
      const hCmd = `${MOUSE_INTEROP}
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_HWHEEL, 0, 0, ${hScrollAmount}, [IntPtr]::Zero);
      `;
      powershell(hCmd);
    }
  },

  pinchZoom(scale) {
    // Ctrl + scroll
    const scrollAmount = scale > 1 ? 360 : -360;
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::keybd_event(0x11, 0, 0, [IntPtr]::Zero);
      [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_WHEEL, 0, 0, ${scrollAmount}, [IntPtr]::Zero);
      [NativeInput]::keybd_event(0x11, 0, [NativeInput]::KEYEVENTF_KEYUP, [IntPtr]::Zero);
    `;
    powershell(cmd);
  },

  pageZoom(scale) {
    // Ctrl + Plus or Ctrl + Minus
    const vk = scale > 1 ? '0xBB' : '0xBD'; // VK_OEM_PLUS or VK_OEM_MINUS
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::keybd_event(0x11, 0, 0, [IntPtr]::Zero);
      [NativeInput]::keybd_event(${vk}, 0, 0, [IntPtr]::Zero);
      [NativeInput]::keybd_event(${vk}, 0, [NativeInput]::KEYEVENTF_KEYUP, [IntPtr]::Zero);
      [NativeInput]::keybd_event(0x11, 0, [NativeInput]::KEYEVENTF_KEYUP, [IntPtr]::Zero);
    `;
    powershell(cmd);
  },

  dragStart() {
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero);
    `;
    powershell(cmd);
  },

  dragMove(dx, dy) {
    const rdx = Math.round(dx);
    const rdy = Math.round(dy);
    const cmd = `${MOUSE_INTEROP}
      $p = New-Object NativeInput+POINT;
      [NativeInput]::GetCursorPos([ref]$p) | Out-Null;
      [NativeInput]::SetCursorPos($p.X + ${rdx}, $p.Y + ${rdy}) | Out-Null;
    `;
    powershell(cmd);
  },

  dragEnd() {
    const cmd = `${MOUSE_INTEROP}
      [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero);
    `;
    powershell(cmd);
  },

  swipe(direction, fingers) {
    // Windows: keyboard shortcuts for virtual desktop/task view
    if (fingers === 3 || fingers === 4) {
      switch (direction) {
        case 'up':
          powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^%{TAB}')`);
          break;
        case 'down':
          powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('#d')`);
          break;
        case 'left':
          powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^#{RIGHT}')`);
          break;
        case 'right':
          powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^#{LEFT}')`);
          break;
      }
    }
  },

  launchpad() {
    powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{ESC}')`);
  },
};

const handler = useRobotjs ? robotjsHandler : powershellHandler;

export default handler;
