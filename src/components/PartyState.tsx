import { Accordion, Checkbox, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';

import { CYCLE, DEFAULT_REFRESH_STEP, STATUS_WEIGHTS } from '../lib/slot.ts';
import type { Party, StatusName } from '../lib/types.ts';

const STATUS_LABELS: Record<StatusName, string> = {
  aura: 'Aura',
  doom: 'Doom',
  blind: 'Blind',
  silence: 'Silence',
  poison: 'Poison',
  slow: 'Slow',
  gradualPetrify: 'Gradual Petrify',
};

export interface PartyStateProps {
  party: Party;
  onPartyChange: (party: Party) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  refreshStep: number;
  onRefreshStepChange: (step: number) => void;
}

/** Stuff for the user to manipulate */
export default function PartyState({
  party,
  onPartyChange,
  offset,
  onOffsetChange,
  refreshStep,
  onRefreshStepChange,
}: PartyStateProps) {
  // Every input below edits one field of the same object. Spelled out rather
  // than driven from a table of field descriptors: there are only four of them,
  // and a table means changing a label or a bound is a hunt through data
  // instead of an edit at the thing you are looking at.
  const set = (patch: Partial<Party>) => onPartyChange({ ...party, ...patch });

  return (
    <>
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="sm">
        <NumberInput
          label="Selphie's Level"
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
          label="Selphie's Current HP"
          min={1}
          max={9999}
          clampBehavior="strict"
          value={party.currentHp}
          onChange={(value) => set({ currentHp: Number(value) || 1 })}
        />
        <NumberInput
          label="Selphie's Max HP"
          min={1}
          max={9999}
          clampBehavior="strict"
          value={party.maxHp}
          onChange={(value) => set({ maxHp: Number(value) || 1 })}
        />

        <Stack gap={6} style={{ gridColumn: '1 / -1' }}>
          <Text component="h3" size="sm" fw={500} m={0}>
            Selphie&apos;s Statuses
          </Text>
          {/*
            This one stays a map: seven near-identical checkboxes, and the labels
            pair with STATUS_WEIGHTS so the weights shown can never drift from the
            ones the crisis formula uses.
          */}
          <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing={4} verticalSpacing={4}>
            {(Object.keys(STATUS_LABELS) as StatusName[]).map((name) => (
              <Checkbox
                key={name}
                size="xs"
                label={`${STATUS_LABELS[name]} (+${STATUS_WEIGHTS[name]})`}
                checked={Boolean(party.statuses[name])}
                onChange={(event) =>
                  set({ statuses: { ...party.statuses, [name]: event.currentTarget.checked } })
                }
              />
            ))}
          </SimpleGrid>
        </Stack>
      </SimpleGrid>

      <Accordion variant="unstyled">
        <Accordion.Item value="advanced">
          <Accordion.Control>Advanced</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <NumberInput
                label="RNG offset"
                description="Correction to the solved index when the battle moves RNG beyond the Slot, e.g. an enemy acting."
                min={-CYCLE}
                max={CYCLE}
                clampBehavior="strict"
                allowNegative
                value={offset}
                onChange={(value) => onOffsetChange(Number(value) || 0)}
              />
              <NumberInput
                label="RNG per refresh"
                description="How far the index moves each ATB refresh. Only the refresh estimate uses this."
                min={1}
                max={CYCLE}
                clampBehavior="strict"
                value={refreshStep}
                onChange={(value) => onRefreshStepChange(Number(value) || DEFAULT_REFRESH_STEP)}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}
