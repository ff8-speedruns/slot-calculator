import { useMemo, useState } from 'react';
import { Anchor, Button, Checkbox, Code, Grid, Group, Select, Stack, Text } from '@mantine/core';
import { ToolShell } from '@ff8-speedruns/ui';

import {
  CYCLE,
  DEFAULT_REFRESH_STEP,
  SHOW_CAST_COUNTS,
  SPELLS,
  findSpell,
  isBlocked,
  openingRoutes,
  spellAvailability,
} from './lib/slot.ts';
import type { CastFilter, Party, Target } from './lib/types.ts';
import { useSlotReading } from './hooks/useSlotReading.ts';

import AvailabilityBadge from './components/AvailabilityBadge.tsx';
import Explainer from './components/Explainer.tsx';
import ObservationInput from './components/ObservationInput.tsx';
import OpeningTell from './components/OpeningTell.tsx';
import Panel from './components/Panel.tsx';
import { spellKeyDown, startsWithFilter } from './components/spellSearch.ts';
import PartyState from './components/PartyState.tsx';
import PlanCard from './components/PlanCard.tsx';
import ReadingPanel from './components/Reading.tsx';

import styles from './App.module.css';

const DEFAULT_SPELL = 'The End';

/** Where the tool starts. Any% Selphie, low enough to actually have a Limit. */
const DEFAULT_PARTY: Party = {
  level: 9,
  currentHp: 34,
  maxHp: 482,
  deadAllies: 0,
  statuses: {},
};

/**
 * Past this many rows the list is too long to scan mid-fight, and a spell on that
 * many openings has a short wait anyway. Beyond it, show the reader instead.
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
  const [party, setParty] = useState<Party>(DEFAULT_PARTY);
  const [spell, setSpell] = useState<string>(DEFAULT_SPELL);
  const [casts, setCasts] = useState<CastFilter>(0);

  /**
   * Correction to the solved index for situations where the battle progresses RNG beyond
   * the slot (e.g. an enemy acting, etc.)
   */
  const [offset, setOffset] = useState(0);

  /**
   * How far the index is assumed to move per ATB refresh. Settable because it is
   * not a constant: every CL check spends RNG even when it returns no Limit
   * Break, so an ally whose ATB fills makes a refresh cost more. Only the
   * estimate on the plan card reads it.
   */
  const [refreshStep, setRefreshStep] = useState(DEFAULT_REFRESH_STEP);

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

  // Walks all 256 indices, hence the memo. `from` is left off on purpose: it only
  // prices each hit's plan, which nothing renders now, and passing `current`
  // re-walked the cycle every time the offset moved - for a value used as a count.
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
   * ever useful. Show the opening list when it's short enough to scan AND
   * complete; otherwise the runner has to read the Slot instead.
   *
   * `complete` is the routes' own verdict, not a rule restated here. An incomplete
   * list has openings that work but can't be named, so it can't claim anything
   * unlisted is safe to pass.
   */
  const readInstead = routes.routes.length > ROUTES_MAX || !routes.complete;

  /**
   * Changing the target drops the reading. A reading seeded from an Opening Tell
   * row describes a route to the spell that was selected at the time, so it
   * cannot be read against a different one.
   */
  const handleSpellChange = (next: string | null) => {
    setSpell(next ?? DEFAULT_SPELL);
    handleClearReading();
  };
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
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Panel title="1. Selphie's Stats" fullHeight>
              <PartyState
                party={party}
                onPartyChange={setParty}
                offset={offset}
                onOffsetChange={setOffset}
                refreshStep={refreshStep}
                onRefreshStepChange={setRefreshStep}
              />
            </Panel>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Panel title="2. Target" fullHeight>
              <Group gap="sm" align="flex-end" wrap="wrap">
                <Select
                  label="Target spell"
                  data={SPELLS as string[]}
                  value={spell}
                  onChange={handleSpellChange}
                  searchable
                  allowDeselect={false}
                  filter={startsWithFilter}
                  // Keeps the top of the list armed, so Mantine commits it on Enter
                  // the same way the handler below commits it on Tab.
                  selectFirstOptionOnChange
                  onKeyDown={spellKeyDown(handleSpellChange)}
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

              <Text size="xs" c="dimmed">
                {routes.routes.length} of {routes.live} openings reach <Code>{spell}</Code>, ruling
                out {routes.dead} dead ones.
              </Text>

              {crisis !== null && (
                <Text size="sm" c="dimmed">
                  {hits.length
                    ? `${hits.length} of ${CYCLE} indices show this at crisis ${crisis}.`
                    : `Nothing shows this at crisis ${crisis} and level ${party.level}, so reaching it means re-opening the Limit Break.`}
                </Text>
              )}
            </Panel>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            {readInstead ? (
              <Panel
                title="3. What is on screen"
                fullHeight
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
              >
                {observations.slice(0, visible).map((observation, position) => (
                  // Fixed 16-slot array - only the contents of a known position
                  // change, so position IS the identity. A content-based key
                  // would remount the field on every keystroke.
                  <ObservationInput
                    key={position}
                    position={position}
                    placeholder={
                      position === 0
                        ? 'Spell shown now'
                        : `After ${position} Do Over${position === 1 ? '' : 's'}`
                    }
                    value={observation}
                    options={reading.options[position] ?? []}
                    onChange={handleObservationChange}
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
            ) : (
              <Panel
                title="3. Opening Tell"
                description={
                  routes.routes.length > 0
                    ? 'Watch the Slot. Match a row, then Do Over that many times.'
                    : `Whether ${spell} can be reached at all.`
                }
                fullHeight
              >
                <OpeningTell guide={routes} spell={spell} onPickReading={handleStartFrom} />
              </Panel>
            )}
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            {planCrisis === null || planFrom === null ? (
              <Panel title="4. Result" fullHeight>
                <Text c="dimmed">
                  {reading.matches.length > 1
                    ? 'More than one state still fits, and they do not agree on the plan. Break the tie on the left first.'
                    : readInstead
                      ? 'Waiting for enough inputs.'
                      : 'Pick the row on the left that matches what the Slot is showing.'}
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
                refreshStep={refreshStep}
              />
            )}
          </Grid.Col>
        </Grid>

        <Explainer />
      </Stack>
    </ToolShell>
  );
}
