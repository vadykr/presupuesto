import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { color } from '#components/mobile/ui/tokens';
import { useLocale } from '#hooks/useLocale';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget } from '#spreadsheet/bindings';

import { BurbujaDormida, BurbujaSueno } from './ficha/BurbujaSueno';
import { useDespertarAuto, useIgnorarMes } from './useIgnorarMes';

/**
 * En la fila del Plan: burbuja pequeña «zZ hasta <mes>» que respira mientras
 * la categoría duerme («Dormir hasta…»), despertar automático al verla
 * (`dormir.ts`) y el «pop» de la burbuja al despertar. Sin dormida no ocupa
 * nada.
 */
export function SuenoFila({
  category,
  month,
}: {
  category: CategoryEntity;
  month: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { dormida } = useIgnorarMes(category.id, month);
  const [pop, setPop] = useState(0);
  const finPop = useCallback(() => setPop(0), []);
  useDespertarAuto({
    categoryId: category.id,
    month,
    actividad: useSheetValue<'envelope-budget', 'sum-amount'>(
      envelopeBudget.catSumAmount(category.id),
    ),
    saldo: useSheetValue<'envelope-budget', 'leftover'>(
      envelopeBudget.catBalance(category.id),
    ),
    asignado: useSheetValue<'envelope-budget', 'budget'>(
      envelopeBudget.catBudgeted(category.id),
    ),
    onDespierta: () => setPop(Date.now()),
  });

  if (!dormida && !pop) {
    return null;
  }
  return (
    <View
      data-testid="sueno-fila"
      style={{
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}
    >
      {dormida && (
        <>
          <BurbujaDormida size={18} data-testid="sueno-fila-burbuja" />
          <Text
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: color.fg3,
              whiteSpace: 'nowrap',
            }}
          >
            {t('until {{month}}', {
              month: monthUtils
                .format(dormida.hasta, 'MMM', locale)
                .replace('.', ''),
            })}
          </Text>
        </>
      )}
      {pop > 0 && (
        <View style={{ position: 'relative', width: 18, height: 18 }}>
          <BurbujaSueno key={pop} modo="despertar" onFin={finPop} />
        </View>
      )}
    </View>
  );
}
