/**
 * GET /api/health
 * Pings each configured service via its internal Docker hostname.
 * Returns an array of status objects with name, status, and response time.
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

async function pingService(name, url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - start;
    return {
      name,
      status: res.ok || res.status < 500 ? 'up' : 'down',
      responseTime,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      name,
      status: 'down',
      responseTime: Date.now() - start,
      error: err.name === 'AbortError' ? 'Timeout' : err.message,
    };
  }
}

export async function GET() {
  try {
    const config = getConfig();
    const s = config.services || {};

    // List of services to monitor with their health-check URLs
    const checks = [
      { name: 'Miniflux', url: s.miniflux?.internal_url },
      { name: 'Notesnook', url: s.notesnook?.internal_url },
      { name: 'Super Productivity', url: s.super_productivity?.external_url ? `${s.super_productivity.internal_webdav_url || 'http://super-productivity:80'}` : undefined },
      { name: 'Immich', url: s.immich?.internal_url },
      { name: 'Local AI', url: s.open_webui?.internal_url },
      { name: 'Nextcloud', url: s.nextcloud?.internal_url },
      { name: 'Stirling PDF', url: s.stirling?.internal_url },
      { name: 'Homepage', url: s.homepage?.internal_url },
    ].filter(c => c.url);

    const results = await Promise.all(
      checks.map(c => pingService(c.name, c.url))
    );

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: 'Health check failed', detail: err.message },
      { status: 500 }
    );
  }
}
