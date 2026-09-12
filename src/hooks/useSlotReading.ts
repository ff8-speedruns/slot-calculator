import { useCallback, useMemo, useState } from 'react';

import {
  SHOW_CAST_COUNTS,
  consecutivePrefix,
  discriminator,
  doOversTo,
  identify,
  wrapIndex,
} from '../lib/slot.ts';
import type { Observation, Party, Roll, Target } from '../lib/types.ts';

/**
 * Four readings settle most states, but adjacent crisis levels can read the same
 * slot row and stay tied. Worst tie measured needs 16, so the panel goes to 16.
 */
const MAX_OBSERVATIONS = 16;

/** Only ever one empty row past the last filled one. */
const VISIBLE_HEADROOM = 1;

const BLANK_OBSERVATION: Observation = { spell: '', casts: 0 };

const emptyReading = (): Observation[] =>
  Array.from({ length: MAX_OBSERVATIONS }, () => BLANK_OBSERVATION);

/**
 * Everything that follows from the spells on screen.
 *
 * `offset` is passed in to survive a clear.
 */
export function useSlotReading(party: Party, target: Target, offset: number) {
  const [observations, setObservations] = useState<Observation[]>(emptyReading);

  // Is the first spell typed the one it opened on? Much the stronger constraint
  // and the normal case, but it can't be inferred - assuming it wrongly drops the
  // true state for 76% of readings begun part way in, silently.
  const [readFromOpening, setReadFromOpening] = useState(true);

  // The party rules out states the crisis formula forbids at this HP. Without it
  // the search returns all 1,024, most of which can't exist - one reading of Sleep
  // at Lv11 349/2797 used to come back with 13 candidates, only one of them live.
  const reading = useMemo(
    () =>
      identify(party.level, observations, {
        party,
        scope: readFromOpening ? 'opening' : 'residue',
      }),
    [party, observations, readFromOpening],
  );

  const solved = reading.matches.length === 1 ? (reading.matches[0] ?? null) : null;
  const crisis = solved?.crisis ?? null;

  const current = solved ? wrapIndex(solved.current + offset) : null;

  const taken = consecutivePrefix(observations).length;
  const visible = Math.min(MAX_OBSERVATIONS, taken + VISIBLE_HEADROOM);

  // A tie where every candidate gives the same answer isn't worth breaking - they
  // agree if they need the same number of presses, or if none can get there.
  // Memoised: doOversTo walks up to 64 indices per candidate and ties get big.
  const tieIsMoot = useMemo(() => {
    if (reading.matches.length <= 1) return false;
    const plans = reading.matches.map(
      (match) => doOversTo(party.level, match.current, match.crisis, target)?.doOvers ?? null,
    );
    return plans.every((plan) => plan === plans[0]);
  }, [reading.matches, party.level, target]);

  const tieBreaker = useMemo(
    () => (tieIsMoot ? null : discriminator(party.level, reading.matches, taken)),
    [tieIsMoot, party.level, reading.matches, taken],
  );

  const handleObservationChange = useCallback((position: number, value: Observation) => {
    setObservations((existing) => existing.map((entry, at) => (at === position ? value : entry)));
  }, []);

  /**
   * Start a fresh reading from a run of spells - what clicking a row on the
   * opening list means. Rows are unique among live openings by name, so seeding
   * one settles the reading.
   *
   * Also ticks the "first spell is the opening" box, because the list is only
   * sound on the opening roll. Leaving it as the runner had it would solve under
   * the residue scope and quietly return the wrong states.
   *
   * Cast counts are dropped while SHOW_CAST_COUNTS is off, or they'd filter on a
   * value the runner can't see or clear.
   */
  const handleStartFrom = useCallback((readings: readonly Roll[]) => {
    const next = emptyReading();
    readings.slice(0, MAX_OBSERVATIONS).forEach((roll, position) => {
      next[position] = { spell: roll.spell, casts: SHOW_CAST_COUNTS ? roll.casts : 0 };
    });
    setObservations(next);
    setReadFromOpening(true);
  }, []);

  const handleClearReading = useCallback(() => {
    setObservations(emptyReading());
    setReadFromOpening(true);
  }, []);

  // Only plan from a state the reading settled on, or a tie where every candidate
  // needs the same presses. Grabbing matches[0] whenever anything matched gave a
  // confident plan built on whichever candidate happened to sort first.
  const planState = solved ?? (tieIsMoot ? (reading.matches[0] ?? null) : null);
  const planFrom = current ?? planState?.current ?? null;
  const planCrisis = crisis ?? planState?.crisis ?? null;

  return {
    observations,
    visible,
    taken,
    planFrom,
    planCrisis,
    readFromOpening,
    reading,
    solved,
    crisis,
    current,
    tieIsMoot,
    tieBreaker,
    handleObservationChange,
    handleClearReading,
    handleStartFrom,
    handleReadFromOpeningChange: setReadFromOpening,
  };
}
