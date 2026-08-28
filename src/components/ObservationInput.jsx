import { Autocomplete, Group, Select } from '@mantine/core';
import { SPELLS } from '../lib/slot';

/**
 * The cast count is optional because it is the least certain part of the
 * recovered data, but it comes from a different byte than the spell name so it
 * roughly halves the candidate set when it is given.
 * TODO: PULL FROM GAME DATA WHEN I GET MY PC BACK
 */
const CAST_OPTIONS = [
  { value: '', label: '×?' },
  { value: '1', label: '×1' },
  { value: '2', label: '×2' },
  { value: '3', label: '×3' },
];

export default function ObservationInput({ placeholder, value, onChange }) {
  const { spell = '', casts = 0 } = value;

  return (
    <Group gap="xs" wrap="nowrap">
      <Autocomplete
        style={{ flex: 1 }}
        data={SPELLS}
        placeholder={placeholder}
        value={spell}
        onChange={(next) => onChange({ spell: next ?? '', casts })}
      />
      <Select
        w={86}
        data={CAST_OPTIONS}
        value={casts ? String(casts) : ''}
        onChange={(next) => onChange({ spell, casts: Number(next) || 0 })}
        allowDeselect={false}
        comboboxProps={{ width: 90 }}
      />
    </Group>
  );
}
