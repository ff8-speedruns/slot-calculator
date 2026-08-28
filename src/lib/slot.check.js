/**
 * Self-check for the slot tables. Run with `node src/lib/slot.check.js`.
 *
 * The roll reads five bytes at fixed offsets from the index, so an off-by-one
 * anywhere in there silently changes every spell the tool reports while still
 * looking plausible. The anchors below are absolute: they come from the
 * community's own The End entry, which was never used to fit the tables, so
 * they catch a shift that an internal round trip cannot.
 */

import assert from 'node:assert/strict';
import { RNG_TABLE, SLOT_ARRAY } from './slot.data.js';
import {
  CYCLE,
  DO_OVER_STEP,
  SPELLS,
  crisisLevel,
  findSpell,
  hpWindowFor,
  identify,
  planTo,
  rollAt,
  rollCycle,
  solveDrift,
  statusSum,
  wrapIndex,
} from './slot.js';

/** Level 8, 34 HP of 482, nothing junctioned. The Any% setup. */
const ANY_PERCENT = { level: 8, currentHp: 34, maxHp: 482, deadAllies: 0, statuses: {} };

/** Level 100 during Odin, Aura up. The 100% setup. */
const ODIN = {
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
for (const row of SLOT_ARRAY) {
  if (row === null) continue;
  assert.equal(row.length, 8, 'every slot row holds 8 spell indices');
}

// Slot levels 8 and 9 of each mod are unreachable from both reference tables.
const unmapped = SLOT_ARRAY.flatMap((row, index) => (row === null ? [index] : []));
assert.deepEqual(unmapped, [8, 9, 20, 21, 32, 33, 44, 45, 56, 57], 'unmapped rows moved');

assert.ok(SPELLS.includes('The End'), 'The End missing from the spell list');
assert.ok(SPELLS.length > 40, 'spell list looks truncated');

// ------------------------------------------------------------------- the roll

// The community's Any% notes list nine HP/RNG/Do-Over entries for The End and
// every one of them lands here. Nothing about this index was used to build the
// tables, so it pins the byte offsets, the *12 stride and the missing clamp.
const anchor = rollAt(179, ANY_PERCENT);
assert.equal(anchor.spell, 'The End', 'The End is no longer at index 179 in the Any% setup');
assert.equal(anchor.casts, 1, 'The End should always be a single cast');
assert.equal(anchor.crisis, 4, 'The End at 179 needs crisis 4');
assert.deepEqual(
  [anchor.slotIndex, anchor.spellIndex],
  [51, 7],
  'The End moved inside the slot array',
);

// And it is the only index that gives it there, which is what makes the manip
// a single target rather than a search.
assert.deepEqual(
  findSpell(ANY_PERCENT, { spell: 'The End' }).map((hit) => hit.index),
  [179],
  'The End should be reachable at exactly one index in the Any% setup',
);

// Those same notes say 34 HP or under. The crisis formula has to agree.
assert.deepEqual(
  hpWindowFor(179, 4, ANY_PERCENT),
  { low: 1, high: 34 },
  'HP window for The End no longer matches the community figure',
);

// The level term shifts the read window by ten, which moves the target rather
// than removing it. Nothing here is derived from the Any% anchor.
assert.deepEqual(
  findSpell(ODIN, { spell: 'The End' }).map((hit) => hit.index),
  [215],
  'The End moved in the Odin setup',
);

// Crisis 0 has to mean no Limit, not a spell of some default kind.
const fullHealth = rollAt(179, { ...ANY_PERCENT, currentHp: 482 });
assert.equal(fullHealth.available, false, 'a healthy Selphie should have no Limit available');
assert.equal(fullHealth.spell, undefined, 'an unavailable roll should not carry a spell');

// Aura is worth 200 before the multiplier, and dead allies 200 each after it.
assert.equal(statusSum({ aura: true, blind: true }), 230, 'status weights changed');
assert.ok(
  crisisLevel(RNG_TABLE[0], { ...ODIN, deadAllies: 2 }) >=
    crisisLevel(RNG_TABLE[0], { ...ODIN, deadAllies: 0 }),
  'dead allies should never lower the crisis level',
);

// ---------------------------------------------------------------- the planner

// A Do-Over is four steps and a turn-skip is one, so any gap decomposes one way.
for (let from = 0; from < CYCLE; from += 37) {
  for (let to = 0; to < CYCLE; to += 29) {
    const plan = planTo(from, to);
    assert.equal(
      wrapIndex(from + plan.doOvers * DO_OVER_STEP + plan.skips),
      to,
      `plan from ${from} to ${to} does not land on the target`,
    );
    assert.ok(plan.skips < DO_OVER_STEP, 'a plan should never need four turn-skips');
  }
}

assert.deepEqual(planTo(175, 179), { steps: 4, skips: 0, doOvers: 1 }, 'the Any% approach changed');
assert.deepEqual(
  planTo(179, 179),
  { steps: 0, skips: 0, doOvers: 0 },
  'staying put should cost nothing',
);

// ------------------------------------------------------- reading the position

// Four consecutive Do-Over results must always find the index they came from.
for (const party of [ANY_PERCENT, ODIN]) {
  for (const roll of rollCycle(party)) {
    if (!roll.spell) continue;
    // A gap in the run would shift the later observations onto the wrong
    // index, so only take the consecutive ones, the same way the UI does.
    const observations = [];
    for (const step of [0, 1, 2, 3]) {
      const seen = rollAt(roll.index + DO_OVER_STEP * step, party);
      if (!seen.spell) break;
      observations.push({ spell: seen.spell, casts: seen.casts });
    }

    const { matches } = identify(party, observations);
    assert.ok(
      matches.includes(roll.index),
      `index ${roll.index} did not identify itself from its own sequence`,
    );
  }
}

// Cast counts carry information the names do not, so they can only narrow.
const namesOnly = identify(ANY_PERCENT, [{ spell: 'Fire' }]).matches.length;
const withCasts = identify(ANY_PERCENT, [{ spell: 'Fire', casts: 2 }]).matches.length;
assert.ok(withCasts < namesOnly, 'cast counts should narrow the candidate set');

// A count no cell can produce falls back to names rather than reporting nothing.
const impossible = identify(ANY_PERCENT, [{ spell: 'The End', casts: 3 }]);
assert.ok(impossible.ignoredCasts, 'an impossible cast count should trigger the fallback');
assert.deepEqual(impossible.matches, [179], 'the fallback lost the true match');

// Nonsense stays nonsense; the fallback must not rescue a wrong spell name.
assert.deepEqual(
  identify(ANY_PERCENT, [{ spell: 'Not A Spell' }]).matches,
  [],
  'an unknown spell should match nothing',
);

// ------------------------------------------------------------ the drift check

// Standing where the plan expected reports no drift at all.
const onPlan = solveDrift(ANY_PERCENT, 179, [{ spell: 'The End', casts: 1 }]);
assert.equal(onPlan.drifts[0], 0, 'being on plan should read as zero drift');
assert.equal(onPlan.actual, 179, 'zero drift should leave the index alone');

// And a known displacement comes back with its sign: negative means behind.
const behind = rollAt(175, ANY_PERCENT);
const behindNext = rollAt(175 + DO_OVER_STEP, ANY_PERCENT);
const measured = solveDrift(ANY_PERCENT, 179, [
  { spell: behind.spell, casts: behind.casts },
  ...(behindNext.spell ? [{ spell: behindNext.spell, casts: behindNext.casts }] : []),
]);
assert.equal(measured.drifts[0], -4, 'a four-step shortfall should read as -4');
assert.equal(measured.actual, 175, 'drift should re-point the index');

console.log('slot tables OK');
