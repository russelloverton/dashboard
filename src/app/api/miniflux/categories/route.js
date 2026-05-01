/**
 * GET /api/miniflux/categories
 * Fetches the list of categories from Miniflux API.
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

export async function GET() {
  try {
    const config = getConfig();
    const miniflux = config.services?.miniflux;
    if (!miniflux?.internal_url || !miniflux?.api_key) {
      return NextResponse.json(
        { error: 'Miniflux not configured' },
        { status: 503 }
      );
    }

    const res = await fetch(`${miniflux.internal_url}/v1/categories`, {
      headers: {
        'X-Auth-Token': miniflux.api_key,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Miniflux API returned ${res.status}`);
    }

    const categories = await res.json();
    return NextResponse.json(categories);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch categories', detail: err.message },
      { status: 502 }
    );
  }
}
