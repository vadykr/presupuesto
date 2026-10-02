import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity, NoteEntity } from '@actual-app/core/types/models';

import { useBudgetActions } from '#budget';
import type { ApplyBudgetActionPayload } from '#budget';
import {
  lineasDeObjetivo,
  notaConObjetivo,
} from '#components/mobile/budget/objetivos';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useUndo } from '#hooks/useUndo';
import { addNotification } from '#notifications/notificationsSlice';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch } from '#redux';

import type { Accion, FilaPropuesta } from './motor';

/**
 * Fija un objetivo mensual («Necesito X cada mes») con el mismo mecanismo
 * que la pantalla «Editar objetivo» (`ObjetivoPage`): la nota manda, se
 * parsea a `goal_def` y se recalcula el objetivo del mes.
 */
export async function fijarObjetivoMensual({
  categoria,
  importe,
  month,
  source,
}: {
  categoria: CategoryEntity;
  importe: IntegerAmount;
  month: string;
  source: 'notes' | 'ui';
}): Promise<void> {
  const { data } = await aqlQuery(
    q('notes').filter({ id: categoria.id }).select('*'),
  );
  const nota = (data as NoteEntity[])[0]?.note ?? null;
  const lineas = lineasDeObjetivo(
    { tipo: 'mensual', importe, dia: null, modo: 'apartar' },
    monthUtils.currentDay(),
  );
  await send('notes-save', {
    id: categoria.id,
    note: notaConObjetivo(nota, lineas),
  });
  if (source === 'ui') {
    await send('budget/set-category-automations', {
      categoriesWithTemplates: [{ id: categoria.id, templates: [] }],
      source: 'notes',
    });
  }
  await send('budget/store-note-templates', [categoria.id]);
  await send('budget/refresh-goals', { month });
  if (month !== monthUtils.currentMonth()) {
    await send('budget/refresh-goals', { month: monthUtils.currentMonth() });
  }
}

/**
 * Acciones de los consejos y de la propuesta: fijar objetivo, ajustar lo
 * asignado de un mes (con «Deshacer») y aplicar la propuesta entera.
 */
export function useAccionesAnalisis() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const applyBudgetAction = useBudgetActions();
  const { data: { list: categorias } = { list: [] } } = useCategories();

  const nombreDe = useCallback(
    (id: string) => categorias.find(c => c.id === id)?.name ?? '',
    [categorias],
  );

  const ejecutar = useCallback(
    async (accion: Accion) => {
      const importe = format(accion.importe, 'financial');
      if (accion.tipo === 'fijar-objetivo') {
        const categoria = categorias.find(c => c.id === accion.categoria);
        if (!categoria) {
          return;
        }
        await fijarObjetivoMensual({
          categoria,
          importe: accion.importe,
          month: accion.mes,
          source: categoria.template_settings?.source === 'ui' ? 'ui' : 'notes',
        });
        dispatch(
          addNotification({
            notification: {
              type: 'message',
              message: t(
                'Target of {{amount}} a month set for {{categoryName}}.',
                {
                  amount: importe,
                  categoryName: categoria.name,
                },
              ),
              timeout: 4000,
            },
          }),
        );
        return;
      }
      applyBudgetAction.mutate({
        month: accion.mes,
        type: 'budget-amount',
        args: { category: accion.categoria, amount: accion.importe },
      } as ApplyBudgetActionPayload);
      showUndoNotification({
        message: t('Budgeted {{amount}} for {{categoryName}}.', {
          amount: importe,
          categoryName: nombreDe(accion.categoria),
        }),
      });
    },
    [
      applyBudgetAction,
      categorias,
      dispatch,
      format,
      nombreDe,
      showUndoNotification,
      t,
    ],
  );

  /** Aplica la propuesta al mes indicado en una sola acción deshacible. */
  const aplicarPropuesta = useCallback(
    (mes: string, filas: readonly FilaPropuesta[]) => {
      const amounts = filas
        .filter(f => f.propuesto !== f.actual)
        .map(f => ({ category: f.categoria, amount: f.propuesto }));
      if (amounts.length === 0) {
        return 0;
      }
      applyBudgetAction.mutate({
        month: mes,
        type: 'budget-amounts',
        args: { amounts },
      } as ApplyBudgetActionPayload);
      showUndoNotification({
        message: t('Proposed budget applied to {{count}} categories.', {
          count: amounts.length,
        }),
      });
      return amounts.length;
    },
    [applyBudgetAction, showUndoNotification, t],
  );

  return { ejecutar, aplicarPropuesta };
}
