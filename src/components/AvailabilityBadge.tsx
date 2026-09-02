import { Badge } from '@mantine/core';

import { isBlocked } from '../lib/slot.ts';
import type { Availability } from '../lib/types.ts';

export interface AvailabilityBadgeProps {
  entry: Availability | undefined;
  level: number;
}

/**
 * The badge in the target picker for unreachable spells.
 *
 * Two kinds of no:
 * 1. "can't at Lv N" means the spell is straight up inaccessible at this level regardless of
 *     CL and HP.
 * 2. "HP too high" means Selphie needs to be a lower HP to find it.
 */
export default function AvailabilityBadge({ entry, level }: AvailabilityBadgeProps) {
  if (!isBlocked(entry)) return null;

  const lockedByLevel = entry.state === 'level';
  const label = lockedByLevel ? `can't at Lv ${level}` : 'HP too high';

  return (
    <Badge
      size="xs"
      variant="light"
      color={lockedByLevel ? 'red' : 'orange'}
      aria-label={label}
      styles={{ root: { flexShrink: 0 } }}
    >
      {label}
    </Badge>
  );
}
