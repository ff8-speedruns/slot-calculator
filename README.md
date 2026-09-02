# slot-calculator

Helper for Selphie's Slot Limit Break in Final Fantasy VIII.

Selphie's Slot is a lookup into a fixed table, indexed by the battle RNG
position and the party's state. Given where the RNG index is and what shape
Selphie is in, the spell that comes out is fully determined, so any spell in the
pool can be planned for rather than rolled for. The End is just the one people
ask about.

## What it does

- Works out the spell and cast count at every one of the 256 RNG indices for a
  given level, HP, dead allies and status set.
- Answers with one of three verdicts rather than a route: the Do Overs between
  you and the spell, or start over, or a hard no with the HP that changes it
- Counts the Do Overs between where you are and the spell you
  want.
- Identifies your current index from the spells on screen, so the route and the
  fight you are in do not matter.
- Takes a standing RNG offset for whatever else in the battle spends RNG.

## Developing

```
npm install
npm run dev
```

`npm test` runs the self-check over the recovered tables. It pins the byte
offsets against the community's known The End entry, which was not used to build
the tables, so it catches a shift that an internal round trip would not.

## Where the tables came from

The spell tables are read out of the game. `kernel.bin` is entry 12 of
`Data/lang-en/main.fs` in the Steam 2013 release, LZS-compressed; decompressed
it is 37,992 bytes, md5 `6551ade6c3cb96186177e397fa5b111e`. Three sections of it
are used:

| Offset   | Size      | Contents                               |
| -------- | --------- | -------------------------------------- |
| `0x4AD0` | 60 bytes  | slot array, one set id per slot index  |
| `0x4B0C` | 256 bytes | 16 sets of 8 magic-id / max-cast pairs |
| `0x021C` | 57 × 60   | magic list the ids resolve through     |

The [FF8 Modding Wiki][modding-wiki] documents those section layouts.

The roll structure was recovered separately, by fitting the two reference tables
in [romaindurand/ff8-slot-manip][slot-manip] against each other, and the kernel
data confirms it: driving the extracted tables through the roll reproduces all
2,048 reference spell names exactly and 2,043 of the cast counts. The five
disagreements are errors in the level-100 reference table, one of them provably
so, since it reports a cast count the cell's kernel maximum cannot produce.

The turn-skip step is measured in game at +7, from three captures that marked a
solved index, skipped one turn and read the re-opened Slot. Backing out of the
Slot menu and re-engaging is +4 with the crisis held, which makes it a Do Over
and no help at all: two of those three landings have no Limit Break of their own,
which is the proof the crisis is not re-rolled.

+7 is a centre, not a promise. A fourth capture, from an index where only +7 and
+8 had a Limit Break, produced none. So the tool does not route through skips at
all: where a skip lands cannot be predicted, and a route naming an index you will
not be standing on is worse than no route. It answers "start over and read
again" instead, and tells you which openings would help.

A failed crisis roll costs RNG anyway, so a turn that shows no Limit Break still
moves the counter. Walking the cycle by any fixed failure step from 1 to 12, from
all 256 starts, always reaches a live index, so a skip can cost turns but cannot
strand you. Above roughly 896 of 2797 HP no index has a Limit Break at all, which
is why a Slot route lives on low HP.

Two things are still unconfirmed, both noted in the tool: the 256-byte battle
random table is carried rather than extracted, and the cost of a turn where the
Limit Break fails to appear is not a constant.
