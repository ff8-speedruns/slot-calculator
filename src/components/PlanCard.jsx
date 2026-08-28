import { Badge, Code, Group, Paper, Stack, Text } from '@mantine/core';

function Step({ label, value, muted }) {
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

/**
 * How many Do-Overs, and how many turn-skips.
 */
export default function PlanCard({ target, from, alternatives = [], hereIsAvailable }) {
  if (!target) {
    return (
      <Paper withBorder radius="md" p="md">
        <Text c="dimmed">
          No index in the cycle produces that spell with this party state. Change the HP to move the
          crisis levels around, or pick another spell.
        </Text>
      </Paper>
    );
  }

  const { plan } = target;

  return (
    <Paper
      radius="md"
      shadow="sm"
      p="md"
      style={{
        background:
          'linear-gradient(-60deg, var(--mantine-color-blue-4) 0%, var(--mantine-color-blue-7) 100%)',
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="baseline" wrap="wrap" gap="xs">
          <Group gap="xs" align="baseline">
            <Text c="white" fw={700} fz={26} lh={1.1}>
              {target.spell}
            </Text>
            <Text c="blue.0" fw={600} fz="lg">
              ×{target.casts}
            </Text>
            {!target.castsAreCertain && (
              <Badge size="xs" color="yellow" variant="light">
                cast count unpinned
              </Badge>
            )}
          </Group>
          <Code color="rgba(0,0,0,0)" c="blue.0" fz={11}>
            index {from} → {target.index}
          </Code>
        </Group>

        <Group gap="lg" wrap="wrap">
          <Step label="Do-Over" value={plan.doOvers} />
          <Step label="Skip turn" value={plan.skips} />
          <Step label="RNG steps" value={plan.steps} muted />
          <Step label="Crisis" value={target.crisis} muted />
        </Group>

        <Text c="blue.0" fz="sm">
          {plan.skips === 0
            ? `Press Do-Over ${plan.doOvers} time${plan.doOvers === 1 ? '' : 's'} and cast.`
            : `The gap is not a multiple of four, so it needs ${plan.skips} turn-skip${
                plan.skips === 1 ? '' : 's'
              } as well. Put them wherever the fight allows; order does not matter.`}
          {!hereIsAvailable && ' Your Limit is not available at the index you are starting from.'}
        </Text>

        {alternatives.length > 0 && (
          <Text c="blue.1" fz="xs">
            Also lands on it:{' '}
            {alternatives
              .map(
                (hit) =>
                  `${hit.index} (${hit.plan.doOvers} DO${
                    hit.plan.skips ? ` + ${hit.plan.skips} skip` : ''
                  })`,
              )
              .join(', ')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
