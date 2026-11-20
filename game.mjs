export const WIDTH = 30;
export const HEIGHT = 15;
export const HZ = 60;
export const SEAT = [5, 8];
const EXIT = [3, 14];
export const RETURN_TICKS = 105;
export const WEEKLY_RULESET = 3;
export const HIDES = [
  { x: 15, y: 3, name: '밀가루 보관함', hint: '밀가루 자국이 주방의 하얀 보관함 아래에서 끊겨 있다.' },
  { x: 26, y: 4, name: '바퀴 선반', hint: '나란히 난 바퀴 자국이 창고 위쪽의 바퀴 선반까지 이어진다.' },
  { x: 26, y: 11, name: '빨간 상자', hint: '빨간 페인트 조각이 창고 아래쪽 상자 앞에 떨어져 있다.' },
];
const CLUES = [[8, 4], [8, 10], [12, 10]];
export const FIXTURES = [
  { x: 3, y: 3, w: 4, h: 2, type: 'table' },
  { x: 3, y: 6, w: 3, h: 1, type: 'table' },
  { x: 6, y: 9, w: 2, h: 2, type: 'table' },
  { x: 11, y: 3, w: 3, h: 1, type: 'counter' },
  { x: 18, y: 3, w: 3, h: 1, type: 'grill' },
  { x: 13, y: 6, w: 7, h: 2, type: 'shelf' },
  { x: 24, y: 6, w: 3, h: 2, type: 'shelf' },
  ...HIDES.map((hide, id) => ({ ...hide, id, w: 1, h: 1, type: 'hide' })),
];
const WALLS = new Set();
const key = (x, y) => y * WIDTH + x;
for (let x = 0; x < WIDTH; x++) {
  WALLS.add(key(x, 1));
  if (x !== EXIT[0]) WALLS.add(key(x, 13));
}
for (let y = 2; y <= 12; y++) {
  WALLS.add(key(0, y));
  WALLS.add(key(WIDTH - 1, y));
  if (![4, 5, 10, 11].includes(y)) {
    WALLS.add(key(10, y));
    WALLS.add(key(22, y));
  }
}
export const wallAt = (x, y) => WALLS.has(key(x, y));
const BLOCKED = new Set(WALLS);
for (const { x, y, w, h } of FIXTURES) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) BLOCKED.add(key(col, row));
  }
}
export function walkable(x, y) {
  if (y >= 13) return x === EXIT[0] && y < HEIGHT;
  return x > 0 && x < WIDTH - 1 && y >= 2 && !BLOCKED.has(key(x, y));
}
const neighbors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function pathTo(startX, startY, targets) {
  const first = key(startX, startY);
  const seen = new Map([[first, null]]);
  const queue = [first];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const x = current % WIDTH;
    const y = Math.floor(current / WIDTH);
    if (targets.has(current)) {
      const path = [];
      for (let node = current; node !== first; node = seen.get(node)) {
        path.push([node % WIDTH, Math.floor(node / WIDTH)]);
      }
      return path.reverse();
    }
    for (const [dx, dy] of neighbors) {
      const next = key(x + dx, y + dy);
      if (walkable(x + dx, y + dy) && !seen.has(next)) {
        seen.set(next, current);
        queue.push(next);
      }
    }
  }
  return null;
}

export function weekStart(now = Date.now()) {
  const korea = new Date(now + 9 * 3600_000);
  korea.setUTCHours(0, 0, 0, 0);
  korea.setUTCDate(korea.getUTCDate() - ((korea.getUTCDay() + 6) % 7));
  return korea.toISOString().slice(0, 10);
}

export function weeklyScenario(week) {
  const serial = Math.floor(Date.parse(week) / (7 * 86400_000));
  return {
    hide: ((serial % 3) + 3) % 3,
    clue: ((serial * 2 + Math.floor(serial / 3)) % 3 + 3) % 3,
    offset: ((serial * 3) % 242 + 242) % 242,
  };
}

export function makeGame(scenario) {
  return {
    scenario, player: { x: SEAT[0], y: SEAT[1], facing: 'down' },
    mode: 'playing', tick: 0, suspicion: 0, caught: 0, seenClue: false,
    carrying: false, path: [], step: null, interaction: null, action: null,
    notice: '', noticeUntil: 0, rush: false, spotted: false,
    guard: guardAt(scenario.offset, scenario.tutorial), returnTick: 0,
  };
}

const PATROL_START = [
  { time: 150, x: 12, y: 4, face: [0, 1] },
  { time: 100, x: 18, y: 4 },
  { time: 140, x: 18, y: 4, face: [0, -1] },
  { time: 115, x: 20, y: 5 },
  { time: 105, x: 20, y: 5, face: [1, 0] },
];
const STORAGE_PATROL = [
  { time: 150, x: 27, y: 5 },
  { time: 70, x: 27, y: 5, face: [0, -1] },
  { time: 85, x: 27, y: 9 },
  { time: 85, x: 23, y: 9 },
  { time: 25, x: 23, y: 10 },
  { time: 65, x: 20, y: 10 },
  { time: 110, x: 20, y: 5 },
];
const PATROL_END = [
  { time: 130, x: 18, y: 4 },
  { time: 205, x: 18, y: 4, face: [0, -1], rush: true },
  { time: 115, x: 12, y: 4, face: [-1, 0] },
  { time: 85, x: 8, y: 4 },
  { time: 85, x: 8, y: 8 },
  { time: 65, x: 5, y: 8 },
  { time: 60, x: 5, y: 8, face: [-1, 1] },
  { time: 65, x: 8, y: 8 },
  { time: 85, x: 8, y: 4 },
  { time: 85, x: 12, y: 4 },
];
const TUTORIAL_PATROL = [...PATROL_START, ...STORAGE_PATROL, ...PATROL_END];
const PATROL = [
  ...PATROL_START,
  ...STORAGE_PATROL,
  { time: 95, x: 20, y: 9 },
  { time: 108, x: 15, y: 9 },
  { time: 55, x: 15, y: 9, face: [0, 1] },
  { time: 100, x: 20, y: 9 },
  { time: 95, x: 20, y: 5 },
  ...PATROL_END,
];
const patrolLength = (route) => route.reduce((sum, part) => sum + part.time, 0);
const TUTORIAL_PERIOD = patrolLength(TUTORIAL_PATROL);
const PERIOD = patrolLength(PATROL);
function guardAt(tick, tutorial) {
  const route = tutorial ? TUTORIAL_PATROL : PATROL;
  let time = tick % (tutorial ? TUTORIAL_PERIOD : PERIOD);
  for (const [i, part] of route.entries()) {
    const prior = route.at(i - 1);
    if (time < part.time) {
      const dx = part.x - prior.x;
      const dy = part.y - prior.y;
      const ratio = time / part.time;
      const [fx, fy] = Math.hypot(dx, dy) ? [dx, dy] : part.face;
      return {
        x: prior.x + dx * ratio, y: prior.y + dy * ratio,
        angle: Math.atan2(fy, fx), rush: !!part.rush,
      };
    }
    time -= part.time;
  }
}

export const VISION_RANGE = 6.2;
export const VISION_SPREAD = Math.PI / 3.3;
export const showVision = ({player, carrying}) => player.y < 13 && (carrying || player.x >= 8.5);
export function visionDistance(guard, angle, limit = VISION_RANGE) {
  for (let d = 0.38; d < limit; d += 0.1) {
    const x = Math.round(guard.x + Math.cos(angle) * d);
    const y = Math.round(guard.y + Math.sin(angle) * d);
    if (BLOCKED.has(key(x, y))) return d;
  }
  return limit;
}
function inSight(p, guard) {
  const dx = p.x - guard.x;
  const dy = p.y - guard.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const difference = Math.atan2(Math.sin(angle - guard.angle), Math.cos(angle - guard.angle));
  return distance < VISION_RANGE && (distance < 0.55 || Math.abs(difference) < VISION_SPREAD)
    && visionDistance(guard, angle, distance) >= distance;
}

export const cluePosition = (g) => CLUES[g.scenario.clue];
export function targetAt(g, x, y) {
  const [cx, cy] = cluePosition(g);
  if (Math.hypot(cx - x, cy - y) < 0.67) return ['clue'];
  const hide = HIDES.findIndex((item) => Math.hypot(item.x - x, item.y - y) < 0.73);
  if (hide !== -1) return ['hide', hide];
  return ['move', Math.round(x), Math.round(y)];
}

export function giveOrder(g, order) {
  if (g.mode !== 'playing' || !Array.isArray(order)) return false;
  const [kind, x, y] = order;
  let targets;
  if (kind === 'move' && order.length === 3 && Number.isInteger(x) && Number.isInteger(y) && walkable(x, y)) {
    targets = new Set([key(x, y)]);
  } else if (kind === 'clue' && order.length === 1) {
    targets = new Set([key(...cluePosition(g))]);
  } else if (kind === 'hide' && order.length === 2 && Number.isInteger(x) && HIDES[x]) {
    const item = HIDES[x];
    targets = new Set(neighbors.map(([dx, dy]) => key(item.x + dx, item.y + dy)));
  } else {
    return false;
  }
  const [fromX, fromY] = g.step || [Math.round(g.player.x), Math.round(g.player.y)];
  const path = pathTo(fromX, fromY, targets);
  if (!path) return false;
  // An ongoing container inspection cannot be interrupted. The next move is queued.
  g.path = path;
  g.interaction = kind === 'move' ? null : order;
  return true;
}

function say(g, text, duration = 155) {
  g.notice = text;
  g.noticeUntil = g.tick + duration;
}
function act(g, order) {
  if (!order) return;
  const [kind, index] = order;
  if (kind === 'clue') {
    g.seenClue = true;
    say(g, HIDES[g.scenario.hide].hint, 260);
  } else if (g.carrying) {
    say(g, '버너는 이미 들고 있다. 미용실로 돌아가자.');
  } else if (index === g.scenario.hide) {
    if (!g.seenClue) say(g, '먼저 가게에 남은 흔적을 조사하자.');
    else {
      g.carrying = true;
      say(g, '버너를 찾았다! 홀에서도 베짱이의 시야를 피해 출구로 가자.', 220);
    }
  } else {
    g.action = { until: g.tick + 54 };
    say(g, '안에 뭐가 들었을까…', 54);
  }
}
function move(g) {
  if (g.action) {
    if (g.tick < g.action.until) return;
    g.action = null;
    say(g, '여기는 비어 있다.');
  }
  g.step ??= g.path.shift() || null;
  if (!g.step) {
    const order = g.interaction;
    g.interaction = null;
    act(g, order);
    return;
  }
  const [x, y] = g.step;
  const p = g.player;
  const dx = x - p.x;
  const dy = y - p.y;
  const distance = Math.hypot(dx, dy);
  const speed = (g.carrying ? 2.25 : 3.5) / HZ;
  if (dx !== 0) p.facing = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) p.facing = dy > 0 ? 'down' : 'up';
  if (distance <= speed) {
    p.x = x;
    p.y = y;
    g.step = null;
  } else {
    p.x += speed * dx / distance;
    p.y += speed * dy / distance;
  }
}

export function advance(g) {
  if (g.mode === 'won' || g.mode === 'lost') return;
  g.tick++;
  if (g.mode === 'returning') {
    if (g.tick - g.returnTick >= RETURN_TICKS) g.mode = 'won';
    return;
  }
  g.guard = guardAt(g.tick + g.scenario.offset, g.scenario.tutorial);
  g.rush = g.guard.rush;
  move(g);
  if (g.player.x === EXIT[0] && g.player.y === EXIT[1]) {
    if (g.carrying) {
      g.mode = 'returning';
      g.returnTick = g.tick;
      return;
    }
    say(g, '버너를 찾은 다음 미용실로 돌아가자.');
    [g.player.x, g.player.y] = [EXIT[0], 12];
  }
  const canBeSpotted = g.player.y < 13 && (g.carrying || g.player.x >= 10.5);
  g.spotted = canBeSpotted && inSight(g.player, g.guard);
  const detectionTicks = g.scenario.tutorial ? 56 : g.carrying ? 38 : 46;
  g.suspicion = Math.min(1, Math.max(0, g.suspicion + (g.spotted ? 1 / detectionTicks : -1 / 70)));
  if (g.suspicion < 1) return;
  g.caught++;
  if (g.caught === 2) {
    g.mode = 'lost';
    return;
  }
  const warning = g.carrying ? '“손님, 그건 제 버너예요!”' : '“손님, 이쪽은 직원만 들어올 수 있어요!”';
  [g.player.x, g.player.y] = SEAT;
  g.player.facing = 'down';
  g.suspicion = 0;
  g.spotted = false;
  g.carrying = false;
  g.path = [];
  g.step = g.interaction = g.action = null;
  say(g, warning + ' 베짱이가 자리로 돌려보냈다.', 260);
}
