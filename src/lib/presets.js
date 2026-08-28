/**
 * Starting party states for the two setups the community has notes for.
 */
export const PRESETS = {
  anyPercent: {
    label: 'Any% Lv8',
    party: { level: 8, currentHp: 34, maxHp: 482, deadAllies: 0, statuses: {} },
  },
  odin: {
    label: '100% Odin',
    party: { level: 100, currentHp: 520, maxHp: 9576, deadAllies: 0, statuses: { aura: true } },
  },
};
