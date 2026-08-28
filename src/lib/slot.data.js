/**
 * Recovered Selphie Slot tables.
 *
 * RNG_TABLE is FF8's battle random table: 256 bytes read by an index that
 * every battle action advances. It is a shuffled permutation of 0-255.
 *
 * SLOT_ARRAY is the spell lookup the roll indexes into, flattened from the
 * kernel's 60-byte slot array (section 27) and its 16 sets of 8 magic/count
 * pairs (section 28) into one row per slot index. Rows 60-65 are the
 * out-of-bounds reads described in slot.js.
 *
 * TODO: Pull from actual game data when I get my PC back
 * Both were recovered by fitting the two reference tables shipped with
 * romaindurand/ff8-slot-manip against each other, one at level 8/9 and one at
 * level 100. The fit reproduces all 2,048 of their spell names exactly. See
 * slot.check.js for the anchors that pin it.
 */

/** The battle random table, indexed 0-255. */
export const RNG_TABLE = [
  202, 99, 6, 240, 35, 248, 229, 168, 1, 193, 174, 127, 72, 123, 177, 220, 9, 34, 109, 125, 238,
  157, 88, 213, 85, 36, 57, 122, 223, 142, 84, 108, 27, 192, 11, 208, 67, 216, 154, 71, 93, 33, 2,
  23, 75, 219, 17, 175, 112, 205, 77, 52, 73, 114, 145, 45, 98, 151, 89, 69, 247, 110, 70, 170, 10,
  163, 200, 49, 146, 56, 250, 212, 230, 203, 243, 222, 107, 187, 241, 28, 60, 214, 173, 178, 169,
  221, 87, 66, 149, 12, 121, 37, 31, 188, 231, 172, 91, 131, 40, 118, 242, 24, 218, 135, 161, 97,
  111, 190, 90, 94, 81, 239, 176, 201, 21, 116, 137, 189, 209, 162, 117, 215, 153, 133, 76, 79, 210,
  191, 74, 32, 8, 86, 160, 80, 58, 103, 38, 65, 51, 183, 186, 251, 48, 207, 124, 132, 44, 50, 233,
  29, 22, 130, 120, 164, 128, 101, 95, 14, 39, 185, 25, 195, 167, 182, 0, 59, 252, 136, 225, 198,
  147, 254, 139, 217, 184, 19, 105, 47, 100, 18, 55, 253, 119, 226, 181, 4, 224, 26, 140, 143, 180,
  204, 249, 96, 235, 41, 227, 144, 165, 104, 61, 129, 115, 63, 171, 126, 179, 15, 206, 196, 53, 148,
  150, 134, 113, 211, 42, 228, 159, 156, 236, 78, 20, 245, 234, 64, 166, 246, 3, 152, 197, 7, 244,
  43, 194, 62, 232, 155, 54, 83, 46, 141, 13, 82, 16, 102, 30, 237, 138, 68, 158, 5, 255, 92, 199,
  106,
];

/**
 * SLOT_ARRAY[slotIndex][spellIndex] = [spell, maxCasts, confidence].
 *
 * Spell names are the English ones. `maxCasts` is what the cast count is taken
 * modulo, and `confidence` says how well it is known: 2 means the maximum is
 * pinned, 1 means the cell was seen too few times to separate 2 from 3 and the
 * lower value is used, 0 means the observations contradict the count model and
 * only the spell name should be trusted.
 *
 * A null cell is a spell index never observed at that slot index. A null row is
 * a slot level unreachable from both reference tables: levels 8 and 9 of each
 * slot mod, which need a dump from a character somewhere between level 20 and
 * 90 to fill in.
 */
export const SLOT_ARRAY = [
  // 0
  [
    ['Fire', 2, 1],
    ['Blizzard', 1, 1],
    ['Thunder', 2, 1],
    ['Cure', 2, 2],
    null,
    null,
    null,
    ['Full Cure', 1, 2],
  ],
  // 1
  [
    ['Fire', 2, 2],
    ['Blizzard', 1, 1],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    null,
    null,
    ['Full Cure', 1, 2],
  ],
  // 2
  [
    ['Fire', 2, 2],
    ['Blizzard', 1, 1],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 1, 1],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 3
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 1, 1],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 4
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 5
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 6
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    null,
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 7
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 1, 1],
    null,
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 1],
  ],
  null, // 8
  null, // 9
  // 10
  [
    ['Fira', 2, 1],
    ['Blizzara', 1, 1],
    ['Thundara', 2, 1],
    ['Cura', 1, 2],
    null,
    null,
    null,
    ['Full Cure', 1, 2],
  ],
  // 11
  [
    ['Fira', 2, 2],
    ['Blizzara', 1, 1],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    null,
    null,
    ['Full Cure', 1, 2],
  ],
  // 12
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 13
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 14
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 15
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 16
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 17
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 18
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 19
  [
    ['Firaga', 2, 2],
    ['Blizzaga', 2, 2],
    ['Thundaga', 2, 2],
    ['Curaga', 1, 2],
    ['Firaga', 3, 2],
    ['Blizzaga', 3, 2],
    ['Thundaga', 3, 2],
    ['Wall', 1, 2],
  ],
  null, // 20
  null, // 21
  // 22
  [
    null,
    ['Aero', 3, 2],
    ['Bio', 2, 2],
    ['Full Cure', 1, 1],
    ['Firaga', 3, 2],
    ['Blizzaga', 3, 2],
    ['Thundaga', 1, 1],
    ['Rapture', 1, 2],
  ],
  // 23
  [
    ['Water', 3, 2],
    ['Aero', 3, 0],
    ['Bio', 3, 2],
    ['Demi', 3, 2],
    ['Holy', 2, 2],
    ['Flare', 2, 2],
    ['Quake', 1, 2],
    ['Rapture', 1, 2],
  ],
  // 24
  [
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Esuna', 3, 2],
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 25
  [
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Esuna', 3, 2],
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 26
  [
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Esuna', 3, 2],
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 27
  [
    ['Protect', 3, 0],
    ['Aura', 3, 0],
    ['Haste', 3, 2],
    ['Drain', 3, 2],
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 28
  [
    ['Protect', 3, 2],
    ['Aura', 3, 2],
    ['Haste', 3, 2],
    ['Drain', 3, 2],
    ['Blind', 3, 2],
    ['Sleep', 3, 2],
    ['Silence', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 29
  [
    ['Break', 3, 2],
    ['Float', 3, 2],
    ['Regen', 3, 2],
    ['Protect', 3, 2],
    ['Aura', 3, 2],
    ['Haste', 3, 2],
    ['Drain', 2, 2],
    ['Wall', 1, 2],
  ],
  // 30
  [
    ['Break', 2, 1],
    ['Float', 3, 2],
    ['Regen', 2, 1],
    ['Protect', 1, 1],
    ['Aura', 3, 2],
    ['Haste', 3, 2],
    ['Drain', 2, 2],
    ['Wall', 1, 1],
  ],
  // 31
  [
    ['Dispel', 2, 1],
    ['Shell', 3, 2],
    ['Double', 2, 1],
    null,
    null,
    ['Confuse', 3, 2],
    ['Curaga', 1, 1],
    null,
  ],
  null, // 32
  null, // 33
  // 34
  [
    ['Death', 3, 2],
    ['Pain', 1, 1],
    ['Stop', 3, 2],
    ['Dispel', 3, 2],
    ['Shell', 3, 2],
    null,
    ['Slow', 1, 1],
    ['Rapture', 1, 1],
  ],
  // 35
  [
    ['Berserk', 3, 2],
    ['Death', 1, 1],
    ['Pain', 3, 2],
    ['Zombie', 3, 2],
    ['Meltdown', 3, 2],
    ['Curaga', 3, 2],
    ['Reflect', 2, 1],
    ['Triple', 3, 2],
  ],
  // 36
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 37
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 3, 2],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 38
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 2, 0],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 39
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 40
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 2],
  ],
  // 41
  [
    ['Firaga', 2, 2],
    ['Blizzaga', 2, 2],
    ['Thundaga', 2, 2],
    ['Curaga', 1, 2],
    ['Firaga', 2, 1],
    ['Blizzaga', 3, 2],
    ['Thundaga', 3, 2],
    ['Wall', 1, 2],
  ],
  // 42
  [
    ['Water', 3, 2],
    null,
    ['Bio', 2, 2],
    ['Full Cure', 1, 2],
    ['Firaga', 2, 1],
    ['Blizzaga', 3, 2],
    ['Thundaga', 3, 2],
    ['Rapture', 1, 2],
  ],
  // 43
  [
    ['Water', 2, 1],
    null,
    ['Bio', 3, 2],
    null,
    null,
    ['Flare', 1, 1],
    ['Quake', 1, 1],
    ['Rapture', 1, 2],
  ],
  null, // 44
  null, // 45
  // 46
  [
    ['Holy', 3, 2],
    ['Flare', 2, 1],
    ['Meteor', 1, 1],
    null,
    null,
    ['Ultima', 1, 1],
    ['Rapture', 1, 2],
    null,
  ],
  // 47
  [
    ['Meteor', 2, 2],
    ['Holy', 3, 2],
    ['Ultima', 1, 1],
    ['Ultima', 1, 1],
    null,
    ['Ultima', 1, 1],
    ['Ultima', 2, 2],
    null,
  ],
  // 48
  [
    ['Fire', 2, 2],
    ['Blizzard', 2, 2],
    ['Thunder', 2, 2],
    ['Cure', 2, 2],
    ['Fire', 2, 1],
    ['Blizzard', 3, 2],
    ['Thunder', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 49
  [
    ['Fira', 2, 2],
    ['Blizzara', 2, 2],
    ['Thundara', 2, 2],
    ['Cura', 1, 2],
    ['Cura', 3, 2],
    ['Blizzara', 3, 2],
    ['Thundara', 3, 2],
    ['Full Cure', 1, 1],
  ],
  // 50
  [
    ['Firaga', 2, 2],
    ['Blizzaga', 2, 2],
    ['Thundaga', 2, 2],
    ['Curaga', 1, 2],
    ['Firaga', 3, 2],
    ['Blizzaga', 3, 2],
    ['Thundaga', 3, 2],
    ['Wall', 1, 2],
  ],
  // 51
  [
    ['Holy', 3, 2],
    ['Meteor', 2, 2],
    ['Ultima', 1, 2],
    ['Ultima', 2, 2],
    ['Meteor', 3, 2],
    ['Ultima', 1, 1],
    ['Ultima', 3, 2],
    ['The End', 1, 2],
  ],
  // 52
  [
    ['Water', 3, 2],
    null,
    ['Bio', 2, 2],
    ['Full Cure', 1, 2],
    ['Firaga', 3, 2],
    ['Blizzaga', 3, 2],
    ['Thundaga', 3, 2],
    ['Rapture', 1, 2],
  ],
  // 53
  [
    ['Water', 3, 2],
    null,
    ['Bio', 3, 2],
    ['Demi', 2, 1],
    null,
    ['Flare', 1, 1],
    ['Quake', 1, 1],
    ['Rapture', 1, 2],
  ],
  // 54
  [['Bio', 3, 2], null, null, null, null, null, null, null],
  // 55
  [['Demi', 3, 2], null, null, null, null, null, null, null],
  null, // 56
  null, // 57
  // 58
  [null, null, null, null, ['Ultima', 1, 2], null, null, ['Ultima', 1, 1]],
  // 59
  [['Holy', 1, 1], null, null, null, ['Meteor', 3, 2], null, null, ['The End', 1, 1]],
  // 60
  [['Fira', 2, 2], null, null, ['Cura', 1, 2], ['Cura', 3, 2], null, null, ['Full Cure', 1, 1]],
  // 61
  [['Firaga', 1, 1], null, null, ['Curaga', 1, 2], ['Firaga', 3, 2], null, null, ['Wall', 1, 1]],
  // 62
  [['Water', 3, 2], null, null, ['Demi', 2, 1], ['Holy', 1, 1], null, null, null],
  // 63
  [['Firaga', 2, 2], null, null, ['Curaga', 1, 2], null, null, null, null],
  // 64
  [['Holy', 3, 2], null, null, null, null, null, null, null],
  // 65
  [['Firaga', 2, 2], null, null, null, null, null, null, null],
];
