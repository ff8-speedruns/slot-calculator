/**
 * These types are the contract between slot.ts and components that draw its
 * output.
 */

/**
 * Crisis levels the Limit Break can open at.
 *
 * 0 is a separate idea and has its own type below, because "no Limit Break at
 * all" is not a fifth level of one. Keeping them apart means a function that
 * returns a live crisis cannot silently be handed a dead index.
 */
export type Crisis = 1 | 2 | 3 | 4;

/** What `crisisAtOpen` returns: a crisis level, or 0 for no Limit Break. */
export type OpeningCrisis = 0 | Crisis;

/** Cast counts the slot array can produce. The kernel maximum per cell is 3. */
export type Casts = 1 | 2 | 3;

/** A cast filter. 0 means "any", which is how every search reads a missing one. */
export type CastFilter = 0 | Casts;

/** Statuses the crisis formula weighs. Anything else on Selphie is irrelevant. */
export interface Statuses {
  aura?: boolean;
  blind?: boolean;
  silence?: boolean;
  slow?: boolean;
  poison?: boolean;
  gradualPetrify?: boolean;
  doom?: boolean;
}

export type StatusName = keyof Statuses;

/** Everything the crisis roll depends on, plus the level the reading needs. */
export interface Party {
  level: number;
  currentHp: number;
  maxHp: number;
  deadAllies: number;
  statuses: Statuses;
}

/** What the runner is chasing. `casts: 0` accepts any cast count. */
export interface Target {
  spell: string;
  casts?: CastFilter;
}

/** One spell typed into the reader. An empty `spell` means the row is blank. */
export interface Observation {
  spell: string;
  casts: CastFilter;
}

/** One roll of the Slot: what is on screen at an index, at a crisis level. */
export interface Roll {
  index: number;
  crisis: Crisis;
  slotIndex: number;
  spellIndex: number;
  spell: string;
  casts: Casts;
}

/** A state the reading could be in: where it started, and where it left you. */
export interface Match {
  index: number;
  crisis: Crisis;
  current: number;
}

/**
 * How the candidate set was narrowed before matching.
 *
 * `opening` is the normal case: the first spell typed is the one the Limit Break
 * opened on, so the run's start index must itself be an index whose byte rolls
 * the crisis the candidate claims. `residue` is the weaker form for a reading
 * begun mid-Limit-Break, where only the residue class can be constrained. `all`
 * means no party was supplied, or the party filter had to be dropped.
 */
export type ReadingScope = 'all' | 'opening' | 'residue';

/** Extra constraints for `identify`. All optional, so a bare call still works. */
export interface IdentifyOptions {
  /** Supply this and states the crisis formula forbids at this HP are dropped. */
  party?: Party;
  /**
   * Which constraint to apply, defaulting to the tight one.
   *
   * This cannot be chosen automatically. `opening` and `residue` are not two
   * guesses at one answer, they answer different questions, and only the caller
   * knows which case the runner is in. Trying `opening` first and falling
   * through when it finds nothing was measured and abandoned: it excludes the
   * true state for 87% of readings begun part way into a Limit Break, and it
   * does so silently.
   */
  scope?: ReadingScope;
}

/** The result of solving the spells on screen. */
export interface Reading {
  matches: Match[];
  ignoredCasts: boolean;
  /**
   * What each row could still be, given every row above it. One entry per
   * rendered row, ending with the first empty one, so the row a runner is about
   * to fill knows its own shortlist. An empty entry means no candidate survives
   * that far, which is a misread rather than a shortlist, and the caller should
   * fall back to offering everything.
   */
  options: string[][];
  /** Which constraint the surviving candidates were filtered against. */
  scope: ReadingScope;
  /**
   * True when no state the crisis formula allows produces this reading, so the
   * filter was dropped to keep an answer on screen. Usually means the HP in the
   * tool is not the HP the Limit Break actually opened at.
   */
  droppedPartyFilter: boolean;
}

/** How to tell two tied candidates apart, and what each will show. */
export interface Discriminator {
  doOversAway: number;
  reading: number;
  predictions: { crisis: Crisis; spell: string; casts: Casts }[];
}

/** A hit found by `findSpell`, with what it costs from where you are. */
export interface Hit extends Roll {
  plan: { steps: number; skips: number; doOvers: number };
  reachable: boolean;
}

/** Why a spell is or is not worth chasing. */
export type AvailabilityState =
  /** In no cell this level band can reach, at any crisis, at any HP. */
  | 'level'
  /** Exists at this level, but no opening at this HP reaches it. */
  | 'hp'
  /** Some opening reaches it. */
  | 'ready';

export interface Availability {
  spell: string;
  state: AvailabilityState;
  good: number;
  live: number;
}

/** What re-opening the Limit Break is worth for one target. */
export interface ReopenOutlook {
  live: number;
  good: number;
  crisisLevels: Crisis[];
  expectedTurns: number;
  possible: boolean;
}

/** One entry in the opening watch list. */
export interface WatchEntry {
  reading: string;
  /** The spell name alone, which is what the reader accepts as an observation. */
  spell: string;
  /** The count shown beside it. Only typeable while SHOW_CAST_COUNTS is on. */
  casts: Casts;
  openings: number;
  /** No dead opening shows this same reading, cast count included. */
  decisive: boolean;
  /**
   * The reader settles on exactly one state from this reading alone. Weaker than
   * `decisive` whenever the cast count is part of the label but not part of what
   * can be typed, which is the case while SHOW_CAST_COUNTS is off.
   */
  pins: boolean;
}

/**
 * One opening, the readings that identify it, and what it costs from there.
 *
 * `readings` starts with the opening roll itself, so a runner watches for these
 * in order. Seeing all of them means you are at this index and crisis, and
 * `doOvers` is the count from where those readings leave you - after `readings`
 * of them the Do-Over button has been pressed one fewer time than that.
 */
export interface OpeningRoute {
  index: number;
  crisis: Crisis;
  readings: Roll[];
  doOvers: number;
}

/** Every opening worth stopping at, spelled out. */
export interface OpeningRoutes {
  routes: OpeningRoute[];
  /** Useful openings needing more readings than the cap allows. */
  unresolved: number;
  /** Live openings that cannot reach the target at all. */
  dead: number;
  live: number;
}

/** What to look for when the Limit Break comes back. */
export interface OpeningGuide {
  useful: number;
  dead: number;
  watchFor: WatchEntry[];
  rulesOut: number;
  decisive: number;
  settleDepth: number | null;
}

/** How the odds for one target change with HP. */
export interface HpPoint {
  hp: number;
  good: number;
  expectedTurns: number;
}

export interface HpOutlook {
  current: HpPoint;
  best: HpPoint;
  ceiling: number | null;
}
