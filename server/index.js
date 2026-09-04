// Main server module — HTTP server for static files and REST API, WebSocket server
// for real-time communication with the phone client, message routing, action
// execution, hot corner detection, and session management.
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { execSync, execFileSync } from 'child_process';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import platform from './platform/index.js';
import { getAction, getConfig, updateGesture, getAvailableActions } from './gestures.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIR = join(__dirname, '..', 'client');
const PORT = 8888;

// Debug mode — enabled with --dev flag
const DEBUG = process.argv.includes('--dev');

// Sensitivity multiplier (applied to movement deltas)
let sensitivity = 1.5;

// Logging helpers
function logGesture(gesture, action) {
  const ts = new Date().toLocaleTimeString();
  console.log(`  [${ts}] 🎯 ${gesture} → ${action}`);
}

function logDebug(...args) {
  if (DEBUG) console.log('  [debug]', ...args);
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Get local network IP address
function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Parse JSON request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Execute a configured action
// Uses shell commands for system gestures (Mission Control, Spaces) and
// native keyPress for keyboard shortcuts (Cmd+Space, Cmd+Shift+5, etc.)
function executeAction(action, extraData = {}) {
  logDebug(`executeAction: ${action}`);
  switch (action) {
    case 'click_left':
      platform.click('left');
      break;
    case 'click_right':
      platform.click('right');
      break;
    case 'click_middle':
      platform.click('middle');
      break;
    case 'double_click':
      platform.doubleClick();
      break;
    case 'triple_click':
      platform.tripleClick();
      break;
    case 'mission_control':
      try { execSync(`open -a "Mission Control"`, { stdio: 'pipe' }); }
      catch (e) { console.error('mission_control failed:', e.message); }
      break;
    case 'app_expose':
      // Use applet (has its own TCC permission)
      try { execFileSync(join(__dirname, '..', 'bin', 'app_expose.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' }); }
      catch (e) { platform.keyPress(125, ['control']); }
      break;
    case 'show_desktop':
      // Use applet (has its own TCC permission)
      try { execFileSync(join(__dirname, '..', 'bin', 'show_desktop.app', 'Contents', 'MacOS', 'applet'), { stdio: 'pipe' }); }
      catch (e) { platform.keyPress(103, []); }
      break;
    case 'launchpad':
      // Try keyPress first, fall back to osascript
      try {
        platform.keyPress(131, []);
      } catch (e) {
        try { execSync(`osascript -e 'tell application "System Events" to key code 131'`, { stdio: 'pipe' }); }
        catch (e2) { console.error('launchpad failed:', e2.message); }
      }
      break;
    case 'space_left':
      // Ctrl+1 = Desktop 1
      platform.keyPress(18, ['control']);
      break;
    case 'space_right':
      // Ctrl+2 = Desktop 2
      platform.keyPress(19, ['control']);
      break;
    case 'zoom':
      platform.pinchZoom(extraData.scale || 1);
      break;
    case 'page_zoom':
      platform.pageZoom(extraData.scale || 1);
      break;
    case 'notification_center':
      try { execSync(`open -g "x-apple.systempreferences:com.apple.Notifications-Settings.extension"`, { stdio: 'pipe' }); }
      catch (e) { console.error('notification_center failed:', e.message); }
      break;
    case 'screenshot':
      platform.keyPress(23, ['command', 'shift']);
      break;
    case 'spotlight':
      platform.keyPress(49, ['command']);
      break;
    case 'lock_screen':
      platform.keyPress(12, ['control', 'command']);
      break;
    case 'none':
      break;
    case 'hot_corner_tl':
    case 'hot_corner_tr':
    case 'hot_corner_bl':
    case 'hot_corner_br': {
      // Resolve the hot corner to its configured action and execute that
      const hcAction = getAction(action);
      if (hcAction && hcAction !== action) {
        executeAction(hcAction, extraData);
      }
      break;
    }
    default:
      console.warn(`Unknown action: ${action}`);
  }
}

// HTTP server to serve client files and API
const httpServer = createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // API routes
  if (urlPath === '/api/gestures' && req.method === 'GET') {
    const config = getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(config));
    return;
  }

  if (urlPath === '/api/gestures' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.gesture && body.action) {
        const success = updateGesture(body.gesture, body.action);
        res.writeHead(success ? 200 : 400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success, message: success ? 'Updated' : 'Invalid gesture key' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Missing gesture or action field' }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
    return;
  }

  if (urlPath === '/api/gestures/actions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getAvailableActions()));
    return;
  }

  // Server info API (for QR code and status)
  if (urlPath === '/api/server/info' && req.method === 'GET') {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}?ip=${ip}`;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ip, port: PORT, url, platform: process.platform }));
    return;
  }

  // QR code image API
  if (urlPath.startsWith('/api/qrcode')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const qrUrl = params.get('url') || `http://${getLocalIP()}:${PORT}?ip=${getLocalIP()}`;
    try {
      const qrBuffer = await QRCode.toBuffer(qrUrl, { type: 'png', width: 400, margin: 2 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
      res.end(qrBuffer);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('QR generation failed');
    }
    return;
  }

  // Stop server API
  if (urlPath === '/api/server/stop' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, message: 'Server stopping...' }));
    // Graceful shutdown after response is sent
    setTimeout(() => {
      console.log('\n⏹ Server stopped via config UI');
      // Unload the launchd service so it doesn't respawn
      try {
        execSync(`launchctl bootout gui/$(id -u)/com.abhishekbedi.tracklink`, { stdio: 'pipe' });
        console.log('  ✓ Launchd service unloaded');
      } catch {
        // Service might not be loaded (running in foreground mode), that's fine
      }
      clearInterval(heartbeatTimer);
      wss.clients.forEach((client) => client.close());
      wss.close();
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000);
    }, 100);
    return;
  }

  // Sessions API
  if (urlPath === '/api/sessions' && req.method === 'GET') {
    const sessions = [];
    for (const [id, sess] of activeSessions) {
      sessions.push({ id, addr: sess.addr, connectedAt: sess.connectedAt });
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ active: sessions.length, max: MAX_CONNECTIONS, sessions }));
    return;
  }

  if (urlPath === '/api/sessions/kick' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.sessionId && activeSessions.has(body.sessionId)) {
        const sess = activeSessions.get(body.sessionId);
        sess.ws.close(4002, 'Kicked by admin');
        activeSessions.delete(body.sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Session not found' }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Serve config page
  if (urlPath === '/config') {
    try {
      const content = await readFile(join(CLIENT_DIR, 'config.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    } catch (err) {
      res.writeHead(404);
      res.end('Config page not found');
      return;
    }
  }

  // Static file serving
  try {
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    const fullPath = join(CLIENT_DIR, filePath);

    // Prevent directory traversal
    if (!fullPath.startsWith(CLIENT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = await readFile(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});

// WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server: httpServer });

// Session management
const MAX_CONNECTIONS = 3;
let sessionCounter = 0;
const activeSessions = new Map(); // sessionId -> { ws, addr, connectedAt }

// Heartbeat to detect dead connections after sleep/wake
const HEARTBEAT_INTERVAL = 10000;

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  const clientAddr = req.socket.remoteAddress;

  // Reject if too many connections
  if (activeSessions.size >= MAX_CONNECTIONS) {
    console.warn(`⚠ Connection rejected from ${clientAddr} — max ${MAX_CONNECTIONS} sessions reached`);
    ws.close(4001, 'Max connections reached');
    return;
  }

  // Create session
  sessionCounter++;
  const sessionId = `session_${sessionCounter}_${Date.now().toString(36)}`;
  activeSessions.set(sessionId, {
    ws,
    addr: clientAddr,
    connectedAt: new Date(),
  });

  console.log(`✓ Client connected: ${clientAddr} [${sessionId}] (${activeSessions.size} active)`);

  // Send session info to client
  ws.send(JSON.stringify({ type: 'session', sessionId, server: 'tracklink' }));

  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (DEBUG && message.type !== 'move') {
        logDebug(`[${sessionId}] raw: ${JSON.stringify(message)}`);
      }
      handleMessage(message);
    } catch (err) {
      console.error('Failed to parse message:', err.message);
      if (DEBUG) console.error('  Raw data:', data.toString().substring(0, 200));
    }
  });

  ws.on('close', () => {
    activeSessions.delete(sessionId);
    console.log(`✗ Client disconnected: ${clientAddr} [${sessionId}] (${activeSessions.size} active)`);
  });

  ws.on('error', (err) => {
    activeSessions.delete(sessionId);
    console.error(`WebSocket error from ${clientAddr} [${sessionId}]:`, err.message);
  });
});

// Ping all clients periodically
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Hot corner detection state
let cornerTriggered = false;
let cornerCooldown = false;
const CORNER_DWELL_THRESHOLD = 8; // consecutive move events at corner before triggering
const CORNER_NAMES = { 1: 'tl', 2: 'tr', 3: 'bl', 4: 'br' };

function checkHotCorner() {
  // Use native addon to get corner state (fast, no shell call)
  if (!platform.getCornerState) return;
  if (cornerCooldown) return; // Don't process during cooldown
  try {
    const state = platform.getCornerState();
    if (state.corner > 0 && state.dwell >= CORNER_DWELL_THRESHOLD && !cornerTriggered) {
      cornerTriggered = true;
      cornerCooldown = true;
      const cornerName = CORNER_NAMES[state.corner];
      const actionKey = `hot_corner_${cornerName}`;
      const action = getAction(actionKey);
      if (action && action !== 'none') {
        logGesture(`hot corner (${cornerName})`, action);
        executeAction(action);
      }
      platform.resetCornerState();
      // Cooldown: ignore moves for 1 second after triggering
      setTimeout(() => { cornerCooldown = false; }, 1000);
    } else if (state.corner === 0) {
      cornerTriggered = false;
    }
  } catch {
    // Corner check failed, ignore
  }
}

// Dispatch messages to platform handler
function handleMessage(msg) {
  switch (msg.type) {
    case 'move': {
      if (cornerCooldown) break; // Don't move cursor during hot corner cooldown
      const dx = (msg.dx || 0) * sensitivity;
      const dy = (msg.dy || 0) * sensitivity;
      platform.moveMouse(dx, dy);
      checkHotCorner();
      logDebug(`move dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
      break;
    }
    case 'click':
      logGesture('click', msg.button || 'left');
      platform.click(msg.button || 'left');
      break;

    case 'scroll': {
      const sx = (msg.dx || 0) * sensitivity;
      const sy = (msg.dy || 0) * sensitivity;
      platform.scroll(sx, sy);
      logDebug(`scroll dx=${sx.toFixed(1)} dy=${sy.toFixed(1)}`);
      break;
    }
    case 'pinch_start':
      // Click at current cursor position to focus the window before zooming
      logDebug('pinch_start — focusing window under cursor');
      platform.click('left');
      break;

    case 'pinch_start':
      // Window focus is handled inside native pinchZoom on first call
      break;

    case 'pinch':
    case 'pinchZoom':
      platform.pinchZoom(msg.scale || 1);
      break;

    case 'page_zoom':
    case 'pageZoom':
      logGesture('page zoom', `scale=${(msg.scale || 1).toFixed(3)}`);
      platform.pageZoom(msg.scale || 1);
      break;

    case 'tap': {
      const gestureKey = `tap_${msg.fingers}`;
      const action = getAction(gestureKey);
      logGesture(`${msg.fingers}-finger tap`, action || 'fallback');
      if (action) {
        executeAction(action);
      } else {
        platform.click(msg.fingers === 2 ? 'right' : msg.fingers === 3 ? 'middle' : 'left');
      }
      break;
    }

    case 'double_tap': {
      const gestureKey = `double_tap_${msg.fingers}`;
      const action = getAction(gestureKey);
      logGesture(`${msg.fingers}-finger double tap`, action || 'fallback');
      if (action) {
        executeAction(action);
      } else {
        // Default: double-click for 1 finger, no-op for others
        if (msg.fingers === 1) {
          platform.click('left');
          platform.click('left');
        }
      }
      break;
    }

    case 'triple_tap': {
      const gestureKey = `triple_tap_${msg.fingers}`;
      const action = getAction(gestureKey);
      logGesture(`${msg.fingers}-finger triple tap`, action || 'fallback');
      if (action) {
        executeAction(action);
      }
      break;
    }

    case 'window_move_start':
      logGesture('window move', 'start');
      // No platform action needed at start — cursor is already positioned
      break;

    case 'window_move': {
      // Move the frontmost window by dx, dy
      const dx = Math.round((msg.dx || 0) * sensitivity);
      const dy = Math.round((msg.dy || 0) * sensitivity);
      logDebug(`window_move dx=${dx} dy=${dy}`);
      try {
        const script = `tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set frontWin to first window of frontApp
          set {x, y} to position of frontWin
          set position of frontWin to {x + ${dx}, y + ${dy}}
        end tell`;
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' });
      } catch (err) {
        logDebug('window_move failed:', err.message);
      }
      break;
    }

    case 'window_move_end':
      logGesture('window move', 'end');
      break;

    case 'swipe': {
      const gestureKey = `swipe_${msg.fingers}_${msg.direction}`;
      const action = getAction(gestureKey);
      logGesture(`${msg.fingers}-finger swipe ${msg.direction}`, action || 'fallback');
      if (action) {
        executeAction(action);
      } else {
        platform.swipe(msg.direction, msg.fingers);
      }
      break;
    }

    case 'drag_start':
    case 'dragStart':
      logGesture('drag', 'start');
      platform.dragStart();
      break;

    case 'drag_move':
    case 'dragMove': {
      const dx = (msg.dx || 0) * sensitivity;
      const dy = (msg.dy || 0) * sensitivity;
      platform.dragMove(dx, dy);
      logDebug(`drag_move dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
      break;
    }
    case 'drag_end':
    case 'dragEnd':
      logGesture('drag', 'end');
      platform.dragEnd();
      break;

    case 'sensitivity':
      sensitivity = msg.value || 1.5;
      logGesture('sensitivity', `${sensitivity}`);
      break;

    default:
      console.warn(`  ⚠ Unknown message type: ${msg.type}`);
  }
}

// Start server
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Kill the existing process: lsof -ti:${PORT} | xargs kill`);
    console.error(`   Then try again: npm start\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}?ip=${ip}`;

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║             TrackLink Server             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`  Config:  http://localhost:${PORT}/config`);
  console.log(`  Platform: ${process.platform}`);
  if (DEBUG) console.log(`  Mode:    🐛 DEBUG (verbose logging)`);
  console.log('');

  // Show QR code in terminal
  QRCode.toString(url, { type: 'terminal', small: true }, (err, qr) => {
    if (err) {
      console.error('Could not generate QR code:', err.message);
    } else {
      console.log('  Scan to connect:\n');
      console.log(qr);
    }
    console.log(`  URL: ${url}`);
    console.log('');
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  clearInterval(heartbeatTimer);
  wss.clients.forEach((client) => client.close());
  wss.close();
  httpServer.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
});
