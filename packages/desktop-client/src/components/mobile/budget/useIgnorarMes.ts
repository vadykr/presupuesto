import { useCallback } from 'react';

import { send } from '@actual-app/core/platform/client/connection';

import { useNotes } from '#hooks/useNotes';

import { idNotaMes, notaConIgnorarMes, notaIgnoraMes } from './objetivos';

/**
 * «Ignorar este mes» de una categoría: lee y cambia la marca `#ignorar-mes`
 * de su nota de mes (id `<categoría>-<AAAA-MM>`). Solo afecta a ese mes; la
 * plantilla y el objetivo de la categoría no se tocan.
 */
export function useIgnorarMes(categoryId: string, month: string) {
  const id = idNotaMes(categoryId, month);
  const nota = useNotes(id);
  const ignorada = notaIgnoraMes(nota);

  const setIgnorada = useCallback(
    async (ignorar: boolean) => {
      await send('notes-save', { id, note: notaConIgnorarMes(nota, ignorar) });
    },
    [id, nota],
  );

  return { ignorada, setIgnorada };
}
