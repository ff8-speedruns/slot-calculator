import { Autocomplete, Group, Select } from '@mantine/core';

import { SHOW_CAST_COUNTS, SPELLS, sameSpell } from '../lib/slot.ts';
import type { CastFilter, Observation } from '../lib/types.ts';

import styles from './ObservationInput.module.css';

/**
 * The cast count is optional because it is the least certain part of the
 * recovered data, but it comes from a different byte than the spell name so it
 * roughly halves the candidate set when it is given.
 */
const CAST_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '×?' },
  { value: '1', label: '×1' },
  { value: '2', label: '×2' },
  { value: '3', label: '×3' },
];

export interface ObservationInputProps {
  placeholder: string;
  value: Observation;
  /**
   * What this row can still be, given every row above it. Empty means no
   * candidate survives that far, so there is no shortlist to offer and the whole
   * spell list goes back on.
   */
  options: string[];
  onChange: (value: Observation) => void;
}

/** One row of the reader: a spell name, and optionally its cast count. */
export default function ObservationInput({
  placeholder,
  value,
  options,
  onChange,
}: ObservationInputProps) {
  const { spell, casts } = value;

  const handleSpellChange = (next: string) => onChange({ spell: next, casts });
  const handleCastsChange = (next: string | null) =>
    onChange({ spell, casts: (Number(next) || 0) as CastFilter });

  // Suggested, never enforced. A runner whose earlier row was a misread has to
  // be able to type the thing this list says is impossible, because that is
  // exactly the moment they need to correct it. What the list does instead is
  // say so, which is useful on its own: a spell off the list means either a
  // misread above, or something in the fight moved the RNG between Do Overs.
  const typed = spell.trim();
  const unexpected =
    options.length > 0 && typed !== '' && !options.some((name) => sameSpell(name, typed));

  return (
    <Group gap="xs" wrap="nowrap">
      <Autocomplete
        className={styles.spell}
        data={options.length ? options : (SPELLS as string[])}
        placeholder={placeholder}
        aria-label={placeholder}
        value={spell}
        onChange={handleSpellChange}
        error={unexpected ? 'Nothing that fits the rows above shows this.' : undefined}
      />
      {SHOW_CAST_COUNTS && (
        <Select
          w={86}
          data={CAST_OPTIONS}
          aria-label={`Cast count for ${placeholder}`}
          value={casts ? String(casts) : ''}
          onChange={handleCastsChange}
          allowDeselect={false}
          comboboxProps={{ width: 90 }}
        />
      )}
    </Group>
  );
}
