import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { useFormat } from '#hooks/useFormat';

// Pasos en céntimos: 1 € = 100, 10 € = 1000.
const STEPS: IntegerAmount[] = [-1000, -100, 100, 1000];

type QuickBudgetButtonsProps = {
  /** Importe presupuestado actual, en céntimos enteros. */
  budgeted: IntegerAmount;
  /** Recibe el nuevo importe presupuestado, en céntimos enteros. */
  onUpdateBudget: (amount: IntegerAmount) => void;
};

/**
 * Fila de botones rápidos «−10 €», «−1 €», «+1 €», «+10 €» para ajustar lo
 * presupuestado sin teclear (comodidad heredada de YNAB). Pensado para el
 * modal de presupuesto de una categoría en el móvil.
 */
export function QuickBudgetButtons({
  budgeted,
  onUpdateBudget,
}: QuickBudgetButtonsProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const symbol = format.currency.symbol;

  const label = (step: IntegerAmount) => {
    const euros = Math.abs(step) / 100;
    const sign = step < 0 ? '−' : '+';
    return symbol ? `${sign}${euros} ${symbol}` : `${sign}${euros}`;
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingLeft: styles.mobileEditingPadding,
        paddingRight: styles.mobileEditingPadding,
        paddingBottom: 10,
      }}
      data-testid="quick-budget-buttons"
    >
      {STEPS.map(step => (
        <Button
          key={step}
          style={{
            flex: 1,
            height: styles.mobileMinHeight,
            ...styles.mediumText,
            ...styles.tnum,
            color: step < 0 ? theme.errorText : theme.noticeText,
          }}
          aria-label={
            step < 0
              ? t('Subtract {{amount}} from budget', {
                  amount: format(-step, 'financial'),
                })
              : t('Add {{amount}} to budget', {
                  amount: format(step, 'financial'),
                })
          }
          onPress={() => onUpdateBudget((budgeted || 0) + step)}
        >
          {label(step)}
        </Button>
      ))}
    </View>
  );
}
