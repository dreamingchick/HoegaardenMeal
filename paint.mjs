import {
  WIDTH, HEIGHT, SEAT, FIXTURES, wallAt, cluePosition, showVision,
  visionDistance, VISION_SPREAD, RETURN_TICKS,
} from './game.mjs';

const TILE = 36;
const cx = (x) => (x + 0.5) * TILE;
const cy = (y) => (y + 0.5) * TILE;
const COLORS = {
  cream: '#f6ddaa', edge: '#4b2f27', wood: '#a8704b', dark: '#433332',
  mint: '#6d8e78', gold: '#ffdb93', red: '#a4493c',
};
const assets = Object.fromEntries(
  ['hairdresser', 'chef', 'chef-back', 'walk-side', 'walk-up', 'walk-down', 'carry-side', 'carry-up', 'carry-down'].map((name) => {
    const sprite = new Image();
    sprite.src = './assets/' + name + '.webp';
    return [name, sprite];
  }),
);

function round(c, x, y, w, h, r, fill, stroke) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
function oval(c, x, y, rx, ry, fill) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fillStyle = fill;
  c.fill();
}
function line(c, x, y, ex, ey, color, width = 1) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function label(c, text, x, y, color = COLORS.cream, size = 19) {
  c.fillStyle = color;
  c.font = '700 ' + size + 'px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}
function light(c, x, y, radius, color) {
  const gradient = c.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#ffe09800');
  c.fillStyle = gradient;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function drawFloor(c) {
  c.fillStyle = '#344540';
  c.fillRect(0, 0, WIDTH * TILE, HEIGHT * TILE);
  for (let y = 2; y <= 12; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      const variation = ((x * 37 + y * 23) % 11) - 5;
      const hue = x < 10 ? 31 : x < 22 ? 37 : 27;
      const shade = (x < 10 ? 50 : x < 22 ? 62 : 47) + variation;
      c.fillStyle = 'hsl(' + hue + ' 34% ' + shade + '%)';
      const left = x * TILE;
      const top = y * TILE;
      c.fillRect(left, top, TILE, TILE);
      line(c, left, top, left + TILE, top, '#3d281732');
      if (x <= 10 || x >= 22) {
        const grainY = top + 10 + ((x * y) % 17);
        line(c, left + 4, grainY, left + 30, grainY + 1, '#f9cc8526');
      } else {
        line(c, left, top, left, top + TILE, '#4f3c342f');
      }
    }
  }
  for (const y of [4, 5, 10, 11]) {
    for (const x of [10, 22]) {
      const top = TILE * y + 6;
      for (let i = 0; i < 3; i++) line(c, x * TILE + 5, top + i * 8, x * TILE + 31, top + i * 8, '#fff0ae38', 2);
    }
  }
  c.fillStyle = '#ad8d73';
  c.fillRect(3 * TILE, 13 * TILE, TILE, 2 * TILE);
  for (let i = 0; i < 4; i++) line(c, 3 * TILE + 2, 13 * TILE + i * 18, 4 * TILE - 2, 13 * TILE + i * 18, '#685a51', 2);
}
function drawWalls(c) {
  for (let y = 1; y < 14; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!wallAt(x, y)) continue;
      const left = x * TILE;
      const top = y * TILE;
      c.fillStyle = '#614239';
      c.fillRect(left, top, TILE, TILE);
      c.fillStyle = '#835f4c';
      c.fillRect(left, top + 2, TILE, 9);
      line(c, left, top + 13, left + TILE, top + 13, '#b28560', 2);
      line(c, left, top + 33, left + TILE, top + 33, '#402d28', 3);
      line(c, left + 1, top + 18, left + 1, top + 32, '#4a382e');
    }
  }
  label(c, '홀', cx(5), cy(1), COLORS.gold);
  label(c, '주방', cx(16), cy(1), COLORS.gold);
  label(c, '창고', cx(25), cy(1), COLORS.gold);
  label(c, '출구', cx(3), cy(14), '#2d2a19', 14);
}
function plate(c, x, y) {
  oval(c, x, y, 12, 9, '#785443');
  oval(c, x, y - 1, 10, 7, '#f3d5aa');
  oval(c, x, y - 1, 6, 4, '#c69464');
  line(c, x - 6, y + 4, x + 8, y - 5, '#503826', 2);
}
function fixture(c, item) {
  const x = item.x * TILE + 3;
  const y = item.y * TILE + 4;
  const w = item.w * TILE - 6;
  const h = item.h * TILE - 8;
  if (item.type === 'hide') {
    const fill = ['#dfc5a5', '#79826a', '#a14837'][item.id];
    round(c, x, y, w, h, 4, fill, COLORS.edge);
    line(c, x + 3, y + 8, x + w - 3, y + 8, '#fff1bc55', 2);
    if (item.id === 1) {
      oval(c, x + 5, y + h, 4, 4, COLORS.dark);
      oval(c, x + w - 5, y + h, 4, 4, COLORS.dark);
      line(c, x + 7, y + 15, x + w - 7, y + 15, COLORS.dark, 3);
    } else {
      round(c, x + 8, y + 11, w - 16, 6, 2, '#67473b');
    }
    return;
  }
  round(c, x + 1, y + 5, w, h + 2, 7, '#3d2e2973');
  const fill = item.type === 'shelf' ? '#785345' : COLORS.wood;
  round(c, x, y, w, h, 6, fill, COLORS.edge);
  line(c, x + 4, y + 4, x + w - 4, y + 4, '#eac0998f', 2);
  if (item.type === 'table') {
    for (let col = x + 20; col < x + w - 7; col += 34) plate(c, col, y + h / 2);
  } else if (item.type === 'shelf') {
    for (let col = x + 8; col < x + w - 17; col += 23) {
      const shade = col % 3 === 0 ? '#d7a274' : '#b88353';
      round(c, col, y + 9, 16, h - 20, 3, shade, '#503d37');
      line(c, col + 2, y + h - 19, col + 13, y + 13, '#f1c79450', 2);
    }
  } else if (item.type === 'counter') {
    round(c, x + 12, y + 5, 25, 16, 4, '#596b61', COLORS.edge);
    round(c, x + 55, y + 4, 17, 19, 2, '#e8c89c');
    line(c, x + 59, y + 11, x + 68, y + 11, '#a18163', 2);
  } else {
    round(c, x + 5, y + 3, w - 10, h - 6, 4, '#453c39', COLORS.edge);
    for (let i = 0; i < 6; i++) {
      const skewer = x + 17 + i * 13;
      line(c, skewer, y + 3, skewer, y + 24, '#c7935a', 2);
      oval(c, skewer, y + 12, 4, 7, i % 2 ? '#d88b48' : '#a95739');
    }
    light(c, x + w / 2, y + h / 2, 67, '#ffc57455');
  }
}
const backdrop = document.createElement('canvas');
backdrop.width = WIDTH * TILE;
backdrop.height = HEIGHT * TILE;
const art = backdrop.getContext('2d');
drawFloor(art);
drawWalls(art);
for (const item of FIXTURES) fixture(art, item);
for (const x of [4, 8, 14, 19, 25]) {
  light(art, cx(x), cy(3), 108, '#ffe29f3f');
  oval(art, cx(x), cy(1) + 14, 6, 5, COLORS.gold);
}
label(art, '지름길', cx(16), cy(5), '#50352d', 15);
label(art, '선반 뒤 우회로', cx(17), cy(10.5), '#50352d', 15);

function actor(c, sprite, x, y, height, flip = false) {
  oval(c, x, y + 2, height * 0.22, height * 0.095, '#30272064');
  if (!sprite.naturalWidth) {
    oval(c, x, y - height * 0.33, height * 0.26, height * 0.35, '#486757');
    return;
  }
  const width = height * sprite.naturalWidth / sprite.naturalHeight;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(sprite, -width / 2, -height * 0.86, width, height);
  c.restore();
}
function fieldOfView(c, g) {
  c.beginPath();
  const { guard } = g;
  c.moveTo(cx(guard.x), cy(guard.y));
  for (let i = 0; i <= 44; i++) {
    const angle = guard.angle - VISION_SPREAD + i * 2 * VISION_SPREAD / 44;
    const distance = visionDistance(guard, angle);
    c.lineTo(cx(guard.x + distance * Math.cos(angle)), cy(guard.y + distance * Math.sin(angle)));
  }
  c.closePath();
  c.fillStyle = g.spotted ? '#f973565e' : '#f9c46550';
  c.strokeStyle = g.spotted ? '#ffac83ab' : '#ffe39979';
  c.lineWidth = 1.6;
  c.fill();
  c.stroke();
}
function markClue(c, g) {
  const [x, y] = cluePosition(g);
  c.save();
  c.translate(cx(x), cy(y));
  c.rotate(g.scenario.hide === 1 ? 0.38 : -0.32);
  if (g.scenario.hide === 2) {
    for (let i = 0; i < 4; i++) oval(c, i * 5 - 8, (i % 2) * 5 - 4, 3, 2, '#9b392c');
  } else {
    for (const height of [-4, 4]) line(c, -11, height, 10, height, g.scenario.hide ? '#523d31' : '#f5dcbb', 2.5);
  }
  c.restore();
  c.beginPath();
  c.arc(cx(x), cy(y), 14 + Math.sin(g.tick / 16) * 1.2, 0, Math.PI * 2);
  c.strokeStyle = g.seenClue ? '#eff3c29e' : '#ffe49d';
  c.lineWidth = 1.7;
  c.stroke();
}
function drawReturn(c, progress) {
  c.fillStyle = '#34483d';
  c.fillRect(0, 0, 1080, 540);
  c.fillStyle = '#9b765b';
  c.fillRect(0, 345, 1080, 195);
  for (let i = 0; i < 28; i++) {
    oval(c, (i * 113) % 1070, 370 + (i * 41) % 165, 13, 4, '#684a3b77');
  }
  const buildings = [
    { x: 95, fill: '#94664f', title: '베짱이네 꼬치구이' },
    { x: 605, fill: '#557568', title: '호가든 미용실' },
  ];
  for (const { x, fill, title } of buildings) {
    round(c, x, 114, 377, 235, 8, fill, '#44352d');
    round(c, x - 8, 92, 392, 36, 7, '#4b3c38', '#372c28');
    round(c, x + 29, 146, 318, 38, 6, '#644536', COLORS.edge);
    label(c, title, x + 188, 165, COLORS.cream, 21);
    round(c, x + 39, 213, 116, 83, 5, '#e7b979', '#5d4335');
    line(c, x + 97, 212, x + 97, 296, '#76513d', 5);
    round(c, x + 216, 204, 85, 144, 5, '#392e2a', '#715344');
    light(c, x + 95, 259, 113, '#ffd18d76');
  }
  const x = 354 + progress * 510;
  const y = 348 + Math.sin(progress * Math.PI) * 51;
  actor(c, assets['carry-side'], x, y, 92);
}
function drawDinner(c) {
  c.fillStyle = '#405b4e';
  c.fillRect(0, 0, 1080, 540);
  round(c, 610, 47, 335, 273, 105, '#a58054', '#47392e');
  round(c, 625, 58, 305, 249, 96, '#6e8c80', '#e3bb79');
  line(c, 650, 231, 873, 105, '#9db3a273', 15);
  light(c, 770, 210, 322, '#ffcb795a');
  actor(c, assets.hairdresser, 769, 408, 318, true);
  round(c, 527, 381, 507, 119, 23, '#a77453', COLORS.edge);
  line(c, 543, 450, 1011, 450, '#d5956488', 3);
  oval(c, 800, 458, 86, 21, '#61483c95');
  round(c, 731, 414, 141, 44, 22, '#c2c0a0', COLORS.edge);
  oval(c, 802, 415, 69, 24, '#e2cc9e');
  oval(c, 802, 406, 54, 25, '#fff4d8');
  for (let i = 0; i < 25; i++) {
    oval(c, 763 + (i * 23) % 77, 399 + (i * 19) % 22, 4, 2, '#ead9b0');
  }
  for (let i = 0; i < 3; i++) {
    const x = 783 + i * 21;
    c.beginPath();
    c.moveTo(x, 369);
    c.bezierCurveTo(x - 18, 352, x + 17, 339, x + 2, 323);
    c.strokeStyle = '#ffedc69d';
    c.lineWidth = 3;
    c.stroke();
  }
}
export function draw(canvas, g, menu = false, cursor = null) {
  const c = canvas.getContext('2d');
  if (g?.mode === 'won') {
    drawDinner(c);
    return;
  }
  if (g?.mode === 'returning') {
    drawReturn(c, Math.min(1, (g.tick - g.returnTick) / RETURN_TICKS));
    return;
  }
  c.drawImage(backdrop, 0, 0);
  if (menu) {
    light(c, 858, 290, 235, '#ffdca787');
    actor(c, assets['chef-back'], 700, 354, 147);
    actor(c, assets.hairdresser, 875, 410, 333, true);
    return;
  }
  if (!g) return;
  if (showVision(g.player)) fieldOfView(c, g);
  markClue(c, g);
  const destination = g.path.at(-1) || g.step;
  if (destination) oval(c, cx(destination[0]), cy(destination[1]), 5, 4, '#fff2c1c9');
  if (cursor) {
    c.strokeStyle = '#ffedbc';
    c.lineWidth = 2;
    c.strokeRect(cursor[0] * TILE + 3, cursor[1] * TILE + 3, TILE - 6, TILE - 6);
  }
  const p = g.player;
  const pose = p.facing === 'up' || p.facing === 'down' ? p.facing : 'side';
  const sprite = assets[(g.carrying ? 'carry-' : 'walk-') + pose];
  const guard = g.guard;
  const back = Math.sin(guard.angle) < -0.35;
  const bob = g.step ? Math.abs(Math.sin(g.tick / 4)) * 2.5 : 0;
  const figures = [
    { sprite, x: p.x, y: p.y, height: 61, flip: p.facing === 'left', bob },
    { sprite: assets[back ? 'chef-back' : 'chef'], x: guard.x, y: guard.y, height: 64, flip: Math.cos(guard.angle) < -0.25, bob: 0 },
  ];
  for (const figure of figures.sort((a, b) => a.y - b.y)) {
    actor(c, figure.sprite, cx(figure.x), cy(figure.y) - figure.bob, figure.height, figure.flip);
  }
  if (!g.caught && p.x === SEAT[0] && p.y === SEAT[1] && g.tick < 160) {
    label(c, '호가든', cx(p.x), cy(p.y) + 18, '#fff2c4', 12);
  }
}
