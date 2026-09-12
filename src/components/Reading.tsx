import { Alert, Badge, Group, Text } from '@mantine/core';

import type { Discriminator, Match, Party, Reading } from '../lib/types.ts';

export interface ReadingPanelProps {
  reading: Reading;
  party: Party;
  solved: Match | null;
  current: number | null;
  offset: number;
  tieBreaker: Discriminator | null;
  tieIsMoot: boolean;
  taken: number;
}

/**
 * The reading, plus anything worth saying about how it got solved. Split in two
 * so the HP warning sits above whichever verdict comes out below, instead of
 * being repeated inside five early returns.
 */
export default function ReadingPanel(props: ReadingPanelProps) {
  const { reading, party } = props;

  if (!reading.droppedPartyFilter) return <ReadingResult {...props} />;

  return (
    <>
      <Alert color="orange" title="Nothing at this HP fits" mb="xs">
        No Limit Break opening at {party.currentHp} HP produces these spells, so the reading below
        ignores HP entirely and is showing every state in the cycle that fits. Two things cause
        this: the HP in step 1 is not what Selphie was at when the Limit Break opened, or you had
        already pressed Do Over before you started typing, in which case untick the box above.
      </Alert>
      <ReadingResult {...props} />
    </>
  );
}

function ReadingResult({
  reading,
  solved,
  current,
  offset,
  tieBreaker,
  tieIsMoot,
  taken,
}: ReadingPanelProps) {
  const { matches, ignoredCasts } = reading;

  if (!taken) return null;

  if (!matches.length) {
    return (
      <Alert color="red" title="No match">
        Nothing produces that sequence at any crisis level. Check Selphie&apos;s level and that
        nothing else in the fight progressed RNG between your Do Overs.
      </Alert>
    );
  }

  if (solved) {
    return (
      <Alert color="blue" title="Index Solved! Slot result found.">
        <Group gap="xs">
          You are in: 
          <Badge color="black">
            crisis {solved.crisis}
          </Badge>
          <Badge color="black">
            index {current}
          </Badge>
        </Group>
        <Text size="sm" mt={6}>
          {offset !== 0 &&
            ` The RNG offset of ${offset > 0 ? '+' : ''}${offset} puts you at ${current}.`}
        </Text>
        {ignoredCasts && (
          <Text size="sm" mt={4}>
            Cast counts were ignored: no state shows those quantities, so at least one number was
            misread.
          </Text>
        )}
        <Text size="sm" mt={6}>
          See below for instructions!
        </Text>
      </Alert>
    );
  }

  if (tieIsMoot) {
    return (
      <Alert color="blue" title={`${matches.length} candidates, same answer.`}>
        Each one needs the same number of Do Overs so specific index does not matter (you are good to go!).
      </Alert>
    );
  }

  return (
    <Alert color="yellow" title="Keep typing the spells you see.">
      {tieBreaker ? (
        <Text size="sm" mt={6}>
          {matches.length} index candidates.
        </Text>
      ) : (
        <Text size="sm" mt={6}>
          These candidates never diverge, which should not happen. Double check all of your inputs.
        </Text>
      )}
    </Alert>
  );
}
