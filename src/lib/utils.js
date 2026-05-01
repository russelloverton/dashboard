/**
 * Shared utility functions.
 */

/**
 * Format bytes into human-readable string (KB, MB, GB, TB).
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format a date into relative time string (e.g. "2h ago", "3d ago").
 */
export function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Map WMO weather codes to emoji icons.
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
export function weatherCodeToEmoji(code) {
  const map = {
    0: '☀️',   // Clear sky
    1: '🌤️',  // Mainly clear
    2: '⛅',   // Partly cloudy
    3: '☁️',   // Overcast
    45: '🌫️', // Fog
    48: '🌫️', // Depositing rime fog
    51: '🌦️', // Light drizzle
    53: '🌦️', // Moderate drizzle
    55: '🌧️', // Dense drizzle
    56: '🌨️', // Light freezing drizzle
    57: '🌨️', // Dense freezing drizzle
    61: '🌧️', // Slight rain
    63: '🌧️', // Moderate rain
    65: '🌧️', // Heavy rain
    66: '🌨️', // Light freezing rain
    67: '🌨️', // Heavy freezing rain
    71: '❄️',  // Slight snowfall
    73: '❄️',  // Moderate snowfall
    75: '❄️',  // Heavy snowfall
    77: '❄️',  // Snow grains
    80: '🌦️', // Slight rain showers
    81: '🌧️', // Moderate rain showers
    82: '🌧️', // Violent rain showers
    85: '🌨️', // Slight snow showers
    86: '🌨️', // Heavy snow showers
    95: '⛈️',  // Thunderstorm
    96: '⛈️',  // Thunderstorm with slight hail
    99: '⛈️',  // Thunderstorm with heavy hail
  };
  return map[code] || '🌡️';
}

/**
 * Map WMO weather codes to text descriptions.
 */
export function weatherCodeToText(code) {
  const map = {
    0: 'Clear',
    1: 'Mostly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    56: 'Freezing Drizzle',
    57: 'Freezing Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain',
    67: 'Freezing Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm + Hail',
    99: 'Thunderstorm + Hail',
  };
  return map[code] || 'Unknown';
}

/**
 * Format temperature with degree symbol.
 */
export function formatTemp(temp, unit) {
  const symbol = unit === 'celsius' ? '°C' : '°F';
  return `${Math.round(temp)}${symbol}`;
}

/**
 * Format hour from ISO string to display string.
 */
export function formatHour(isoString, format24) {
  const date = new Date(isoString);
  if (format24) {
    return `${date.getHours().toString().padStart(2, '0')}:00`;
  }
  const h = date.getHours();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}${period}`;
}
