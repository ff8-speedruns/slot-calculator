import type { Casts } from './types.ts';

/**
 * Selphie Slot tables, read out of the game's kernel.bin.
 *
 * Extracted from the Steam 2013 release: Data/lang-en/main.fs entry 12
 * (LZS-compressed, 37,992 bytes decompressed, md5
 * 6551ade6c3cb96186177e397fa5b111e), then two sections of that file:
 *
 *   0x4AD0, 60 bytes    the slot array - one set id per slotIndex
 *   0x4B0C, 256 bytes   16 sets of 8 (magic id, max casts) pairs
 *
 * Magic ids are resolved through kernel section 2 (0x021C, 57 entries of 60
 * bytes), so a name here is the game's own, not a translation of one.
 *
 * This supersedes the tables that were previously fitted from
 * romaindurand/ff8-slot-manip.
 */

/**
 * FF8's battle random table: 256 bytes read by an index that every battle
 * action advances.
 */
export const RNG_TABLE: readonly number[] = [
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
 * SLOT_ARRAY[slotIndex][spellIndex] = [spell, maxCasts].
 *
 * Flattened from the kernel's slot array and slot sets so a roll is one lookup.
 * Rows 0-59 are slotMod * 12 + slotLevel, exactly as the game indexes them.
 * Rows 60-65 are the out-of-bounds reads: the index is not clamped and runs off
 * the end of the 60-byte array into the set block that follows it, so those six
 * rows use set ids 1, 2, 4, 2, 7, 2 - the first six bytes of the sets
 * themselves, reinterpreted as array entries. They are reachable in play, and
 * the level-100 reference table confirms every one of them.
 */
export const SLOT_ARRAY: readonly (readonly (readonly [string, Casts])[])[] = [
  // 0 = mod 0 level 0, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 1 = mod 0 level 1, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 2 = mod 0 level 2, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 3 = mod 0 level 3, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 4 = mod 0 level 4, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 5 = mod 0 level 5, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 6 = mod 0 level 6, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 7 = mod 0 level 7, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 8 = mod 0 level 8, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 9 = mod 0 level 9, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 10 = mod 0 level 10, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 11 = mod 0 level 11, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 12 = mod 1 level 0, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 13 = mod 1 level 1, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 14 = mod 1 level 2, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 15 = mod 1 level 3, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 16 = mod 1 level 4, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 17 = mod 1 level 5, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 18 = mod 1 level 6, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 19 = mod 1 level 7, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 20 = mod 1 level 8, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 21 = mod 1 level 9, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 22 = mod 1 level 10, set 3
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 2],
    ['Full Cure', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Rapture', 1],
  ],
  // 23 = mod 1 level 11, set 4
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Quake', 1],
    ['Rapture', 1],
  ],
  // 24 = mod 2 level 0, set 9
  [
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Esuna', 3],
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Full Cure', 1],
  ],
  // 25 = mod 2 level 1, set 9
  [
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Esuna', 3],
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Full Cure', 1],
  ],
  // 26 = mod 2 level 2, set 9
  [
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Esuna', 3],
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Full Cure', 1],
  ],
  // 27 = mod 2 level 3, set 10
  [
    ['Protect', 3],
    ['Aura', 3],
    ['Haste', 3],
    ['Drain', 3],
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Full Cure', 1],
  ],
  // 28 = mod 2 level 4, set 10
  [
    ['Protect', 3],
    ['Aura', 3],
    ['Haste', 3],
    ['Drain', 3],
    ['Blind', 3],
    ['Sleep', 3],
    ['Silence', 3],
    ['Full Cure', 1],
  ],
  // 29 = mod 2 level 5, set 11
  [
    ['Break', 3],
    ['Float', 3],
    ['Regen', 3],
    ['Protect', 3],
    ['Aura', 3],
    ['Haste', 3],
    ['Drain', 2],
    ['Wall', 1],
  ],
  // 30 = mod 2 level 6, set 11
  [
    ['Break', 3],
    ['Float', 3],
    ['Regen', 3],
    ['Protect', 3],
    ['Aura', 3],
    ['Haste', 3],
    ['Drain', 2],
    ['Wall', 1],
  ],
  // 31 = mod 2 level 7, set 12
  [
    ['Dispel', 3],
    ['Shell', 3],
    ['Double', 3],
    ['Slow', 3],
    ['Break', 3],
    ['Confuse', 3],
    ['Curaga', 3],
    ['Wall', 1],
  ],
  // 32 = mod 2 level 8, set 12
  [
    ['Dispel', 3],
    ['Shell', 3],
    ['Double', 3],
    ['Slow', 3],
    ['Break', 3],
    ['Confuse', 3],
    ['Curaga', 3],
    ['Wall', 1],
  ],
  // 33 = mod 2 level 9, set 13
  [
    ['Death', 3],
    ['Pain', 3],
    ['Stop', 3],
    ['Dispel', 3],
    ['Shell', 3],
    ['Double', 3],
    ['Slow', 3],
    ['Rapture', 1],
  ],
  // 34 = mod 2 level 10, set 13
  [
    ['Death', 3],
    ['Pain', 3],
    ['Stop', 3],
    ['Dispel', 3],
    ['Shell', 3],
    ['Double', 3],
    ['Slow', 3],
    ['Rapture', 1],
  ],
  // 35 = mod 2 level 11, set 14
  [
    ['Berserk', 3],
    ['Death', 3],
    ['Pain', 3],
    ['Zombie', 3],
    ['Meltdown', 3],
    ['Curaga', 3],
    ['Reflect', 3],
    ['Triple', 3],
  ],
  // 36 = mod 3 level 0, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 37 = mod 3 level 1, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 38 = mod 3 level 2, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 39 = mod 3 level 3, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 40 = mod 3 level 4, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 41 = mod 3 level 5, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 42 = mod 3 level 6, set 3
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 2],
    ['Full Cure', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Rapture', 1],
  ],
  // 43 = mod 3 level 7, set 4
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Quake', 1],
    ['Rapture', 1],
  ],
  // 44 = mod 3 level 8, set 5
  [
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Meteor', 2],
    ['Quake', 1],
    ['Tornado', 1],
    ['Rapture', 1],
  ],
  // 45 = mod 3 level 9, set 6
  [
    ['Demi', 3],
    ['Holy', 3],
    ['Flare', 2],
    ['Meteor', 1],
    ['Quake', 1],
    ['Tornado', 1],
    ['Ultima', 1],
    ['Rapture', 1],
  ],
  // 46 = mod 3 level 10, set 7
  [
    ['Holy', 3],
    ['Flare', 3],
    ['Meteor', 1],
    ['Quake', 2],
    ['Tornado', 1],
    ['Ultima', 2],
    ['Rapture', 1],
    ['Tornado', 2],
  ],
  // 47 = mod 3 level 11, set 8
  [
    ['Meteor', 2],
    ['Holy', 3],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 2],
    ['Ultima', 2],
  ],
  // 48 = mod 4 level 0, set 0
  [
    ['Fire', 2],
    ['Blizzard', 2],
    ['Thunder', 2],
    ['Cure', 2],
    ['Fire', 3],
    ['Blizzard', 3],
    ['Thunder', 3],
    ['Full Cure', 1],
  ],
  // 49 = mod 4 level 1, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 50 = mod 4 level 2, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 51 = mod 4 level 3, set 15
  [
    ['Holy', 3],
    ['Meteor', 2],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Meteor', 3],
    ['Ultima', 2],
    ['Ultima', 3],
    ['The End', 1],
  ],
  // 52 = mod 4 level 4, set 3
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 2],
    ['Full Cure', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Rapture', 1],
  ],
  // 53 = mod 4 level 5, set 4
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Quake', 1],
    ['Rapture', 1],
  ],
  // 54 = mod 4 level 6, set 5
  [
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Meteor', 2],
    ['Quake', 1],
    ['Tornado', 1],
    ['Rapture', 1],
  ],
  // 55 = mod 4 level 7, set 6
  [
    ['Demi', 3],
    ['Holy', 3],
    ['Flare', 2],
    ['Meteor', 1],
    ['Quake', 1],
    ['Tornado', 1],
    ['Ultima', 1],
    ['Rapture', 1],
  ],
  // 56 = mod 4 level 8, set 7
  [
    ['Holy', 3],
    ['Flare', 3],
    ['Meteor', 1],
    ['Quake', 2],
    ['Tornado', 1],
    ['Ultima', 2],
    ['Rapture', 1],
    ['Tornado', 2],
  ],
  // 57 = mod 4 level 9, set 8
  [
    ['Meteor', 2],
    ['Holy', 3],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 2],
    ['Ultima', 2],
  ],
  // 58 = mod 4 level 10, set 8
  [
    ['Meteor', 2],
    ['Holy', 3],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Ultima', 2],
    ['Ultima', 2],
  ],
  // 59 = mod 4 level 11, set 15
  [
    ['Holy', 3],
    ['Meteor', 2],
    ['Ultima', 1],
    ['Ultima', 2],
    ['Meteor', 3],
    ['Ultima', 2],
    ['Ultima', 3],
    ['The End', 1],
  ],
  // 60 = past the array, reads set-block byte 0, set 1
  [
    ['Fira', 2],
    ['Blizzara', 2],
    ['Thundara', 2],
    ['Cura', 1],
    ['Cura', 3],
    ['Blizzara', 3],
    ['Thundara', 3],
    ['Full Cure', 1],
  ],
  // 61 = past the array, reads set-block byte 1, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 62 = past the array, reads set-block byte 2, set 4
  [
    ['Water', 3],
    ['Aero', 3],
    ['Bio', 3],
    ['Demi', 3],
    ['Holy', 2],
    ['Flare', 2],
    ['Quake', 1],
    ['Rapture', 1],
  ],
  // 63 = past the array, reads set-block byte 3, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
  // 64 = past the array, reads set-block byte 4, set 7
  [
    ['Holy', 3],
    ['Flare', 3],
    ['Meteor', 1],
    ['Quake', 2],
    ['Tornado', 1],
    ['Ultima', 2],
    ['Rapture', 1],
    ['Tornado', 2],
  ],
  // 65 = past the array, reads set-block byte 5, set 2
  [
    ['Firaga', 2],
    ['Blizzaga', 2],
    ['Thundaga', 2],
    ['Curaga', 1],
    ['Firaga', 3],
    ['Blizzaga', 3],
    ['Thundaga', 3],
    ['Wall', 1],
  ],
];
