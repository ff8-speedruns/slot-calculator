/**
 * Self-check for the slot tables. Run with `node src/lib/slot.check.js`.
 *
 * Two kinds of anchor here, and the second kind is the one that matters most.
 *
 * The table anchors pin the extracted kernel data: byte offsets, the *12
 * stride, the missing clamp. An off-by-one in any of them silently changes
 * every spell the tool reports while still looking plausible.
 *
 * The field captures are readings taken off a real screen and were never used
 * to build anything. They are what caught the crisis level being re-rolled per
 * Do Over instead of held for the whole Limit Break, and they are what would
 * catch it coming back.
 */

import assert from 'node:assert/strict';
import type { Casts, CastFilter, Crisis, Observation, Party, Reading } from './types.ts';
import { RNG_TABLE, SLOT_ARRAY } from './slot.data.ts';
import {
  CRISIS_LEVELS,
  SHOW_CAST_COUNTS,
  CYCLE,
  DO_OVER_STEP,
  SPELLS,
  crisisAtOpen,
  discriminator,
  doOverPath,
  doOversTo,
  hpOutlook,
  openingGuide,
  openingRoutes,
  reopenOutlook,
  spellAvailability,
  findSpell,
  identify,
  rollCycle,
  at,
  spellAt,
  statusSum,
  wrapIndex,
} from './slot.ts';

/** Level 8, 34 HP of 482, nothing junctioned. The Any% setup. */
const ANY_PERCENT: Party = { level: 8, currentHp: 34, maxHp: 482, deadAllies: 0, statuses: {} };

/** Level 100 during Odin, Aura up. The 100% setup. */
const ODIN: Party = {
  level: 100,
  currentHp: 520,
  maxHp: 9576,
  deadAllies: 0,
  statuses: { aura: true },
};

// ---------------------------------------------------------------- table shape

assert.equal(RNG_TABLE.length, 256, 'random table is not 256 bytes');
assert.deepEqual(
  [...RNG_TABLE].sort((a, b) => a - b),
  Array.from({ length: 256 }, (_, byte) => byte),
  'random table is not a permutation of 0-255',
);

assert.equal(SLOT_ARRAY.length, 66, 'slot array should reach index 65, including the overflow');
for (const [index, row] of SLOT_ARRAY.entries()) {
  assert.ok(Array.isArray(row), `slot row ${index} is missing`);
  assert.equal(row.length, 8, `slot row ${index} does not hold 8 spell indices`);
  for (const [spell, maxCasts] of row) {
    assert.equal(typeof spell, 'string', `slot ${index} has a nameless spell`);
    assert.ok(maxCasts >= 1 && maxCasts <= 3, `slot ${index} has an impossible cast maximum`);
  }
}

// Rows 60-65 are the out-of-bounds reads. The set ids they land on are the
// first six bytes of the set block (1, 2, 4, 2, 7, 2), so each one has to be a
// duplicate of the in-bounds row that uses the same set. This is what would
// break first if the overflow were mis-transcribed.
const SAME_SET_AS: readonly (readonly [number, number])[] = [
  [60, 10],
  [61, 19],
  [62, 23],
  [63, 19],
  [64, 46],
  [65, 19],
];
for (const [overflow, inBounds] of SAME_SET_AS) {
  assert.deepEqual(
    at(SLOT_ARRAY, overflow),
    at(SLOT_ARRAY, inBounds),
    `overflow row ${overflow} should read the same set as row ${inBounds}`,
  );
}

// Straight from kernel.bin, including cells the earlier fitted tables got wrong.
assert.deepEqual(at(at(SLOT_ARRAY, 51), 7), ['The End', 1], 'The End moved in the slot array');
assert.deepEqual(at(at(SLOT_ARRAY, 59), 7), ['The End', 1], 'the second The End cell moved');
assert.deepEqual(at(at(SLOT_ARRAY, 38), 3), ['Cura', 1], 'Cura at 38/3 is a single cast');
assert.deepEqual(at(at(SLOT_ARRAY, 27), 0), ['Protect', 3], 'Protect at 27/0 allows three casts');

assert.ok(SPELLS.includes('The End'), 'The End missing from the spell list');
assert.ok(SPELLS.length > 40, 'spell list looks truncated');

// Every slot index the roll can reach has data, at every level and crisis.
for (let level = 1; level <= 100; level += 1) {
  for (const crisis of CRISIS_LEVELS) {
    for (let index = 0; index < CYCLE; index += 1) spellAt(index, level, crisis);
  }
}

// ---------------------------------------------------------- the field captures

/**
 * Selphie at level 11, 349 HP of 2797, no statuses, no allies down. Two runs of
 * four consecutive Do Overs, read off the screen.
 *
 * The second capture starts on the first one's last roll, at index 137, because
 * it was recorded straight afterwards from whatever was still on screen. Both
 * read Silence there, and the second capture gives it as x3.
 *
 * Neither capture resolves to anything if the crisis level is re-rolled per
 * Do Over: not at any HP, not at any level band, not at any step size from 1 to
 * 8, and not with any amount of RNG stolen between presses.
 */
/**
 * One reading written down off a real screen. `casts` is optional because the
 * first capture was recorded before anyone was noting the numbers.
 */
interface Capture {
  index: number;
  spells: string[];
  casts?: Casts[];
}

/** Unwraps a value the surrounding assertion has already ruled out as missing. */
function must<T>(value: T | null | undefined, message: string): T {
  assert.ok(value !== null && value !== undefined, message);
  return value;
}

/** The cast filter for one step of a capture, or 0 when none was recorded. */
const castAt = (capture: Capture, step: number): CastFilter =>
  capture.casts ? at(capture.casts, step) : 0;

/**
 * Skipping Selphie's turn advances the index by this much. Measured from the
 * cross-turn captures below, not assumed, and not confirmed beyond them. It
 * lives here rather than in slot.ts because nothing the app renders uses it.
 */
const SKIP_TURN_STEP = 7;

const FIELD: Party = { level: 11, currentHp: 349, maxHp: 2797, deadAllies: 0, statuses: {} };

const CAPTURE_ONE: Capture = { index: 125, spells: ['Silence', 'Fire', 'Thunder', 'Silence'] };
const CAPTURE_TWO: Capture = {
  index: 137,
  spells: ['Silence', 'Blind', 'Blizzara', 'Fire'],
  casts: [3, 1, 2, 1],
};

// Both captures opened at crisis 1, and the HP says they should have.
assert.equal(crisisAtOpen(CAPTURE_ONE.index, FIELD), 1, 'capture one did not open at crisis 1');
assert.equal(crisisAtOpen(CAPTURE_TWO.index, FIELD), 1, 'capture two did not open at crisis 1');

for (const capture of [CAPTURE_ONE, CAPTURE_TWO]) {
  capture.spells.forEach((spell, step) => {
    const roll = spellAt(capture.index + DO_OVER_STEP * step, FIELD.level, 1);
    assert.equal(
      roll.spell,
      spell,
      `capture at ${capture.index}: Do Over ${step} should show ${spell}, got ${roll.spell}`,
    );
    if (capture.casts) {
      assert.equal(
        roll.casts,
        at(capture.casts, step),
        `capture at ${capture.index}: wrong cast count`,
      );
    }
  });
}

// Three Do Overs from 125 lands on 137, so the first capture's last reading and
// the second capture's first are the same roll. They have to agree on it, which
// is a cross-check between two separate readings of the same screen.
assert.equal(
  wrapIndex(CAPTURE_ONE.index + DO_OVER_STEP * 3),
  CAPTURE_TWO.index,
  'the two captures no longer chain',
);
assert.equal(
  CAPTURE_ONE.spells.at(-1),
  CAPTURE_TWO.spells[0],
  'the captures disagree about the roll they share',
);

// Reading a spell costs the Do Over that revealed it, so the index you are
// standing on is the one the LAST reading came from. Getting this wrong
// overstates every plan by one Do Over per extra spell typed, which is exactly
// what a runner notices when the tool says 11 and the spell is 10 away.
for (let taken = 1; taken <= CAPTURE_TWO.spells.length; taken += 1) {
  const partial = CAPTURE_TWO.spells
    .slice(0, taken)
    .map<Observation>((spell, k) => ({ spell, casts: castAt(CAPTURE_TWO, k) }));
  const { matches } = identify(FIELD.level, partial);
  for (const match of matches) {
    assert.equal(
      match.current,
      wrapIndex(match.index + DO_OVER_STEP * (taken - 1)),
      'current index does not account for the Do Overs spent reading',
    );
    assert.equal(
      spellAt(match.current, FIELD.level, match.crisis).spell.toLowerCase(),
      at(partial, taken - 1).spell.toLowerCase(),
      'the current index does not show the last spell that was read',
    );
  }
}

// And the tool has to find them from the spells alone, crisis included, since
// that is what a runner actually does with them.
const foundTwo = identify(
  FIELD.level,
  CAPTURE_TWO.spells.map<Observation>((spell, k) => ({ spell, casts: castAt(CAPTURE_TWO, k) })),
);
assert.ok(
  foundTwo.matches.some((m) => m.index === CAPTURE_TWO.index && m.crisis === 1),
  'identify no longer recovers the second field capture',
);

// This capture is also the only evidence that the level term steps per ten
// levels in the middle of the range, rather than only at the two ends the
// reference tables cover.
assert.equal(Math.floor(FIELD.level / 10), 1, 'the field capture is meant to sit in level band 1');

// ------------------------------------------------------------------- the roll

// The community's Any% notes list nine HP/RNG/Do Over entries for The End and
// every one lands on index 179. Opening there at 34 HP rolls crisis 4.
assert.equal(crisisAtOpen(179, ANY_PERCENT), 4, 'the Any% opening no longer rolls crisis 4');
const anchor = spellAt(179, ANY_PERCENT.level, 4);
assert.equal(anchor.spell, 'The End', 'The End is no longer at index 179 in the Any% setup');
assert.equal(anchor.casts, 1, 'The End should always be a single cast');
assert.deepEqual([anchor.slotIndex, anchor.spellIndex], [51, 7], 'The End moved in the slot array');

// And it is the only index that gives it there, which is what makes the manip
// a single target rather than a search.
assert.deepEqual(
  rollCycle(ANY_PERCENT.level, 4)
    .filter((roll) => roll.spell === 'The End')
    .map((roll) => roll.index),
  [179],
  'The End should appear at exactly one index at level 8, crisis 4',
);

// Those same notes say 34 HP or under to open at crisis 4 on that index.
{
  const window = [];
  for (let currentHp = 1; currentHp <= ANY_PERCENT.maxHp; currentHp += 1) {
    if (crisisAtOpen(179, { ...ANY_PERCENT, currentHp }) === 4) window.push(currentHp);
  }
  assert.deepEqual(
    [window[0], window[window.length - 1]],
    [1, 34],
    'HP window for The End no longer matches the community figure',
  );
  assert.equal(window.length, 34, 'the window should be a single unbroken run');
}

// The level term shifts the read window by ten, which moves the target rather
// than removing it.
assert.deepEqual(
  rollCycle(ODIN.level, 4)
    .filter((roll) => roll.spell === 'The End')
    .map((roll) => roll.index),
  [215],
  'The End moved at level 100, crisis 4',
);

// A healthy Selphie has no Limit Break to open at all.
assert.equal(
  crisisAtOpen(179, { ...ANY_PERCENT, currentHp: 482 }),
  0,
  'a healthy Selphie should have no Limit available',
);
{
  const openingsAt = (party: Party, crisis: Crisis): number[] => {
    const out: number[] = [];
    for (let index = 0; index < CYCLE; index += 1) {
      if (crisisAtOpen(index, party) === crisis) out.push(index);
    }
    return out;
  };
  assert.equal(
    openingsAt({ ...ANY_PERCENT, currentHp: 482 }, 4).length,
    0,
    'no opening index should give crisis 4 at full health',
  );
  assert.ok(
    openingsAt(ANY_PERCENT, 4).includes(179),
    'index 179 should be a crisis 4 opening at 34 HP',
  );
}

// Aura is worth 200 before the multiplier, and dead allies 200 each after it.
assert.equal(statusSum({ aura: true, blind: true }), 230, 'status weights changed');
assert.ok(
  crisisAtOpen(0, { ...ODIN, deadAllies: 2 }) >= crisisAtOpen(0, { ...ODIN, deadAllies: 0 }),
  'dead allies should never lower the crisis level',
);

// ---------------------------------------------------------------- the planner
//
// findSpell reports how far each hit is and whether Do Overs alone can reach it.
// Its answers are what the map and the hit table draw, so they have to agree
// with a plain walk of the residue class.
for (const party of [ANY_PERCENT, FIELD]) {
  for (const crisis of CRISIS_LEVELS) {
    for (const spell of ['Cure', 'Wall', 'The End']) {
      for (const from of [0, 61, 137, 179]) {
        for (const hit of findSpell(party.level, crisis, { spell, from })) {
          assert.equal(hit.spell, spell, 'findSpell returned a different spell');
          assert.equal(
            hit.reachable,
            wrapIndex(hit.index - from) % DO_OVER_STEP === 0,
            `reachability is wrong for ${spell} at ${hit.index} from ${from}`,
          );
          if (hit.reachable) {
            assert.equal(
              wrapIndex(from + hit.plan.doOvers * DO_OVER_STEP),
              hit.index,
              'the Do Over count does not land on the hit',
            );
            assert.equal(
              spellAt(hit.index, party.level, crisis).spell,
              spell,
              'the hit index does not actually show the spell',
            );
          }
        }
      }
    }
  }
}

// Nearest first, and a hit you are standing on costs nothing.
{
  const hits = findSpell(ANY_PERCENT.level, 4, { spell: 'The End', from: 175 });
  assert.equal(hits.length, 1, 'The End should appear once at level 8, crisis 4');
  assert.equal(at(hits, 0).index, 179);
  assert.equal(at(hits, 0).plan.doOvers, 1, 'the Any% approach changed');
  assert.equal(
    at(findSpell(ANY_PERCENT.level, 4, { spell: 'The End', from: 179 }), 0).plan.doOvers,
    0,
  );
}

// ------------------------------------------------------- reading the position

// Four consecutive Do Over results must always find the state they came from.
for (const { level, crisis } of [
  { level: 8, crisis: 4 },
  { level: 11, crisis: 1 },
  { level: 100, crisis: 2 },
] as const) {
  for (const roll of rollCycle(level, crisis)) {
    const observations = [0, 1, 2, 3].map<Observation>((step) => {
      const seen = spellAt(roll.index + DO_OVER_STEP * step, level, crisis);
      return { spell: seen.spell, casts: seen.casts };
    });
    const { matches } = identify(level, observations);
    assert.ok(
      matches.some((m) => m.index === roll.index && m.crisis === crisis),
      `level ${level} crisis ${crisis} index ${roll.index} did not identify itself`,
    );
  }
}

// Cast counts carry information the names do not, so they can only narrow.
const namesOnly = identify(8, [{ spell: 'Fire', casts: 0 }]).matches.length;
const withCasts = identify(8, [{ spell: 'Fire', casts: 2 }]).matches.length;
assert.ok(withCasts < namesOnly, 'cast counts should narrow the candidate set');

// A count no cell can produce falls back to names rather than reporting nothing.
const impossible = identify(8, [{ spell: 'The End', casts: 3 }]);
assert.ok(impossible.ignoredCasts, 'an impossible cast count should trigger the fallback');
assert.ok(
  impossible.matches.some((m) => m.index === 179 && m.crisis === 4),
  'the fallback lost the true match',
);

// Nonsense stays nonsense; the fallback must not rescue a wrong spell name.
assert.deepEqual(
  identify(8, [{ spell: 'Not A Spell', casts: 0 }]).matches,
  [],
  'an unknown spell matched',
);

// ------------------------------------------ narrowing by what the HP permits
//
// The crisis level is rolled from the byte at the OPENING index, so most of the
// 1,024 states cannot exist at a given HP. Searching all of them regardless is
// what made one reading of Sleep at Lv11 349/2797 come back with 13 candidates,
// only one of which was a live opening, and let the plan answer from whichever
// of the impossible twelve happened to sort first.
{
  const sleep: Observation[] = [{ spell: 'Sleep', casts: 0 }];
  const wide = identify(FIELD.level, sleep);
  const narrow = identify(FIELD.level, sleep, { party: FIELD });

  assert.equal(wide.scope, 'all', 'a bare call must not filter');
  assert.equal(narrow.scope, 'opening', 'a party call defaults to the tight filter');
  assert.ok(wide.matches.length > narrow.matches.length, 'the party filter narrowed nothing');
  assert.deepEqual(
    narrow.matches.map((match) => ({ index: match.index, crisis: match.crisis })),
    [{ index: 207, crisis: 3 }],
    'one reading of Sleep no longer pins the opening at 349/2797',
  );

  // Not just that one case. Every live opening must identify itself from its own
  // first spell, and nothing the crisis formula forbids may survive alongside it.
  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    for (let index = 0; index < CYCLE; index += 1) {
      const crisis = crisisAtOpen(index, party);
      if (!crisis) continue;
      const roll = spellAt(index, party.level, crisis);
      const found = identify(party.level, [{ spell: roll.spell, casts: 0 }], {
        party,
        scope: 'opening',
      });
      assert.ok(!found.droppedPartyFilter, 'a real opening triggered the widening fallback');
      assert.ok(
        found.matches.some((match) => match.index === index && match.crisis === crisis),
        `the opening at ${index} could not identify itself at level ${party.level}`,
      );
      for (const match of found.matches) {
        assert.equal(
          crisisAtOpen(match.index, party),
          match.crisis,
          `a state the HP forbids survived at level ${party.level}`,
        );
      }
    }
  }

  // Typing started part way through a Limit Break, so the run's start index is
  // no longer the opening and only the residue class can be constrained. The
  // loose form has to keep states the tight one throws away.
  const opening = 125;
  assert.equal(crisisAtOpen(opening, FIELD), 1, 'index 125 no longer opens at crisis 1');
  const mid = wrapIndex(opening + DO_OVER_STEP * 3);
  const midRoll = spellAt(mid, FIELD.level, 1);
  const loose = identify(FIELD.level, [{ spell: midRoll.spell, casts: midRoll.casts }], {
    party: FIELD,
    scope: 'residue',
  });
  assert.equal(loose.scope, 'residue', 'the loose form did not report itself');
  assert.ok(
    loose.matches.some((match) => match.index === mid && match.crisis === 1),
    'the loose filter lost a state three Do Overs from a real opening',
  );

  // Why the rung is asked for on screen rather than guessed at.
  //
  // A reading begun part way into a Limit Break is a state the tight rung does
  // not contain, and the tight rung is silent about it: it returns other states
  // that fit, or none at all. Both are wrong answers rather than absent ones.
  // This walks every live opening and up to four Do Overs past it, and holds the
  // two rungs to what each actually promises.
  {
    let missedByTight = 0;
    let states = 0;
    for (let opening = 0; opening < CYCLE; opening += 1) {
      const openCrisis = crisisAtOpen(opening, FIELD);
      if (!openCrisis) continue;
      for (let presses = 1; presses <= 4; presses += 1) {
        const standing = wrapIndex(opening + DO_OVER_STEP * presses);
        const holds = (found: Reading): boolean =>
          found.matches.some((match) => match.index === standing && match.crisis === openCrisis);

        // Checked at the first reading, which is where a runner starts and where
        // the two rungs differ most, and again at three, which is where a
        // settled answer normally comes from.
        for (const depth of [1, 3]) {
          const seen = Array.from({ length: depth }, (_, step) => {
            const roll = spellAt(standing + DO_OVER_STEP * step, FIELD.level, openCrisis);
            return { spell: roll.spell, casts: roll.casts } satisfies Observation;
          });

          // The loose rung is the one that has to be safe here, always.
          assert.ok(
            holds(identify(FIELD.level, seen, { party: FIELD, scope: 'residue' })),
            `the residue rung lost a state ${presses} Do Overs past opening ${opening}`,
          );

          if (depth !== 1) continue;
          states += 1;
          if (!holds(identify(FIELD.level, seen, { party: FIELD, scope: 'opening' }))) {
            missedByTight += 1;
          }
        }
      }
    }
    // If this ever drops near zero the two rungs have stopped being different
    // questions and the control on screen has become noise.
    assert.ok(
      missedByTight > states / 2,
      'the tight rung no longer excludes mid-Limit-Break states, so the scope control is moot',
    );
  }

  // ------------------------------------------- what the next row can still be
  //
  // The shortlist on a row is only worth having if the true answer is always on
  // it. Everything else about the feature is convenience; this is correctness.
  {
    // 1. The true next spell is on the shortlist, at every live opening, at
    //    every depth a runner would type.
    for (const party of [ANY_PERCENT, ODIN, FIELD]) {
      for (let opening = 0; opening < CYCLE; opening += 1) {
        const openCrisis = crisisAtOpen(opening, party);
        if (!openCrisis) continue;
        const typed: Observation[] = [];
        for (let depth = 0; depth <= 3; depth += 1) {
          const { options } = identify(party.level, typed, { party, scope: 'opening' });
          const next = spellAt(opening + DO_OVER_STEP * depth, party.level, openCrisis);
          assert.equal(options.length, depth + 1, 'one shortlist per row, ending on the empty one');
          assert.ok(
            at(options, depth).includes(next.spell),
            `${next.spell} was missing from row ${depth} at opening ${opening}, level ${party.level}`,
          );
          typed.push({ spell: next.spell, casts: 0 });
        }
      }
    }

    // 2. Each shortlist is exactly the distinct spells the surviving candidates
    //    show, rebuilt the slow way rather than trusted.
    const walk = ['Cure', 'Aura', 'Fire'];
    for (let depth = 0; depth <= walk.length; depth += 1) {
      const typed = walk.slice(0, depth).map<Observation>((spell) => ({ spell, casts: 0 }));
      const { options } = identify(ANY_PERCENT.level, typed, {
        party: ANY_PERCENT,
        scope: 'opening',
      });

      let alive: { index: number; crisis: Crisis }[] = [];
      for (let index = 0; index < CYCLE; index += 1) {
        const crisis = crisisAtOpen(index, ANY_PERCENT);
        if (crisis) alive.push({ index, crisis });
      }
      for (let row = 0; row < depth; row += 1) {
        alive = alive.filter(
          ({ index, crisis }) =>
            spellAt(index + DO_OVER_STEP * row, ANY_PERCENT.level, crisis).spell ===
            at(typed, row).spell,
        );
      }
      const expected = [
        ...new Set(
          alive.map(
            ({ index, crisis }) =>
              spellAt(index + DO_OVER_STEP * depth, ANY_PERCENT.level, crisis).spell,
          ),
        ),
      ].sort();
      assert.deepEqual(at(options, depth), expected, `row ${depth} shortlist is wrong`);
    }

    // 3. It has to narrow, or the whole feature is decoration. Before anything
    //    is typed the first row is well under the full picker, and one reading
    //    at 349/2797 settles the row below it to a single spell.
    const cold = identify(FIELD.level, [], { party: FIELD, scope: 'opening' });
    assert.equal(cold.options.length, 1, 'an untouched reader still prices up its first row');
    assert.ok(at(cold.options, 0).length < SPELLS.length / 2, 'the first row barely narrowed');

    const oneDeep = identify(FIELD.level, [{ spell: 'Blind', casts: 0 }], {
      party: FIELD,
      scope: 'opening',
    });
    assert.deepEqual(at(oneDeep.options, 1).length, 1, 'Blind no longer pins the row below it');

    // 4. A spell no candidate can show empties the rows below it rather than
    //    offering something wrong. That empty list is the caller's cue to fall
    //    back to the whole picker, so a misread cannot lock a runner out.
    const wrong = identify(
      FIELD.level,
      [
        { spell: 'Blind', casts: 0 },
        { spell: 'Ultima', casts: 0 },
      ],
      {
        party: FIELD,
        scope: 'opening',
      },
    );
    assert.ok(!at(wrong.options, 1).includes('Ultima'), 'Ultima should not be on that row');
    assert.deepEqual(at(wrong.options, 2), [], 'an impossible reading must empty the row below');
  }

  // At an HP with no live opening there is nothing to filter against, so the
  // filter is dropped rather than calling a reading that is plainly on screen
  // impossible. That is the tell that the HP in the tool is wrong, not the spell.
  const healthy: Party = { ...FIELD, currentHp: FIELD.maxHp };
  const dropped = identify(FIELD.level, [{ spell: 'Fire', casts: 0 }], { party: healthy });
  assert.ok(dropped.droppedPartyFilter, 'the filter should have been dropped at full HP');
  assert.equal(dropped.scope, 'all', 'a dropped filter must report itself as unfiltered');
  assert.ok(dropped.matches.length > 0, 'dropping the filter returned nothing');
}

// --------------------------------------------------------- breaking a tie

// Adjacent crisis levels can read the same row of the slot array, so candidates
// can stay tied for several readings. They must always separate in the end, and
// the tool must be able to say exactly which reading does it.
for (const level of [1, 8, 11, 50, 100]) {
  for (let index = 0; index < CYCLE; index += 17) {
    for (const [a, b] of [
      [1, 2],
      [2, 3],
      [3, 4],
      [1, 4],
    ] as const) {
      const matches = [
        { index, crisis: a, current: index },
        { index, crisis: b, current: index },
      ];
      const tie = discriminator(level, matches, 1);
      assert.ok(tie, `crisis ${a} and ${b} never separate at level ${level}, index ${index}`);

      // The reading it names must actually disagree, and every reading before
      // it must agree, or the instruction sends the runner too far or not far
      // enough.
      for (let k = 1; k < tie.reading; k += 1) {
        assert.equal(
          spellAt(index + DO_OVER_STEP * k, level, a).spell,
          spellAt(index + DO_OVER_STEP * k, level, b).spell,
          'a tie-break was called later than the first reading that separates',
        );
      }
      const [first, second] = [at(tie.predictions, 0), at(tie.predictions, 1)];
      assert.ok(
        first.spell !== second.spell || first.casts !== second.casts,
        'the tie-break reading does not actually separate the candidates',
      );
      assert.equal(
        tie.doOversAway,
        tie.reading,
        'Do Overs away should count from one reading taken',
      );
    }
  }
}

// A single candidate is not a tie.
assert.equal(discriminator(8, [{ index: 179, crisis: 4, current: 179 }], 1), null);

// ------------------------------------------- captures across a turn boundary
//
// A second round of field captures, taken the same way: read spells until one
// state is named, note the index, do exactly one thing, read three spells back.
// These were never used to fit anything either.
//
// They settle two questions the model previously guessed at.
//
// First, backing out of the Slot menu and re-engaging it is +4 with the crisis
// held, which is to say it is a Do Over with extra button presses. Three
// captures, all +4. The proof that the crisis is held rather than re-rolled is
// that two of the three landings have crisisAtOpen === 0: had the game re-rolled
// there, the runner would have found no Limit Break to come back to, and instead
// they read three spells off it.
//
// Second, skipping Selphie's turn is +7, not the +1 this file used to replay.
// Three captures, all +7, one of them with an ally casting Demi in between,
// which cost nothing on this counter. 7 is 3 mod 4, so a skipped turn is the
// only known move that escapes the residue class Do Overs are confined to.
{
  const REENGAGE = [
    { marked: 135, held: 2 },
    { marked: 147, held: 2 },
    { marked: 171, held: 2 },
  ] as const;
  for (const { marked, held } of REENGAGE) {
    const landing = wrapIndex(marked + 4);
    // The spells read after re-engaging are the spells the held crisis produces.
    assert.ok(
      spellAt(landing, FIELD.level, held).spell,
      're-engage landing must be a legal roll at the held crisis',
    );
  }
  const wouldHaveDied = REENGAGE.filter(
    ({ marked }) => crisisAtOpen(wrapIndex(marked + 4), FIELD) === 0,
  ).length;
  assert.equal(
    wouldHaveDied,
    2,
    'two of the three re-engage landings must have no Limit Break of their own; ' +
      'that is the evidence the crisis is held rather than re-rolled',
  );

  // marked index, landing index, and every crisis the tool listed as fitting.
  const CROSS_TURN = [
    { marked: 239, landing: 246, fits: [2], oneRound: true },
    { marked: 10, landing: 17, fits: [2], oneRound: true },
    { marked: 25, landing: 32, fits: [1, 2, 3, 4], oneRound: true },
    // Four Selphie turns, three of them with no Limit Break at all, total +17.
    // 17 is prime, so no constant per-round cost explains it. Routes never plan
    // a wait like this, which is why it anchors the crisis and not the step.
    { marked: 92, landing: 109, fits: [1, 2], oneRound: false },
  ];
  for (const { marked, landing, fits, oneRound } of CROSS_TURN) {
    if (oneRound) {
      assert.equal(
        wrapIndex(marked + SKIP_TURN_STEP),
        landing,
        `a single skipped turn from ${marked} must land on ${landing}`,
      );
    }
    assert.ok(
      fits.includes(crisisAtOpen(landing, FIELD)),
      `crisis re-rolled at ${landing} is not one the capture allows`,
    );
  }

  // Those four landings are not a free fit. Sweep every HP at this max and count
  // how many produce all four: a model that agreed with anything would agree here
  // too, and the captured HP has to be among the few that do.
  let agreeing = 0;
  for (let hp = 1; hp <= FIELD.maxHp; hp += 1) {
    const party = { ...FIELD, currentHp: hp };
    if (CROSS_TURN.every(({ landing, fits }) => fits.includes(crisisAtOpen(landing, party)))) {
      agreeing += 1;
    }
  }
  assert.ok(
    agreeing / FIELD.maxHp < 0.05,
    `${agreeing} of ${FIELD.maxHp} HP values fit all four landings; the anchor proves nothing`,
  );
  assert.ok(
    CROSS_TURN.every(({ landing, fits }) => fits.includes(crisisAtOpen(landing, FIELD))),
    'the captured HP must be one of the few that fit',
  );
}

// ------------------------------------------------- waiting out a failed roll
//
// The crisis is rolled every time Selphie's turn comes up, and the roll costs
// RNG whether or not a Limit Break comes of it. So a turn that produces nothing
// still moves the counter, and the question is only how long the wait is.
//
// It is always finite. Walk the cycle by any fixed failure step from 1 to 12,
// from all 256 starts, at every party state: a live index always turns up. A
// skip can cost turns but it cannot strand you, which is the assumption every
// "start over" verdict rests on.
{
  const liveCount = (party: Party): number => {
    let live = 0;
    for (let index = 0; index < CYCLE; index += 1) if (crisisAtOpen(index, party) > 0) live += 1;
    return live;
  };

  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    assert.ok(liveCount(party) > 0, 'a party state with no live opening cannot be walked');
    for (let failStep = 1; failStep <= 12; failStep += 1) {
      for (let start = 0; start < CYCLE; start += 1) {
        let here = wrapIndex(start + SKIP_TURN_STEP);
        const seen = new Set();
        while (crisisAtOpen(here, party) === 0) {
          assert.ok(!seen.has(here), `failure step ${failStep} loops forever from ${start}`);
          seen.add(here);
          here = wrapIndex(here + failStep);
        }
      }
    }
  }

  // Plain anchors on how much of the cycle is live. Every "start over" figure in
  // the tool is a fraction of these, so a change to the crisis formula that
  // moved them would move every number a runner reads.
  assert.equal(liveCount(FIELD), 98);
  assert.equal(liveCount(ANY_PERCENT), 125);
  assert.equal(liveCount(ODIN), 256);
}

// -------------------------------------------------------- the three verdicts
//
// A runner is only ever in one of three situations, and the tool has to name
// which one without hedging.
//
//   1. The target is in this Limit Break. Press Do Over N times. Nothing here
//      depends on an unmeasured number, so this answer is exact.
//   2. It is not in this one, but some opening at this HP reaches it. Start
//      over. Which openings work is exact; how long the wait is, is a model.
//   3. No opening at this HP reaches it, or none at this level at any HP. That
//      is a hard no, and dressing it as a very long route is a lie.
//
// The old answer to case 2 was a multi-leg route through turn-skips, which
// assumed the RNG cost of a turn was a constant. It is not. Predicting a landing
// the runner will not be standing on is worse than admitting the landing is
// unpredictable, so the route is gone from the verdict.
{
  // Case 1 must agree with the brute-force walk of the residue class, both ways.
  for (const level of [8, 11, 34, 100]) {
    for (const crisis of CRISIS_LEVELS) {
      for (const spell of ['The End', 'Ultima', 'Cure', 'Wall', 'Meteor']) {
        for (const from of [0, 37, 125, 137, 179, 222]) {
          const hit = doOversTo(level, from, crisis, { spell });
          let expected = null;
          for (let step = 0; step < CYCLE / DO_OVER_STEP; step += 1) {
            if (spellAt(wrapIndex(from + DO_OVER_STEP * step), level, crisis).spell === spell) {
              expected = step;
              break;
            }
          }
          assert.equal(hit?.doOvers ?? null, expected, `doOversTo disagrees for ${spell}`);
          if (hit) {
            assert.equal(hit.spell, spell);
            assert.equal(hit.index, wrapIndex(from + DO_OVER_STEP * hit.doOvers));
          }
        }
      }
    }
  }

  // A cast count filter may only ever narrow, never widen.
  for (const casts of [1, 2, 3] as const) {
    for (const from of [0, 125, 179]) {
      const any = doOversTo(11, from, 2, { spell: 'Cure' });
      const exact = doOversTo(11, from, 2, { spell: 'Cure', casts });
      if (exact) {
        assert.equal(exact.casts, casts, 'a cast-filtered hit must have that cast count');
        assert.ok(any, 'filtering by casts cannot find a spell the unfiltered search missed');
        assert.ok(exact.doOvers >= any.doOvers, 'a narrower search cannot find a nearer hit');
      }
    }
  }

  // Case 2 and 3: possible is exactly "some live opening reaches it".
  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    for (const spell of ['The End', 'Death', 'Ultima', 'Cure', 'Aero', 'Meteor']) {
      const outlook = reopenOutlook(party, { spell });
      let good = 0;
      let live = 0;
      for (let index = 0; index < CYCLE; index += 1) {
        const crisis = crisisAtOpen(index, party);
        if (!crisis) continue;
        live += 1;
        if (doOversTo(party.level, index, crisis, { spell })) good += 1;
      }
      assert.equal(outlook.live, live, `live opening count wrong for ${spell}`);
      assert.equal(outlook.good, good, `useful opening count wrong for ${spell}`);
      assert.equal(outlook.possible, good > 0);
      // The wait folds in both failures: the Limit Break has to appear at all,
      // and the opening it appears at has to be one that reaches the target.
      assert.equal(outlook.expectedTurns, good ? CYCLE / good : Infinity);
    }
  }

  // Exactly one verdict fires. Never two, never none.
  for (const party of [ANY_PERCENT, FIELD]) {
    for (const spell of SPELLS) {
      for (const from of [0, 137, 222]) {
        for (const crisis of CRISIS_LEVELS) {
          const here = doOversTo(party.level, from, crisis, { spell });
          const outlook = reopenOutlook(party, { spell });
          const fired = [Boolean(here), !here && outlook.possible, !here && !outlook.possible];
          assert.equal(fired.filter(Boolean).length, 1, 'the verdicts must partition the cases');
        }
      }
    }
  }
}

// ------------------------------------------ the spells on the way there
//
// The Solved panel lists what a runner will see on each press between here and
// the target, so the two ends and the stride all have to be exact: a path one
// short stops before the target, one long walks past it.
{
  for (const party of [ANY_PERCENT, FIELD]) {
    for (const spell of ['The End', 'Cure', 'Wall', 'Death']) {
      for (const crisis of CRISIS_LEVELS) {
        for (const from of [0, 61, 137, 179]) {
          const hit = doOversTo(party.level, from, crisis, { spell });
          const path = doOverPath(party.level, from, crisis, { spell });

          if (!hit) {
            assert.equal(path, null, 'no route means no path to walk');
            continue;
          }
          const walk = must(path, `no path for ${spell} from ${from}`);

          // One entry per press, plus the one you are standing on.
          assert.equal(
            walk.length,
            hit.doOvers + 1,
            'path length must be the Do-Over count plus 1',
          );
          assert.equal(at(walk, 0).index, wrapIndex(from), 'the path must start where you stand');
          assert.equal(
            at(walk, walk.length - 1).index,
            hit.index,
            'the path must end on the hit doOversTo found',
          );
          assert.equal(at(walk, walk.length - 1).spell, spell, 'the path must end on the target');

          // Every step is one Do-Over, and the crisis is held for all of them.
          for (const [step, roll] of walk.entries()) {
            assert.equal(
              roll.index,
              wrapIndex(from + DO_OVER_STEP * step),
              `step ${step} is off the lattice`,
            );
            assert.equal(roll.crisis, crisis, 'the crisis must be held across the path');
          }

          // The target may not appear before the end, or the route is not the nearest.
          assert.ok(
            walk.slice(0, -1).every((roll) => roll.spell !== spell),
            'the path passes the target before its last entry',
          );
        }
      }
    }
  }

  // Standing on it already is a one-entry path, not an empty one.
  const onIt = must(doOverPath(ANY_PERCENT.level, 179, 4, { spell: 'The End' }), 'no path at 179');
  assert.deepEqual(
    onIt.map((roll) => roll.index),
    [179],
    'standing on the target is a path of just that index',
  );
}

// ------------------------------- why a moot tie still hides the route
//
// tieIsMoot says every candidate needs the same NUMBER of Do-Overs, which is why
// the count is safe to show. It says nothing about the spells in between: tied
// candidates sit at different crisis levels and read different rows on the way.
//
// The card leans on that distinction to decide what to draw, so it is measured
// here rather than assumed. If divergence ever fell to zero the card could list
// the route on a tie and the suppression would be dead weight.
{
  let withRoute = 0;
  let divergent = 0;
  let endCastDiffers = 0;

  for (const target of SPELLS) {
    for (const seed of SPELLS) {
      const found = identify(FIELD.level, [{ spell: seed, casts: 0 }], {
        party: FIELD,
        scope: 'opening',
      });
      if (found.matches.length < 2) continue;

      // The same test the hook applies to decide the tie is not worth breaking.
      const presses = found.matches.map(
        (match) =>
          doOversTo(FIELD.level, match.current, match.crisis, { spell: target })?.doOvers ?? null,
      );
      const shared = at(presses, 0);
      if (!presses.every((count) => count === shared)) continue;

      // Moot because nobody can get there: doOverPath returns null and the card
      // never reaches its "in this Slot Table" branch at all.
      if (shared === null) {
        for (const match of found.matches) {
          assert.equal(
            doOverPath(FIELD.level, match.current, match.crisis, { spell: target }),
            null,
            'a moot tie with no presses must have no path either',
          );
        }
        continue;
      }
      withRoute += 1;

      const paths = found.matches.map((match) =>
        must(
          doOverPath(FIELD.level, match.current, match.crisis, { spell: target }),
          'a shared press count must come with a path',
        ),
      );

      // What every candidate agrees on, and is therefore safe to show: the spell
      // you are standing on, the number of presses, and the target at the end.
      const standing = new Set(paths.map((path) => at(path, 0).spell));
      assert.equal(standing.size, 1, 'tied candidates must agree on the spell already on screen');
      for (const path of paths) {
        assert.equal(path.length, shared + 1, 'every tied path is the same length');
        assert.equal(at(path, path.length - 1).spell, target, 'every tied path ends on the target');
      }

      const shapes = new Set(
        paths.map((path) => path.map((roll) => `${roll.spell}x${roll.casts}`).join('|')),
      );
      if (shapes.size > 1) divergent += 1;
      if (new Set(paths.map((path) => at(path, path.length - 1).casts)).size > 1) {
        endCastDiffers += 1;
      }
    }
  }

  assert.ok(withRoute > 0, 'no moot tie reaches the target, so this proves nothing');
  assert.ok(
    divergent > 0,
    'moot ties no longer diverge on the way, so the card could list the route on a tie',
  );
  assert.ok(
    endCastDiffers > 0,
    'the last row cast count no longer varies across a moot tie either',
  );
}

// ------------------------- why the watch list has two colours, not three
//
// `decisive` and `pins` look like two grades of good news. They are not, while
// SHOW_CAST_COUNTS is off: `decisive` is computed on the reading WITH its cast
// count, but the reader only accepts the name, so a decisive-but-unpinning
// reading resolves to a set that still holds dead openings. The card therefore
// colours on `pins` alone.
//
// Both halves of that are measured. If either flipped, the card's two-colour key
// would be understating what it knows and the third colour should come back.
{
  let pinning = 0;
  let unpinning = 0;
  let unpinningWithADeadCandidate = 0;
  let resolvedNow = 0;

  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    for (const spell of SPELLS) {
      if (!reopenOutlook(party, { spell }).possible) continue;
      const guide = openingGuide(party, { spell });
      if (guide.watchFor.length > 12) continue;

      for (const entry of guide.watchFor) {
        // Whatever the reader can actually be told, which is the name alone here.
        const typed: Observation[] = [
          { spell: entry.spell, casts: SHOW_CAST_COUNTS ? entry.casts : 0 },
        ];
        const found = identify(party.level, typed, { party, scope: 'opening' });
        const presses = found.matches.map(
          (match) =>
            doOversTo(party.level, match.current, match.crisis, { spell })?.doOvers ?? null,
        );

        if (entry.pins) {
          pinning += 1;
          // A pinning reading is the one case that needs nothing further: one
          // state, and a route from it. That is what earns the filled colour.
          assert.equal(found.matches.length, 1, `${entry.reading} claims to pin but did not`);
          assert.ok(entry.decisive, `${entry.reading} pins without being decisive`);
          assert.ok(
            presses.every((count) => count !== null),
            'a pinning reading must have a route',
          );
          resolvedNow += 1;
          continue;
        }

        unpinning += 1;
        // Everything else needs at least one more reading, decisive or not.
        assert.ok(
          found.matches.length > 1,
          `${entry.reading} does not pin yet resolved to one state`,
        );
        if (presses.some((count) => count === null)) unpinningWithADeadCandidate += 1;
      }
    }
  }

  assert.ok(pinning > 0 && unpinning > 0, 'both colours must actually occur');
  assert.equal(resolvedNow, pinning, 'every pinning reading resolves immediately');
  assert.ok(
    unpinningWithADeadCandidate > 0,
    'no unpinning reading admits a dead opening any more, so decisive would be worth its own colour again',
  );
}

// ---------------------------------------- the whole plan, up front
//
// A runner acts on these rows without typing anything, so every column has to
// be true on its own: the readings must actually appear in that order at that
// opening, they must appear at NO other live opening, and the Do-Over count must
// be measured from where those readings leave you rather than from the opening.
//
// The last one is the easy mistake. Reading n spells costs n-1 Do-Overs, so a
// count taken from the opening index overstates the wait by exactly that much.
{
  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    for (const spell of ['The End', 'Ultima', 'Meteor', 'Wall', 'Cure']) {
      const outlook = reopenOutlook(party, { spell });
      const { routes, unresolved, dead, live } = openingRoutes(party, { spell });

      assert.equal(live, outlook.live, `live count disagrees for ${spell}`);
      assert.equal(dead, outlook.live - outlook.good, `dead count disagrees for ${spell}`);
      // Every useful opening is either listed or counted as unresolved.
      assert.equal(routes.length + unresolved, outlook.good, `routes lost an opening for ${spell}`);

      for (const route of routes) {
        // The opening is real and rolls the crisis the row claims.
        assert.equal(crisisAtOpen(route.index, party), route.crisis, 'route names a dead opening');

        // The readings are consecutive Do-Overs from the opening, in order.
        route.readings.forEach((roll, step) => {
          const expected = spellAt(route.index + DO_OVER_STEP * step, party.level, route.crisis);
          assert.equal(roll.spell, expected.spell, 'route reading is not what that index shows');
          assert.equal(roll.casts, expected.casts, 'route cast count is wrong');
        });

        // No other live opening shows this run of NAMES. Names, not names with
        // cast counts: a row that is only unique once the counts are read is a
        // row that misleads anyone who glosses a digit, and a cast count is the
        // easiest thing on that screen to get wrong.
        const mine = route.readings.map((roll) => roll.spell).join(',');
        for (let index = 0; index < CYCLE; index += 1) {
          const crisis = crisisAtOpen(index, party);
          if (!crisis) continue;
          if (index === route.index && crisis === route.crisis) continue;
          const theirs = Array.from(
            { length: route.readings.length },
            (_, step) => spellAt(index + DO_OVER_STEP * step, party.level, crisis).spell,
          ).join(',');
          assert.notEqual(
            theirs,
            mine,
            `opening ${index}/${crisis} shows the same spells as ${route.index}/${route.crisis}`,
          );
        }

        // The count is from where the readings leave you, and it lands on the target.
        const standing = wrapIndex(route.index + DO_OVER_STEP * (route.readings.length - 1));
        assert.equal(
          at(route.readings, route.readings.length - 1).index,
          standing,
          'the last reading is not the one you are standing on',
        );
        const landing = wrapIndex(standing + DO_OVER_STEP * route.doOvers);
        assert.equal(
          spellAt(landing, party.level, route.crisis).spell,
          spell,
          `${route.doOvers} Do-Overs from ${standing} does not land on ${spell}`,
        );

        // And it is the NEAREST such landing, or the row sends a runner too far.
        for (let step = 0; step < route.doOvers; step += 1) {
          assert.notEqual(
            spellAt(wrapIndex(standing + DO_OVER_STEP * step), party.level, route.crisis).spell,
            spell,
            'a nearer landing was skipped',
          );
        }
      }

      // Rows are ordered cheapest-first: fewest readings, then shortest wait.
      for (let k = 1; k < routes.length; k += 1) {
        const previous = at(routes, k - 1);
        const current = at(routes, k);
        assert.ok(
          previous.readings.length < current.readings.length ||
            (previous.readings.length === current.readings.length &&
              previous.doOvers <= current.doOvers),
          'routes are not ordered cheapest first',
        );
      }
    }
  }

  // The End, the target a manip is actually run for, is fully covered in three
  // readings at both party states, which is what makes the panel usable without
  // typing anything. Other spells may leave some openings unresolved; that is
  // reported rather than papered over, and the caller must not then claim an
  // unlisted reading is safe to pass.
  for (const party of [ANY_PERCENT, FIELD]) {
    const { unresolved, routes } = openingRoutes(party, { spell: 'The End' });
    assert.equal(unresolved, 0, 'The End should need no more than three readings');
    assert.ok(routes.length > 0, 'The End should have some route');
  }
  assert.equal(openingRoutes(FIELD, { spell: 'The End' }).routes.length, 6);
  assert.equal(openingRoutes(ANY_PERCENT, { spell: 'The End' }).routes.length, 4);

  // The two rows reported from the field as false positives. Both were unique
  // only by cast count, and both now carry the extra reading that separates them
  // by name: Sleep needs Blizzard (the other Sleep opening goes to Blizzara),
  // and Full Cure/Thundara needs Blizzara (the other one goes to Cura).
  {
    const rows = openingRoutes(ANY_PERCENT, { spell: 'The End' }).routes;
    const named = (first: string) =>
      must(
        rows.find((route) => at(route.readings, 0).spell === first),
        `no row starting with ${first}`,
      );

    const sleep = named('Sleep');
    assert.deepEqual(
      sleep.readings.map((roll) => roll.spell),
      ['Sleep', 'Blizzard'],
      'the Sleep row must name Blizzard, or it also matches the dead Sleep opening',
    );

    const fullCure = named('Full Cure');
    assert.deepEqual(
      fullCure.readings.map((roll) => roll.spell),
      ['Full Cure', 'Thundara', 'Blizzara'],
      'the Full Cure row must name Blizzara, or it also matches the dead Cura opening',
    );
  }

  // Clicking a row loads its spells into the reader, so the row has to settle the
  // reading on the opening it names - otherwise the plan card would disagree with
  // the row that was clicked. Names only, since that is all the reader takes.
  //
  // This is the property that lets the panel be shown INSTEAD of the reader: the
  // list is complete, and every row on it is self-identifying.
  for (const party of [ANY_PERCENT, FIELD]) {
    for (const spell of ['The End', 'Ultima', 'Meteor']) {
      const { routes, unresolved } = openingRoutes(party, { spell });
      assert.equal(unresolved, 0, `${spell} must be fully covered at the default depth`);

      for (const route of routes) {
        const typed = route.readings.map<Observation>((roll) => ({ spell: roll.spell, casts: 0 }));
        const found = identify(party.level, typed, { party, scope: 'opening' });
        assert.equal(
          found.matches.length,
          1,
          `row ${typed.map((o) => o.spell).join(', ')} does not settle the reader`,
        );
        const settled = at(found.matches, 0);
        assert.equal(settled.index, route.index, 'the row settled on a different opening');
        assert.equal(settled.crisis, route.crisis, 'the row settled on a different crisis');
      }
    }
  }

  // A deeper cap can only resolve more, never fewer.
  for (const spell of ['Cure', 'Wall']) {
    const shallow = openingRoutes(FIELD, { spell }, 2);
    const deeper = openingRoutes(FIELD, { spell }, 4);
    assert.ok(
      deeper.routes.length >= shallow.routes.length,
      'raising the cap must not lose routes',
    );
    assert.ok(deeper.unresolved <= shallow.unresolved, 'raising the cap must not add unresolved');
  }
}

// ------------------------------------------------------ the hard-no anchors
//
// A hard no is only worth stating if it is true, so these pin the three kinds.
{
  // Not at this level, at any HP: Death is not in a row that level 11 can read.
  const deathAtEleven = hpOutlook(FIELD, { spell: 'Death' });
  assert.equal(deathAtEleven.ceiling, null, 'Death must be impossible at level 11 at every HP');
  assert.equal(deathAtEleven.best.good, 0);
  assert.equal(reopenOutlook(FIELD, { spell: 'Death' }).possible, false);

  // HP too high, but fixable: The End is gone by 700 of 2797 and returns
  // below roughly 496. A runner told "no" here should be told the number.
  const highHp = { ...FIELD, currentHp: 700 };
  assert.equal(reopenOutlook(highHp, { spell: 'The End' }).possible, false);
  const endOutlook = hpOutlook(highHp, { spell: 'The End' });
  assert.ok(endOutlook.ceiling !== null, 'The End must still be possible at some lower HP');
  assert.ok(
    endOutlook.ceiling < 700 && endOutlook.ceiling > 400,
    `The End should come back somewhere around 496 HP, got ${endOutlook.ceiling}`,
  );
  assert.equal(reopenOutlook({ ...FIELD, currentHp: 400 }, { spell: 'The End' }).possible, true);

  // Possible, but a long wait. 6 of 98 openings at the captured HP.
  const end = reopenOutlook(FIELD, { spell: 'The End' });
  assert.equal(end.live, 98);
  assert.equal(end.good, 6);
  assert.ok(end.expectedTurns > 40 && end.expectedTurns < 45);

  // The ratio would flatter high HP, where almost nothing is live but the one
  // opening that is happens to work. hpOutlook must rank by the count instead,
  // or it will send a runner to an HP where the Limit Break never appears.
  const best = hpOutlook(FIELD, { spell: 'Thundaga' }).best;
  const atBest = { ...FIELD, currentHp: best.hp };
  assert.ok(
    reopenOutlook(atBest, { spell: 'Thundaga' }).good >=
      reopenOutlook(FIELD, { spell: 'Thundaga' }).good,
    'the recommended HP must not be worse than the current one',
  );
  assert.ok(best.expectedTurns < 5, 'a recommended HP with a long wait is not a recommendation');
}

// ----------------------------------------- what the target picker may claim
//
// The picker marks a spell red when it cannot appear at this level at any
// crisis level and any HP, and amber when it exists at this level but no
// opening the current HP can produce reaches it. Both are told to a runner as
// facts, so both have to survive being checked the slow way.
{
  for (const party of [ANY_PERCENT, ODIN, FIELD, { ...FIELD, currentHp: 700 }]) {
    const availability = spellAvailability(party);
    assert.equal(availability.size, SPELLS.length, 'every spell must get a verdict');

    for (const spell of SPELLS) {
      const entry = must(availability.get(spell), `no verdict for ${spell}`);

      // The fast one-pass count must equal the slow per-spell one.
      const slow = reopenOutlook(party, { spell });
      assert.equal(entry.good, slow.good, `availability disagrees with reopenOutlook for ${spell}`);
      assert.equal(entry.live, slow.live);
      assert.equal(entry.state === 'ready', slow.possible, `state disagrees for ${spell}`);

      // Red means the level cannot produce it anywhere, at any crisis. Check
      // that against a full walk of the cycle rather than against the same
      // table that produced the claim.
      const anywhere = CRISIS_LEVELS.some((crisis) =>
        rollCycle(party.level, crisis).some((roll) => roll.spell === spell),
      );
      assert.equal(entry.state === 'level', !anywhere, `red badge is wrong for ${spell}`);

      // Amber must never be shown for something red, and never for something
      // that is actually reachable.
      if (entry.state === 'hp') {
        assert.ok(anywhere, 'amber claims the level can produce it, so it must');
        assert.equal(entry.good, 0, 'amber claims no opening reaches it');
      }
    }
  }

  // Red is a property of the level alone, so it must not move when HP does.
  // If it ever did, a runner could be told "never" and then find it by taking a
  // hit, which is the worst failure this badge can have.
  for (const level of [8, 11, 34, 100]) {
    const base = { level, maxHp: 2797, deadAllies: 0, statuses: {} };
    const reference = [...spellAvailability({ ...base, currentHp: 1 }).values()]
      .filter((entry) => entry.state === 'level')
      .map((entry) => entry.spell)
      .sort();
    for (const currentHp of [1, 200, 349, 700, 1500, 2797]) {
      for (const statuses of [{}, { aura: true }, { doom: true, blind: true }]) {
        const now = [...spellAvailability({ ...base, currentHp, statuses }).values()]
          .filter((entry) => entry.state === 'level')
          .map((entry) => entry.spell)
          .sort();
        assert.deepEqual(now, reference, `the red set moved with HP or status at level ${level}`);
      }
    }
  }

  // The counts a runner actually reads.
  const atEleven = spellAvailability(FIELD);
  const redAtEleven = [...atEleven.values()]
    .filter((entry) => entry.state === 'level')
    .map((entry) => entry.spell)
    .sort();
  assert.deepEqual(redAtEleven, [
    'Berserk',
    'Death',
    'Meltdown',
    'Pain',
    'Reflect',
    'Stop',
    'Triple',
    'Zombie',
  ]);
  assert.deepEqual(
    [...atEleven.values()]
      .filter((entry) => entry.state === 'hp')
      .map((entry) => entry.spell)
      .sort(),
    ['Aero', 'Slow', 'Tornado'],
  );

  // Level 8 reads a lower band of the slot array, so three more are out of
  // reach there and Aero moves from amber to red.
  const atEight = spellAvailability(ANY_PERCENT);
  assert.equal(
    [...atEight.values()].filter((entry) => entry.state === 'level').length,
    11,
    'level 8 should lock out eleven spells',
  );
  assert.equal(must(atEight.get('Aero'), 'Aero missing at level 8').state, 'level');
  assert.equal(must(atEleven.get('Aero'), 'Aero missing at level 11').state, 'hp');
}

// ------------------------------------------ recognising a useful opening
//
// A skip cannot be steered, so the tool cannot say which opening you will get.
// What it can say is which openings are worth stopping at, and that turns the
// expensive part of starting over, typing four spells for every dead opening,
// into a glance at the first one.
//
// Everything the card claims here is checked against a per-opening walk rather
// than against the table that produced the claim.
{
  // The watch list names cast counts because a runner can see them on screen.
  // settleDepth promises what they can type, and the reader only takes counts
  // when SHOW_CAST_COUNTS is on, so the two are checked against different keys.
  const firstReading = (index: number, crisis: Crisis, level: number): string => {
    const roll = spellAt(index, level, crisis);
    return `${roll.spell} ×${roll.casts}`;
  };
  const typedReading = (index: number, crisis: Crisis, level: number): string => {
    const roll = spellAt(index, level, crisis);
    return SHOW_CAST_COUNTS ? `${roll.spell} ×${roll.casts}` : roll.spell;
  };

  for (const party of [ANY_PERCENT, ODIN, FIELD]) {
    for (const spell of ['The End', 'Ultima', 'Meteor', 'Wall', 'Cure']) {
      const outlook = reopenOutlook(party, { spell });
      if (!outlook.possible) continue;
      const guide = openingGuide(party, { spell });

      assert.equal(guide.useful, outlook.good, `useful count disagrees for ${spell}`);
      assert.equal(guide.useful + guide.dead, outlook.live, 'useful and dead must partition live');

      // Rebuild the whitelist the slow way.
      const usefulFirst = new Map();
      const deadFirst = new Set();
      for (let index = 0; index < CYCLE; index += 1) {
        const crisis = crisisAtOpen(index, party);
        if (!crisis) continue;
        const first = firstReading(index, crisis, party.level);
        if (doOversTo(party.level, index, crisis, { spell })) {
          usefulFirst.set(first, (usefulFirst.get(first) ?? 0) + 1);
        } else {
          deadFirst.add(first);
        }
      }

      // `decisive` is about what a runner can SEE, cast count included. `pins` is
      // about what the reader can be TOLD, which is the spell name alone while
      // SHOW_CAST_COUNTS is off, so it is the weaker claim and it is checked
      // against what identify actually does rather than against itself.
      for (const entry of guide.watchFor) {
        // The label is built from these, so they have to agree with it.
        assert.equal(
          `${entry.spell} ×${entry.casts}`,
          entry.reading,
          'watch entry parts disagree with its label',
        );
        const typed: Observation[] = [
          { spell: entry.spell, casts: SHOW_CAST_COUNTS ? entry.casts : 0 },
        ];
        assert.equal(
          entry.pins,
          identify(party.level, typed, { party }).matches.length === 1,
          `pins disagrees with the reader for ${entry.reading} at level ${party.level}`,
        );
        if (entry.pins) {
          assert.ok(entry.decisive, `${entry.reading} pins but is not marked decisive`);
        }
      }

      assert.deepEqual(
        guide.watchFor.map((entry) => entry.reading).sort(),
        [...usefulFirst.keys()].sort(),
        `the watch list is not the set of useful first readings for ${spell}`,
      );

      for (const entry of guide.watchFor) {
        assert.equal(entry.openings, usefulFirst.get(entry.reading), 'weight is wrong');
        assert.equal(entry.decisive, !deadFirst.has(entry.reading), 'decisive flag is wrong');
      }

      // Decisive first: the list is read top down and the useful half has to
      // come first or the ordering is worse than useless.
      const firstNonDecisive = guide.watchFor.findIndex((entry) => !entry.decisive);
      if (firstNonDecisive !== -1) {
        assert.ok(
          guide.watchFor.slice(firstNonDecisive).every((entry) => !entry.decisive),
          'decisive entries must sort ahead of the rest',
        );
      }
      assert.equal(guide.decisive, guide.watchFor.filter((e) => e.decisive).length);

      // The claim the runner acts on: anything off the list is a dead opening.
      // Count the dead openings the whitelist rules out, and separately assert
      // that no useful opening is ever ruled out by it.
      let ruledOut = 0;
      for (let index = 0; index < CYCLE; index += 1) {
        const crisis = crisisAtOpen(index, party);
        if (!crisis) continue;
        const onList = usefulFirst.has(firstReading(index, crisis, party.level));
        const isUseful = Boolean(doOversTo(party.level, index, crisis, { spell }));
        assert.ok(!isUseful || onList, 'a useful opening must never be ruled out by the list');
        if (!isUseful && !onList) ruledOut += 1;
      }
      assert.equal(guide.rulesOut, ruledOut, `rulesOut is wrong for ${spell}`);

      // settleDepth is promised as enough. Verify it separates every pair, and
      // that it is the smallest such depth rather than a safe overestimate.
      assert.ok(guide.settleDepth !== null, `no settle depth found for ${spell}`);
      const signature = (index: number, crisis: Crisis, depth: number): string =>
        Array.from({ length: depth }, (_, step) =>
          typedReading(wrapIndex(index + DO_OVER_STEP * step), crisis, party.level),
        ).join(', ');
      for (const depth of [guide.settleDepth, guide.settleDepth - 1]) {
        if (depth < 1) continue;
        const dead = new Set();
        const useful = new Set();
        for (let index = 0; index < CYCLE; index += 1) {
          const crisis = crisisAtOpen(index, party);
          if (!crisis) continue;
          const sig = signature(index, crisis, depth);
          if (doOversTo(party.level, index, crisis, { spell })) useful.add(sig);
          else dead.add(sig);
        }
        const separated = [...useful].every((sig) => !dead.has(sig));
        if (depth === guide.settleDepth) {
          assert.ok(separated, `${depth} readings do not actually settle ${spell}`);
        } else {
          assert.ok(!separated, `settleDepth ${guide.settleDepth} is one more than needed`);
        }
      }
    }
  }

  // The captured party state, as plain numbers a reader can check against the
  // card. Six first readings, three of them decisive, ruling out 71 of 92.
  const end = openingGuide(FIELD, { spell: 'The End' });
  assert.equal(end.useful, 6);
  assert.equal(end.dead, 92);
  assert.equal(end.watchFor.length, 6);
  assert.equal(end.decisive, 3);
  assert.equal(end.rulesOut, 71);
  // Three on names alone, which is what the reader takes while cast counts are
  // hidden. With counts on it would be three here too, but Ultima at this party
  // state drops to two, so the number is not a constant of the spell.
  assert.equal(end.settleDepth, 3);
  assert.deepEqual(
    end.watchFor.filter((entry) => entry.decisive).map((entry) => entry.reading),
    ['Sleep ×2', 'The End ×1', 'Thundaga ×1'],
  );

  // The tell is only sound on the OPENING reading, and the panel says so. That
  // caveat has to be load-bearing rather than decorative, so prove it: after a
  // single Do Over there is a useful opening whose reading is not on the list,
  // which means a runner applying the list late would pass a turn that was
  // about to work.
  {
    const party = FIELD;
    const want = { spell: 'The End' };
    const onList = new Set(openingGuide(party, want).watchFor.map((entry) => entry.reading));
    let misledAfterOneDoOver = 0;
    for (let index = 0; index < CYCLE; index += 1) {
      const crisis = crisisAtOpen(index, party);
      if (!crisis || !doOversTo(party.level, index, crisis, want)) continue;
      const moved = spellAt(wrapIndex(index + DO_OVER_STEP), party.level, crisis);
      if (!onList.has(`${moved.spell} ×${moved.casts}`)) misledAfterOneDoOver += 1;
    }
    assert.ok(
      misledAfterOneDoOver > 0,
      'if the list still held after a Do Over the panel would not need its caveat',
    );
  }

  // A spell on most openings has no useful shortcut, and the card says so
  // rather than printing forty pills. That is a rendering decision, but the
  // list length it keys off is not, so it is anchored here.
  assert.ok(
    openingGuide(FIELD, { spell: 'Thundaga' }).watchFor.length > 12,
    'Thundaga should be too common for a watch list',
  );
}

// ------------------------------------------------ the HP the card names
//
// "Drop to 1 HP" is not advice. The card names the ceiling, the highest HP at
// which the spell is reachable at all, and the best HP alongside it. Both are
// printed as instructions, so both have to be HP values where it really works.
for (const party of [ANY_PERCENT, FIELD]) {
  for (const spell of ['The End', 'Meteor', 'Wall']) {
    const outlook = hpOutlook(party, { spell });
    if (outlook.best.good === 0) {
      assert.equal(outlook.ceiling, null, 'an impossible spell has no reachable HP');
      continue;
    }
    const ceiling = must(outlook.ceiling, `no ceiling for ${spell}`);
    assert.ok(
      hpOutlook({ ...party, currentHp: ceiling }, { spell }).current.good > 0,
      'the ceiling must be an HP where the spell is actually reachable',
    );
    assert.ok(outlook.best.hp <= ceiling, 'the best HP cannot sit above the ceiling');
    assert.ok(outlook.best.good > 0, 'the recommended HP must reach the spell');
  }
}

console.log('slot tables OK');
