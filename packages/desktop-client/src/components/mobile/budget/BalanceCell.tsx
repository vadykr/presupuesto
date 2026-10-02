import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgArrowThickRight } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { BalanceWithCarryover } from '#components/budget/BalanceWithCarryover';
import { coloresPildora } from '#components/mobile/ui/Pildora';
import type { EstadoPildora } from '#components/mobile/ui/Pildora';
import {
  densidad,
  movimiento,
  num,
  radio,
  TACTIL,
} from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { getColumnWidth } from './BudgetTable';
import { useIgnorarMes } from './useIgnorarMes';

type BalanceCellProps = {
  binding: Binding<
    'envelope-budget' | 'tracking-budget',
    'leftover' | 'sum-amount'
  >;
  category: CategoryEntity;
  /** Mes de la hoja: con él se sabe si la categoría está «ignorada este mes». */
  month: string;
  show3Columns?: boolean;
  onPress?: () => void;
  'aria-label'?: string;
};

export function BalanceCell({
  binding,
  category,
  month,
  show3Columns,
  onPress,
  'aria-label': ariaLabel,
}: BalanceCellProps) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const columnWidth = getColumnWidth({
    show3Columns,
    disponible: true,
  });

  const goal =
    budgetType === 'tracking'
      ? trackingBudget.catGoal(category.id)
      : envelopeBudget.catGoal(category.id);

  const longGoal =
    budgetType === 'tracking'
      ? trackingBudget.catLongGoal(category.id)
      : envelopeBudget.catLongGoal(category.id);

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const carryover =
    budgetType === 'tracking'
      ? trackingBudget.catCarryover(category.id)
      : envelopeBudget.catCarryover(category.id);

  const format = useFormat();
  const { ignorada } = useIgnorarMes(category.id, month);
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  type Hoja = 'envelope-budget' | 'tracking-budget';
  const goalValue = useSheetValue<Hoja, 'goal'>(goal);
  const budgetedValue = useSheetValue<Hoja, 'budget'>(budgeted);
  const longGoalValue = useSheetValue<Hoja, 'long-goal'>(longGoal);

  // Mismo criterio que `makeBalanceAmountStyle`, dicho con píldoras: rojo si
  // está en negativo, ámbar si no llega al objetivo, verde si hay saldo o se
  // cumple, gris si no hay nada pendiente (o si está ignorada este mes).
  const estadoDe = (valor: number): EstadoPildora => {
    if (valor < 0) {
      return 'rojo';
    }
    if (ignorada) {
      return 'neutro';
    }
    if (isGoalTemplatesEnabled && goalValue != null) {
      const base = longGoalValue === 1 ? valor : (budgetedValue ?? 0);
      return base < goalValue ? 'aviso' : 'ok';
    }
    return valor > 0 ? 'ok' : 'neutro';
  };

  return (
    <BalanceWithCarryover
      goalIgnored={ignorada}
      aria-label={t('Balance for {{categoryName}} category', {
        categoryName: category.name,
      })} // Translated aria-label
      type="financial"
      carryover={carryover}
      balance={binding}
      goal={goal}
      budgeted={budgeted}
      longGoal={longGoal}
      CarryoverIndicator={MobileCarryoverIndicator}
    >
      {({ type, value }) => {
        const estado = estadoDe(value);
        const textoImporte = format(value, type);
        const { fondo, texto: tinta } = coloresPildora(estado);
        return (
          <Button
            variant="bare"
            style={({ isPressed }) => ({
              // Zona táctil de 44 px sin engordar la fila (contenido de 32).
              minHeight: TACTIL,
              margin: `${-(TACTIL - 32) / 2}px 0`,
              maxWidth: columnWidth,
              padding: 0,
              backgroundColor: 'transparent',
              transform: isPressed ? 'scale(0.95)' : undefined,
              transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
            })}
            onPress={onPress}
            aria-label={ariaLabel}
            data-estado={estado}
          >
            <PrivacyFilter>
              <Text
                className={css({
                  ...num,
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 26,
                  padding: '0 9px',
                  borderRadius: radio.pildora,
                  backgroundColor: fondo,
                  color: tinta,
                  ...densidad.pildora,
                  // Cifras de 7 dígitos: un punto menos para caber en 96 px.
                  ...(textoImporte.length > 10 && {
                    fontSize: 12,
                    padding: '0 7px',
                  }),
                  whiteSpace: 'nowrap',
                  transition: `background-color ${movimiento.pildora}ms, color ${movimiento.pildora}ms`,
                })}
              >
                {textoImporte}
              </Text>
            </PrivacyFilter>
          </Button>
        );
      }}
    </BalanceWithCarryover>
  );
}
function MobileCarryoverIndicator({ style }: { style?: CSSProperties }) {
  return (
    <View
      style={{
        position: 'absolute',
        right: '-3px',
        top: '-5px',
        borderRadius: '50%',
        backgroundColor: style?.color ?? theme.pillText,
      }}
    >
      <SvgArrowThickRight
        width={11}
        height={11}
        style={{ color: theme.pillBackgroundLight }}
      />
    </View>
  );
}
