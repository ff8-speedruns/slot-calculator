import { Button, Checkbox, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';

import { CYCLE, STATUS_WEIGHTS } from '../lib/slot.ts';
import { PRESETS } from '../lib/presets.ts';
import type { Party, StatusName } from '../lib/types.ts';

import Panel from './Panel.tsx';

const STATUS_LABELS: Record<StatusName, string> = {
  aura: 'Aura',
  doom: 'Doom',
  blind: 'Blind',
  silence: 'Silence',
  poison: 'Poison',
  slow: 'Slow',
  gradualPetrify: 'Gradual Petrify',
};

/**
 * The numeric fields.
 */
interface NumberField {
  key: keyof Omit<Party, 'statuses'>;
  label: string;
  min: number;
  max: (party: Party) => number;
}

const NUMBER_FIELDS: NumberField[] = [
  { key: 'level', label: 'Level', min: 1, max: () => 100 },
  { key: 'deadAllies', label: 'Dead allies', min: 0, max: () => 2 },
  { key: 'currentHp', label: 'Current HP', min: 1, max: (party) => party.maxHp },
  { key: 'maxHp', label: 'Max HP', min: 1, max: () => 9999 },
];

export interface PartyStateProps {
  party: Party;
  onPartyChange: (party: Party) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
}

/** Stuff for the user to manipulate */
export default function PartyState({
  party,
  onPartyChange,
  offset,
  onOffsetChange,
}: PartyStateProps) {
  const handleFieldChange = (key: NumberField['key'], min: number) => (value: string | number) =>
    onPartyChange({ ...party, [key]: Number(value) || min });

  const handleStatusChange = (name: StatusName, checked: boolean) =>
    onPartyChange({ ...party, statuses: { ...party.statuses, [name]: checked } });

  return (
    <Panel title="1. Selphie's Stats" fullHeight>
      <SimpleGrid cols={2} spacing="sm">
        {NUMBER_FIELDS.map((field) => (
          <NumberInput
            key={field.key}
            label={field.label}
            min={field.min}
            max={field.max(party)}
            clampBehavior="strict"
            value={party[field.key]}
            onChange={handleFieldChange(field.key, field.min)}
          />
        ))}

        <Stack gap={6}>
          <Text component="h3" size="sm" fw={500} m={0}>
            Statuses on Selphie
          </Text>
          <SimpleGrid cols={2} spacing={4} verticalSpacing={4}>
            {(Object.keys(STATUS_LABELS) as StatusName[]).map((name) => (
              <Checkbox
                key={name}
                size="xs"
                label={`${STATUS_LABELS[name]} (+${STATUS_WEIGHTS[name]})`}
                checked={Boolean(party.statuses[name])}
                onChange={(event) => handleStatusChange(name, event.currentTarget.checked)}
              />
            ))}
          </SimpleGrid>
        </Stack>
        <NumberInput
          label="RNG offset"
          description="(Advanced users only) Correction to the solved index for situations where the battle progresses RNG beyond the slot (e.g. an enemy acting, etc.)"
          min={-CYCLE}
          max={CYCLE}
          clampBehavior="strict"
          allowNegative
          value={offset}
          onChange={(value) => onOffsetChange(Number(value) || 0)}
        />
      </SimpleGrid>

      <Text component="h3" size="sm" fw={500} m={0}>
        Presets
      </Text>
      <Group gap="xs">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="xs"
            variant="default"
            onClick={() => onPartyChange(preset.party)}
          >
            {preset.label}
          </Button>
        ))}
      </Group>
    </Panel>
  );
}
