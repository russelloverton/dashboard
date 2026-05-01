/**
 * Custom Express server for the dashboard.
 * 
 * Responsibilities:
 * 1. Read config.yaml at startup and store in global.__dashboardConfig
 * 2. Wrap the Next.js request handler
 * 3. Listen on port 3001
 */

const express = require('express');
const next = require('next');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);

// ------------------------------------
// Load config.yaml once at startup
// ------------------------------------
const configPath = path.resolve(process.cwd(), 'config.yaml');

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return yaml.load(raw);
  } catch (err) {
    console.error(`[server] Failed to load config.yaml from ${configPath}:`, err.message);
    console.error('[server] Falling back to empty config. Dashboard will not function correctly.');
    return {};
  }
}

// Store config globally so API routes can access it
// via global.__dashboardConfig without re-reading the file
global.__dashboardConfig = loadConfig();
console.log('[server] Config loaded successfully');

// Watch for config changes and reload (optional hot-reload)
fs.watchFile(configPath, { interval: 5000 }, () => {
  console.log('[server] config.yaml changed, reloading...');
  global.__dashboardConfig = loadConfig();
});

// ------------------------------------
// Start Next.js + Express
// ------------------------------------
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Let Next.js handle all routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[server] Dashboard ready on http://0.0.0.0:${port}`);
  });
}).catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
