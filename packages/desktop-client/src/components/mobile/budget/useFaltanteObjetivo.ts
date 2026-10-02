import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { faltante } from './objetivos';
import { useIgnorarMes } from './useIgnorarMes';

/**
 * Lo que falta asignar este mes para cumplir el objetivo de la categoría
 * (0 si no tiene objetivo, está cubierta o está «ignorada este mes») y lo
 * asignado ahora. En el Plan ya no se pinta «Faltan X» bajo la fila: lo dice
 * el color ámbar de la píldora y el teclado ofrece el atajo para asignarlo.
 */
export function useFaltanteObjetivo(
  category: CategoryEntity | null | undefined,
  month: string,
): { falta: IntegerAmount; asignado: IntegerAmount } {
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const bindings = budgetType === 'tracking' ? trackingBudget : envelopeBudget;
  const id = category?.id ?? '';

  type Hoja = 'envelope-budget' | 'tracking-budget';
  const goal = useSheetValue<Hoja, 'goal'>(bindings.catGoal(id));
  const longGoal = useSheetValue<Hoja, 'long-goal'>(bindings.catLongGoal(id));
  const asignado = useSheetValue<Hoja, 'budget'>(bindings.catBudgeted(id)) ?? 0;
  const balance = useSheetValue<Hoja, 'leftover'>(bindings.catBalance(id)) ?? 0;
  const { ignorada } = useIgnorarMes(id, month);

  if (!category || !isGoalTemplatesEnabled || goal == null) {
    return { falta: 0, asignado };
  }
  return {
    falta: faltante({
      goal,
      longGoal: longGoal === 1,
      budgeted: asignado,
      balance,
      spent: 0,
      ignorada,
    }),
    asignado,
  };
}
