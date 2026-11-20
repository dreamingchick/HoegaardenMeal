import { WEEKLY_RULESET, weekStart } from './game.mjs';
import { MAX_SCORE_BYTES, scoreName } from './ranking.mjs';
import assets from './public-assets.mjs';

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

async function readScore(request) {
  if (!request.body || Number(request.headers.get('content-length')) > MAX_SCORE_BYTES) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_SCORE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let index = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, index);
      index += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function board(database, week) {
  const { results } = await database.prepare(
    'SELECT name, ticks FROM weekly_scores WHERE week = ? AND ruleset = ? ORDER BY ticks, recorded, player LIMIT 25',
  ).bind(week, WEEKLY_RULESET).all();
  return json({ week, scores: results });
}

async function saveScore(database, request) {
  const data = await readScore(request);
  const week = weekStart();
  const name = scoreName(data, week);
  if (!name) return json({ error: 'invalid-score' }, 400);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.profile));
  const player = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const recorded = Date.now();
  if (week !== weekStart(recorded)) return json({ error: 'week-changed' }, 409);
  const result = await database.prepare(`
    INSERT INTO weekly_scores (week, ruleset, player, name, ticks, recorded)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (week, ruleset, player) DO UPDATE
      SET name = excluded.name, ticks = excluded.ticks, recorded = excluded.recorded
      WHERE excluded.ticks < weekly_scores.ticks
  `).bind(week, WEEKLY_RULESET, player, name, data.ticks, recorded).run();
  return json({ improved: result.meta.changes > 0 });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;
    try {
      if (method === 'GET' && pathname === '/api/board') return await board(env.SCORES, weekStart());
      if (method === 'POST' && pathname === '/api/score') return await saveScore(env.SCORES, request);
      const asset = assets[pathname === '/' ? '/index.html' : pathname];
      if (!asset || (method !== 'GET' && method !== 'HEAD')) return json({ error: 'not-found' }, 404);
      const [type, content] = asset;
      const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
      return new Response(method === 'HEAD' ? null : bytes, {
        headers: {
          'content-type': type,
          'content-length': String(bytes.length),
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (error) {
      console.error(error);
      return json({ error: 'server-error' }, 500);
    }
  },
};
