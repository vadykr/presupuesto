import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { usePayeesById } from '#hooks/usePayees';

import { ingresosGastosPorMes, nominasPorPayee } from './calculos';
import { variableDeHueco } from './coloresCategorias';
import {
  Cargando,
  etiquetaMesCorta,
  formatPorcentaje,
  GUTTER,
  Hero,
  MiniBarras,
  PaginaInforme,
  Seccion,
  Vacio,
} from './comunes';
import { clasificarMes, mediana } from './estadisticaRobusta';
import { BarrasMensuales } from './graficas';
import type { PuntoMes } from './graficas';
import { useTotalesMensuales } from './useTotalesMensuales';

export const COLOR_NOMINAS = variableDeHueco(0);

export function fraseNominas(
  t: (key: string, opts?: Record<string, unknown>) => string,
  actual: number,
  previos: number[],
  format: (v: number) => string,
): string {
  const habituales = previos.filter(v => v > 0);
  if (habituales.length === 0) {
    return actual > 0
      ? t('First month with income on record.')
      : t('No income recorded this month yet.');
  }
  const referencia = mediana(habituales);
  const { tipo } = clasificarMes(actual, previos);
  if (actual === 0) {
    return t(
      'Nothing received yet this month; you usually get {{reference}}.',
      {
        reference: format(referencia),
      },
    );
  }
  if (tipo === 'puntual') {
    return t(
      'Usually {{reference}} a month; this month {{amount}} (extra income).',
      {
        reference: format(referencia),
        amount: format(actual),
      },
    );
  }
  if (referencia === 0 || Math.abs(actual - referencia) / referencia < 0.02) {
    return t(
      'Received so far this month, in line with your usual {{reference}}.',
      { reference: format(referencia) },
    );
  }
  if (actual > referencia) {
    return t(
      'Received so far this month, {{pct}} more than your usual {{reference}}.',
      {
        pct: formatPorcentaje((actual - referencia) / referencia, false),
        reference: format(referencia),
      },
    );
  }
  return t(
    'Received so far this month; you usually get {{reference}} a month.',
    { reference: format(referencia) },
  );
}

/** Nóminas: ingresos por pagador y mes, últimos 12 meses. */
export function NominasPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { data: payees = {} } = usePayeesById();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: 12,
    incluirOcultas: true,
  });

  const porMes = ingresosGastosPorMes(movimientos, meses, categorias);
  const ingresos = porMes.map(m => m.ingresos);
  const actual = ingresos[ingresos.length - 1] ?? 0;
  const filas = nominasPorPayee(movimientos, meses, categorias);
  const nombrePayee = (id: string | null) =>
    id == null ? t('No payee') : (payees[id]?.name ?? t('Unknown'));

  const datos: PuntoMes[] = meses.map((mes, i) => ({
    mes,
    etiqueta: etiquetaMesCorta(mes, locale),
    valor: ingresos[i],
  }));

  return (
    <PaginaInforme titulo={t('Income by payer')} data-testid="informe-nominas">
      <View style={{ padding: GUTTER, gap: 14 }}>
        {isLoading ? (
          <Cargando />
        ) : (
          <Hero
            etiqueta={
              <Text style={{ textTransform: 'capitalize' }}>
                {monthUtils.format(
                  meses[meses.length - 1],
                  'MMMM yyyy',
                  locale,
                )}
              </Text>
            }
            valor={format(actual, 'financial')}
            frase={fraseNominas(t, actual, ingresos.slice(0, -1), v =>
              format(v, 'financial'),
            )}
          />
        )}
      </View>
      {!isLoading && (
        <>
          <View style={{ paddingLeft: 4, paddingRight: 8 }}>
            <BarrasMensuales
              datos={datos}
              series={[
                { clave: 'valor', color: COLOR_NOMINAS, nombre: t('Income') },
              ]}
              formato={v => format(v, 'financial')}
              referencia={mediana(ingresos.filter(v => v > 0))}
              etiquetaReferencia={t('usual')}
            />
          </View>
          {filas.length === 0 ? (
            <Vacio>
              <Trans>No income in the last 12 months.</Trans>
            </Vacio>
          ) : (
            <Seccion titulo={t('By payer, last 12 months')}>
              {filas.map(f => {
                const mesesConIngreso = f.porMes.filter(v => v > 0).length;
                return (
                  <View
                    key={f.payee ?? 'sin'}
                    style={{
                      padding: `10px ${GUTTER}px`,
                      borderTop: `1px solid ${theme.tableBorder}`,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ ...styles.mediumText, fontWeight: 600 }}>
                          {nombrePayee(f.payee)}
                        </Text>
                        <Text
                          style={{
                            ...styles.smallText,
                            color: theme.pageTextSubdued,
                          }}
                        >
                          {t('{{count}} months · usually {{amount}}', {
                            count: mesesConIngreso,
                            amount: format(
                              mediana(f.porMes.filter(v => v > 0)),
                              'financial',
                            ),
                          })}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <PrivacyFilter>
                          <Text
                            style={{
                              ...styles.mediumText,
                              ...styles.tnum,
                              fontWeight: 600,
                            }}
                          >
                            {format(f.total, 'financial')}
                          </Text>
                        </PrivacyFilter>
                        <Text
                          style={{
                            ...styles.smallText,
                            ...styles.tnum,
                            color: theme.pageTextSubdued,
                          }}
                        >
                          {t('this month {{amount}}', {
                            amount: format(
                              f.porMes[f.porMes.length - 1],
                              'financial',
                            ),
                          })}
                        </Text>
                      </View>
                    </View>
                    <MiniBarras
                      valores={f.porMes}
                      color={COLOR_NOMINAS}
                      alto={28}
                    />
                  </View>
                );
              })}
            </Seccion>
          )}
        </>
      )}
    </PaginaInforme>
  );
}
