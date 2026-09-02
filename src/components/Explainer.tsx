import { Accordion, Code, List, Text } from '@mantine/core';

export default function Explainer() {
  return (
    <Accordion variant="contained">
      <Accordion.Item value="roll">
        <Accordion.Control>How the roll works</Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" mb="sm">
            FF8&apos;s battle RNG is a fixed 256-byte table walked by an index. When the Limit Break
            opens, the game rolls a crisis level once:
          </Text>
          <Code block fz="xs">
            {`hpMod       = floor(2500 * curHP / maxHP)
deathBonus  = deadAllies * 200 + 1600
statusBonus = statusSum * 10
limitLevel  = floor((statusBonus + deathBonus - hpMod) / (B[open] + 160))
crisis      = limitLevel <= 4 ? 0 : min(limitLevel - 4, 4)`}
          </Code>
          <Text size="sm" mt="sm" mb="sm">
            Every Do Over after that rolls only the spell, reading four consecutive bytes and
            advancing the index by four:
          </Text>
          <Code block fz="xs">
            {`x          = B[i+1] % 5
slotMod    = B[i+2] < 39 ? 0 : <159 ? 1 : <209 ? 2 : <249 ? 3 : 4
slotIndex  = slotMod * 12 + floor(Level / 10) + crisis + x - 1
spellIndex = B[i+3] % 8
spell      = SLOT_ARRAY[slotIndex][spellIndex]
castCount  = (B[i+4] % spell.maxCasts) + 1`}
          </Code>
          <Text size="sm" mt="sm">
            <Text span fw={600}>
              The slot index is not clamped.
            </Text>{' '}
            The kernel&apos;s array is 60 bytes, five slot mods of twelve levels, but the expression
            above reaches 65 at level 100 with crisis 4 and <Code>x = 4</Code>. The game reads past
            the end into the slot sets that follow it, and those six rows are reachable in play. The
            overflow is also why a level 100 party sees a different distribution than a level 8 one.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="enemy">
        <Accordion.Control>What the enemy and the route change</Accordion.Control>
        <Accordion.Panel>
          <Text size="sm" mb="sm">
            The roll is independent of the encounter. Three things do depend on the fight:
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              The RNG table is static, but your position (index) in it changes. We can determine the
              position in the list by reading the spells off of the Slot limit.
            </List.Item>
            <List.Item>
              How fast the index moves while you decide. Every enemy action, status resist roll,
              drop roll, Angelo Search and auto-summon check advances the same counter. This means
              Odin is easy to manip (because he does nothing until the timer runs out), but an enemy
              actively attacking you makes things complicated. This has not been solved yet, but
              there is an RNG offset field you can set if you know the values.
            </List.Item>
            <List.Item>Selphie level/HP/crisis level (via status, dead enemies, etc).</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
