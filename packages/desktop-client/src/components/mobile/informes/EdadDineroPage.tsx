import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { createAgeOfMoneySpreadsheet } from '#components/reports/spreadsheets/age-of-money-spreadsheet';
import type { AgeOfMoneyData } from '#components/reports/spreadsheets/age-of-money-spreadsheet';
import { useReport } from '#components/reports/useReport';

import { variableDeHueco } from './coloresCategorias';
import {
  Cargando,
  FilaValor,
  GUTTER,
  Hero,
  PaginaInforme,
  Seccion,
  Vacio,
} from './comunes';
import type { Tono } from './comunes';
import { LineaMensual } from './graficas';
import type { PuntoMes } from './graficas';

export const COLOR_EDAD = variableDeHueco(2);

export function tonoEdad(dias: number | null): Tono {
  if (dias === null) return 'neutro';
  if (dias >= 30) return 'bien';
  if (dias >= 14) return 'aviso';
  return 'mal';
}

export function fraseEdad(
  t: (key: string, opts?: Record<string, unknown>) => string,
  datos: AgeOfMoneyData,
): string {
  if (datos.currentAge === null) {
    return t('Not enough transactions yet to know how old your money is.');
  }
  const base = t('You are spending money you earned {{days}} days ago.', {
    days: datos.currentAge,
  });
  const tendencia =
    datos.trend === 'up'
      ? t('It is getting older: good sign.')
      : datos.trend === 'down'
        ? t('It is getting younger: you are spending closer to payday.')
        : t('Steady over the last months.');
  const aviso = datos.insufficientData
    ? ` ${t('Some spending could not be matched to income, so the figure is approximate.')}`
    : '';
  return `${base} ${tendencia}${aviso}`;
}

/** Edad del dinero (FIFO), reutilizando el cálculo del informe de Actual. */
export function EdadDineroPage() {
  const { t } = useTranslation();
  const hasta = monthUtils.currentMonth();
  const desde = monthUtils.subMonths(hasta, 11);

  const getData = useMemo(
    () =>
      createAgeOfMoneySpreadsheet({
        start: desde,
        end: hasta,
        granularity: 'monthly',
      }),
    [desde, hasta],
  );
  const datos = useReport<AgeOfMoneyData>('edad-dinero', getData);

  const serie: PuntoMes[] = (datos?.graphData ?? []).map(p => ({
    mes: p.date,
    etiqueta: p.date.replace(/ .*$/, '').replace('.', ''),
    valor: p.ageOfMoney * 100, // la gráfica formatea céntimos; aquí son días × 100
  }));
  const formatoDias = (v: number) =>
    t('{{count}} days', { count: Math.round(v / 100) });

  return (
    <PaginaInforme titulo={t('Age of money')} data-testid="informe-edad-dinero">
      <View style={{ padding: GUTTER, gap: 14 }}>
        {!datos ? (
          <Cargando />
        ) : (
          <Hero
            etiqueta={t('Days between earning and spending')}
            valor={
              datos.currentAge === null
                ? '—'
                : t('{{count}} days', { count: datos.currentAge })
            }
            frase={fraseEdad(t, datos)}
            tono={tonoEdad(datos.currentAge)}
          />
        )}
      </View>
      {datos && serie.length === 0 && (
        <Vacio>
          <Trans>No data for the last 12 months.</Trans>
        </Vacio>
      )}
      {datos && serie.length > 0 && (
        <>
          <View style={{ paddingLeft: 4, paddingRight: 8 }}>
            <LineaMensual
              datos={serie}
              serie={{
                clave: 'valor',
                color: COLOR_EDAD,
                nombre: t('Age of money'),
              }}
              formato={formatoDias}
            />
          </View>
          <Seccion titulo={t('Month by month')}>
            {[...(datos.graphData ?? [])].reverse().map(p => (
              <FilaValor
                key={p.date}
                nombre={
                  <span style={{ textTransform: 'capitalize' }}>{p.date}</span>
                }
                valor={t('{{count}} days', { count: p.ageOfMoney })}
                tonoValor={tonoEdad(p.ageOfMoney)}
              />
            ))}
          </Seccion>
        </>
      )}
    </PaginaInforme>
  );
}
