import { HZ, WEEKLY_RULESET, advance, giveOrder, makeGame, weeklyScenario } from './game.mjs';

export const MAX_SCORE_BYTES = 128_000;

export function scoreName(data, week) {
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 32 || Array.from(name).length > 16 || /[\p{C}\p{Zl}\p{Zp}]/u.test(name)
    || typeof data.profile !== 'string' || !/^[a-f0-9-]{32,36}$/i.test(data.profile)
    || data.week !== week || data.ruleset !== WEEKLY_RULESET || !verifyReplay(data)) return null;
  return name;
}

function verifyReplay({ week, ticks, controls }) {
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
