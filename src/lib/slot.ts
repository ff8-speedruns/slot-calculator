/**
 * Selphie's Slot roll, plus the manip planning on top of it.
 *
 * Two things happen. Opening the Limit Break rolls a crisis level once, from the
 * byte at the opening index plus Selphie's HP and statuses, and it's stuck there
 * for the rest of the Limit Break. Every Do Over after that only rolls the
 * spell, reading four bytes and moving the index +4:
 *
 *   B[i+1]  the [0..4] term, mod 5
 *   B[i+2]  the slot mod, through the thresholds below
 *   B[i+3]  which of the set's 8 spells, mod 8
 *   B[i+4]  the cast count, mod that spell's max
 *
 * None of this touches the enemy or the encounter. What a fight changes is where
 * the index already is, and how fast other actors move it while you think.
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
  RefreshEstimate,
  ReopenOutlook,
  Roll,
  Statuses,
  Target,
} from './types.ts';

/** The random table's length, and so the length of the whole manip cycle. */
export const CYCLE = RNG_TABLE.length;

/**
 * Whether the cast-count inputs are shown. Off to keep typing down: the count
 * does narrow a reading (different byte from the name), but every search still
 * filters on one when it's given, so nothing is lost by hiding the input.
 */
export const SHOW_CAST_COUNTS = false;

/** A Do Over advances the RNG index by this much. */
export const DO_OVER_STEP = 4;

/**
 * Assumed index movement per ATB refresh, until a runner overrides it. Three
 * captures put a skipped turn at +7; a fourth moved +17 over four turns, and 17
 * is prime, so no one constant fits all of them. A starting guess, not a plan.
 */
export const DEFAULT_REFRESH_STEP = 7;

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
 * Reads a slot we know is filled. `noUncheckedIndexedAccess` makes every
 * `array[i]` possibly-undefined. Right in general, noise for these tables - the
 * RNG table is exactly 256 long and every read wraps into it.
 * Throwing beats sprinkling `!` through the arithmetic.
 */
export function at<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) throw new RangeError(`index ${index} is outside the table`);
  return value;
}

/**
 * An index plus the crisis in play there. Covers both an opening and a candidate
 * state the reader hasn't placed yet - they're the same pair.
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
 * Crisis level Selphie opens at, from the index the menu opened on. 0 means no
 * Limit Break. Rolled once; every Do Over after keeps whatever came out.
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
 * The spell on screen at one index, for a Limit Break already open at a known
 * crisis.
 *
 * slotIndex is NOT clamped on purpose. The kernel's array is 60 bytes but this
 * reaches 65 at Lv100/crisis 4/x=4, and the game really does read past the end
 * into the slot sets after it. Those six rows show up in play.
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

  // 0 through 65 all have rows so this can't miss. Guard is here so a future
  // level/crisis change fails loudly instead of returning undefined.
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
 * A run of consecutive Do Overs from one state. Every reading sequence in here
 * is this same walk, so the +4 arithmetic only lives in one place.
 */
const rollsFrom = (index: number, level: number, crisis: Crisis, depth: number): Roll[] =>
  Array.from({ length: depth }, (_, step) => spellAt(index + DO_OVER_STEP * step, level, crisis));

/**
 * Every index the Limit Break can open at, with the crisis it rolls there.
 * `hpOutlook` still counts inline - it asks this once per sampled HP, and
 * building a couple of hundred throwaway lists costs more than it saves.
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

/**
 * Every spell the slot array can produce, for populating menus.
 */
export const SPELLS: readonly string[] = [...new Set(SLOT_ARRAY.flat().map((cell) => cell[0]))];

const SPELL_NAMES = new Set(SPELLS.map((name) => name.toLowerCase()));

/** Gap between two indices. Anything not a multiple of 4 needs turn-skips. */
function planTo(from: number, to: number) {
  const steps = wrapIndex(to - from);
  const skips = steps % DO_OVER_STEP;
  return { steps, skips, doOvers: (steps - skips) / DO_OVER_STEP };
}

/**
 * Every index showing the target at this crisis, nearest first. `casts` 0 means
 * any. `reachable` marks the ones on the +4 lattice from where you are.
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
 * Every spell, sorted by why it is or isn't worth chasing.
 *
 *   'level'  not in any slot row this level can read, at any crisis. 11 of 50
 *            spells are stuck here at Lv11.
 *   'hp'     exists at this level, but no opening at this HP gets to it.
 *   'ready'  at least one opening reaches it.
 */
/**
 * Does this spell need a warning badge? The badge and the width the picker
 * reserves for it both ask, so the rule lives here instead of in two places.
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
 * Inside one Limit Break the crisis is held and every move is +4, so you can only
 * ever see the 64 indices in your residue class. Either the target is one of
 * them and this is the whole plan, or it isn't and you get null.
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
 * Spells from where you stand to the target, both ends included - so the Do Over
 * count is length minus one. Null if it isn't in this Limit Break.
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
    // Slot 0 is the no-Limit-Break case, so the crisis can index straight in.
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

/** Reads one cell of a reach table. Always filled. */
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
    // A turn pays off only if the Limit Break appears AND lands on an opening
    // that reaches the target, so the per-turn chance is good / 256.
    expectedTurns: good ? CYCLE / good : Infinity,
    // The mean sits well above the median here: at 60 of 256 the mean is 4 but
    // half of all attempts are done in 2. Showing only the mean is what made a
    // two-refresh success look like luck when it was the normal case.
    halfWithin: refreshesWithin(good, 0.5),
    ninetyWithin: refreshesWithin(good, 0.9),
    possible: good > 0,
  };
}

/**
 * How many refreshes it takes to be `chance` sure of a working opening, on the
 * same per-turn probability the mean above is built from.
 */
function refreshesWithin(good: number, chance: number): number {
  if (good <= 0) return Infinity;
  const perTurn = good / CYCLE;
  if (perTurn >= 1) return 1;
  return Math.ceil(Math.log(1 - chance) / Math.log(1 - perTurn));
}

/**
 * First opening that reaches the target, if every refresh really moved the index
 * by `step`. Other tools quote this as an instruction; here it's a guess, because
 * the fixed step is the shakiest thing in the model (see RefreshEstimate).
 *
 * Being wrong is cheap if the runner still reads every opening and expensive if
 * they use it to skip reading them, so show it as a guess. Null if nothing on
 * the walk works.
 */
export function nextWorkingOpening(
  party: Party,
  target: Target,
  from: number,
  step: number,
): RefreshEstimate | null {
  if (!Number.isInteger(step) || step <= 0) return null;
  const reachable = reachTable(party.level, target);

  // After CYCLE steps the walk is back where it started, so nothing new can
  // turn up past this bound.
  for (let refreshes = 1; refreshes <= CYCLE; refreshes += 1) {
    const index = wrapIndex(from + step * refreshes);
    const crisis = crisisAtOpen(index, party);
    if (crisis && reaches(reachable, index, crisis)) return { refreshes, index, crisis };
  }
  return null;
}

/**
 * Every opening that reaches the target, the spells that identify it, and the Do
 * Overs owed once you've seen them. The whole answer up front, so a runner who's
 * busy playing types nothing: watch the Slot, match a row, press Do Over.
 *
 * Rows are keyed on spell NAME only, never the cast count. Keying on the count
 * was tried and it broke: at Lv8 34/482 it made `Sleep x2` look unique on the
 * first reading, but two live openings show Sleep and the other can't reach The
 * End. Gloss the count and you'd spend 57 Do Overs on a dead opening. Counts ride
 * along on every reading to confirm a row, never to pick one.
 *
 * A row is only listed once its names are unique among all live openings, dead
 * ones included, and each row is as short as that allows. Anything still
 * ambiguous at `maxDepth` goes in `unresolved` instead - those openings DO reach
 * the target, so don't tell a runner that unlisted means safe to pass. Default 5
 * is measured; nothing sampled needed more.
 */
export function openingRoutes(
  party: Party,
  { spell, casts = 0 }: Target,
  maxDepth = 5,
): OpeningRoutes {
  const { level } = party;
  const target = { spell, casts };

  // Reachability only depends on residue class and crisis, so this 16-cell table
  // covers every opening at fixed cost. Asking doOversTo per opening was ~8,000
  // rolls to work out 125 booleans.
  const reachable = reachTable(level, target);

  // Walk each opening to max depth once; shallower signatures are prefixes.
  const walked = liveOpenings(party).map((state) => ({
    state,
    readings: rollsFrom(state.index, level, state.crisis, maxDepth),
  }));
  const keyOf = (readings: readonly Roll[], depth: number): string =>
    readings
      .slice(0, depth)
      .map((roll) => roll.spell)
      .join(',');

  // How many openings share each signature, per depth, so the test below is a
  // lookup instead of another scan over all 256.
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

    // Every reading after the first cost a Do Over, so this is where you're
    // standing once the last one shows.
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

  // Cheapest rows first: fewest readings, then shortest wait.
  routes.sort(
    (a, b) => a.readings.length - b.readings.length || a.doOvers - b.doOvers || a.index - b.index,
  );

  return {
    routes,
    unresolved,
    dead,
    live: walked.length,
    // Does the list cover every opening that works? Decides whether a caller can
    // say "anything unlisted is safe to pass". Settled here, not per call site.
    complete: unresolved === 0,
  };
}

/**
 * How the odds change with HP.
 */
export function hpOutlook(party: Party, { spell, casts = 0 }: Target): HpOutlook {
  const table = reachTable(party.level, { spell, casts });
  // Count openings, not a ratio. A ratio flatters high HP, where almost nothing
  // is live but the one that is happens to work - reads as 100%, means 100 turns.
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

export const topSpellMatch = (typed: string, options: readonly string[]): string | null => {
  const needle = typed.trim().toLowerCase();
  return options.find((name) => name.toLowerCase().startsWith(needle)) ?? null;
};

/**
 * Rows are one Do Over apart, so a blank in the middle throws off everything
 * after it. Only the run before the first blank is trustworthy.
 */
export const consecutivePrefix = (observations: readonly Observation[]): Observation[] => {
  const firstGap = observations.findIndex(
    (observation) => !SPELL_NAMES.has(observation?.spell.trim().toLowerCase() ?? ''),
  );
  return [...(firstGap === -1 ? observations : observations.slice(0, firstGap))];
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
 * Cast counts come from a different byte than the name, so they narrow the search
 * on their own. They're exact, but misreading a number on screen is easy, so a
 * search that finds nothing with them is retried without them.
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
 * States the crisis formula actually allows at this HP. Crisis is rolled from the
 * byte at the OPENING index, so a state only works if some opening it could have
 * come from rolls the crisis it claims. Without this, one reading of Sleep at
 * Lv11 349/2797 came back with 13 candidates and only one was live.
 *
 * `readFromOpening` is the tight version: the first spell typed IS the opening
 * roll. Otherwise all you can say is that some live opening in the same residue
 * class rolls that crisis, which is just a lookup on `index % 4`.
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
 * What each row could still be, narrowing one row at a time. Each shortlist is
 * the distinct spells the surviving states show at that step. At Lv11 349/2797
 * that's 23 of 50 spells on row one and usually exactly one by row two.
 *
 * `useCasts` follows whatever the search settled on, so a shortlist is never
 * stricter than the answer next to it.
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
    out.push(SPELLS.filter((name) => seen.has(name)));

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
 * Works out where you are and which crisis you opened at, from the spells on
 * screen. Each match has two indices: `index` is where the run started (what a
 * written-down capture records), `current` is where it left you - plan from that.
 */
export function identify(
  level: number,
  observations: readonly Observation[],
  { party, scope = 'opening' }: IdentifyOptions = {},
): Reading {
  const useful = consecutivePrefix(observations);

  const candidatesFor = (rung: ReadingScope): State[] =>
    rung === 'all' || !party ? allStates() : reachableStates(party, rung === 'opening');

  // Nothing typed yet. No reading to solve, but the first row still gets a
  // shortlist - and that's the most useful one, since it's up before the runner
  // has touched anything.
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

  // 'opening' is the normal case and much the stronger constraint: three readings
  // from a live opening settle 98 of 98 states at Lv11 349/2797. 'residue' is for
  // someone already a few Do Overs in, where only index % 4 can be pinned, and it
  // settles about half as often. The caller picks, not this function.
  //
  // 'all' is the one automatic fallback, and only when the chosen scope finds
  // nothing at all. At that point no allowed state produces this reading, so drop
  // the filter, set droppedPartyFilter, and keep an answer on screen instead of
  // telling someone the spells in front of them are impossible.
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
 * The next reading that separates two or more tied candidates.
 *
 * Adjacent crisis levels often read neighbouring slot rows, and 27 of the 55
 * adjacent row pairs share a set id, so they show the same spell and candidates
 * stay tied. They always separate eventually (checked across ten level bands,
 * every index, every crisis pair) but it can take 16 readings, and 6% of ties
 * need more than four.
 *
 * `taken` is how many readings you already have. Returns how many more Do Overs
 * you need and what each candidate predicts, so a tie gets a real instruction.
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
