import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
    }

    // Use BigDataCloud reverse geocoding API from the server-side to avoid adblockers
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    
    if (!res.ok) {
      throw new Error(`Reverse geocoding API responded with status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Reverse Geocoding Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to reverse geocode' }, { status: 500 });
  }
}
