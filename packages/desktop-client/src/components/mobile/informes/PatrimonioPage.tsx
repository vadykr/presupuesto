import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { createSpreadsheet as netWorthSpreadsheet } from '#components/reports/spreadsheets/net-worth-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';

import { desviacionPct } from './calculos';
import { variableDeHueco } from './coloresCategorias';
import {
  Cargando,
  etiquetaMesCorta,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Pildoras,
  Seccion,
  Vacio,
} from './comunes';
import { LineaMensual } from './graficas';
import type { PuntoMes } from './graficas';

type Ventana = '12' | '24';

export const COLOR_PATRIMONIO = variableDeHueco(0);

type PuntoPatrimonio = {
  x: string;
  y: number;
  assets: string;
  debt: string;
  change: string;
  networth: string;
  date: string;
};

type DatosPatrimonio = {
  graphData: { data: PuntoPatrimonio[] };
  netWorth: number;
  totalChange: number;
};

/** Patrimonio: activos − deudas, mes a mes, reutilizando el informe de Actual. */
export function PatrimonioPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const [ventana, setVentana] = useState<Ventana>('12');
  const { data: cuentas = [] } = useAccounts();

  const hasta = monthUtils.currentMonth();
  const desde = monthUtils.subMonths(hasta, Number(ventana) - 1);
  const cuentasAbiertas = useMemo(
    () => cuentas.filter(c => !c.closed),
    [cuentas],
  );

  const getData = useMemo(
    () =>
      netWorthSpreadsheet(
        desde,
        hasta,
        cuentasAbiertas,
        [],
        'and',
        locale,
        'Monthly',
        '0',
        format,
      ),
    [desde, hasta, cuentasAbiertas, locale, format],
  );
  const datos = useReport<DatosPatrimonio>('patrimonio', getData);

  const puntos = datos?.graphData.data ?? [];
  // La serie incluye el mes previo al rango como arranque; nos quedamos con la ventana.
  const visibles = puntos.slice(-Number(ventana));
  const ultimo = visibles[visibles.length - 1];
  const anterior = visibles[visibles.length - 2];
  const cambio = ultimo && anterior ? ultimo.y - anterior.y : 0;
  const pct = ultimo && anterior ? desviacionPct(ultimo.y, anterior.y) : null;

  // La deuda llega como «-1.234»; la frase ya dice «deudas».
  const sinSigno = (deuda: string) => deuda.replace(/^-/, '');
  const serie: PuntoMes[] = visibles.map(p => ({
    mes: p.x,
    etiqueta: p.x.replace(/ .*$/, '').replace('.', ''),
    valor: p.y,
  }));

  return (
    <PaginaInforme titulo={t('Net worth')} data-testid="informe-patrimonio">
      <View style={{ paddingTop: 10 }}>
        <Pildoras<Ventana>
          aria-label={t('Window')}
          valor={ventana}
          onChange={setVentana}
          opciones={[
            { valor: '12', etiqueta: t('12 months') },
            { valor: '24', etiqueta: t('24 months') },
          ]}
        />
      </View>
      <View style={{ padding: GUTTER, gap: 14 }}>
        {!datos ? (
          <Cargando />
        ) : !ultimo ? (
          <Vacio>
            <Trans>No account balances yet.</Trans>
          </Vacio>
        ) : (
          <Hero
            etiqueta={t('What you own minus what you owe')}
            valor={format(ultimo.y, 'financial')}
            tono={ultimo.y < 0 ? 'mal' : 'neutro'}
            frase={
              anterior
                ? cambio >= 0
                  ? t(
                      'Up {{amount}} since last month ({{pct}}). Assets {{assets}}, debts {{debt}}.',
                      {
                        amount: format(cambio, 'financial'),
                        pct: pct === null ? '—' : formatPorcentaje(pct),
                        assets: ultimo.assets,
                        debt: sinSigno(ultimo.debt),
                      },
                    )
                  : t(
                      'Down {{amount}} since last month ({{pct}}). Assets {{assets}}, debts {{debt}}.',
                      {
                        amount: format(-cambio, 'financial'),
                        pct: pct === null ? '—' : formatPorcentaje(pct),
                        assets: ultimo.assets,
                        debt: sinSigno(ultimo.debt),
                      },
                    )
                : t('Assets {{assets}}, debts {{debt}}.', {
                    assets: ultimo.assets,
                    debt: sinSigno(ultimo.debt),
                  })
            }
          />
        )}
      </View>
      {datos && ultimo && (
        <>
          <View style={{ paddingLeft: 4, paddingRight: 8 }}>
            <LineaMensual
              datos={serie}
              serie={{
                clave: 'valor',
                color: COLOR_PATRIMONIO,
                nombre: t('Net worth'),
              }}
              formato={v => format(v, 'financial')}
            />
          </View>
          <Seccion titulo={t('Month by month')}>
            {[...visibles].reverse().map((p, i, arr) => {
              const prev = arr[i + 1];
              const dif = prev ? p.y - prev.y : null;
              return (
                <FilaValor
                  key={p.date}
                  nombre={
                    <span style={{ textTransform: 'capitalize' }}>
                      {p.date}
                    </span>
                  }
                  detalle={t('assets {{assets}} · debts {{debt}}', {
                    assets: p.assets,
                    debt: sinSigno(p.debt),
                  })}
                  valor={format(p.y, 'financial')}
                  valorSecundario={
                    dif === null
                      ? undefined
                      : `${dif >= 0 ? '+' : '−'}${format(Math.abs(dif), 'financial')}`
                  }
                  tonoValor={p.y < 0 ? 'mal' : 'neutro'}
                />
              );
            })}
          </Seccion>
        </>
      )}
    </PaginaInforme>
  );
}

export { etiquetaMesCorta };
