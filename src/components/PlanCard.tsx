import { Badge, Code, Group, Paper, Stack, Text } from '@mantine/core';
import { memo, type ReactNode } from 'react';

import {
  CYCLE,
  at,
  doOverPath,
  hpOutlook,
  nextWorkingOpening,
  reopenOutlook,
} from '../lib/slot.ts';
import type { CastFilter, Crisis, Party, Roll } from '../lib/types.ts';

import styles from './PlanCard.module.css';

export interface PlanCardProps {
  party: Party;
  from: number;
  fromCrisis: Crisis;
  spell: string;
  casts?: CastFilter;
  /**
   * Did the reading pin exactly one state? The Do Over count survives a moot tie
   * (that's what makes it moot) but the spells on the way don't - tied candidates
   * sit at different crisis levels. So the route only shows when settled.
   */
  settled: boolean;
  /** Assumed RNG cost of one ATB refresh. Feeds the estimate and nothing else. */
  refreshStep: number;
}

type Verdict = 'good' | 'retry' | 'dead';

function Step({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <Stack gap={0} align="center" miw={72}>
      <Text c="white" fw={700} fz={28} lh={1.1} ff="monospace">
        {value}
      </Text>
      <Text c={muted ? 'blue.2' : 'blue.0'} fz={10} tt="uppercase" lh={1.3}>
        {label}
      </Text>
    </Stack>
  );
}

function Card({ tint, children }: { tint: Verdict; children: ReactNode }) {
  return (
    <Paper component="section" radius="md" shadow="sm" p="md" className={styles[tint]}>
      <Stack gap="sm">{children}</Stack>
    </Paper>
  );
}

/**
 * Every spell between here and the target, one line per press. Line one is what's
 * on screen now, so it doubles as a check that the reading was right before you
 * spend anything. Never truncated - you press Do Over once per line, so a list
 * that stops short is useless. Long ones scroll.
 */
function Route({ path }: { path: Roll[] }) {
  const width = Math.max(3, String(path.length - 1).length + 1);
  return (
    <Code block color="rgba(0,0,0,0)" c="teal.0" fz={11} className={styles.route}>
      {path
        .map(
          (roll, step) =>
            `${(step === 0 ? 'now' : '+' + String(step)).padStart(width)}  ${roll.spell} ×${roll.casts}`,
        )
        .join('\n')}
    </Code>
  );
}

const round = (value: number): string =>
  value >= 10 ? String(Math.round(value)) : value.toFixed(1);

/**
 * The three states:
 *
 * 1. Target is in this Slot rotation (what people call "table", but that's confusing
 *    given that Selphie's limit is also a table lookup). Within a slot, the CL is
 *    held and every Do Over is +4, so the reachable states are the 64 indices of the 256.
 *    If the target is within a multiple of 4, then it's just a matter of Do Overs.
 *
 * 2. Target is not in this rotation, but it exists at this HP. Runner needs to start
 *    over: do a turn refresh, let the Limit Break come back, read the spells, and look again.
 *    There's too much math involved in calculating how many refreshes/limits for my brain.
 *    I'm sure it's possible for someone smarter than me though.
 *
 * 3. It is not reachable at this level at all. That is a hard stop because it doesn't matter
 *    what the CL/HP is, the spell is simply not available in the slot-array rows at this level.
 */
function PlanCard({
  party,
  from,
  fromCrisis,
  spell,
  casts = 0,
  settled,
  refreshStep,
}: PlanCardProps) {
  const want = { spell, casts };
  // The path's last entry is the hit, and its length is the Do-Over count plus
  // one, so this is the same value doOversTo returns without walking twice for it.
  const path = doOverPath(party.level, from, fromCrisis, want);
  const here = path && { ...at(path, path.length - 1), doOvers: path.length - 1 };

  if (here) {
    return (
      <Card tint="good">
        <Group justify="space-between" align="baseline" wrap="wrap" gap="xs">
          <Group gap="xs" align="center">
            <Text c="white" fw={700} fz={26} lh={1.1}>
              {here.spell}
            </Text>
            <Text c="teal.0" fw={600} fz="lg">
              ×{here.casts}
            </Text>
            <Badge size="xs" color="teal.9" variant="filled">
              in this Slot Table
            </Badge>
          </Group>
          <Code color="rgba(0,0,0,0)" c="teal.0" fz={11}>
            index {from} crisis {fromCrisis} → index {here.index}
          </Code>
        </Group>

        <Group gap="lg" wrap="wrap">
          <Step label="Do Over" value={here.doOvers} />
          <Step label="Array cell" value={`${here.slotIndex}/${here.spellIndex}`} />
        </Group>

        <Text c="teal.0" fz="xs">
          {here.spell} should be <strong>{here.doOvers}</strong> Do Over
          {here.doOvers === 1 ? '' : 's'} away from your current slot.
        </Text>

        {settled && path.length > 1 && <Route path={path} />}
      </Card>
    );
  }

  // Only reached when the target is not in this Limit Break, so the walk this
  // costs is not paid on the common path above.
  const outlook = reopenOutlook(party, want);
  const estimate = nextWorkingOpening(party, want, from, refreshStep);

  if (outlook.possible) {
    return (
      <Card tint="retry">
        <Group justify="space-between" align="baseline" wrap="wrap" gap="xs">
          <Group gap="xs" align="center">
            <Text c="white" fw={700} fz={26} lh={1.1}>
              {spell}
            </Text>
            {casts > 0 && (
              <Text c="blue.0" fw={600} fz="lg">
                ×{casts}
              </Text>
            )}
            <Badge size="xs" color="darkred" variant="filled">
              start over
            </Badge>
          </Group>
          <Code color="rgba(0,0,0,0)" c="blue.0" fz={11}>
            index {from} crisis {fromCrisis}
          </Code>
        </Group>

        <Group gap="lg" wrap="wrap">
          <Step label="Openings that work" value={`${outlook.good}/${outlook.live}`} />
          <Step label="Refreshes, 50%" value={outlook.halfWithin} />
          <Step label="Refreshes, 90%" value={outlook.ninetyWithin} muted />
          <Step label="Average" value={round(outlook.expectedTurns)} muted />
        </Group>

        <Text c="blue.0" fz="sm" fw={600}>
          Not in this Slot Table. ATB refresh and start over.
        </Text>
        <Text c="blue.0" fz="xs">
          50% of the time you will find it within <strong>{outlook.halfWithin}</strong> total refresh
          {outlook.halfWithin === 1 ? '' : 'es'} (counting all living characters), 90% of the time within{' '}
          <strong>{outlook.ninetyWithin}</strong>.
        </Text>
        {estimate && (
          <Text c="yellow.2" fz="xs">
            <strong>Refreshes are a rough guess:</strong> assuming an ATB refresh moves RNG by {refreshStep} every time,
            the next working opening is <strong>{estimate.refreshes}</strong> refresh
            {estimate.refreshes === 1 ? '' : 'es'} away. Refreshes are the least confirmed thing in this tool, so do not skip
            reading the openings in between.
          </Text>
        )}
      </Card>
    );
  }

  const deadHp = hpOutlook(party, want);
  const fixable = deadHp.ceiling !== null && deadHp.best.good > 0;

  return (
    <Card tint="dead">
      <Group gap="xs" align="baseline">
        <Text c="white" fw={700} fz={26} lh={1.1}>
          {spell}
        </Text>
        {casts > 0 && (
          <Text c="gray.3" fw={600} fz="lg">
            ×{casts}
          </Text>
        )}
        <Badge size="xs" color="red" variant="filled">
          {fixable ? 'HP too high' : 'not at this level'}
        </Badge>
      </Group>

      {fixable ? (
        <Stack gap="sm">
          <Text c="gray.2" fz="sm">
            Selphie HP is too high.
          </Text>
          <Text c="gray.2" fz="sm">
            Reduce her HP to <strong>{deadHp.ceiling} HP or lower</strong>, (ideally{' '}
            <strong>{deadHp.best.hp} HP</strong>), where {deadHp.best.good} of {CYCLE} openings
            reach it. Estimated wait is about {round(deadHp.best.expectedTurns)} turns.
          </Text>
        </Stack>
      ) : (
        <Text c="gray.2" fz="sm">
          {spell} is not reachable at level {party.level}.
        </Text>
      )}
    </Card>
  );
}

export default memo(PlanCard);
