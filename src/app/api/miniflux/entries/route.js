/**
 * GET /api/miniflux/entries
 * Fetches unread entries from Miniflux API.
 * 
 * Query params:
 *   ?category_id=N  — optional, filter by category
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

export async function GET(request) {
  try {
    const config = getConfig();
    const miniflux = config.services?.miniflux;
    if (!miniflux?.internal_url || !miniflux?.api_key) {
      return NextResponse.json(
        { error: 'Miniflux not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    let url = `${miniflux.internal_url}/v1/entries?status=unread&limit=100&order=published_at&direction=desc`;
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }

    const res = await fetch(url, {
      headers: {
        'X-Auth-Token': miniflux.api_key,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Miniflux API returned ${res.status}`);
    }

    const data = await res.json();

    // Shape the response — only send what the frontend needs
    const entries = (data.entries || []).map(entry => ({
      id: entry.id,
      feed_id: entry.feed_id,
      title: entry.title,
      published_at: entry.published_at,
      feed_title: entry.feed?.title || 'Unknown',
      category_title: entry.feed?.category?.title || 'Uncategorized',
      category_id: entry.feed?.category?.id,
    }));

    return NextResponse.json({
      entries,
      total: data.total || entries.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch entries', detail: err.message },
      { status: 502 }
    );
  }
}
