// Platform dispatcher — auto-detects the OS via process.platform and dynamically
// imports the appropriate input handler (macOS, Linux, or Windows).
let handler;

const currentPlatform = process.platform;

switch (currentPlatform) {
  case 'darwin':
    handler = (await import('./mac.js')).default;
    break;
  case 'linux':
    handler = (await import('./linux.js')).default;
    break;
  case 'win32':
    handler = (await import('./windows.js')).default;
    break;
  default:
    console.error(`Unsupported platform: ${currentPlatform}`);
    console.error('Supported platforms: macOS (darwin), Linux, Windows (win32)');
    handler = {
      moveMouse() {},
      click() {},
      scroll() {},
      pinchZoom() {},
      pageZoom() {},
      dragStart() {},
      dragMove() {},
      dragEnd() {},
    };
}

export default handler;
