import { Alert, Badge, Code, Group, Table, Text } from '@mantine/core';
import { Fragment, memo } from 'react';

import type { OpeningRoute, OpeningRoutes, Roll } from '../lib/types.ts';

import styles from './OpeningTell.module.css';

export interface OpeningTellProps {
  /** Computed by App, which needs the same result to choose between the panels. */
  guide: OpeningRoutes;
  spell: string;
  /** Picking a row seeds the reader with exactly the spells that row names. */
  onPickReading: (readings: readonly Roll[]) => void;
}

/**
 * One opening: the spells to watch for in order, then what it costs. The whole
 * row is the control - its readings are unique by name, so clicking it settles
 * the reading on this exact opening and the plan card agrees with what you hit.
 */
function OpeningRow({
  route,
  onPickReading,
}: {
  route: OpeningRoute;
  onPickReading: (readings: readonly Roll[]) => void;
}) {
  const spells = route.readings.map((roll) => `${roll.spell} times ${roll.casts}`).join(', then ');

  return (
    <Table.Tr>
      <Table.Td
        onClick={() => onPickReading(route.readings)}
        aria-label={`${spells}. Then ${route.doOvers} Do Overs. Load this reading.`}
      >
        <Group gap={6} wrap="wrap" align="center">
          {route.readings.map((roll, step) => (
            // because react and its warnings about keys on loops -_-
            // else it'd have been the usual <></>
            <Fragment key={roll.index}>
              {step > 0 && (
                <Text fz="xs" c="dimmed">
                  →
                </Text>
              )}
              <Badge size="sm" color="grape" className={styles.badge}>
                {roll.spell} ×{roll.casts}
              </Badge>
            </Fragment>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" fw={600}>
          {route.doOvers} × Do Over
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Either the spell can't be reached at all, or here's every opening that gets it.
 * No "too common" case here - App picks between this panel and the reader. The
 * copy below still asks `complete` itself rather than assuming App checked.
 */
function Tell({ guide, spell, onPickReading }: OpeningTellProps) {
  const { routes, complete } = guide;

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
      <Table className={styles.badges}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={350}>If you see...</Table.Th>
            <Table.Th>Do</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {routes.map((route) => (
            <OpeningRow
              key={`${route.index}/${route.crisis}`}
              route={route}
              onPickReading={onPickReading}
            />
          ))}

          {/* Only true on a complete list, and this panel is the one making the
          claim, so it checks rather than trusting a condition it can't see. */}
          {complete && (
            <Table.Tr>
              <Table.Td>Anything else</Table.Td>
              <Table.Td fw={600}>Refresh ATB</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}

export default memo(Tell);
