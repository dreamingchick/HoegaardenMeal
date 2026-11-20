import { WIDTH, HEIGHT, HZ, makeGame, advance, giveOrder, targetAt, weekStart, weeklyScenario, cluePosition } from './game.mjs';
import { draw } from './paint.mjs';

const byId = (id) => document.getElementById(id);
const canvas = byId('map');
const portrait = matchMedia('(orientation: portrait)');
const tickMs = 1000 / HZ;
const api = './api/';
const prefix = 'hoegaarden-meal:';
function read(key) {
  try { return localStorage.getItem(prefix + key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(prefix + key, value); } catch { /* Play is available without storage. */ }
}
const profile = read('profile') || (globalThis.crypto?.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join(''));
save('profile', profile);
let scene = 'menu';
let game;
let kind;
let tutorial = false;
let guides = new Set();
let scenario;
let controls;
let activeWeek;
let boardOnline = false;
let rankedAttempt = false;
let viewVersion = 0;
let cursor;
let previousHide;
let owed = 0;
let previousFrame = 0;

function visible(id, flag = true) { byId(id).hidden = !flag; }
function copy(id, content) {
  const node = byId(id);
  if (node.textContent !== content) node.textContent = content;
}
function format(ticks) {
  const centiseconds = Math.floor(ticks * 100 / HZ);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = String(Math.floor(centiseconds / 100) % 60).padStart(2, '0');
  return minutes + ':' + seconds + '.' + String(centiseconds % 100).padStart(2, '0');
}
function showScene(next) {
  viewVersion++;
  scene = next;
  for (const name of ['menu', 'guide', 'result', 'board']) visible(name, name === next);
}
function home() {
  game = null;
  cursor = null;
  showScene('menu');
}
function randomIndex(count) { return Math.floor(Math.random() * count); }
function pickNormal() {
  if (tutorial) return { hide: 1, clue: 0, offset: 95 };
  const choices = [0, 1, 2].filter((index) => index !== previousHide);
  previousHide = choices[randomIndex(choices.length)];
  return { hide: previousHide, clue: randomIndex(3), offset: randomIndex(420) };
}
function start(mode) {
  kind = mode;
  tutorial = mode === 'normal' && !read('tutorial');
  if (mode === 'weekly') activeWeek ??= weekStart();
  scenario = mode === 'weekly' ? weeklyScenario(activeWeek) : pickNormal();
  rankedAttempt = mode === 'weekly' && boardOnline;
  controls = [];
  guides = new Set();
  game = makeGame(scenario);
  owed = 0;
  cursor = null;
  showScene('game');
  if (tutorial) guide('move', '손님인 척 가게에 들어왔어요', '가고 싶은 바닥을 눌러 보세요. 호가든이 그곳으로 걸어갑니다.');
}
function guide(id, title, description) {
  guides.add(id);
  copy('guideTitle', title);
  copy('guideBody', description);
  showScene('guide');
  byId('guideNext').focus();
}
function guideNearPlayer() {
  if (!tutorial || scene !== 'game' || game.mode !== 'playing') return;
  const p = game.player;
  const [x, y] = cluePosition(game);
  if (!game.seenClue && !guides.has('clue') && Math.hypot(x - p.x, y - p.y) < 2.5) {
    guide('clue', '바닥에 수상한 흔적이 있어요', '동그라미 안의 흔적을 누르면 가까이 가서 조사합니다. 버너를 집으려면 먼저 이 흔적을 확인해야 해요.');
  } else if (!guides.has('danger') && p.x > 8.5) {
    guide('danger', '주방과 창고는 손님 출입 금지', '베짱이의 시야가 바닥에 표시됩니다. 의심 게이지가 다 차기 전에 시야를 벗어나세요. 주문이 몰리면 베짱이가 화로에 오래 머물러요.');
  }
}
function finish() {
  showScene('result');
  const won = game.mode === 'won';
  byId('result').dataset.won = String(won);
  if (won && tutorial) {
    save('tutorial', '1');
    previousHide = scenario.hide;
  }
  copy('resultTitle', won ? '드디어, 따뜻한 한 끼!' : '오늘은 찬밥입니다');
  copy('resultText', won
    ? (game.caught ? '“손님, 아까 꼬치는 두고 가셨어요!”' : '“이 한 숟갈이 먹고 싶었다니까.”')
    : '“손님, 이번엔 정말 나가 주셔야겠어요.”');
  copy('resultTime', won ? format(game.tick) : '');
  visible('resultTime', won);
  visible('scoreForm', won && rankedAttempt);
  visible('scoreStatus', won && kind === 'weekly' && !rankedAttempt);
  if (!rankedAttempt) copy('scoreStatus', '연습 기록은 온라인 순위표에 등록되지 않습니다.');
  byId('nickname').value = read('nickname') || '';
  byId('retry').focus();
}
function renderHud() {
  const show = !!game && scene !== 'board';
  visible('clock', show && kind === 'weekly');
  if (show && kind === 'weekly') copy('clock', format(game.tick));
  visible('warning', show && game.caught === 1);
  copy('phase', !show ? '버너 찾기' : game.carrying ? '미용실로 귀환' : game.seenClue ? '버너 찾기' : '흔적 조사');
  const running = scene === 'game' && game?.mode === 'playing';
  visible('rush', running && game.rush);
  visible('danger', running && game.suspicion > 0);
  if (running) byId('meter').value = game.suspicion;
  const currentNotice = running && game.notice && game.tick < game.noticeUntil;
  visible('notice', !!currentNotice);
  if (currentNotice) copy('notice', game.notice);
}
function frame(now) {
  const elapsed = Math.min(140, now - (previousFrame || now));
  previousFrame = now;
  if (scene === 'game') {
    owed += elapsed;
    while (scene === 'game' && owed >= tickMs) {
      owed -= tickMs;
      advance(game);
      guideNearPlayer();
      if (game.mode === 'won' || game.mode === 'lost') finish();
    }
  } else owed = 0;
  draw(canvas, game, scene === 'menu' || scene === 'board', cursor);
  renderHud();
  requestAnimationFrame(frame);
}
function issue(x, y) {
  if (scene !== 'game' || game.mode !== 'playing') return;
  const order = targetAt(game, x, y);
  if (!giveOrder(game, order) || kind !== 'weekly') return;
  const event = [game.tick, order];
  if (controls.at(-1)?.[0] === game.tick) controls[controls.length - 1] = event;
  else controls.push(event);
}
canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const across = (event.clientX - bounds.left) / bounds.width;
  const down = (event.clientY - bounds.top) / bounds.height;
  // The stage turns clockwise in a portrait viewport, so undo that turn for taps.
  const [x, y] = portrait.matches ? [down, 1 - across] : [across, down];
  cursor = null;
  issue(x * WIDTH - 0.5, y * HEIGHT - 0.5);
});
canvas.addEventListener('keydown', (event) => {
  if (scene !== 'game') return;
  const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    cursor ??= [Math.round(game.player.x), Math.round(game.player.y)];
    cursor = cursor.map((value, index) => Math.min((index ? HEIGHT : WIDTH) - 1, Math.max(0, value + direction[index])));
  } else if (event.key === 'Enter' && cursor) issue(...cursor);
});

async function request(path, options) {
  const response = await fetch(api + path, { ...options, signal: AbortSignal.timeout(3800) });
  if (!response.ok) throw new Error('기록 서버 응답 오류');
  return response.json();
}
async function openBoard() {
  game = null;
  showScene('board');
  const version = viewVersion;
  activeWeek = weekStart();
  boardOnline = false;
  copy('weekLabel', activeWeek + ' 시작');
  copy('boardStatus', '이번 주 순위표를 불러오는 중입니다.');
  byId('scores').replaceChildren();
  byId('weeklyStart').disabled = true;
  try {
    const data = await request('board');
    if (viewVersion !== version) return;
    activeWeek = data.week;
    boardOnline = true;
    copy('weekLabel', activeWeek + ' 시작');
    for (const row of data.scores) {
      const item = document.createElement('li');
      item.textContent = row.name + ' · ' + format(row.ticks);
      byId('scores').append(item);
    }
    copy('boardStatus', data.scores.length ? '' : '이번 주 첫 기록에 도전해 보세요.');
  } catch {
    if (viewVersion === version) copy('boardStatus', '기록 서버에 연결되지 않았습니다. 이번 주 문제는 연습할 수 있습니다.');
  } finally {
    if (viewVersion === version) byId('weeklyStart').disabled = false;
  }
}
byId('scoreForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = byId('nickname').value.trim();
  if (!name) return;
  const button = event.submitter;
  const version = viewVersion;
  button.disabled = true;
  try {
    const result = await request('score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, profile, week: activeWeek, ticks: game.tick, controls }),
    });
    save('nickname', name);
    if (viewVersion !== version) return;
    visible('scoreForm', false);
    visible('scoreStatus');
    copy('scoreStatus', result.improved ? '이번 주 기록을 등록했습니다.' : '이번 주 최고 기록이 이미 등록되어 있습니다.');
  } catch {
    if (viewVersion === version) {
      visible('scoreStatus');
      copy('scoreStatus', activeWeek !== weekStart()
        ? '새 주가 시작되었습니다. 새 기록전에서 다시 도전해 주세요.'
        : '기록을 등록하지 못했습니다. 다시 눌러 주세요.');
    }
  } finally {
    button.disabled = false;
  }
});
byId('normal').onclick = () => start('normal');
byId('weekly').onclick = openBoard;
byId('weeklyStart').onclick = () => start('weekly');
byId('boardBack').onclick = home;
byId('home').onclick = home;
byId('back').onclick = home;
byId('retry').onclick = () => {
  if (kind === 'weekly' && activeWeek !== weekStart()) openBoard();
  else start(kind);
};
byId('guideNext').onclick = () => {
  showScene('game');
  canvas.focus();
};
requestAnimationFrame(frame);
