import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { HZ, advance, giveOrder, makeGame, weekStart, weeklyScenario } from './game.mjs';

const root = new URL('./', import.meta.url);
const scoreFile = process.env.HOEGAARDEN_SCORES_PATH || fileURLToPath(new URL('./.weekly-scores.json', root));
const files = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'],
  ...['game', 'paint', 'play'].map((name) => ['/' + name + '.mjs', name + '.mjs']),
  ...['hairdresser', 'carrying', 'chef', 'chef-back', 'walk-side', 'walk-up', 'walk-down', 'carry-side', 'carry-up', 'carry-down']
    .map((name) => ['/assets/' + name + '.webp', 'assets/' + name + '.webp']),
]);
const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', mjs: 'text/javascript; charset=utf-8', webp: 'image/webp' };
let scores;
try {
  scores = JSON.parse(await readFile(scoreFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  scores = {};
}
let writes = Promise.resolve();

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function board(week) {
  return Object.values(scores[week] || {})
    .sort((a, b) => a.ticks - b.ticks || a.recorded - b.recorded)
    .slice(0, 25).map(({ name, ticks }) => ({ name, ticks }));
}
async function parse(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128_000) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
function verify({ week, ticks, controls }) {
  // Bound submission work. The game itself has no countdown.
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > HZ * 3600
    || !Array.isArray(controls) || controls.length < 1 || controls.length > 3500) return false;
  const replay = makeGame(weeklyScenario(week));
  let last = -1;
  for (const input of controls) {
    if (!Array.isArray(input) || input.length !== 2) return false;
    const [at, action] = input;
    if (!Number.isInteger(at) || at <= last || at >= ticks) return false;
    while (replay.tick < at && ['playing', 'returning'].includes(replay.mode)) advance(replay);
    if (!giveOrder(replay, action)) return false;
    last = at;
  }
  while (replay.tick < ticks && ['playing', 'returning'].includes(replay.mode)) advance(replay);
  return replay.mode === 'won' && replay.tick === ticks;
}
function persist(week, player, name, ticks) {
  const job = writes.then(async () => {
    if (week !== weekStart()) return null;
    const prior = scores[week]?.[player];
    if (prior && prior.ticks <= ticks) return false;
    const updated = { ...scores, [week]: { ...scores[week], [player]: { name, ticks, recorded: Date.now() } } };
    const temp = scoreFile + '.tmp';
    await writeFile(temp, JSON.stringify(updated), { mode: 0o600 });
    await rename(temp, scoreFile);
    scores = updated;
    return true;
  });
  writes = job.catch(() => {});
  return job;
}
async function handle(req, res) {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && route === '/api/board') {
    const week = weekStart();
    return json(res, 200, { week, scores: board(week) });
  }
  if (req.method === 'POST' && route === '/api/score') {
    const data = await parse(req);
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    const week = weekStart();
    if (!data || !name || Array.from(name).length > 16 || /[\p{C}\p{Zl}\p{Zp}]/u.test(name)
      || typeof data.profile !== 'string' || !/^[a-f0-9-]{32,36}$/i.test(data.profile) || data.week !== week || !verify(data)) {
      return json(res, 400, { error: 'invalid-score' });
    }
    const player = createHash('sha256').update(data.profile).digest('hex');
    const improved = await persist(week, player, name, data.ticks);
    if (improved === null) return json(res, 409, { error: 'week-changed' });
    return json(res, 200, { improved });
  }
  const file = files.get(route);
  if (!file || !['GET', 'HEAD'].includes(req.method)) return json(res, 404, { error: 'not-found' });
  const buffer = await readFile(new URL(file, root));
  res.writeHead(200, { 'content-type': mime[file.split('.').at(-1)], 'content-length': buffer.length });
  res.end(req.method === 'HEAD' ? undefined : buffer);
}
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'server-error' });
    else res.destroy();
  });
}).listen(port, host, () => console.log('http://' + host + ':' + port));
