/**
 * GET /api/config
 * Returns non-sensitive configuration to the frontend.
 * API keys, passwords, and internal URLs are stripped.
 */

import { NextResponse } from 'next/server';
import { getClientConfig } from '@/lib/config.server';

export async function GET() {
  try {
    const config = getClientConfig();
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}
