import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';

export async function GET(request, { params }) {
  try {
    const config = getConfig();
    const glancesUrl = config.services?.glances?.internal_url || 'http://glances:61208';
    
    // Await params because in Next.js 15+ dynamic params are asynchronous
    const pathParams = await params;
    const path = pathParams.path.join('/');
    
    const res = await fetch(`${glancesUrl}/api/4/${path}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`Glances returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Glances endpoint unavailable', detail: err.message },
      { status: 502 }
    );
  }
}
