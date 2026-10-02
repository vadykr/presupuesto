import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { BarraPartes, Fila, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { color } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { envelopeBudget } from '#spreadsheet/bindings';

/** Fracción de `parte` sobre `total` (0 si no hay total). */
export function fraccionDe(parte: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, parte / total)) : 0;
}

/**
 * Resumen del mes: ingresos, asignado y gastado, con una barra que enseña
 * lo gastado y lo asignado sobre los ingresos.
 *
 * Tamaños: compacto = barra y gastado; normal = tres cifras y barra;
 * grande = + lo que queda por gastar de lo asignado.
 */
export function ResumenMes({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();

  const totalBudgeted =
    useEnvelopeSheetValue(envelopeBudget.totalBudgeted) ?? 0;
  const totalSpent = useEnvelopeSheetValue(envelopeBudget.totalSpent) ?? 0;
  const totalIncome = useEnvelopeSheetValue(envelopeBudget.totalIncome) ?? 0;

  // La hoja guarda lo asignado y lo gastado en negativo; se enseñan en
  // positivo, igual que la cabecera de la pestaña Presupuesto.
  const asignado = -totalBudgeted;
  const gastado = -totalSpent;
  const base = Math.max(totalIncome, asignado);
  const fGastado = fraccionDe(gastado, base);
  const fAsignado = Math.max(0, fraccionDe(asignado, base) - fGastado);

  const nombreMes = monthUtils.format(month, 'MMMM', locale);

  const barra = (
    <BarraPartes
      etiqueta={t('Spent {{percent}} of income', {
        percent: `${Math.round(fraccionDe(gastado, totalIncome) * 100)} %`,
      })}
      partes={[
        { fraccion: fGastado, color: color.accent },
        { fraccion: fAsignado, color: color.accentSoft },
      ]}
    />
  );

  const filas = [
    { label: t('Income'), value: totalIncome, testId: 'resumen-ingresos' },
    { label: t('Assigned'), value: asignado, testId: 'resumen-asignado' },
    { label: t('Spent'), value: gastado, testId: 'resumen-gastado' },
  ];

  return (
    <Tarjeta
      titulo={t('Summary of {{month}}', { month: nombreMes })}
      cabecera="tarjeta"
      data-testid="inicio-resumen"
    >
      {tamano === 'compacto' ? (
        <Fila style={{ minHeight: 0, justifyContent: 'space-between' }}>
          <Text style={estilos.resumenEtiqueta}>
            <Trans>Spent</Trans>
          </Text>
          <PrivacyFilter>
            <Text style={estilos.resumenValor} data-testid="resumen-gastado">
              {format(gastado, 'financial')}
            </Text>
          </PrivacyFilter>
        </Fila>
      ) : (
        <View style={estilos.resumenRejilla}>
          {filas.map(f => (
            <View key={f.testId} style={{ gap: 2, minWidth: 0 }}>
              <Text style={estilos.resumenEtiqueta}>{f.label}</Text>
              <PrivacyFilter>
                <Text style={estilos.resumenValor} data-testid={f.testId}>
                  {format(f.value, 'financial')}
                </Text>
              </PrivacyFilter>
            </View>
          ))}
        </View>
      )}
      {barra}
      {tamano === 'grande' && (
        <Fila separada style={{ minHeight: 44, paddingTop: 8 }}>
          <Text style={{ ...estilos.filaSub, flex: 1 }}>
            <Trans>Left to spend of what you assigned</Trans>
          </Text>
          <PrivacyFilter>
            <Text style={estilos.resumenValor}>
              {format(asignado - gastado, 'financial')}
            </Text>
          </PrivacyFilter>
        </Fila>
      )}
    </Tarjeta>
  );
}
