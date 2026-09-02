import { Divider, Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export interface PanelProps {
  title: ReactNode;
  description?: ReactNode;
  //A control that belongs to the panel as a whole, such as "Clear"
  action?: ReactNode;
  fullHeight?: boolean;
  children: ReactNode;
}

export default function Panel({ title, description, action, fullHeight, children }: PanelProps) {
  return (
    <Paper component="section" withBorder radius="md" p="md" h={fullHeight ? '100%' : undefined}>
      <Stack gap="sm">
        <header>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Text
              component="h2"
              fw={600}
              fz="xs"
              lh={1.4}
              m={0}
              tt="uppercase"
              style={{ letterSpacing: '0.15rem' }}
            >
              {title}
            </Text>
            {action}
          </Group>
          <Divider my="xs" />
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </header>
        {children}
      </Stack>
    </Paper>
  );
}
