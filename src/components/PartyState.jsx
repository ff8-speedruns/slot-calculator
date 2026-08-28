import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { PRESETS } from '../lib/presets';
import { STATUS_WEIGHTS } from '../lib/slot';

/**
 * The statuses the crisis level formula weighs, in the order they are worth
 * most.
 */
const STATUS_LABELS = {
  aura: 'Aura',
  doom: 'Doom',
  blind: 'Blind',
  silence: 'Silence',
  poison: 'Poison',
  gradualPetrify: 'Gradual Petrify',
  slow: 'Slow',
};

export default function PartyState({ party, onChange }) {
  const set = (patch) => onChange({ ...party, ...patch });
  const setStatus = (name, checked) => set({ statuses: { ...party.statuses, [name]: checked } });

  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Stack gap="sm">
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="Level"
            min={1}
            max={100}
            clampBehavior="strict"
            value={party.level}
            onChange={(value) => set({ level: Number(value) || 1 })}
          />
          <NumberInput
            label="Dead allies"
            min={0}
            max={2}
            clampBehavior="strict"
            value={party.deadAllies}
            onChange={(value) => set({ deadAllies: Number(value) || 0 })}
          />
          <NumberInput
            label="Current HP"
            min={1}
            max={party.maxHp}
            clampBehavior="strict"
            value={party.currentHp}
            onChange={(value) => set({ currentHp: Number(value) || 1 })}
          />
          <NumberInput
            label="Max HP"
            min={1}
            max={9999}
            clampBehavior="strict"
            value={party.maxHp}
            onChange={(value) => set({ maxHp: Number(value) || 1 })}
          />
        </SimpleGrid>

        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Statuses on Selphie
          </Text>
          <SimpleGrid cols={2} spacing={4} verticalSpacing={4}>
            {Object.entries(STATUS_LABELS).map(([name, label]) => (
              <Checkbox
                key={name}
                size="xs"
                label={`${label} (+${STATUS_WEIGHTS[name]})`}
                checked={Boolean(party.statuses[name])}
                onChange={(event) => setStatus(name, event.currentTarget.checked)}
              />
            ))}
          </SimpleGrid>
        </Stack>

        <Text size="sm" fw={500}>
          Presets
        </Text>
        <Group gap="xs">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <Button key={key} size="xs" variant="default" onClick={() => onChange(preset.party)}>
              {preset.label}
            </Button>
          ))}
        </Group>
      </Stack>
    </Paper>
  );
}
