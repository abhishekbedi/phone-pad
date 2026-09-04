// Gesture configuration manager — loads gestures.json, provides action lookups,
// handles live-reload on file changes, and manages default/available actions.
import { readFileSync, writeFileSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'gestures.json');

let config = null;

// Default config if file doesn't exist
const DEFAULT_CONFIG = {
  version: 1,
  gestures: {
    tap_1: { action: 'click_left', description: 'Single finger tap' },
    tap_2: { action: 'click_right', description: 'Two finger tap' },
    tap_3: { action: 'click_middle', description: 'Three finger tap' },
    tap_4: { action: 'launchpad', description: 'Four finger tap' },
    double_tap_1: { action: 'double_click', description: 'Single finger double tap' },
    double_tap_2: { action: 'none', description: 'Two finger double tap' },
    triple_tap_1: { action: 'triple_click', description: 'Single finger triple tap' },
    triple_tap_2: { action: 'none', description: 'Two finger triple tap' },
    swipe_3_up: { action: 'mission_control', description: 'Three finger swipe up' },
    swipe_3_down: { action: 'app_expose', description: 'Three finger swipe down' },
    swipe_3_left: { action: 'space_right', description: 'Three finger swipe left' },
    swipe_3_right: { action: 'space_left', description: 'Three finger swipe right' },
    swipe_4_up: { action: 'mission_control', description: 'Four finger swipe up' },
    swipe_4_down: { action: 'show_desktop', description: 'Four finger swipe down' },
    swipe_4_left: { action: 'space_right', description: 'Four finger swipe left' },
    swipe_4_right: { action: 'space_left', description: 'Four finger swipe right' },
    pinch_2: { action: 'zoom', description: 'Two finger pinch zoom' },
    pinch_3: { action: 'page_zoom', description: 'Three finger pinch' },
    hot_corner_tl: { action: 'mission_control', description: 'Cursor pushed to top-left corner' },
    hot_corner_tr: { action: 'notification_center', description: 'Cursor pushed to top-right corner' },
    hot_corner_bl: { action: 'launchpad', description: 'Cursor pushed to bottom-left corner' },
    hot_corner_br: { action: 'show_desktop', description: 'Cursor pushed to bottom-right corner' },
  },
  available_actions: {
    click_left: { name: 'Left Click', category: 'mouse' },
    click_right: { name: 'Right Click', category: 'mouse' },
    click_middle: { name: 'Middle Click', category: 'mouse' },
    double_click: { name: 'Double Click', category: 'mouse' },
    triple_click: { name: 'Triple Click (Select Line)', category: 'mouse' },
    mission_control: { name: 'Mission Control', category: 'system' },
    app_expose: { name: 'App Exposé', category: 'system' },
    show_desktop: { name: 'Show Desktop', category: 'system' },
    launchpad: { name: 'Launchpad', category: 'system' },
    space_left: { name: 'Move Space Left', category: 'spaces' },
    space_right: { name: 'Move Space Right', category: 'spaces' },
    zoom: { name: 'Zoom In/Out', category: 'zoom' },
    page_zoom: { name: 'Page Zoom (Cmd +/-)', category: 'zoom' },
    notification_center: { name: 'Notification Center', category: 'system' },
    screenshot: { name: 'Screenshot', category: 'system' },
    spotlight: { name: 'Spotlight Search', category: 'system' },
    lock_screen: { name: 'Lock Screen', category: 'system' },
    hot_corner_tl: { name: 'Hot Corner (Top-Left)', category: 'hot_corners' },
    hot_corner_tr: { name: 'Hot Corner (Top-Right)', category: 'hot_corners' },
    hot_corner_bl: { name: 'Hot Corner (Bottom-Left)', category: 'hot_corners' },
    hot_corner_br: { name: 'Hot Corner (Bottom-Right)', category: 'hot_corners' },
    none: { name: 'Do Nothing', category: 'other' },
  },
};

function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    config = JSON.parse(raw);
    console.log('✓ Gesture config loaded');
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, create default
      config = DEFAULT_CONFIG;
      saveConfig();
      console.log('✓ Created default gesture config');
    } else {
      console.error('⚠ Failed to load gesture config:', err.message);
      config = DEFAULT_CONFIG;
    }
  }
}

function saveConfig() {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error('⚠ Failed to save gesture config:', err.message);
  }
}

// Load on import
loadConfig();

// Watch for external changes (e.g., user edits the file)
try {
  watchFile(CONFIG_PATH, { interval: 2000 }, () => {
    console.log('↻ Gesture config changed, reloading...');
    loadConfig();
  });
} catch (err) {
  // watchFile not supported, that's okay
}

/**
 * Get the action for a gesture key (e.g., 'tap_2', 'swipe_3_up')
 */
export function getAction(gestureKey) {
  if (!config || !config.gestures || !config.gestures[gestureKey]) {
    return null;
  }
  return config.gestures[gestureKey].action;
}

/**
 * Get the full config object
 */
export function getConfig() {
  return config || DEFAULT_CONFIG;
}

/**
 * Update a gesture mapping and save to disk
 */
export function updateGesture(gestureKey, action) {
  if (!config) config = DEFAULT_CONFIG;
  if (!config.gestures[gestureKey]) {
    return false;
  }
  config.gestures[gestureKey].action = action;
  saveConfig();
  return true;
}

/**
 * Get available actions
 */
export function getAvailableActions() {
  return (config || DEFAULT_CONFIG).available_actions;
}
