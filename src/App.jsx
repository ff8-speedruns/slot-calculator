import { useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Anchor,
  Button,
  Code,
  Grid,
  Group,
  List,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { ToolShell } from '@ff8-speedruns/ui';
import {
  CYCLE,
  SPELLS,
  findSpell,
  hpWindowFor,
  identify,
  rollAt,
  rollCycle,
  solveDrift,
} from './lib/slot';
import { PRESETS } from './lib/presets';
import HitTable from './components/HitTable';
import ObservationInput from './components/ObservationInput';
import PartyState from './components/PartyState';
import PlanCard from './components/PlanCard';
import RngMap from './components/RngMap';

/** Four consecutive Do-Over results is more than enough to pin any index. */
const OBSERVATION_SLOTS = 4;
const BLANK_OBSERVATION = { spell: '', casts: 0 };

/** Beyond this the alternatives line stops being a shortlist and starts being noise. */
const MAX_ALTERNATIVES = 3;

const CAST_FILTER = [
  { value: '0', label: 'Any' },
  { value: '1', label: '×1' },
  { value: '2', label: '×2' },
  { value: '3', label: '×3' },
];

export default function App() {
  const [party, setParty] = useState(PRESETS.anyPercent.party);
  const [spell, setSpell] = useState('The End');
  const [casts, setCasts] = useState(0);
  const [current, setCurrent] = useState(175);

  const [observations, setObservations] = useState(() =>
    Array.from({ length: OBSERVATION_SLOTS }, () => BLANK_OBSERVATION),
  );
  const [identified, setIdentified] = useState(null);

  const [expected, setExpected] = useState(179);
  const [drifted, setDrifted] = useState(() => [BLANK_OBSERVATION, BLANK_OBSERVATION]);
  const [drift, setDrift] = useState(null);

  // Every index is recomputed whenever the party state moves, which is cheap at
  // 256 entries and keeps the map, the plan and the table from disagreeing.
  const rolls = useMemo(() => rollCycle(party), [party]);
  const hits = useMemo(
    () => findSpell(party, { spell, casts, from: current }),
    [party, spell, casts, current],
  );

  const [target, ...alternatives] = hits;
  const here = rollAt(current, party);
  const availableCount = rolls.filter((roll) => roll.available).length;
  const unmappedCount = rolls.filter((roll) => roll.available && !roll.spell).length;

  const setObservation = (position, value, setter) =>
    setter((existing) => existing.map((entry, at) => (at === position ? value : entry)));

  const runIdentify = () => {
    const result = identify(party, observations);
    setIdentified(result);
    setExpected(result.matches.length ? result.matches[0] : 0);
    if (result.matches.length) setCurrent(result.matches[0]);
  };

  const runDrift = () => {
    const result = solveDrift(party, expected, drifted);
    setDrift(result);
    if (result.actual !== null) setCurrent(result.actual);
  };

  return (
    <ToolShell
      title="Selphie Slot Manip"
      status="needsTesters"
      repo="slot-calculator"
      intro="Selphie's Slot is a lookup / manipulation."
      credits={
        <>
          Built on the tables and manip arithmetic from{' '}
          <Anchor href="https://github.com/romaindurand/ff8-slot-manip">
            romaindurand
          </Anchor>.
        </>
      }
    >
      <Stack gap="lg">
        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <PartyState party={party} onChange={setParty} />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>

            <Paper withBorder radius="md" p="md" h="100%">
              <Stack gap="sm">
                <div>
                  <Text fw={600}>Find Your Index</Text>
                  <Text size="sm" c="dimmed">
                    The spell showing now, then each one a Do-Over later. Cast counts come from a different byte than the names, so filling them in roughly halves the search.
                  </Text>
                </div>

                {observations.map((observation, position) => (
                  <ObservationInput
                    key={position}
                    placeholder={
                      position === 0
                        ? 'spell shown now'
                        : `after ${position} Do-Over${position === 1 ? '' : 's'}`
                    }
                    value={observation}
                    onChange={(value) => setObservation(position, value, setObservations)}
                  />
                ))}

                <Group>
                  <Button onClick={runIdentify}>Identify index</Button>
                </Group>

                {identified && <IdentifyResult result={identified} />}
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder radius="md" p="md" h="100%">
              <Stack gap="sm">
                <div>
                  <Text fw={600}>Drift check</Text>
                  <Text size="sm" c="dimmed">
                    Where the plan said you would be, against what you are actually looking at.
                    Anything but zero is another actor in the fight spending RNG you did not.
                  </Text>
                </div>

                <NumberInput
                  label="Index you expected"
                  min={0}
                  max={CYCLE - 1}
                  clampBehavior="strict"
                  value={expected}
                  onChange={(value) => setExpected(Number(value) || 0)}
                />

                {drifted.map((observation, position) => (
                  <ObservationInput
                    key={position}
                    placeholder={position === 0 ? 'spell shown' : 'next Do-Over (optional)'}
                    value={observation}
                    onChange={(value) => setObservation(position, value, setDrifted)}
                  />
                ))}

                <Group>
                  <Button onClick={runDrift}>Solve drift</Button>
                </Group>

                {drift && <DriftResult result={drift} expected={expected} />}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

            <Stack gap="md">
              <Paper withBorder radius="md" p="md">
                <Group gap="sm" align="flex-end" wrap="wrap">
                  <Select
                    label="Target spell"
                    data={SPELLS}
                    value={spell}
                    onChange={(next) => setSpell(next ?? 'The End')}
                    searchable
                    allowDeselect={false}
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <Select
                    label="Casts"
                    w={96}
                    data={CAST_FILTER}
                    value={String(casts)}
                    onChange={(next) => setCasts(Number(next) || 0)}
                    allowDeselect={false}
                  />
                  <NumberInput
                    label="Current index"
                    w={130}
                    min={0}
                    max={CYCLE - 1}
                    clampBehavior="strict"
                    value={current}
                    onChange={(value) => setCurrent(Number(value) || 0)}
                  />
                </Group>
                <Text size="sm" c="dimmed" mt="sm">
                  {hits.length
                    ? `${hits.length} of ${CYCLE} indices give this, so roughly one in ${Math.round(
                        CYCLE / hits.length,
                      )} blind Do-Overs.`
                    : 'No index gives this with the current party state.'}{' '}
                  {availableCount} indices have a Limit available at this HP
                  {unmappedCount > 0 && `, and ${unmappedCount} land on an unmapped slot level`}.
                </Text>
              </Paper>

            </Stack>

              <PlanCard
                target={target}
                from={current}
                alternatives={alternatives.slice(0, MAX_ALTERNATIVES)}
                hereIsAvailable={here.available}
              />
        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>Visual RNG Map</Text>
            <RngMap
              rolls={rolls}
              targetIndices={hits.map((hit) => hit.index)}
              current={current}
              onPick={setCurrent}
            />
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>Every hit for this target</Text>
            <HitTable
              hits={hits}
              current={current}
              hpWindowFor={(hit) => hpWindowFor(hit.index, hit.crisis, party)}
            />
          </Stack>
        </Paper>

        <Explainer />
      </Stack>
    </ToolShell>
  );
}

function IdentifyResult({ result }) {
  const { matches, ignoredCasts } = result;

  if (!matches.length) {
    return (
      <Alert color="red" title="No match">
        Nothing in the cycle produces that sequence. Check the party state and the spelling, and
        that nothing else in the fight rolled between your Do-Overs.
      </Alert>
    );
  }

  return (
    <Alert
      color={matches.length === 1 ? 'green' : 'yellow'}
      title={matches.length === 1 ? 'Found' : `${matches.length} candidates`}
    >
      {matches.length === 1 ? (
        <>
          You are at index <Code>{matches[0]}</Code>.
        </>
      ) : (
        <>
          <Code>{matches.slice(0, 12).join(', ')}</Code>
          {matches.length > 12 && ' …'}. One more Do-Over result will narrow it.
        </>
      )}
      {ignoredCasts &&
        ' Cast counts were ignored: no index matches those quantities, so one of the cells you hit has an unpinned maximum.'}
    </Alert>
  );
}

function DriftResult({ result, expected }) {
  const { drifts, ignoredCasts, actual } = result;

  if (!drifts.length) {
    return (
      <Alert color="red" title="No match">
        Nothing in the cycle matches. Either the party state changed or a spell name is mistyped.
      </Alert>
    );
  }

  const [drift, ...others] = drifts;

  return (
    <Alert
      color={drift === 0 ? 'green' : 'yellow'}
      title={drift === 0 ? 'On plan' : `Drift ${drift > 0 ? '+' : ''}${drift}`}
    >
      {drift === 0 ? (
        <>
          Nothing else rolled. You are still at index <Code>{expected}</Code> and the plan holds.
        </>
      ) : (
        <>
          You are at index <Code>{actual}</Code>, not {expected}. Something else consumed{' '}
          {Math.abs(drift)} RNG step{Math.abs(drift) === 1 ? '' : 's'}. Re-plan from here.
        </>
      )}
      {others.length > 0 &&
        ` Other fits: ${others
          .slice(0, 4)
          .map((value) => (value > 0 ? `+${value}` : value))
          .join(', ')}. Add the next Do-Over result to rule them out.`}
      {ignoredCasts && ' Cast counts were ignored on an unpinned cell.'}
    </Alert>
  );
}

function Explainer() {
  return (
    <Accordion variant="contained">
      <Accordion.Item value="how-to">
        <Accordion.Control>How to use this tool</Accordion.Control>
        <Accordion.Panel>
          <List type="ordered" size="sm" spacing="xs">
            <List.Item>
              Enter Selphie's level, her current and max HP, how many allies are down, and any
              statuses on her. This (plus some RNG calculations) determines her crisis level.
            </List.Item>
            <List.Item>
              Open the Limit Break while RNG is not progressing (e.g. Odin fight, GF summon sequence, etc. Anything that freezes ATB). Enemy attacks DO progress the RNG, so be careful.
              This is the only reliable way to keep the index still while you work.
            </List.Item>
            <List.Item>
              Type the spell showing now, then Do-Over and type the next. Fill in the
              cast counts too if you can, but it's not required. Press <Code>Identify index</Code>. You can start with two spells and add more if the tool hasn't identified the index.
            </List.Item>
            <List.Item>Pick your target spell. The card gives the Do-Overs to press.</List.Item>
            <List.Item>
              If this is a battle where enemies are attacking, after two or three Do-Overs, check yourself against <Code>Drift check</Code> before
              committing.
            </List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="roll">
        <Accordion.Control>How the roll works</Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" mb="sm">
            FF8's battle RNG is a fixed 256-byte table walked by an index. A Do-Over advances
            it by 4, and skipping the turn of anyone in CRIT HP advances it by 1. A roll starting at index{' '}
            <Code>i</Code> reads five consecutive bytes:
          </Text>
          <Code block fz="xs">
            {`hpMod       = floor(2500 * curHP / maxHP)
deathBonus  = deadAllies * 200 + 1600
statusBonus = statusSum * 10
limitLevel  = floor((statusBonus + deathBonus - hpMod) / (B[i] + 160))
crisis      = limitLevel <= 4 ? 0 : min(limitLevel - 4, 4)

x           = B[i+1] % 5
slotMod     = B[i+2] < 39 ? 0 : <159 ? 1 : <209 ? 2 : <249 ? 3 : 4
slotIndex   = slotMod * 12 + floor(Level / 10) + crisis + x - 1
spellIndex  = B[i+3] % 8
spell       = SLOT_ARRAY[slotIndex][spellIndex]
castCount   = (B[i+4] % spell.maxCasts) + 1`}
          </Code>
          <Text size="sm" mt="sm">
            <Text span fw={600}>
              The slot index is not clamped.
            </Text>{' '}
            The kernel's array is 60 bytes, five slot mods of twelve levels, but the expression
            above reaches 65 at level 100 with crisis 4 and <Code>x = 4</Code>. The game reads past
            the end into the slot sets that follow it, and those six rows are reachable in play. The
            overflow is also why a level 100 party sees a different distribution than a level 8 one.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="data">
        <Accordion.Control>TO DO</Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" mb="sm">
            The random table and both reference spell tables come from{' '}
            <Anchor href="https://github.com/romaindurand/ff8-slot-manip">
              romaindurand/ff8-slot-manip
            </Anchor>
            . The structure above was recovered by fitting those two tables against each other, and
            it is an exact fit: 1,024 observations at level 8/9 and 1,024 at level 100 resolve with
            zero conflicts, and only one byte-role assignment does so.
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              <Text span fw={600}>
                Slot levels 8 and 9 are unmapped.
              </Text>{' '}
              Array rows 8, 9, 20, 21, 32, 33, 44, 45, 56 and 57 are unreachable from both reference
              tables, so nothing observes them. A dump from a character between level 20 and 90 could fill them in.
            </List.Item>
            <List.Item>
              <Text span fw={600}>
                57 cast-count maxima are unpinned.
              </Text>{' '}
              Where a cell was seen too few times to separate a maximum of 2 from 3, the lower is
              used and the count is flagged.
            </List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
