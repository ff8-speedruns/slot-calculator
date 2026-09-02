/**
 * Selphie's Slot roll, and the manipulation planning built on top of it.
 *
 * Two separate things happen.
 *
 * When the Limit Break opens, the game rolls a crisis level once, from the byte
 * at the opening index and Selphie's HP and statuses. That value is stored on
 * her and does not move again for the rest of the Limit Break.
 *
 * Every Do Over after that rolls only the spell, reading four consecutive bytes
 * and advancing the index by four:
 *
 *   B[i + 1]  the [0..4] term, taken modulo 5
 *   B[i + 2]  the slot mod, through the thresholds below
 *   B[i + 3]  which of the set's 8 spells, modulo 8
 *   B[i + 4]  the cast count, modulo that spell's maximum
 *
 * The crisis level feeds the slot index alongside those as a constant.
 *
 * Nothing in any of this involves the enemy, the encounter or the battle scene.
 * What a fight changes is where the index sits when you get there, and how fast
 * other actors move it while you are deciding.
 */

import { RNG_TABLE, SLOT_ARRAY } from './slot.data.ts';
import type {
  Availability,
  Casts,
  Crisis,
  Discriminator,
  Hit,
  HpOutlook,
  HpPoint,
  IdentifyOptions,
  Match,
  Observation,
  OpeningCrisis,
  OpeningRoute,
  OpeningRoutes,
  Party,
  Reading,
  ReadingScope,
  ReopenOutlook,
  Roll,
  Statuses,
  Target,
} from './types.ts';

/** The random table's length, and so the length of the whole manip cycle. */
export const CYCLE = RNG_TABLE.length;

/**
 * Whether the cast-count inputs are shown.
 *
 * A count narrows the reading independently of the spell name, because it comes from a
 * different byte, and every search still filters on one when it is given. Switched off
 * to decrease the amount of information a runner needs to input.
 */
export const SHOW_CAST_COUNTS = false;

/** A Do Over advances the RNG index by this much. */
export const DO_OVER_STEP = 4;

/** Crisis levels the Limit Break can open at. 0 means it is not available. */
const MAX_CRISIS = 4 satisfies Crisis;
export const CRISIS_LEVELS: readonly Crisis[] = [1, 2, 3, 4];

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
export const STATUS_WEIGHTS: Record<keyof Statuses, number> = {
  aura: 200,
  blind: 30,
  silence: 30,
  slow: 15,
  poison: 30,
  gradualPetrify: 30,
  doom: 45,
};
const STATUS_MULTIPLIER = 10;

/**
 * Reads an array slot that is dense by construction.
 *
 * `noUncheckedIndexedAccess` makes every `array[i]` possibly-undefined, which is
 * the right default and wrong for the tables here: the RNG table is exactly 256
 * long and every read is wrapped into it, and the reach table is built with all
 * five crisis slots filled. Throwing on a miss keeps that guarantee honest
 * without scattering non-null assertions through the arithmetic.
 */
export function at<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) throw new RangeError(`index ${index} is outside the table`);
  return value;
}

/**
 * An index paired with the crisis level in play there.
 *
 * Both things this describes are the same pair: an opening (an index whose byte
 * rolls that crisis) and a candidate state the reader has not yet placed.
 */
interface State {
  index: number;
  crisis: Crisis;
}

/** Wraps any integer into the cycle, including negatives. */
export const wrapIndex = (index: number): number => ((index % CYCLE) + CYCLE) % CYCLE;

/** Which of the five slot mods a byte lands in. */
function slotModOf(byte: number): number {
  let mod = 0;
  while (mod < SLOT_MOD_BOUNDS.length && byte >= at(SLOT_MOD_BOUNDS, mod)) mod += 1;
  return mod;
}

/** The status half of the crisis numerator, from a set of ticked statuses. */
export function statusSum(statuses: Statuses = {}): number {
  return Object.entries(STATUS_WEIGHTS).reduce(
    (total, [name, weight]) => total + (statuses[name as keyof Statuses] ? weight : 0),
    0,
  );
}

/**
 * The crisis level Selphie opens the Limit Break at, given the index the menu
 * opened on. Returns 0-4, where 0 means no Limit Break at all.
 *
 * This is rolled once. Every Do Over that follows keeps whatever came out here.
 */
export function crisisAtOpen(
  openingIndex: number,
  { currentHp, maxHp, deadAllies = 0, statuses }: Party,
): OpeningCrisis {
  const byte = at(RNG_TABLE, wrapIndex(openingIndex));
  const hpTerm = Math.floor((CRISIS_HP_SCALE * currentHp) / maxHp);
  const deathTerm = deadAllies * CRISIS_PER_DEAD_ALLY + CRISIS_BASE;
  const statusTerm = statusSum(statuses) * STATUS_MULTIPLIER;
  const limitLevel = Math.floor((statusTerm + deathTerm - hpTerm) / (byte + CRISIS_DIVISOR_OFFSET));

  if (limitLevel <= CRISIS_THRESHOLD) return 0;
  return Math.min(limitLevel - CRISIS_THRESHOLD, MAX_CRISIS) as Crisis;
}

/**
 * The spell on screen at one RNG index, for a Limit Break already open at a
 * known crisis level.
 *
 * The slot index is deliberately not clamped. The kernel's array is 60 bytes,
 * five slot mods of twelve levels, but this reaches 65 at level 100 with crisis
 * 4 and a [0..4] term of 4. The game reads straight past the end into the slot
 * sets that follow it, and those six rows are reachable in play. That overflow
 * is also why a level 100 party sees a different spell distribution than a
 * level 8 one: the level term shifts the read window by ten.
 */
export function spellAt(index: number, level: number, crisis: Crisis): Roll {
  const here = wrapIndex(index);
  const slotIndex =
    slotModOf(at(RNG_TABLE, wrapIndex(here + 2))) * LEVELS_PER_SLOT_MOD +
    Math.floor(level / 10) +
    crisis +
    (at(RNG_TABLE, wrapIndex(here + 1)) % 5) -
    1;
  const spellIndex = at(RNG_TABLE, wrapIndex(here + 3)) % 8;

  // Every slot index the expression above can produce, 0 through 65, has a row,
  // so this cannot miss. The guard is here so a future change to the level or
  // crisis range fails loudly rather than reporting a spell of undefined.
  const cell = SLOT_ARRAY[slotIndex]?.[spellIndex];
  if (!cell) throw new RangeError(`no slot data for ${slotIndex}/${spellIndex}`);

  const [spell, maxCasts] = cell;
  return {
    index: here,
    crisis,
    slotIndex,
    spellIndex,
    spell,
    casts: ((at(RNG_TABLE, wrapIndex(here + 4)) % maxCasts) + 1) as Casts,
  };
}

/** Does this roll satisfy the target? `casts` of 0 accepts any count. */
const matchesTarget = (roll: Roll, { spell, casts = 0 }: Target): boolean =>
  roll.spell === spell && (!casts || roll.casts === casts);

/**
 * A run of consecutive Do Overs from one state, in order.
 *
 * Every reading sequence in this file is this same walk: the path to a target,
 * the signature that identifies an opening, the run a capture recorded. Writing
 * it once means the step arithmetic can only be wrong in one place.
 */
const rollsFrom = (index: number, level: number, crisis: Crisis, depth: number): Roll[] =>
  Array.from({ length: depth }, (_, step) => spellAt(index + DO_OVER_STEP * step, level, crisis));

/**
 * Every index the Limit Break can open at, with the crisis it would roll there.
 *
 * The single most repeated question in this file. `hpOutlook` still counts
 * inline: it asks this once per sampled HP, and building a fresh list a couple
 * of hundred times over is the one place the helper would cost more than the
 * duplication it removes.
 */
export function liveOpenings(party: Party): State[] {
  const out: State[] = [];
  for (let index = 0; index < CYCLE; index += 1) {
    const crisis = crisisAtOpen(index, party);
    if (crisis) out.push({ index, crisis });
  }
  return out;
}

/** Every index in the cycle for one level and one open crisis level. */
export function rollCycle(level: number, crisis: Crisis): Roll[] {
  return Array.from({ length: CYCLE }, (_, index) => spellAt(index, level, crisis));
}

/** Every spell the slot array can produce, for populating menus. */
export const SPELLS: readonly string[] = [
  ...new Set(SLOT_ARRAY.flat().map((cell) => cell[0])),
].sort();

/**
 * Getting from one index to another. A gap that is not a multiple of four
 * cannot be closed by Do Overs alone, and the remainder is how many turn-skips
 * it costs.
 */
function planTo(from: number, to: number) {
  const steps = wrapIndex(to - from);
  const skips = steps % DO_OVER_STEP;
  return { steps, skips, doOvers: (steps - skips) / DO_OVER_STEP };
}

/**
 * Every index that shows the target at this crisis level, nearest first.
 * `casts` of 0 accepts any cast count.
 *
 * `reachable` marks the ones you can Do Over onto without leaving the Limit
 * Break. The rest sit off the four-step lattice from where you are, so getting
 * to them means re-opening at a new crisis, which is routeTo's job.
 */
export function findSpell(
  level: number,
  crisis: Crisis,
  { spell, casts = 0, from = 0 }: Target & { from?: number },
): Hit[] {
  return rollCycle(level, crisis)
    .filter((roll) => matchesTarget(roll, { spell, casts }))
    .map((roll) => {
      const plan = planTo(from, roll.index);
      return { ...roll, plan, reachable: plan.skips === 0 };
    })
    .sort((a, b) => a.plan.skips - b.plan.skips || a.plan.doOvers - b.plan.doOvers);
}

/**
 * Every spell, sorted into the reason it is or is not worth chasing.
 *
 *   'level'  The spell is in no cell of the slot array this level band can
 *            read, at any crisis level. 11/50 spells are in this state at level 11.
 *   'hp'     Spell exists at this level, but no opening at the current HP can produce
 *            it. Need to lower Selphie's HP.
 *   'ready'  At least 1 opening reaches the spell.
 */
/**
 * Whether a spell is worth flagging in the picker: it exists in the map and is
 * not simply reachable. Both the badge and the width the picker reserves for it
 * ask this, and a second copy of the condition goes stale the moment one moves.
 */
export const isBlocked = (entry: Availability | undefined): entry is Availability =>
  entry !== undefined && entry.state !== 'ready';

export function spellAvailability(party: Party): Map<string, Availability> {
  const cellKey = (residue: number, crisis: Crisis) => residue * 8 + crisis;

  const cellsFor = new Map<string, Set<number>>();
  for (const crisis of CRISIS_LEVELS) {
    for (let index = 0; index < CYCLE; index += 1) {
      const { spell } = spellAt(index, party.level, crisis);
      let cells = cellsFor.get(spell);
      if (!cells) cellsFor.set(spell, (cells = new Set()));
      cells.add(cellKey(index % DO_OVER_STEP, crisis));
    }
  }

  const openings: number[] = [];
  for (let index = 0; index < CYCLE; index += 1) {
    const crisis = crisisAtOpen(index, party);
    if (crisis) openings.push(cellKey(index % DO_OVER_STEP, crisis));
  }

  const out = new Map<string, Availability>();
  for (const spell of SPELLS) {
    const cells = cellsFor.get(spell);
    if (!cells) {
      out.set(spell, { spell, state: 'level', good: 0, live: openings.length });
      continue;
    }
    const good = openings.filter((cell) => cells.has(cell)).length;
    out.set(spell, {
      spell,
      state: good ? 'ready' : 'hp',
      good,
      live: openings.length,
    });
  }
  return out;
}

/**
 * Inside one Limit Break the crisis is held and every move is +4, so the only
 * states you can see are the 64 indices in your residue class at your crisis.
 * Either the target is one of them, in which case this is the whole plan and it
 * carries no risk at all, or it's not.
 *
 * Returns null when it is not in there.
 */
export function doOversTo(
  level: number,
  index: number,
  crisis: Crisis,
  { spell, casts = 0 }: Target,
): (Roll & { doOvers: number }) | null {
  for (let step = 0; step < CYCLE / DO_OVER_STEP; step += 1) {
    const roll = spellAt(wrapIndex(index + DO_OVER_STEP * step), level, crisis);
    if (matchesTarget(roll, { spell, casts })) return { doOvers: step, ...roll };
  }
  return null;
}

/**
 * Every spell you will see between where you stand and the target, both ends
 * included: entry 0 is what is on screen right now, and the last entry is the
 * target itself. So the number of Do-Overs is one less than the length.
 *
 * Null when the target is not in this Limit Break at all, which is the same
 * question doOversTo answers and is left to it rather than guessed at here.
 */
export function doOverPath(
  level: number,
  index: number,
  crisis: Crisis,
  target: Target,
): Roll[] | null {
  const hit = doOversTo(level, index, crisis, target);
  if (!hit) return null;
  return rollsFrom(index, level, crisis, hit.doOvers + 1);
}

/**
 * Which residue classes show the target, at each crisis level. Four classes by
 * four crisis levels, so 16 questions, each answered by walking 64 indices.
 */
function reachTable(level: number, { spell, casts = 0 }: Target): ReachTable {
  const table: boolean[][] = [];
  for (let residue = 0; residue < DO_OVER_STEP; residue += 1) {
    // Index 0 is the no-Limit-Break case, which reaches nothing by definition.
    // Keeping it in the row means the crisis level can index straight into it.
    const row = [false];
    for (const crisis of CRISIS_LEVELS) {
      row.push(doOversTo(level, residue, crisis, { spell, casts }) !== null);
    }
    table.push(row);
  }
  return table;
}

/** Reachability by residue class and crisis level. See reachTable. */
type ReachTable = boolean[][];

/** Reads one cell of a reach table, which is dense by construction. */
const reaches = (table: ReachTable, index: number, crisis: Crisis): boolean =>
  at(at(table, index % DO_OVER_STEP), crisis);

/**
 * What re-opening the Limit Break is worth, when the target is not in the one
 * you are standing in.
 */
export function reopenOutlook(party: Party, { spell, casts = 0 }: Target): ReopenOutlook {
  const table = reachTable(party.level, { spell, casts });
  let live = 0;
  const openings: number[] = [];
  for (let index = 0; index < CYCLE; index += 1) {
    const crisis = crisisAtOpen(index, party);
    if (!crisis) continue;
    live += 1;
    if (reaches(table, index, crisis)) openings.push(index);
  }
  const good = openings.length;
  return {
    live,
    good,
    crisisLevels: [
      ...new Set(openings.map((index) => crisisAtOpen(index, party) as Crisis)),
    ].sort(),
    // The number that actually matters to a runner, because it folds in both
    // failures: a turn produces nothing unless the Limit Break appears AND the
    // opening it appears at is one that reaches the target. Per turn that is
    // good / 256, so the expected wait is 256 / good turns of skipping.
    expectedTurns: good ? CYCLE / good : Infinity,
    possible: good > 0,
  };
}

/**
 * Every opening that reaches the target, with the readings that identify it and
 * the Do-Overs owed once they have been seen.
 *
 * This is the whole answer up front, so a runner who is busy playing does not
 * have to type anything: watch the Slot, match a row, press Do-Over that many
 * times. Anything not listed cannot reach the target, so the turn can be passed.
 *
 * Openings are told apart by spell NAME alone, never by the cast count, even
 * though the count is on screen and is carried on every reading for the runner
 * to check against. Keying on the count was measured and abandoned: at Lv8
 * 34/482 it made `Sleep ×2` look unique at the first reading when two live
 * openings show Sleep, and the other one cannot reach The End. A runner who
 * glossed the count would have spent 57 Do-Overs on a dead opening. Making the
 * count decisive turns one misread digit into a confidently wrong route, so it
 * only ever confirms a row, never establishes it.
 *
 * An opening is only listed once its names are unique among every live opening,
 * dead ones included. Each row is as short as it can be, because the smallest
 * unique depth is chosen per opening rather than one depth for the whole list.
 *
 * Openings still ambiguous at `maxDepth` are counted in `unresolved` rather than
 * listed, because a row a runner cannot trust is worse than no row. An
 * unresolved opening DOES reach the target, so a caller must not tell a runner
 * that anything unlisted is safe to pass. The default of 5 is measured: across
 * every level, HP, status and maxHp sampled, five readings leave nothing
 * unresolved.
 */
export function openingRoutes(
  party: Party,
  { spell, casts = 0 }: Target,
  maxDepth = 5,
): OpeningRoutes {
  const { level } = party;
  const target = { spell, casts };

  // Reachability depends only on the residue class and the crisis, never on the
  // index itself, so the 16-cell table answers it for every opening at a fixed
  // cost. Asking doOversTo per opening instead walked up to 64 indices each,
  // about 8,000 rolls at a typical party state to compute 125 booleans.
  const reachable = reachTable(level, target);

  // Each opening is walked to the deepest depth once. Every shallower signature
  // is a prefix of that run, so no index is rolled twice.
  const walked = liveOpenings(party).map((state) => ({
    state,
    readings: rollsFrom(state.index, level, state.crisis, maxDepth),
  }));
  const keyOf = (readings: readonly Roll[], depth: number): string =>
    readings
      .slice(0, depth)
      .map((roll) => roll.spell)
      .join(',');

  // How many live openings share each signature, one map per depth, so the
  // uniqueness test below is a lookup rather than a scan over all 256 again.
  const shared: Map<string, number>[] = [];
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const counts = new Map<string, number>();
    for (const { readings } of walked) {
      const key = keyOf(readings, depth);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    shared.push(counts);
  }

  const routes: OpeningRoute[] = [];
  let unresolved = 0;
  let dead = 0;

  for (const { state, readings } of walked) {
    if (!reaches(reachable, state.index, state.crisis)) {
      dead += 1;
      continue;
    }

    let depth: number | null = null;
    for (let tryDepth = 1; tryDepth <= maxDepth; tryDepth += 1) {
      if (at(shared, tryDepth - 1).get(keyOf(readings, tryDepth)) === 1) {
        depth = tryDepth;
        break;
      }
    }
    if (depth === null) {
      unresolved += 1;
      continue;
    }

    // Each reading after the first cost a Do-Over, so the runner is standing
    // this far along by the time the last one is on screen.
    const standing = wrapIndex(state.index + DO_OVER_STEP * (depth - 1));
    const from = doOversTo(level, standing, state.crisis, target);
    if (!from) throw new Error(`no route from ${standing} though ${state.index} had one`);

    routes.push({
      index: state.index,
      crisis: state.crisis,
      readings: readings.slice(0, depth),
      doOvers: from.doOvers,
    });
  }

  // Fewest readings first, then the shortest wait, so the cheapest rows to act
  // on are at the top.
  routes.sort(
    (a, b) => a.readings.length - b.readings.length || a.doOvers - b.doOvers || a.index - b.index,
  );

  return {
    routes,
    unresolved,
    dead,
    live: walked.length,
    // Whether the list accounts for every opening that reaches the target, and
    // so whether a caller may tell a runner that anything unlisted is safe to
    // pass. A property of this result, not of a caller's layout choices, so it
    // is settled here instead of being re-derived at each call site.
    complete: unresolved === 0,
  };
}

/**
 * How the odds change with HP.
 */
export function hpOutlook(party: Party, { spell, casts = 0 }: Target): HpOutlook {
  const table = reachTable(party.level, { spell, casts });
  // Count the openings that reach the target, not the ratio. A ratio flatters
  // high HP, where almost nothing is live but the one opening that is happens
  // to work: that reads as 100% and means a wait of over a hundred turns.
  const goodAt = (currentHp: number): number => {
    const at = { ...party, currentHp };
    let good = 0;
    for (let index = 0; index < CYCLE; index += 1) {
      const crisis = crisisAtOpen(index, at);
      if (crisis && reaches(table, index, crisis)) good += 1;
    }
    return good;
  };
  const asOutlook = (currentHp: number): HpPoint => {
    const good = goodAt(currentHp);
    return { hp: currentHp, good, expectedTurns: good ? CYCLE / good : Infinity };
  };

  const stride = Math.max(1, Math.floor(party.maxHp / 240));
  let best = asOutlook(party.currentHp);
  let ceiling: number | null = null; // highest HP at which the spell is possible at all
  for (let currentHp = 1; currentHp <= party.maxHp; currentHp += stride) {
    const here = asOutlook(currentHp);
    if (here.good > best.good) best = here;
    if (here.good > 0) ceiling = currentHp;
  }

  return { current: asOutlook(party.currentHp), best, ceiling };
}

/** Case-insensitive, so a spell typed in a hurry still matches. */
export const sameSpell = (rolled: string, typed: string): boolean =>
  rolled.toLowerCase() === typed.toLowerCase();

/**
 * Observations are one Do Over apart, so a blank in the middle would shift
 * everything after it onto the wrong index. Only the run before the first blank
 * can be trusted to be consecutive.
 */
export const consecutivePrefix = (observations: readonly Observation[]): Observation[] => {
  const firstBlank = observations.findIndex((observation) => !observation?.spell);
  return [...(firstBlank === -1 ? observations : observations.slice(0, firstBlank))];
};

/** Does the run of observations start at this index, at this crisis level? */
function matchesFrom(
  index: number,
  level: number,
  crisis: Crisis,
  observations: readonly Observation[],
  useCasts: boolean,
): boolean {
  return observations.every((observation, step) => {
    const roll = spellAt(index + DO_OVER_STEP * step, level, crisis);
    if (!sameSpell(roll.spell, observation.spell)) return false;
    if (useCasts && observation.casts && roll.casts !== observation.casts) return false;
    return true;
  });
}

/**
 * Cast counts come from a different byte than the spell name, so they narrow
 * the search independently. They are exact now that the maxima come from the
 * kernel, but a misread number on screen is easy, so a search that finds
 * nothing with them is retried without them rather than called a bad reading.
 */
function searchWithCastFallback(
  candidates: readonly State[],
  level: number,
  observations: readonly Observation[],
): { matches: State[]; ignoredCasts: boolean } {
  const gaveCasts = observations.some((observation) => observation.casts);
  const strict = candidates.filter(({ index, crisis }) =>
    matchesFrom(index, level, crisis, observations, true),
  );
  if (strict.length || !gaveCasts) return { matches: strict, ignoredCasts: false };

  const loose = candidates.filter(({ index, crisis }) =>
    matchesFrom(index, level, crisis, observations, false),
  );
  return { matches: loose, ignoredCasts: loose.length > 0 };
}

/** Every (crisis, index) pair in the search space, for the searches below. */
function allStates(): State[] {
  const out: State[] = [];
  for (const crisis of CRISIS_LEVELS) {
    for (let index = 0; index < CYCLE; index += 1) out.push({ crisis, index });
  }
  return out;
}

/**
 * The states the crisis formula actually permits at this HP.
 *
 * The crisis level is rolled from the byte at the OPENING index, so a state is
 * only possible if some opening it could have come from rolls the crisis it
 * claims to be in. Leaving this out is what let a single reading of Sleep at
 * Lv11 349/2797 return 13 candidates when only one of them is a live opening.
 *
 * `readFromOpening` is the tight form, used when the first spell typed is the
 * one the Limit Break opened on, so the run's own start index must be that
 * opening. The loose form is all that can be said when the runner started
 * typing part way through: Do Over moves by four and the crisis is held, so the
 * state is possible whenever ANY live opening in the same residue class rolls
 * that crisis, which makes the whole test a lookup on `index % 4`.
 */
function reachableStates(party: Party, readFromOpening: boolean): State[] {
  const out: State[] = [];

  if (readFromOpening) {
    for (let index = 0; index < CYCLE; index += 1) {
      const crisis = crisisAtOpen(index, party);
      if (crisis) out.push({ crisis, index });
    }
    return out;
  }

  const byResidue: Set<Crisis>[] = Array.from({ length: DO_OVER_STEP }, () => new Set<Crisis>());
  for (let index = 0; index < CYCLE; index += 1) {
    const crisis = crisisAtOpen(index, party);
    if (crisis) at(byResidue, index % DO_OVER_STEP).add(crisis);
  }
  for (const crisis of CRISIS_LEVELS) {
    for (let index = 0; index < CYCLE; index += 1) {
      if (at(byResidue, index % DO_OVER_STEP).has(crisis)) out.push({ crisis, index });
    }
  }
  return out;
}

/**
 * Compensating for the fact that Do Overs to determine index consume RNG while you do so.
 */
const positionAfter = (first: number, count: number): number =>
  wrapIndex(first + DO_OVER_STEP * (count - 1));

/**
 * What every row could still be, walking the candidate set down one row at a
 * time.
 *
 * A single pass gives the whole ladder. Each row's shortlist is the distinct
 * spells the states still standing show at that step, and typing one of them
 * narrows the set for the row below. At Lv11 349/2797 that is 23 of the 50
 * spells at the first row and usually exactly one by the second, which turns
 * the next input from a guess into a prediction.
 *
 * `useCasts` follows whatever the search settled on, so the shortlist can never
 * be stricter than the answer beside it.
 */
function optionsByRow(
  candidates: readonly State[],
  level: number,
  observations: readonly Observation[],
  useCasts: boolean,
  rows: number,
): string[][] {
  const out: string[][] = [];
  let alive: readonly State[] = candidates;

  for (let row = 0; row < rows; row += 1) {
    const seen = new Set<string>();
    for (const { index, crisis } of alive) {
      seen.add(spellAt(index + DO_OVER_STEP * row, level, crisis).spell);
    }
    out.push([...seen].sort());

    const typed = observations[row];
    if (!typed?.spell) break;
    alive = alive.filter(({ index, crisis }) => {
      const roll = spellAt(index + DO_OVER_STEP * row, level, crisis);
      if (!sameSpell(roll.spell, typed.spell)) return false;
      return !(useCasts && typed.casts && roll.casts !== typed.casts);
    });
  }

  return out;
}

/**
 * Works out both where you are and which crisis level the Limit Break opened
 * at, from the spells on screen.
 *
 * Each match carries two indices. `index` is where the run started, which is
 * what a written-down capture records. `current` is where the run left you, and
 * is the one to plan from.
 */
export function identify(
  level: number,
  observations: readonly Observation[],
  { party, scope = 'opening' }: IdentifyOptions = {},
): Reading {
  const useful = consecutivePrefix(observations);

  const candidatesFor = (rung: ReadingScope): State[] =>
    rung === 'all' || !party ? allStates() : reachableStates(party, rung === 'opening');

  // How many rows to price up: every filled one, plus the empty one below it,
  // which is the row the shortlist is actually for. Not capped by how many rows
  // the caller happened to pass, because a caller passing one filled row still
  // wants to know what the next one can be, and an empty array still wants the
  // opening shortlist.

  // Nothing typed yet. There is no reading to solve, but the first row still has
  // a shortlist, and that is the most useful one of the lot: it is on screen
  // before the runner has touched anything.
  if (!useful.length) {
    const chosenNow: ReadingScope = party ? scope : 'all';
    return {
      matches: [],
      ignoredCasts: false,
      scope: chosenNow,
      droppedPartyFilter: false,
      options: optionsByRow(candidatesFor(chosenNow), level, observations, true, 1),
    };
  }

  const search = (rung: ReadingScope) => searchWithCastFallback(candidatesFor(rung), level, useful);

  // 'opening' is the normal case and by far the stronger constraint: three
  // readings from a live opening settle 98 of 98 states at Lv11 349/2797.
  // 'residue' covers a runner already several Do Overs in before they started
  // typing, where only index % 4 can be pinned, and it settles about half as
  // often. Which one applies is the caller's to say, not this function's.
  //
  // 'all' is the one automatic step, taken only when the chosen rung finds
  // nothing whatsoever. That means no state the crisis formula permits produces
  // this reading, so the filter is dropped to keep an answer on screen with
  // droppedPartyFilter set, rather than telling a runner that the spells in
  // front of them are impossible.
  const chosen: ReadingScope = party ? scope : 'all';
  let rung = chosen;
  let found = search(chosen);
  if (chosen !== 'all' && !found.matches.length) {
    const wide = search('all');
    if (wide.matches.length) {
      rung = 'all';
      found = wide;
    }
  }

  return {
    ...found,
    scope: rung,
    droppedPartyFilter: chosen !== 'all' && rung === 'all',
    // Built from the same candidate set and the same cast strictness the answer
    // came from, so a row can never be offered a spell the reading beside it has
    // already ruled out.
    options: optionsByRow(
      candidatesFor(rung),
      level,
      observations,
      !found.ignoredCasts,
      useful.length + 1,
    ),
    matches: found.matches.map((match) => ({
      ...match,
      current: positionAfter(match.index, useful.length),
    })),
  };
}

/**
 * The next reading that would tell two or more candidate states apart.
 *
 * Adjacent crisis levels often read neighbouring rows of the slot array, and 27
 * of the array's 55 adjacent row pairs hold the same set id, so those two crisis
 * levels show the identical spell. When that keeps happening the candidates stay
 * tied for several Do Overs. They always separate in the end - measured across
 * ten level bands, every index and every crisis pair, no pair stays tied
 * forever - but it can take up to 16 readings, and 6% of ties need more than
 * four.
 *
 * `taken` is how many readings there are already. Returns the number of extra
 * Do Overs needed and what each candidate predicts you will see, so the answer
 * to a tie is a specific instruction rather than "try again".
 */
export function discriminator(
  level: number,
  matches: readonly Match[],
  taken: number,
): Discriminator | null {
  if (matches.length < 2) return null;

  for (let reading = Math.max(taken, 1); reading < taken + CYCLE / DO_OVER_STEP; reading += 1) {
    const predictions = matches.map((match) => {
      const roll = spellAt(match.index + DO_OVER_STEP * reading, level, match.crisis);
      return { crisis: match.crisis, spell: roll.spell, casts: roll.casts };
    });
    const distinct = new Set(predictions.map((roll) => `${roll.spell}x${roll.casts}`));
    if (distinct.size > 1) {
      return { doOversAway: reading - taken + 1, reading, predictions };
    }
  }
  return null;
}
