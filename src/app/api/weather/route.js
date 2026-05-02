/**
 * GET /api/weather
 * Proxies the Open-Meteo API using coordinates from config.
 * Open-Meteo is free and requires no API key.
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const config = getConfig();
    const weather = config.weather || {};
    
    // Use query params if present, otherwise fallback to config
    const lat = searchParams.get('lat') || weather.latitude || 0;
    const lon = searchParams.get('lon') || weather.longitude || 0;
    const tempUnit = weather.units === 'celsius' ? 'celsius' : 'fahrenheit';
    const windUnit = tempUnit === 'fahrenheit' ? 'mph' : 'kmh';
    const precipUnit = tempUnit === 'fahrenheit' ? 'inch' : 'mm';

    const hourlyParams = [
      'temperature_2m',
      'apparent_temperature',
      'precipitation_probability',
      'weather_code',
      'relative_humidity_2m',
      'wind_speed_10m',
    ].join(',');

    const dailyParams = [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'uv_index_max',
      'wind_speed_10m_max',
      'weather_code',
    ].join(',');

    const currentParams = [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'relative_humidity_2m',
      'wind_speed_10m',
      'uv_index',
      'precipitation',
    ].join(',');

    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&current=${currentParams}` +
      `&hourly=${hourlyParams}` +
      `&daily=${dailyParams}` +
      `&minutely_15=temperature_2m,precipitation_probability` +
      `&temperature_unit=${tempUnit}` +
      `&wind_speed_unit=${windUnit}` +
      `&precipitation_unit=${precipUnit}` +
      `&timezone=auto` +
      `&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Weather data unavailable', detail: err.message },
      { status: 502 }
    );
  }
}
