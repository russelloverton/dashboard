/**
 * GET /api/tasks
 * Fetches Super Productivity task data from WebDAV.
 * 
 * SP syncs its entire app state as a single JSON file (sync-data.json)
 * to a WebDAV server. We fetch that file, parse it, and extract
 * today's tasks with their status and time estimates.
 * 
 * This relies on SP's internal data format which is NOT an official API.
 * If the format changes, this will fail gracefully.
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';
import { gunzipSync } from 'zlib';

export async function GET() {
  try {
    const config = getConfig();
    const sp = config.services?.super_productivity;
    if (!sp?.internal_webdav_url) {
      return NextResponse.json(
        { error: 'Super Productivity WebDAV not configured' },
        { status: 503 }
      );
    }

    const dataFile = sp.data_file || 'sync-data.json';
    const url = `${sp.internal_webdav_url.replace(/\/$/, '')}/${dataFile}`;

    const headers = {};
    if (sp.webdav_username && sp.webdav_password) {
      headers['Authorization'] = 'Basic ' +
        Buffer.from(`${sp.webdav_username}:${sp.webdav_password}`).toString('base64');
    }

    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`WebDAV returned ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());

    let jsonText;
    // SP prefixes compressed data with "pf_C2__" before the gzip bytes
    if (buffer.slice(0, 7).toString() === 'pf_C2__') {
      const compressed = buffer.slice(7);
      jsonText = gunzipSync(compressed).toString('utf8');
    } else {
      jsonText = buffer.toString('utf8');
    }

    let spData;
    try {
      spData = JSON.parse(jsonText);
    } catch {
      throw new Error('Super Productivity data is not valid JSON');
    }

    const tasks = extractTasks(spData);
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: 'Task data unavailable', detail: err.message },
      { status: 502 }
    );
  }
}

/**
 * Extract today's tasks from the SP data structure.
 * 
 * SP stores tasks in a structure like:
 * {
 *   task: {
 *     ids: [...],
 *     entities: { [id]: { title, isDone, timeEstimate, ... } }
 *   }
 * }
 * 
 * We look for tasks scheduled for today or currently in progress.
 */
function extractTasks(data) {
  try {
    // SP might store task data at different paths depending on version
    const taskData = data?.task || data?.tasks;
    if (!taskData) {
      return [];
    }

    const ids = taskData.ids || [];
    const entities = taskData.entities || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const todayTs = today.getTime();
    const todayEndTs = todayEnd.getTime();

    const tasks = [];

    for (const id of ids) {
      const task = entities[id];
      if (!task) continue;

      // Include task if:
      // 1. It's planned for today (plannedAt is today)
      // 2. It's a current task (marked as in-progress/current)
      // 3. It's in today's schedule
      const plannedAt = task.plannedAt;
      const isPlannedToday = plannedAt && plannedAt >= todayTs && plannedAt <= todayEndTs;
      const isInProgress = task.currentSessionId || task._currentSessionId;
      const isDone = task.isDone || false;

      // Also check if task is in today's planned tasks via the worklog
      const isTodayTask = isPlannedToday || isInProgress;

      if (isTodayTask || (!isDone && !task.parentId)) {
        // Only include top-level tasks (no subtasks) unless planned for today
        if (task.parentId && !isPlannedToday) continue;

        tasks.push({
          id: task.id,
          title: task.title || 'Untitled Task',
          isDone: isDone,
          inProgress: !!isInProgress,
          timeEstimate: task.timeEstimate || 0,
          timeSpent: task.timeSpent || task.timeSpentOnDay?.[formatDateKey(today)] || 0,
        });
      }
    }

    // Sort: in-progress first, then not done, then done
    tasks.sort((a, b) => {
      if (a.inProgress !== b.inProgress) return b.inProgress ? 1 : -1;
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return 0;
    });

    return tasks.slice(0, 20); // Limit to 20 tasks
  } catch (err) {
    console.error('[tasks] Failed to parse SP data structure:', err.message);
    return [];
  }
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
