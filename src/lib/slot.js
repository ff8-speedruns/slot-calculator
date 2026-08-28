/**
 * Selphie's Slot roll, and the manipulation planning built on top of it.
 *
 * Every Limit Break menu refresh reads five consecutive bytes from the battle
 * random table, and a Do-Over advances the index by four. Nothing in the roll
 * mentions the enemy, the encounter or the battle scene, so the same index and
 * the same party state give the same spell in every fight. What a fight changes
 * is where the index sits when you get there, and how fast other actors move it
 * while you are deciding.
 *
 * A roll at index i reads:
 *
 *   B[i]      the crisis level roll
 *   B[i + 1]  the [0..4] term, taken modulo 5
 *   B[i + 2]  the slot mod, through the thresholds below
 *   B[i + 3]  which of the set's 8 spells, modulo 8
 *   B[i + 4]  the cast count, modulo that spell's maximum
 *
 * The count byte sits one past the roll's own window, so consecutive rolls
 * overlap on it. That is what the observations say; it has not been confirmed
 * against the executable.
 */

import { RNG_TABLE, SLOT_ARRAY } from './slot.data.js';

/** The random table's length, and so the length of the whole manip cycle. */
export const CYCLE = RNG_TABLE.length;

/** A Do-Over advances the RNG index by this much. */
export const DO_OVER_STEP = 4;

/**
 * Skipping Selphie's turn advances it by one, which is the only way to close a
 * gap that is not a multiple of DO_OVER_STEP.
 */
export const SKIP_TURN_STEP = 1;

/**
 * Crisis level 0 means no Limit Break is available, so those indices are dead
 * ground for a manip and the map draws them empty.
 */
export const MAX_CRISIS = 4;

/** Slot mod thresholds. The byte falls into one of five bands. */
const SLOT_MOD_BOUNDS = [39, 159, 209, 249];

/** Each slot mod owns this many consecutive slot levels in the array. */
const LEVELS_PER_SLOT_MOD = 12;

/** Terms of the crisis level formula that are not the HP or status parts. */
const CRISIS_BASE = 1600;
const CRISIS_PER_DEAD_ALLY = 200;
const CRISIS_HP_SCALE = 2500;
const CRISIS_DIVISOR_OFFSET = 160;
const CRISIS_THRESHOLD = 4;

/** Status weights, before the ten the whole sum is multiplied by. */
export const STATUS_WEIGHTS = {
  aura: 200,
  blind: 30,
  silence: 30,
  slow: 15,
  poison: 30,
  gradualPetrify: 30,
  doom: 45,
};
const STATUS_MULTIPLIER = 10;

/** Wraps any integer into the cycle, including negatives. */
export const wrapIndex = (index) => ((index % CYCLE) + CYCLE) % CYCLE;

/** Which of the five slot mods a byte lands in. */
function slotModOf(byte) {
  let mod = 0;
  while (mod < SLOT_MOD_BOUNDS.length && byte >= SLOT_MOD_BOUNDS[mod]) mod += 1;
  return mod;
}

/** The status half of the crisis numerator, from a set of ticked statuses. */
export function statusSum(statuses = {}) {
  return Object.entries(STATUS_WEIGHTS).reduce(
    (total, [name, weight]) => total + (statuses[name] ? weight : 0),
    0,
  );
}

/**
 * Crisis level for one random byte and one party state. Returns 0-4, where 0
 * means the Limit Break is not available at all.
 */
export function crisisLevel(byte, { currentHp, maxHp, deadAllies = 0, statuses }) {
  const hpTerm = Math.floor((CRISIS_HP_SCALE * currentHp) / maxHp);
  const deathTerm = deadAllies * CRISIS_PER_DEAD_ALLY + CRISIS_BASE;
  const statusTerm = statusSum(statuses) * STATUS_MULTIPLIER;
  const limitLevel = Math.floor((statusTerm + deathTerm - hpTerm) / (byte + CRISIS_DIVISOR_OFFSET));

  if (limitLevel <= CRISIS_THRESHOLD) return 0;
  return Math.min(limitLevel - CRISIS_THRESHOLD, MAX_CRISIS);
}

/**
 * What the Slot menu shows at one RNG index.
 *
 * The slot index is deliberately not clamped. The kernel's array is 60 bytes,
 * five slot mods of twelve levels, but this reaches 65 at level 100 with crisis
 * 4 and a [0..4] term of 4. The game reads straight past the end into the slot
 * sets that follow it, and those six rows are reachable in play. That overflow
 * is also why a level 100 party sees a different spell distribution than a
 * level 8 one: the level term shifts the read window by ten.
 */
export function rollAt(index, party) {
  const at = wrapIndex(index);
  const crisis = crisisLevel(RNG_TABLE[at], party);
  if (crisis === 0) return { index: at, crisis: 0, available: false };

  const slotIndex =
    slotModOf(RNG_TABLE[wrapIndex(at + 2)]) * LEVELS_PER_SLOT_MOD +
    Math.floor(party.level / 10) +
    crisis +
    (RNG_TABLE[wrapIndex(at + 1)] % 5) -
    1;
  const spellIndex = RNG_TABLE[wrapIndex(at + 3)] % 8;

  const cell = SLOT_ARRAY[slotIndex]?.[spellIndex] ?? null;
  if (!cell) {
    return { index: at, crisis, available: true, slotIndex, spellIndex, spell: null };
  }

  const [spell, maxCasts, confidence] = cell;
  return {
    index: at,
    crisis,
    available: true,
    slotIndex,
    spellIndex,
    spell,
    casts: (RNG_TABLE[wrapIndex(at + 4)] % maxCasts) + 1,
    // False when the cell was seen too rarely to pin its maximum, in which case
    // the spell is right but the number beside it may not be.
    castsAreCertain: confidence === 2,
  };
}

/** Every index in the cycle for one party state, in index order. */
export function rollCycle(party) {
  return Array.from({ length: CYCLE }, (_, index) => rollAt(index, party));
}

/** Every spell the recovered array can produce, for populating menus. */
export const SPELLS = [
  ...new Set(SLOT_ARRAY.flatMap((row) => (row ?? []).map((cell) => cell?.[0]).filter(Boolean))),
].sort();

/**
 * Getting from one index to another. A gap that is not a multiple of four
 * cannot be closed by Do-Overs alone, and the remainder is how many turn-skips
 * it costs. Where the skips sit among the Do-Overs is up to the fight; only the
 * totals matter to the RNG.
 */
export function planTo(from, to) {
  const steps = wrapIndex(to - from);
  const skips = steps % DO_OVER_STEP;
  return { steps, skips, doOvers: (steps - skips) / DO_OVER_STEP };
}

/**
 * Every index that produces the target, nearest first by cost, each with the
 * plan to reach it. `casts` of 0 accepts any cast count.
 */
export function findSpell(party, { spell, casts = 0, from = 0 }) {
  return rollCycle(party)
    .filter((roll) => roll.spell === spell && (!casts || roll.casts === casts))
    .map((roll) => ({ ...roll, plan: planTo(from, roll.index) }))
    .sort((a, b) => a.plan.skips - b.plan.skips || a.plan.doOvers - b.plan.doOvers);
}

/** Case-insensitive, so a spell typed in a hurry still matches. */
const sameSpell = (rolled, typed) =>
  Boolean(rolled) && rolled.toLowerCase() === typed.toLowerCase();

/**
 * Does the cycle starting at `index` produce this run of observations? Each
 * observation is one Do-Over later than the last.
 */
function matchesFrom(index, observations, party, useCasts) {
  return observations.every((observation, step) => {
    const roll = rollAt(index + DO_OVER_STEP * step, party);
    if (!sameSpell(roll.spell, observation.spell)) return false;
    if (useCasts && observation.casts && roll.casts !== observation.casts) return false;
    return true;
  });
}

/**
 * Cast counts come from a different byte than the spell name, so they narrow
 * the search independently. They also come from the least certain part of the
 * recovered data, so when nothing matches with them the search is retried
 * without them rather than reported as a bad reading.
 */
function searchWithCastFallback(candidates, observations, party) {
  const gaveCasts = observations.some((observation) => observation.casts);
  const strict = candidates.filter((index) => matchesFrom(index, observations, party, true));
  if (strict.length || !gaveCasts) return { matches: strict, ignoredCasts: false };

  const loose = candidates.filter((index) => matchesFrom(index, observations, party, false));
  return { matches: loose, ignoredCasts: loose.length > 0 };
}

/**
 * Observations are one Do-Over apart, so a blank in the middle would shift
 * everything after it onto the wrong index. Only the run before the first blank
 * can be trusted to be consecutive.
 */
const consecutivePrefix = (observations) => {
  const firstBlank = observations.findIndex((observation) => !observation?.spell);
  return firstBlank === -1 ? observations : observations.slice(0, firstBlank);
};

/**
 * Works out where you are from the spells on screen. One observation leaves
 * plenty of candidates; two with cast counts usually settle it, and three
 * settle it on names alone.
 */
export function identify(party, observations) {
  const useful = consecutivePrefix(observations);
  if (!useful.length) return { matches: [], ignoredCasts: false };

  const all = Array.from({ length: CYCLE }, (_, index) => index);
  return searchWithCastFallback(all, useful, party);
}

/**
 * How far the index moved away from where the plan expected it. Anything other
 * than zero is another actor in the fight spending RNG you did not spend.
 *
 * Drifts are reported nearest to zero first, and signed: negative means the
 * index is behind where the plan put it.
 */
export function solveDrift(party, expected, observations) {
  const useful = consecutivePrefix(observations);
  if (!useful.length) return { drifts: [], ignoredCasts: false, actual: null };

  const offsets = Array.from({ length: CYCLE }, (_, offset) => offset);
  const { matches, ignoredCasts } = searchWithCastFallback(
    offsets.map((offset) => wrapIndex(expected + offset)),
    useful,
    party,
  );

  const signed = matches
    .map((index) => {
      const forward = wrapIndex(index - expected);
      return forward > CYCLE / 2 ? forward - CYCLE : forward;
    })
    .sort((a, b) => Math.abs(a) - Math.abs(b));

  return {
    drifts: signed,
    ignoredCasts,
    actual: signed.length ? wrapIndex(expected + signed[0]) : null,
  };
}

/**
 * The current HP range that keeps one index at one crisis level. Useful for
 * seeing how much damage a hit can take before a planned target evaporates,
 * since crisis level is the only part of the roll HP touches.
 */
export function hpWindowFor(index, crisis, party) {
  const byte = RNG_TABLE[wrapIndex(index)];
  let low = null;
  let high = null;

  for (let currentHp = 1; currentHp <= party.maxHp; currentHp += 1) {
    if (crisisLevel(byte, { ...party, currentHp }) !== crisis) continue;
    if (low === null) low = currentHp;
    high = currentHp;
  }

  return low === null ? null : { low, high };
}
