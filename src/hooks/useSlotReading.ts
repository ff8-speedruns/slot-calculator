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
 * row of the slot array and stay tied for a while. The worst tie measured needs
 * 16, so the panel grows to that rather than dead-ending at four.
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

  // Whether the first spell typed is the one the Limit Break opened on, which
  // is much the stronger constraint and the normal case. It cannot be inferred:
  // assuming it when it is false excludes the true state for 76% of readings
  // begun part way in, without saying so.
  const [readFromOpening, setReadFromOpening] = useState(true);

  // The party is what rules out the states the crisis formula forbids at this
  // HP. Without it the search returns all 1,024 and most of them cannot exist,
  // which is how one reading of Sleep at Lv11 349/2797 used to come back with 13
  // candidates when only one was a live opening.
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

  // A tie that every candidate answers the same way is not worth breaking. The
  // answer is a Do Over count or the absence of one, so two candidates agree
  // when they need the same number of presses, or when neither can get there.
  //
  // Memoised because doOversTo walks up to 64 indices per candidate, and a tie
  // can carry a dozen of them.
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
   * Start a fresh reading from a run of spells, which is what picking a row off
   * the opening list means: the row names exactly what the runner saw, and a row
   * is unique among live openings by name, so seeding it settles the reading.
   *
   * The list is only sound on the OPENING roll, so this also ticks the box that
   * says so: leaving it as the runner last had it would solve the new reading
   * under the residue scope and quietly return the wrong states.
   *
   * The cast count is dropped while SHOW_CAST_COUNTS is off. It would otherwise
   * filter the search on a value the runner can neither see nor clear.
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
  }, []);

  // Only plan from a state the reading actually settled on, or from a tie whose
  // candidates all need the same number of Do Overs. Reaching into matches[0]
  // whenever anything matched meant an unsettled reading rendered a confident
  // plan built on whichever candidate happened to sort first.
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
