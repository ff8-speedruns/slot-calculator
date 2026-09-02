import { useMemo, useState } from 'react';
import { Anchor, Button, Checkbox, Grid, Group, Select, Stack, Text } from '@mantine/core';
import { ToolShell } from '@ff8-speedruns/ui';

import {
  CYCLE,
  SHOW_CAST_COUNTS,
  SPELLS,
  findSpell,
  isBlocked,
  openingRoutes,
  spellAvailability,
} from './lib/slot.ts';
import { ANY_PERCENT } from './lib/presets.ts';
import type { CastFilter, Party, Target } from './lib/types.ts';
import { useSlotReading } from './hooks/useSlotReading.ts';

import AvailabilityBadge from './components/AvailabilityBadge.tsx';
import Explainer from './components/Explainer.tsx';
import ObservationInput from './components/ObservationInput.tsx';
import OpeningTell from './components/OpeningTell.tsx';
import Panel from './components/Panel.tsx';
import PartyState from './components/PartyState.tsx';
import PlanCard from './components/PlanCard.tsx';
import ReadingPanel from './components/Reading.tsx';

import styles from './App.module.css';

const DEFAULT_SPELL = 'The End';

/**
 * Past this many rows the opening list stops being something a runner can scan
 * mid-fight, and a spell on that many openings has a short wait anyway. Beyond
 * it the reader is the better tool, so the two panels swap.
 */
const ROUTES_MAX = 16;

/** Width of the right-hand slot in the target picker when a badge is in it. */
const BADGE_SLOT_WIDTH = 116;

const CAST_FILTER: { value: string; label: string }[] = [
  { value: '0', label: 'Any' },
  { value: '1', label: '×1' },
  { value: '2', label: '×2' },
  { value: '3', label: '×3' },
];

const INTRO =
  'Works out where the RNG is and how many Do Overs stand between Selphie and the target spell.';

export default function App() {
  const [party, setParty] = useState<Party>(ANY_PERCENT);
  const [spell, setSpell] = useState<string>(DEFAULT_SPELL);
  const [casts, setCasts] = useState<CastFilter>(0);

  /**
   * Correction to the solved index for situations where the battle progresses RNG beyond
   * the slot (e.g. an enemy acting, etc.)
   */
  const [offset, setOffset] = useState(0);

  // One object so the memos below key off a stable value rather than two.
  const target = useMemo<Target>(() => ({ spell, casts }), [spell, casts]);

  const {
    observations,
    visible,
    taken,
    reading,
    solved,
    crisis,
    current,
    tieIsMoot,
    tieBreaker,
    planFrom,
    planCrisis,
    readFromOpening,
    handleObservationChange,
    handleClearReading,
    handleStartFrom,
    handleReadFromOpeningChange,
  } = useSlotReading(party, target, offset);

  // Walks all 256 indices, so it is memoised. `from` is deliberately left off:
  // it exists to price each hit's plan, which nothing renders any more, and
  // passing `current` re-walked the whole cycle every time the offset moved or
  // the reading resolved, for a value only ever read as a count.
  const hits = useMemo(
    () => (crisis === null ? [] : findSpell(party.level, crisis, target)),
    [party.level, crisis, target],
  );
  const availability = useMemo(() => spellAvailability(party), [party]);

  // Walks every live opening and up to 64 indices per opening, so it is the most
  // expensive thing here. Computed once: the panel draws it, and the choice of
  // which panel to draw depends on it.
  const routes = useMemo(() => openingRoutes(party, target), [party, target]);

  /**
   * The two panels answer the same question from opposite ends, so only one is
   * ever useful. The opening list is the better answer when it is short enough to
   * scan AND complete; otherwise the runner has to read the Slot instead.
   *
   * Completeness is the other half of the test, and it is the routes' own verdict
   * rather than a rule restated here: an incomplete list has openings that work
   * but cannot be named, so it cannot claim anything unlisted is safe to pass,
   * and the reader has to be there to settle them.
   */
  const readInstead = routes.routes.length > ROUTES_MAX || !routes.complete;

  const handleSpellChange = (next: string | null) => setSpell(next ?? DEFAULT_SPELL);
  const handleCastsChange = (next: string | null) => setCasts((Number(next) || 0) as CastFilter);

  const targetEntry = availability.get(spell);
  const showTargetBadge = isBlocked(targetEntry);

  return (
    <ToolShell
      title="Selphie Slot Calculator"
      status="needsTesters"
      repo="slot-calculator"
      intro={INTRO}
      credits={
        <>
          Inspired by{' '}
          <Anchor href="https://github.com/romaindurand/ff8-slot-manip">
            romaindurand/ff8-slot-manip
          </Anchor>
          .
        </>
      }
    >
      <Stack gap="lg">
        <Grid gap="md" align="stretch">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <PartyState
              party={party}
              onPartyChange={setParty}
              offset={offset}
              onOffsetChange={setOffset}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              <Panel title="2. Target">
                <Group gap="sm" align="flex-end" wrap="wrap">
                  <Select
                    label="Target spell"
                    data={SPELLS as string[]}
                    value={spell}
                    onChange={handleSpellChange}
                    searchable
                    allowDeselect={false}
                    className={styles.targetSelect}
                    renderOption={({ option }) => (
                      <Group justify="space-between" w="100%" gap="xs" wrap="nowrap">
                        <span>{option.label}</span>
                        <AvailabilityBadge
                          entry={availability.get(option.value)}
                          level={party.level}
                        />
                      </Group>
                    )}
                    rightSectionWidth={showTargetBadge ? BADGE_SLOT_WIDTH : undefined}
                    rightSection={
                      showTargetBadge ? (
                        <AvailabilityBadge entry={targetEntry} level={party.level} />
                      ) : null
                    }
                    rightSectionPointerEvents="none"
                  />
                  {SHOW_CAST_COUNTS && (
                    <Select
                      label="Casts"
                      w={96}
                      data={CAST_FILTER}
                      value={String(casts)}
                      onChange={handleCastsChange}
                      allowDeselect={false}
                    />
                  )}
                </Group>
                {crisis !== null && (
                  <Text size="sm" c="dimmed">
                    {hits.length
                      ? `${hits.length} of ${CYCLE} indices show this at crisis ${crisis}.`
                      : `Nothing shows this at crisis ${crisis} and level ${party.level}, so reaching it means re-opening the Limit Break.`}
                  </Text>
                )}
              </Panel>

              {!readInstead && (
                <OpeningTell guide={routes} spell={spell} onPickReading={handleStartFrom} />
              )}
            </Stack>
          </Grid.Col>

          {readInstead && (
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Panel
                title="4. What is on screen"
                description="Type the Slot spells you see, in order."
                action={
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    disabled={taken === 0}
                    onClick={handleClearReading}
                  >
                    Clear
                  </Button>
                }
                fullHeight
              >
                {observations.slice(0, visible).map((observation, position) => (
                  // These rows are a fixed 16-slot array that doesn't change.
                  // Only the contents of a known position change,
                  // so the position IS the identity. Swapping to a content-based
                  // key would remount the field on every keystroke.
                  <ObservationInput
                    key={position}
                    placeholder={
                      position === 0
                        ? 'Spell shown now'
                        : `After ${position} Do Over${position === 1 ? '' : 's'}`
                    }
                    value={observation}
                    options={reading.options[position] ?? []}
                    onChange={(value) => handleObservationChange(position, value)}
                  />
                ))}

                <Checkbox
                  mt="xs"
                  size="xs"
                  checked={readFromOpening}
                  onChange={(event) => handleReadFromOpeningChange(event.currentTarget.checked)}
                  label="First spell above is the one the Limit Break opened on"
                  description="Untick if you had already pressed Do Over before you started typing."
                />

                <ReadingPanel
                  reading={reading}
                  party={party}
                  solved={solved}
                  current={current}
                  offset={offset}
                  tieBreaker={tieBreaker}
                  tieIsMoot={tieIsMoot}
                  taken={taken}
                />
              </Panel>
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, md: readInstead ? 7 : 12 }}>
            {planCrisis === null || planFrom === null ? (
              <Panel title="5. [Waiting...]" fullHeight>
                <Text c="dimmed">
                  {reading.matches.length > 1
                    ? 'More than one state still fits, and they do not agree on the plan. Break the tie on the left first.'
                    : 'Waiting for the previous step to be complete.'}
                </Text>
              </Panel>
            ) : (
              <PlanCard
                party={party}
                from={planFrom}
                fromCrisis={planCrisis}
                spell={spell}
                casts={casts}
                settled={solved !== null}
              />
            )}
          </Grid.Col>
        </Grid>

        <Explainer />
      </Stack>
    </ToolShell>
  );
}
