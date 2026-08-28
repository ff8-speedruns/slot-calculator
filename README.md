# slot-calculator

Manipulation helper for Selphie's Slot Limit Break in Final Fantasy VIII.

Selphie's Slot is a lookup into a fixed table, indexed by the battle RNG position and the party's state. Given where the RNG index is and what shape Selphie is in, the spell that comes out is fully determined, so any spell in the pool can be planned for rather than rolled for. The End is just the one people ask about.

## What it does

- Works out the spell and cast count at every one of the 256 RNG indices for a given level, HP, dead allies and status set.
- Counts the Do-Overs and turn-skips between where you are and the spell you want.
- Identifies your current index from the spells on screen, so the route and the fight you are in do not matter.
- Solves for drift when something else in the battle spends RNG mid-manip.

## Developing

```
npm install
npm run dev
```

`npm test` runs the self-check over the recovered tables. It pins the byte offsets against the known The End entry, which was not used to build the tables, so it catches a shift that an internal round trip would not.

## Credits

The battle random table and the two reference spell tables (one at level 8/9,
one at level 100) come from [romaindurand/ff8-slot-manip][slot-manip].
