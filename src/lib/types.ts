/** The contract between slot.ts and the components that draw its output. */

/**
 * Crisis levels the Limit Break can open at. 0 lives in its own type below -
 * "no Limit Break" isn't a fifth level, and keeping them apart stops a dead
 * index getting passed where a live crisis is expected.
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
 * How the candidates were narrowed. `opening` is the normal case - the first
 * spell typed IS the opening roll. `residue` is the weaker one for a reading
 * started mid-Limit-Break. `all` means no party, or the filter got dropped.
 */
export type ReadingScope = 'all' | 'opening' | 'residue';

/** Extra constraints for `identify`. All optional, so a bare call still works. */
export interface IdentifyOptions {
  /** Supply this and states the crisis formula forbids at this HP are dropped. */
  party?: Party;
  /**
   * Which constraint to apply. Can't be picked automatically - these answer
   * different questions and only the caller knows which the runner is in.
   * Trying `opening` first and falling through was tried: it silently drops the
   * true state for 87% of readings started part way in.
   */
  scope?: ReadingScope;
}

/** The result of solving the spells on screen. */
export interface Reading {
  matches: Match[];
  ignoredCasts: boolean;
  /**
   * What each row could still be, given the rows above it. One entry per row,
   * ending with the first empty one. An empty entry means nothing survives that
   * far (a misread), so fall back to offering the whole spell list.
   */
  options: string[][];
  /** Which constraint the surviving candidates were filtered against. */
  scope: ReadingScope;
  /**
   * No allowed state produces this reading, so the HP filter was dropped to keep
   * an answer on screen. Usually means the HP here isn't the HP it opened at.
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
  /**
   * The MEAN refresh count - a long-run average, not what you usually see. It
   * sits well above the median, so showing only this makes a common spell look
   * like a slog.
   */
  expectedTurns: number;
  /** Refreshes by which half of all attempts have it. The typical case. */
  halfWithin: number;
  /** Refreshes by which nine in ten have it. The bad-luck case. */
  ninetyWithin: number;
  possible: boolean;
}

/**
 * Where a fixed RNG cost per refresh would put you. An estimate, not a plan: it
 * assumes every refresh moves the index the same amount, and that's the one
 * thing here that's never held up. A skipped turn measured +7 three times, but
 * four turns once came to +17, and 17 is prime. Every CL check spends RNG even
 * when no Limit Break comes of it, so the real cost depends on ally ATB.
 */
export interface RefreshEstimate {
  refreshes: number;
  index: number;
  crisis: Crisis;
}

/**
 * One opening, the readings that identify it, and what it costs from there.
 * `readings` starts with the opening roll, so watch for them in order. Seeing
 * them all means you're at this index and crisis. `doOvers` counts from where
 * they leave you, which is one fewer press than there are readings.
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
  /**
   * True when `routes` covers every opening that works, so anything unlisted can
   * be passed. False means some `unresolved` openings work but couldn't be
   * named - don't present the list as exhaustive.
   */
  complete: boolean;
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
