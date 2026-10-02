import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { faltante } from './objetivos';

type EstadoObjetivoCortoProps = {
  category: CategoryEntity;
};

/**
 * Bajo el disponible de la fila del presupuesto: «Faltan 86,32 €» cuando la
 * categoría tiene objetivo y no está cubierto este mes (mismo color ámbar que
 * usa el saldo cuando el objetivo no se cumple). Si está cubierta o no hay
 * objetivo no enseña nada.
 */
export function EstadoObjetivoCorto({ category }: EstadoObjetivoCortoProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const bindings = budgetType === 'tracking' ? trackingBudget : envelopeBudget;

  type Hoja = 'envelope-budget' | 'tracking-budget';
  const goal = useSheetValue<Hoja, 'goal'>(bindings.catGoal(category.id));
  const longGoal = useSheetValue<Hoja, 'long-goal'>(
    bindings.catLongGoal(category.id),
  );
  const budgeted =
    useSheetValue<Hoja, 'budget'>(bindings.catBudgeted(category.id)) ?? 0;
  const balance =
    useSheetValue<Hoja, 'leftover'>(bindings.catBalance(category.id)) ?? 0;

  if (!isGoalTemplatesEnabled || goal == null) {
    return null;
  }
  const falta = faltante({
    goal,
    longGoal: longGoal === 1,
    budgeted,
    balance,
    spent: 0,
  });
  if (falta <= 0) {
    return null;
  }
  return (
    <PrivacyFilter>
      <Text
        data-testid="estado-objetivo-corto"
        style={{
          ...styles.tinyText,
          ...styles.tnum,
          color: theme.templateNumberUnderFunded,
          whiteSpace: 'nowrap',
        }}
      >
        {t('{{amount}} more needed', { amount: format(falta, 'financial') })}
      </Text>
    </PrivacyFilter>
  );
}
