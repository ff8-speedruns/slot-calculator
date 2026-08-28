import { Badge, Table, Text } from '@mantine/core';

/**
 * Every index that gives the target, with what it costs from where you are and
 * how much damage the plan survives.
 *
 * The HP window is the range of current HP that keeps that index at the crisis
 * level the target needs. Take a hit that leaves you outside it and the spell
 * at that index changes, so it doubles as how much health the plan can afford
 * to lose.
 */
export default function HitTable({ hits, current, hpWindowFor }) {
  if (!hits.length) {
    return (
      <Text c="dimmed" size="sm">
        Nothing to list until a reachable target is chosen.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table striped highlightOnHover withTableBorder={false} fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Index</Table.Th>
            <Table.Th>Crisis</Table.Th>
            <Table.Th>Casts</Table.Th>
            <Table.Th>Array</Table.Th>
            <Table.Th>Do-Over</Table.Th>
            <Table.Th>Skip</Table.Th>
            <Table.Th>HP window</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {hits.map((hit) => {
            const window = hpWindowFor(hit);
            return (
              <Table.Tr
                key={hit.index}
                bg={hit.index === current ? 'var(--mantine-color-teal-light)' : undefined}
              >
                <Table.Td ff="monospace">{hit.index}</Table.Td>
                <Table.Td ff="monospace">{hit.crisis}</Table.Td>
                <Table.Td>
                  ×{hit.casts}{' '}
                  {!hit.castsAreCertain && (
                    <Badge size="xs" color="yellow" variant="light">
                      unpinned
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td ff="monospace" c="dimmed">
                  {hit.slotIndex}/{hit.spellIndex}
                </Table.Td>
                <Table.Td ff="monospace">{hit.plan.doOvers}</Table.Td>
                <Table.Td ff="monospace" c={hit.plan.skips ? 'orange' : undefined}>
                  {hit.plan.skips}
                </Table.Td>
                <Table.Td ff="monospace">{window ? `${window.low}–${window.high}` : '-'}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
