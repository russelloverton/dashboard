/**
 * Server-side config access.
 * 
 * In production (custom server), config is in global.__dashboardConfig.
 * In development (next dev), we fall back to reading config.yaml directly.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

let devConfig = null;

export function getConfig() {
  // Custom server sets this at startup
  if (global.__dashboardConfig) {
    return global.__dashboardConfig;
  }

  // Fallback for `next dev` without custom server
  if (!devConfig) {
    try {
      const configPath = path.resolve(process.cwd(), 'config.yaml');
      const raw = fs.readFileSync(configPath, 'utf8');
      devConfig = yaml.load(raw);
    } catch (err) {
      console.error('[config] Failed to load config.yaml:', err.message);
      devConfig = {};
    }
  }

  return devConfig;
}

/**
 * Returns only the non-sensitive config fields
 * safe to send to the browser.
 */
export function getClientConfig() {
  const config = getConfig();
  return {
    dashboard: config.dashboard || {},
    weather: config.weather || {},
    bookmarks: config.bookmarks || [],
    keyboard_shortcuts: config.keyboard_shortcuts || {},
    // Only external URLs — no API keys, no internal URLs, no passwords
    external_urls: {
      nextflux: config.services?.nextflux?.external_url || '',
      open_webui: config.services?.open_webui?.external_url || '',
      open_webui_query_param: config.services?.open_webui?.query_param || '',
      stirling: config.services?.stirling?.external_url || '',
      super_productivity: config.services?.super_productivity?.external_url || '',
    },
  };
}
