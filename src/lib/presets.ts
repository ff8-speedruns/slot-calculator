import type { Party } from './types.ts';

/** Where the tool starts, and the first button in the preset row. */
export const ANY_PERCENT: Party = {
  level: 8,
  currentHp: 34,
  maxHp: 482,
  deadAllies: 0,
  statuses: {},
};

/** Party states a runner can load in one click. */
export const PRESETS: { label: string; party: Party }[] = [
  { label: 'Any% Lv8', party: ANY_PERCENT },
  {
    label: '100% Odin',
    party: { level: 100, currentHp: 520, maxHp: 9576, deadAllies: 0, statuses: { aura: true } },
  },
];
