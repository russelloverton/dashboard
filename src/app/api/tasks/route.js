/**
 * /api/tasks
 * 
 * GET  — Fetch all tasks from Super Productivity's WebDAV sync file.
 * PATCH — Toggle a task's isDone status.
 * POST — Create a new task (supports SP short syntax).
 * 
 * SP syncs its entire app state as a single JSON file (sync-data.json)
 * to a WebDAV server. We fetch that file, parse it, mutate it in memory,
 * and PUT it back for write operations (PATCH/POST).
 * 
 * Short syntax:
 *   "Buy groceries 30m +Personal #errand"
 *   → title: "Buy groceries"
 *   → timeEstimate: 1800000 (30 min in ms)
 *   → project: "Personal"
 *   → tags: ["errand"]
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config.server';
import { gunzipSync, gzipSync } from 'zlib';

// ── Helpers ──

function getSPConfig() {
  const config = getConfig();
  const sp = config.services?.super_productivity;
  if (!sp?.internal_webdav_url) return null;
  const dataFile = sp.data_file || 'sync-data.json';
  const url = `${sp.internal_webdav_url.replace(/\/$/, '')}/${dataFile}`;
  const headers = {};
  if (sp.webdav_username && sp.webdav_password) {
    headers['Authorization'] = 'Basic ' +
      Buffer.from(`${sp.webdav_username}:${sp.webdav_password}`).toString('base64');
  }
  return { url, headers };
}

async function fetchSPData(url, headers) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`WebDAV returned ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  let jsonText;
  // SP prefixes compressed data with "pf_C2__" before the gzip bytes
  if (buffer.slice(0, 7).toString() === 'pf_C2__') {
    const b64 = buffer.slice(7).toString('utf8');
    const compressed = Buffer.from(b64, 'base64');
    jsonText = gunzipSync(compressed).toString('utf8');
  } else {
    jsonText = buffer.toString('utf8');
  }

  return JSON.parse(jsonText);
}

async function writeSPData(url, headers, spData) {
  // Update lastChange so SP treats this file as the authoritative state on next sync
  spData.lastChange = Date.now();
  if (spData.state) spData.state.lastChange = Date.now();

  const jsonText = JSON.stringify(spData);
  const compressed = gzipSync(Buffer.from(jsonText, 'utf8'));
  const b64 = compressed.toString('base64');
  const body = 'pf_C2__' + b64;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!res.ok) throw new Error(`WebDAV PUT returned ${res.status}`);
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse SP short syntax from a raw input string.
 * Returns { title, projectName, tags, timeEstimateMs }
 * 
 * Examples:
 *   "Buy groceries 30m +Personal #errand @tomorrow"
 *   "Write paper 1h30m +School #homework @next thursday"
 *   "Submit form @5/12"
 *   "Clean desk"
 */
function parseShortSyntax(raw) {
  let remaining = raw.trim();
  let projectName = null;
  const tags = [];
  let timeEstimateMs = 0;
  let plannedAt = null;

  // Extract @date expressions (must come before other parsing since they can have spaces like "@next thursday")
  // Multi-word: @next monday, @next tuesday, etc.
  const nextDayMatch = remaining.match(/@next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (nextDayMatch) {
    plannedAt = resolveNextWeekday(nextDayMatch[1], true);
    remaining = remaining.replace(nextDayMatch[0], '').trim();
  }

  if (!plannedAt) {
    // Single-word @tokens
    const dateTokenMatch = remaining.match(/@(\S+)/);
    if (dateTokenMatch) {
      const token = dateTokenMatch[1].toLowerCase();
      const resolved = resolveDateToken(token);
      if (resolved) {
        plannedAt = resolved;
        remaining = remaining.replace(dateTokenMatch[0], '').trim();
      }
    }
  }

  // Extract +ProjectName (project can have spaces if quoted: +"My Project")
  const projectMatch = remaining.match(/\+\"([^\"]+)\"/);
  if (projectMatch) {
    projectName = projectMatch[1];
    remaining = remaining.replace(projectMatch[0], '').trim();
  } else {
    const simpleProjectMatch = remaining.match(/\+(\S+)/);
    if (simpleProjectMatch) {
      projectName = simpleProjectMatch[1];
      remaining = remaining.replace(simpleProjectMatch[0], '').trim();
    }
  }

  // Extract #tags
  const tagMatches = remaining.matchAll(/#(\S+)/g);
  for (const m of tagMatches) {
    tags.push(m[1]);
  }
  remaining = remaining.replace(/#\S+/g, '').trim();

  // Extract time estimate (e.g. "1h30m", "45m", "2h", "1h/2h" for spent/estimate)
  // We only care about the estimate part
  const timeMatch = remaining.match(/(?:(\d+)h\/?(\d+)h|(\d+)h(\d+)m|(\d+)h|(\d+)m)/);
  if (timeMatch) {
    if (timeMatch[2]) {
      // "1h/2h" format — second value is estimate
      timeEstimateMs = parseInt(timeMatch[2]) * 3600000;
    } else if (timeMatch[3] && timeMatch[4]) {
      // "1h30m"
      timeEstimateMs = parseInt(timeMatch[3]) * 3600000 + parseInt(timeMatch[4]) * 60000;
    } else if (timeMatch[5]) {
      // "2h"
      timeEstimateMs = parseInt(timeMatch[5]) * 3600000;
    } else if (timeMatch[6]) {
      // "45m"
      timeEstimateMs = parseInt(timeMatch[6]) * 60000;
    }
    remaining = remaining.replace(timeMatch[0], '').trim();
  }

  return {
    title: remaining || raw.trim(),
    projectName,
    tags,
    timeEstimateMs,
    plannedAt,
  };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Resolve a single-word @token to a timestamp.
 * Supports: today, tomorrow, weekday names, M/D dates
 */
function resolveDateToken(token) {
  const now = new Date();
  now.setHours(9, 0, 0, 0); // Default to 9 AM

  if (token === 'today') return now.getTime();
  if (token === 'tomorrow') {
    now.setDate(now.getDate() + 1);
    return now.getTime();
  }

  // Weekday names (next occurrence, could be this week or next)
  const dayIndex = WEEKDAYS.indexOf(token);
  if (dayIndex !== -1) {
    return resolveNextWeekday(token, false);
  }

  // M/D or MM/DD format
  const slashMatch = token.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1;
    const day = parseInt(slashMatch[2]);
    const target = new Date(now.getFullYear(), month, day, 9, 0, 0);
    // If the date is in the past, assume next year
    if (target < new Date()) {
      target.setFullYear(target.getFullYear() + 1);
    }
    return target.getTime();
  }

  return null; // Unrecognized — don't consume the token
}

/**
 * Get the timestamp for the next occurrence of a weekday.
 * @param {string} dayName — e.g. "monday"
 * @param {boolean} forceNextWeek — if true, always skip to next week
 */
function resolveNextWeekday(dayName, forceNextWeek) {
  const target = WEEKDAYS.indexOf(dayName.toLowerCase());
  if (target === -1) return null;

  const now = new Date();
  now.setHours(9, 0, 0, 0);
  const current = now.getDay();
  let diff = target - current;
  if (diff <= 0 || forceNextWeek) diff += 7;
  if (forceNextWeek && diff <= 7) diff += 7 - 7; // already added 7 above
  now.setDate(now.getDate() + diff);
  return now.getTime();
}

/**
 * Extract projects from SP data.
 * Returns a map of { id -> name } and an array for the client.
 */
function extractProjects(data) {
  const projData = data?.state?.project || data?.project;
  if (!projData?.ids || !projData?.entities) return { map: {}, list: [] };

  const map = {};
  const list = [];
  for (const id of projData.ids) {
    const p = projData.entities[id];
    if (p) {
      map[id] = p.title || id;
      list.push({ id, name: p.title || id });
    }
  }
  return { map, list };
}

/**
 * Extract tasks from the SP data structure.
 * Returns all non-subtask tasks, sorted by due date then status.
 */
function extractTasks(data, projectMap) {
  try {
    const taskData = data?.state?.task || data?.task || data?.tasks;
    if (!taskData) return [];

    const ids = taskData.ids || [];
    const entities = taskData.entities || {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = [];

    for (const id of ids) {
      const task = entities[id];
      if (!task) continue;
      // Skip subtasks
      if (task.parentId) continue;

      const isDone = task.isDone || false;
      const plannedAt = task.plannedAt || null;
      const isInProgress = !!(task.currentSessionId || task._currentSessionId);

      tasks.push({
        id: task.id,
        title: task.title || 'Untitled Task',
        isDone,
        inProgress: isInProgress,
        plannedAt,
        projectId: task.projectId || null,
        projectName: projectMap[task.projectId] || null,
        timeEstimate: task.timeEstimate || 0,
        timeSpent: task.timeSpent || task.timeSpentOnDay?.[formatDateKey(today)] || 0,
      });
    }

    // Sort: in-progress first, then undone before done,
    // then by planned date (soonest first, null last)
    tasks.sort((a, b) => {
      if (a.inProgress !== b.inProgress) return b.inProgress ? 1 : -1;
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      const aDate = a.plannedAt || Infinity;
      const bDate = b.plannedAt || Infinity;
      return aDate - bDate;
    });

    return tasks;
  } catch (err) {
    console.error('[tasks] Failed to parse SP data structure:', err.message);
    return [];
  }
}

// ── GET: Fetch all tasks ──

export async function GET() {
  try {
    const sp = getSPConfig();
    if (!sp) {
      return NextResponse.json(
        { error: 'Super Productivity WebDAV not configured' },
        { status: 503 }
      );
    }

    const spData = await fetchSPData(sp.url, sp.headers);
    const { map: projectMap, list: projects } = extractProjects(spData);
    const tasks = extractTasks(spData, projectMap);
    return NextResponse.json({ tasks, projects });
  } catch (err) {
    return NextResponse.json(
      { error: 'Task data unavailable', detail: err.message },
      { status: 502 }
    );
  }
}

// ── PATCH: Toggle task done status ──

export async function PATCH(request) {
  try {
    const sp = getSPConfig();
    if (!sp) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { id, isDone } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

    const spData = await fetchSPData(sp.url, sp.headers);
    const taskData = spData?.state?.task || spData?.task || spData?.tasks;
    if (!taskData?.entities?.[id]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    taskData.entities[id].isDone = isDone;
    if (isDone) {
      taskData.entities[id].doneOn = Date.now();
    } else {
      taskData.entities[id].doneOn = null;
    }

    await writeSPData(sp.url, sp.headers, spData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update task', detail: err.message },
      { status: 500 }
    );
  }
}

// ── POST: Create a new task (supports SP short syntax) ──

export async function POST(request) {
  try {
    const sp = getSPConfig();
    if (!sp) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { raw } = await request.json();
    if (!raw?.trim()) return NextResponse.json({ error: 'Missing task text' }, { status: 400 });

    const { title, projectName, tags, timeEstimateMs, plannedAt } = parseShortSyntax(raw);

    const spData = await fetchSPData(sp.url, sp.headers);
    const taskData = spData?.state?.task || spData?.task || spData?.tasks;
    if (!taskData) {
      return NextResponse.json({ error: 'Cannot locate task store' }, { status: 500 });
    }

    // Resolve project by name (case-insensitive fuzzy match)
    const projectData = spData?.state?.project || spData?.project;
    let resolvedProjectId = projectData?.ids?.[0] || 'DEFAULT';

    if (projectName && projectData?.entities) {
      const lowerName = projectName.toLowerCase();
      const match = Object.entries(projectData.entities).find(([, p]) =>
        p.title?.toLowerCase() === lowerName
      );
      if (match) {
        resolvedProjectId = match[0];
      } else {
        // Partial match
        const partial = Object.entries(projectData.entities).find(([, p]) =>
          p.title?.toLowerCase().startsWith(lowerName)
        );
        if (partial) resolvedProjectId = partial[0];
      }
    }

    // Resolve tag IDs
    const tagData = spData?.state?.tag || spData?.tag;
    const resolvedTagIds = [];
    if (tags.length > 0 && tagData?.entities) {
      for (const tagName of tags) {
        const lowerTag = tagName.toLowerCase();
        const match = Object.entries(tagData.entities).find(([, t]) =>
          t.name?.toLowerCase() === lowerTag
        );
        if (match) resolvedTagIds.push(match[0]);
      }
    }

    // Generate a unique ID in SP format
    const newId = `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newTask = {
      id: newId,
      title,
      isDone: false,
      inProgress: false,
      plannedAt: plannedAt || null,
      projectId: resolvedProjectId,
      parentId: null,
      subTaskIds: [],
      timeEstimate: timeEstimateMs,
      timeSpent: 0,
      timeSpentOnDay: {},
      created: Date.now(),
      doneOn: null,
      notes: '',
      tagIds: resolvedTagIds,
      issueId: null,
      issueType: null,
    };

    // Insert into entities and ids
    taskData.entities[newId] = newTask;
    taskData.ids.push(newId);

    // Also add to the project's taskIds
    if (projectData?.entities?.[resolvedProjectId]) {
      if (!projectData.entities[resolvedProjectId].taskIds) {
        projectData.entities[resolvedProjectId].taskIds = [];
      }
      projectData.entities[resolvedProjectId].taskIds.push(newId);
    }

    await writeSPData(sp.url, sp.headers, spData);
    return NextResponse.json({ ok: true, id: newId, parsed: { title, projectName, tags, timeEstimateMs, plannedAt } });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create task', detail: err.message },
      { status: 500 }
    );
  }
}
