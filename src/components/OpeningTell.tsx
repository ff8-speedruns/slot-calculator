import { Alert, Badge, Code, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Fragment, memo } from 'react';

import type { OpeningRoute, OpeningRoutes, Roll } from '../lib/types.ts';

import Panel from './Panel.tsx';

import styles from './OpeningTell.module.css';

export interface OpeningTellProps {
  /** Computed by App, which needs the same result to choose between the panels. */
  guide: OpeningRoutes;
  spell: string;
  /** Picking a row seeds the reader with exactly the spells that row names. */
  onPickReading: (readings: readonly Roll[]) => void;
}

/**
 * A row with one reading is done the moment that reading appears, so it is
 * filled. A row needing several is not actionable until the last of them, so it
 * stays outlined: the colour is "can I act on this yet", nothing else.
 */
const toneOf = (route: OpeningRoute) =>
  route.readings.length === 1
    ? ({ variant: 'filled', color: 'blue' } as const)
    : ({ variant: 'outline', color: 'gray' } as const);

/**
 * One opening: the spells to watch for in order, then what it costs.
 *
 * The whole row is the control. Its readings are unique among live openings by
 * name, so seeding them settles the reading on this exact opening, which is what
 * makes the plan card below agree with the row that was clicked.
 */
function Route({
  route,
  onPickReading,
}: {
  route: OpeningRoute;
  onPickReading: (readings: readonly Roll[]) => void;
}) {
  const tone = toneOf(route);
  const spells = route.readings.map((roll) => `${roll.spell} times ${roll.casts}`).join(', then ');

  return (
    <UnstyledButton
      component="li"
      className={styles.row}
      onClick={() => onPickReading(route.readings)}
      aria-label={`${spells}. Then ${route.doOvers} Do Overs. Load this reading.`}
    >
      <Group gap={6} wrap="wrap" align="center">
        {route.readings.map((roll, step) => (
          <Fragment key={roll.index}>
            {step > 0 && (
              <Text fz="xs" c="dimmed">
                →
              </Text>
            )}
            <Badge size="sm" {...tone} className={styles.badge}>
              {roll.spell} ×{roll.casts}
            </Badge>
          </Fragment>
        ))}
        <Text fz="sm" fw={600}>
          → {route.doOvers} Do Over{route.doOvers === 1 ? '' : 's'}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Either the spell cannot be reached at all, or here is every opening that
 * reaches it.
 *
 * There is no "too common" case here any more: App decides between this panel
 * and the reader, and only renders this one when the list is short enough to
 * scan AND complete. That is what lets the copy below say plainly that anything
 * unlisted can be passed.
 */
function Tell({
  guide,
  spell,
  onPickReading,
}: {
  guide: OpeningRoutes;
  spell: string;
  onPickReading: (readings: readonly Roll[]) => void;
}) {
  const { routes, dead, live } = guide;

  if (routes.length === 0) {
    return (
      <Alert
        color="red"
        title={
          <>
            <s>Fuite</s> Spell Impossible
          </>
        }
      >
        Selphie cannot reach <Code>{spell}</Code> with her current stats.
      </Alert>
    );
  }

  return (
    <>
      <Stack component="ul" gap={2} className={styles.badges}>
        {routes.map((route) => (
          <Route
            key={`${route.index}/${route.crisis}`}
            route={route}
            onPickReading={onPickReading}
          />
        ))}
      </Stack>

      <Text size="sm" fw={600}>
        Anything else, do an ATB/turn refresh.
      </Text>
      <Text size="xs" c="dimmed">
        {routes.length} of {live} openings reach <Code>{spell}</Code>, ruling out {dead} dead ones.
        The count is the Do Overs owed once every spell on that row has shown. Cast counts confirm a
        row, they never pick one: every row is decided by the spell names alone. Click a row to load
        it into the reader.
      </Text>
    </>
  );
}

function OpeningTell({ guide, spell, onPickReading }: OpeningTellProps) {
  return (
    <Panel
      title="3. Opening Tell"
      description={
        guide.routes.length > 0
          ? `Watch the Slot. Match a row, then Do Over that many times.`
          : `Whether ${spell} can be reached at all.`
      }
    >
      <Tell guide={guide} spell={spell} onPickReading={onPickReading} />
    </Panel>
  );
}

export default memo(OpeningTell);
