/**
 * GET /api/calendar
 * Fetches upcoming events from Nextcloud CalDAV.
 * 
 * Steps:
 * 1. PROPFIND to discover calendars and their colors
 * 2. REPORT with calendar-query for events in the next 7 days
 * 3. Parse iCal responses and return structured event data
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';
import ICAL from 'ical.js';

export async function GET() {
  try {
    const config = getConfig();
    const nc = config.services?.nextcloud;
    if (!nc?.internal_url || !nc?.username || !nc?.app_password) {
      return NextResponse.json(
        { error: 'Nextcloud CalDAV not configured' },
        { status: 503 }
      );
    }

    const baseUrl = nc.internal_url.replace(/\/$/, '');
    const caldavBase = `${baseUrl}/remote.php/dav/calendars/${nc.username}/`;
    const authHeader = 'Basic ' + Buffer.from(`${nc.username}:${nc.app_password}`).toString('base64');

    // Step 1: Discover calendars via PROPFIND
    const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:x="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname />
    <x:calendar-color />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;

    const propRes = await fetch(caldavBase, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1',
      },
      body: propfindBody,
    });

    if (!propRes.ok && propRes.status !== 207) {
      throw new Error(`CalDAV PROPFIND returned ${propRes.status}`);
    }

    const propText = await propRes.text();

    // Parse calendar list from PROPFIND response
    const calendars = parseCalendars(propText, caldavBase);
    const filterNames = nc.calendars || [];

    // Filter calendars if config specifies which ones to show
    const filtered = filterNames.length > 0
      ? calendars.filter(c => filterNames.includes(c.name))
      : calendars;

    // Step 2: Query each calendar for events in the next 7 days
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startStr = formatCalDate(now);
    const endStr = formatCalDate(weekFromNow);

    const allEvents = [];

    for (const cal of filtered) {
      try {
        const events = await queryCalendarEvents(cal, startStr, endStr, authHeader);
        allEvents.push(...events);
      } catch (err) {
        console.error(`[calendar] Failed to query calendar "${cal.name}":`, err.message);
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return NextResponse.json(allEvents);
  } catch (err) {
    return NextResponse.json(
      { error: 'Calendar data unavailable', detail: err.message },
      { status: 502 }
    );
  }
}

/**
 * Parse calendar names, URLs, and colors from PROPFIND XML response.
 */
function parseCalendars(xml, baseUrl) {
  const calendars = [];
  // Simple XML parsing using regex — avoids needing an XML parser dependency
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/gi;
  let match;

  while ((match = responseRegex.exec(xml)) !== null) {
    const block = match[1];

    // Check if this is a calendar (has <d:calendar/> in resourcetype)
    if (!/<c:calendar\s*\/?>|<cal:calendar\s*\/?>/i.test(block) &&
        !/<d:resourcetype>[\s\S]*?calendar[\s\S]*?<\/d:resourcetype>/i.test(block)) {
      continue;
    }

    const hrefMatch = block.match(/<d:href>(.*?)<\/d:href>/i);
    const nameMatch = block.match(/<d:displayname>(.*?)<\/d:displayname>/i);
    const colorMatch = block.match(/<x:calendar-color>(.*?)<\/x:calendar-color>/i) ||
                       block.match(/<calendar-color[^>]*>(.*?)<\/calendar-color>/i);

    if (hrefMatch && nameMatch) {
      const href = hrefMatch[1];
      // Build full URL from href
      const url = href.startsWith('http') ? href : baseUrl.replace(/\/calendars\/.*$/, '') + href;
      calendars.push({
        name: nameMatch[1],
        url: url.replace(/\/$/, '') + '/',
        color: colorMatch ? colorMatch[1].substring(0, 7) : '#6366f1',
      });
    }
  }

  return calendars;
}

/**
 * Query a single calendar for events in a time range using REPORT.
 */
async function queryCalendarEvents(calendar, start, end, authHeader) {
  const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${start}" end="${end}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const res = await fetch(calendar.url, {
    method: 'REPORT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/xml; charset=utf-8',
      'Depth': '1',
    },
    body: reportBody,
  });

  if (!res.ok && res.status !== 207) {
    throw new Error(`CalDAV REPORT returned ${res.status}`);
  }

  const text = await res.text();
  const events = [];

  // Extract calendar-data (iCal) from each response
  const calDataRegex = /<C:calendar-data[^>]*>([\s\S]*?)<\/C:calendar-data>/gi;
  let dataMatch;

  while ((dataMatch = calDataRegex.exec(text)) !== null) {
    try {
      const icalData = dataMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

      const jcal = ICAL.parse(icalData);
      const comp = new ICAL.Component(jcal);
      const vevents = comp.getAllSubcomponents('vevent');

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        
        // Handle recurring events — expand occurrences in our time range
        if (event.isRecurring()) {
          const rangeStart = ICAL.Time.fromDateTimeString(start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
          const rangeEnd = ICAL.Time.fromDateTimeString(end.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
          const iterator = event.iterator();
          let next;
          let count = 0;
          while ((next = iterator.next()) && count < 50) {
            if (next.compare(rangeEnd) > 0) break;
            if (next.compare(rangeStart) >= 0) {
              const duration = event.duration;
              const endTime = next.clone();
              endTime.addDuration(duration);
              events.push({
                title: event.summary || 'Untitled',
                start: next.toJSDate().toISOString(),
                end: endTime.toJSDate().toISOString(),
                calendarName: calendar.name,
                calendarColor: calendar.color,
                allDay: !vevent.getFirstProperty('dtstart')?.getParameter('value') !== 'DATE' && 
                        vevent.getFirstProperty('dtstart')?.type === 'date',
              });
            }
            count++;
          }
        } else {
          events.push({
            title: event.summary || 'Untitled',
            start: event.startDate.toJSDate().toISOString(),
            end: event.endDate.toJSDate().toISOString(),
            calendarName: calendar.name,
            calendarColor: calendar.color,
            allDay: vevent.getFirstProperty('dtstart')?.type === 'date',
          });
        }
      }
    } catch (parseErr) {
      console.error('[calendar] Failed to parse iCal event:', parseErr.message);
    }
  }

  return events;
}

/**
 * Format a JS Date to CalDAV time-range format: YYYYMMDDTHHMMSSZ
 */
function formatCalDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
