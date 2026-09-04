#!/usr/bin/env node
// Installs the TrackLink launchd service on macOS by substituting the
// placeholders in com.abhishekbedi.tracklink.plist with the current machine's
// node path and project directory, then copying it to ~/Library/LaunchAgents.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, '..');

const nodePath = process.execPath;                 // absolute path to node
const nodeDir = dirname(nodePath);
const templatePath = join(projectDir, 'com.abhishekbedi.tracklink.plist');
const targetDir = join(homedir(), 'Library', 'LaunchAgents');
const targetPath = join(targetDir, 'com.abhishekbedi.tracklink.plist');

const template = readFileSync(templatePath, 'utf8');
const rendered = template
  .replace(/__NODE_PATH__/g, nodePath)
  .replace(/__NODE_DIR__/g, nodeDir)
  .replace(/__PROJECT_DIR__/g, projectDir);

mkdirSync(targetDir, { recursive: true });
writeFileSync(targetPath, rendered);

console.log(`Installed launchd service to ${targetPath}`);
console.log(`  node:    ${nodePath}`);
console.log(`  project: ${projectDir}`);
