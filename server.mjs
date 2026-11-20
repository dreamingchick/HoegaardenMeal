import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WEEKLY_RULESET, weekStart } from './game.mjs';
import { MAX_SCORE_BYTES, scoreName } from './ranking.mjs';

const root = new URL('./', import.meta.url);
const scoreFile = process.env.HOEGAARDEN_SCORES_PATH || fileURLToPath(new URL('./.weekly-scores.json', root));
const files = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'],
  ...['game', 'paint', 'play'].map((name) => ['/' + name + '.mjs', name + '.mjs']),
  ...['hairdresser', 'carrying', 'chef', 'chef-back', 'walk-side', 'walk-up', 'walk-down', 'carry-side', 'carry-up', 'carry-down',
    'guest-rabbit', 'guest-chipmunk', 'guest-mouse']
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
const scoreKey = (week) => week + ':v' + WEEKLY_RULESET;
function board(week) {
  return Object.values(scores[scoreKey(week)] || {})
    .sort((a, b) => a.ticks - b.ticks || a.recorded - b.recorded)
    .slice(0, 25).map(({ name, ticks }) => ({ name, ticks }));
}
async function parse(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_SCORE_BYTES) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}
function persist(week, player, name, ticks) {
  const job = writes.then(async () => {
    if (week !== weekStart()) return null;
    const key = scoreKey(week);
    const prior = scores[key]?.[player];
    if (prior && prior.ticks <= ticks) return false;
    const updated = { ...scores, [key]: { ...scores[key], [player]: { name, ticks, recorded: Date.now() } } };
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
    const week = weekStart();
    const name = scoreName(data, week);
    if (!name) return json(res, 400, { error: 'invalid-score' });
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
