import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';

import { ingresosGastosPorMes } from './calculos';
import { variableDeHueco } from './coloresCategorias';
import {
  Cargando,
  etiquetaMesCorta,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Punto,
  Seccion,
} from './comunes';
import { mediana } from './estadisticaRobusta';
import { BarrasMensuales } from './graficas';
import type { PuntoMes } from './graficas';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useTotalesMensuales } from './useTotalesMensuales';

export const COLOR_INGRESOS = variableDeHueco(0);
export const COLOR_GASTOS = variableDeHueco(1);

export function fraseAhorro(
  t: (key: string, opts?: Record<string, unknown>) => string,
  tasa: number | null,
  ahorro: number,
  format: (v: number) => string,
): { frase: string; tono: 'bien' | 'mal' | 'neutro' } {
  if (tasa === null) {
    return { frase: t('No income recorded this month yet.'), tono: 'neutro' };
  }
  if (tasa < 0) {
    return {
      frase: t('This month you spent {{amount}} more than you earned.', {
        amount: format(-ahorro),
      }),
      tono: 'mal',
    };
  }
  return {
    frase: t('This month you saved {{pct}} of your income ({{amount}}).', {
      pct: formatPorcentaje(tasa, false),
      amount: format(ahorro),
    }),
    tono: tasa >= 0.1 ? 'bien' : 'neutro',
  };
}

/** Ingresos frente a gastos, 12 meses, con la tasa de ahorro de cada mes. */
export function IngresosGastosPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { excluidas } = useCategoriasExcluidas();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: 12,
    categoriasExcluidas: excluidas,
  });

  const porMes = ingresosGastosPorMes(movimientos, meses, categorias);
  const actual = porMes[porMes.length - 1];
  const { frase, tono } = fraseAhorro(t, actual.tasa, actual.ahorro, v =>
    format(v, 'financial'),
  );
  const tasasPrevias = porMes
    .slice(0, -1)
    .map(m => m.tasa)
    .filter((x): x is number => x !== null);
  const tasaHabitual =
    tasasPrevias.length > 0
      ? mediana(tasasPrevias.map(x => x * 1000)) / 1000
      : null;

  const datos: PuntoMes[] = porMes.map(m => ({
    mes: m.mes,
    etiqueta: etiquetaMesCorta(m.mes, locale),
    ingresos: m.ingresos,
    gastos: m.gastos,
  }));
  const series = [
    { clave: 'ingresos', color: COLOR_INGRESOS, nombre: t('Income') },
    { clave: 'gastos', color: COLOR_GASTOS, nombre: t('Spending') },
  ];

  return (
    <PaginaInforme
      titulo={t('Income vs spending')}
      data-testid="informe-ingresos-gastos"
    >
      <View style={{ padding: GUTTER, gap: 14 }}>
        {isLoading ? (
          <Cargando />
        ) : (
          <Hero
            etiqueta={t('Savings rate this month')}
            valor={
              actual.tasa === null ? '—' : formatPorcentaje(actual.tasa, false)
            }
            frase={
              tasaHabitual !== null
                ? `${frase} ${t('Your usual rate is {{pct}}.', {
                    pct: formatPorcentaje(tasaHabitual, false),
                  })}`
                : frase
            }
            tono={tono}
          />
        )}
      </View>
      {!isLoading && (
        <>
          <View style={{ paddingLeft: 4, paddingRight: 8 }}>
            <BarrasMensuales
              datos={datos}
              series={series}
              formato={v => format(v, 'financial')}
              extraTooltip={p => {
                const m = porMes.find(x => x.mes === p.mes);
                return m && m.tasa !== null ? (
                  <div style={{ marginTop: 4, ...styles.smallText }}>
                    {t('Saved {{pct}}', {
                      pct: formatPorcentaje(m.tasa, false),
                    })}
                  </div>
                ) : null;
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              paddingLeft: GUTTER,
              paddingTop: 4,
            }}
          >
            {series.map(s => (
              <View
                key={s.clave}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: s.color,
                  }}
                />
                <Text style={styles.smallText}>{s.nombre}</Text>
              </View>
            ))}
          </View>
          <Seccion titulo={t('Month by month')}>
            {[...porMes]
              .reverse()
              .filter(m => m.ingresos !== 0 || m.gastos !== 0)
              .map(m => (
                <FilaValor
                  key={m.mes}
                  nombre={
                    <Text style={{ textTransform: 'capitalize' }}>
                      {monthUtils.format(m.mes, 'MMMM yyyy', locale)}
                    </Text>
                  }
                  detalle={
                    m.tasa === null
                      ? t('no income')
                      : t('saved {{pct}}', {
                          pct: formatPorcentaje(m.tasa, false),
                        })
                  }
                  icono={
                    <Punto
                      color={m.ahorro >= 0 ? COLOR_INGRESOS : COLOR_GASTOS}
                    />
                  }
                  valor={format(m.ahorro, 'financial')}
                  tonoValor={m.ahorro < 0 ? 'mal' : 'neutro'}
                  valorSecundario={t('{{income}} in · {{spending}} out', {
                    income: format(m.ingresos, 'financial'),
                    spending: format(m.gastos, 'financial'),
                  })}
                />
              ))}
          </Seccion>
        </>
      )}
    </PaginaInforme>
  );
}
