import { Alert, Badge, Code, Group, Text } from '@mantine/core';

import type { Discriminator, Match, Party, Reading } from '../lib/types.ts';

/** Past this many candidates the list stops being readable and starts being wallpaper. */
const CANDIDATES_SHOWN = 8;

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

/** The candidate list, shared by the two tie states. */
function Candidates({ matches }: { matches: readonly Match[] }) {
  return (
    <>
      <Code>
        {matches
          .slice(0, CANDIDATES_SHOWN)
          .map((match) => `${match.current} at crisis ${match.crisis}`)
          .join(', ')}
      </Code>
      {matches.length > CANDIDATES_SHOWN && ' …'}
    </>
  );
}

/**
 * The reading, plus anything that has to be said about how it was solved.
 *
 * Split in two so the HP warning can sit above whichever verdict comes out
 * below it, rather than being repeated inside five early returns.
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

  if (!taken) {
    return (
      <Alert color="gray" title="Waiting on a reading">
        Type at least one spell. 3 is usually enough, but a stubborn tie can take more.
      </Alert>
    );
  }

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
      <Alert color="green" title="Solved">
        <Group gap="xs">
          <Badge color="teal" variant="light">
            crisis {solved.crisis}
          </Badge>
          <Badge color="teal" variant="light">
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
      </Alert>
    );
  }

  if (tieIsMoot) {
    return (
      <Alert color="blue" title={`${matches.length} candidates, same answer`}>
        <Candidates matches={matches} />. Each one needs the same number of Do Overs so the tie does
        not matter.
      </Alert>
    );
  }

  return (
    <Alert color="yellow" title={`${matches.length} candidates, keep going.`}>
      <Candidates matches={matches} />
      {tieBreaker ? (
        <Text size="sm" mt={6}>
          Need a tie-breaking value. Do <strong>{tieBreaker.doOversAway}</strong> Do Over{' '}
          {tieBreaker.doOversAway === 1 ? '' : 's'}
          and type what you see.
        </Text>
      ) : (
        <Text size="sm" mt={6}>
          These candidates never diverge, which should not happen. Double check all of your inputs.
        </Text>
      )}
    </Alert>
  );
}
