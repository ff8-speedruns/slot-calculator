import type { OptionsFilter } from '@mantine/core';
import type { KeyboardEvent } from 'react';

import { SPELLS, topSpellMatch } from '../lib/slot.ts';

/**
 * Prefix matching, against Mantine's default of "contains anywhere". Contains
 * puts Confuse above Fire when you type F, which is useless when the point is to
 * name a spell in two keystrokes. Groups never appear here - the data is a flat
 * list of names - so anything without a label is passed over.
 */
export const startsWithFilter: OptionsFilter = ({ options, search }) => {
  const needle = search.trim().toLowerCase();
  return options.filter((item) => 'label' in item && item.label.toLowerCase().startsWith(needle));
};

/**
 * Hand focus to the field after this one. DOM order is the tab order here, so
 * the next text input is the next reader row, or its cast count when those are
 * shown.
 *
 * ponytail: queries the whole document. Scope it to the panel if a text input
 * ever lands between two rows.
 */
function advance(input: HTMLInputElement) {
  const fields = [
    ...document.querySelectorAll<HTMLInputElement>(
      'input:not([disabled]):not([type="checkbox"]):not([type="radio"])',
    ),
  ];
  fields[fields.indexOf(input) + 1]?.focus();
}

/**
 * Tab / Enter completion.
 *
 * Tab isn't prevented, so the browser moves focus itself; Enter has to be told.
 */
export const spellKeyDown =
  (commit: (spell: string) => void, options: readonly string[] = SPELLS) =>
  (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.shiftKey || (event.key !== 'Enter' && event.key !== 'Tab')) return;

    const top = topSpellMatch(event.currentTarget.value, options);
    if (top) commit(top);

    if (event.key === 'Enter') {
      event.preventDefault();
      advance(event.currentTarget);
    }
  };
