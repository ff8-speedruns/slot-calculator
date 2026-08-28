import { Group, Stack, Text, Tooltip, UnstyledButton, useComputedColorScheme } from '@mantine/core';
import { CYCLE } from '../lib/slot';

const COLUMNS = 16;

/**
 * Crisis level shades, darkest to lightest in each scheme, so a higher crisis
 * always reads as more saturated whichever way round the page is.
 */
const CRISIS_SHADES = {
  dark: [null, 'blue-9', 'blue-8', 'blue-7', 'blue-6'],
  light: [null, 'blue-1', 'blue-2', 'blue-3', 'blue-4'],
};

function cellBackground(roll, isHit, scheme) {
  if (isHit) return `var(--mantine-color-yellow-${scheme === 'dark' ? 5 : 4})`;
  if (!roll.available) return 'transparent';
  if (!roll.spell) {
    // An unmapped slot level: the roll is real but nothing was ever observed
    // there, so it is crosshatched rather than coloured.
    const stripe = `var(--mantine-color-${CRISIS_SHADES[scheme][1]})`;
    return `repeating-linear-gradient(45deg, ${stripe}, ${stripe} 3px, transparent 3px, transparent 6px)`;
  }
  return `var(--mantine-color-${CRISIS_SHADES[scheme][roll.crisis]})`;
}

function Swatch({ background, label }) {
  return (
    <Group gap={6} wrap="nowrap">
      <div
        style={{
          width: 13,
          height: 13,
          background,
          border: '1px solid var(--mantine-color-default-border)',
        }}
      />
      <Text fz="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}

export default function RngMap({ rolls, targetIndices, current, onPick }) {
  const scheme = useComputedColorScheme('dark');
  const targets = new Set(targetIndices);

  return (
    <Stack gap="xs">
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS}, minmax(30px, 1fr))`,
            gap: 1,
            minWidth: COLUMNS * 30,
          }}
        >
          {Array.from({ length: CYCLE }, (_, index) => {
            const roll = rolls[index];
            const isHit = targets.has(index);
            const isCurrent = index === current;
            const detail = roll.available
              ? `${roll.spell ? `${roll.spell} ×${roll.casts}` : 'unmapped slot level'} · crisis ${roll.crisis} · array ${roll.slotIndex}/${roll.spellIndex}`
              : 'no Limit available at this HP';


            return (
              <Tooltip key={index} label={`${index}: ${detail}`} withArrow openDelay={120}>
                <UnstyledButton
                  onClick={() => onPick(index)}
                  aria-label={`RNG index ${index}, ${detail}`}
                  style={{
                    background: isCurrent ? 'var(--mantine-color-teal-5)' : cellBackground(roll, isHit, scheme),
                    outlineOffset: -2,
                    border: '1px solid var(--mantine-color-default-border)',
                    textAlign: 'center',
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 10,
                    fontWeight: isHit ? 700 : 400,
                    lineHeight: '24px',
                    height: 26,
                    color: isHit || isCurrent
                      ? 'var(--mantine-color-black)'
                      : roll.available
                        ? undefined
                        : 'var(--mantine-color-dimmed)',
                  }}
                >
                  {index}
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <Group gap="md" wrap="wrap">
        <Swatch
          background={`var(--mantine-color-teal-5)`}
          label="you"
        />
        <Swatch
          background={`var(--mantine-color-yellow-${scheme === 'dark' ? 5 : 4})`}
          label="target"
        />
        <Swatch background={`var(--mantine-color-${CRISIS_SHADES[scheme][4]})`} label="crisis 4" />
        <Swatch background={`var(--mantine-color-${CRISIS_SHADES[scheme][3]})`} label="crisis 3" />
        <Swatch background={`var(--mantine-color-${CRISIS_SHADES[scheme][2]})`} label="crisis 2" />
        <Swatch background={`var(--mantine-color-${CRISIS_SHADES[scheme][1]})`} label="crisis 1" />
        <Swatch background="transparent" label="no Limit at this HP" />
        <Swatch
          background={cellBackground({ available: true, spell: null, crisis: 1 }, false, scheme)}
          label="unmapped slot level"
        />
      </Group>
    </Stack>
  );
}
