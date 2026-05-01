/**
 * GET /api/immich
 * Fetches server statistics from Immich API.
 * Immich has no Cloudflare Tunnel — all requests go through this proxy.
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

export async function GET() {
  try {
    const config = getConfig();
    const immich = config.services?.immich;
    if (!immich?.internal_url || !immich?.api_key) {
      return NextResponse.json(
        { error: 'Immich not configured' },
        { status: 503 }
      );
    }

    const url = `${immich.internal_url}/api/server/statistics`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': immich.api_key,
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Immich API returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      photos: data.photos || 0,
      videos: data.videos || 0,
      usage: data.usage || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Immich data unavailable', detail: err.message },
      { status: 502 }
    );
  }
}
