import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgFilter2 } from '@actual-app/components/icons/v2';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

import { gastoPorCategoria } from './calculos';
import { CategoriasQueCuentanModal } from './CategoriasQueCuentanModal';
import {
  BarraApilada,
  Cargando,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Pildoras,
  Seccion,
  SelectorMes,
  Vacio,
} from './comunes';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';
import { useTotalesMensuales } from './useTotalesMensuales';

type Modo = 'mes' | '3' | '6' | '12' | 'ano';

function rangoDeModo(
  modo: Modo,
  mes: string,
): { meses: number; hasta: string } {
  const actual = monthUtils.currentMonth();
  switch (modo) {
    case 'mes':
      return { meses: 1, hasta: mes };
    case 'ano':
      return {
        meses: Number(actual.slice(5, 7)),
        hasta: actual,
      };
    default:
      return { meses: Number(modo), hasta: actual };
  }
}

/** Detalle «Este mes»: dónde se va el dinero, por categoría. */
export function GastoMesPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [modo, setModo] = useState<Modo>('mes');
  const [mes, setMes] = useState(
    params.get('mes') ?? monthUtils.currentMonth(),
  );
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  const { excluidas } = useCategoriasExcluidas();
  const rango = rangoDeModo(modo, mes);
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    ...rango,
    categoriasExcluidas: excluidas,
  });
  const { colorDe } = useColoresCategorias();

  const desglose = gastoPorCategoria(movimientos, meses, categorias);
  const nombreDe = (id: string | null) =>
    id == null
      ? t('Uncategorized')
      : (categorias.get(id)?.nombre ?? t('Unknown'));

  const mayor = desglose.filas[0];
  const etiquetaPeriodo =
    modo === 'mes'
      ? monthUtils.format(mes, 'MMMM yyyy', locale)
      : modo === 'ano'
        ? t('this year')
        : t('the last {{count}} months', { count: Number(modo) });

  const frase =
    desglose.total === 0
      ? t('Nothing spent in {{period}}', { period: etiquetaPeriodo })
      : mayor
        ? t(
            'Spent in {{period}} across {{count}} categories. The biggest: {{category}} ({{pct}}).',
            {
              period: etiquetaPeriodo,
              count: desglose.filas.length,
              category: nombreDe(mayor.categoria),
              pct: formatPorcentaje(mayor.importe / desglose.total, false),
            },
          )
        : '';

  return (
    <PaginaInforme
      titulo={t('Spending')}
      data-testid="informe-gasto-mes"
      rightContent={
        <Button
          variant="bare"
          aria-label={t('What counts as spending')}
          onPress={() => setFiltroAbierto(true)}
          style={{ margin: 10, minWidth: 44, minHeight: 44 }}
        >
          <SvgFilter2 width={18} height={18} />
        </Button>
      }
    >
      <View style={{ gap: 10, paddingTop: 10 }}>
        <Pildoras<Modo>
          aria-label={t('Period')}
          valor={modo}
          onChange={setModo}
          opciones={[
            { valor: 'mes', etiqueta: t('Month') },
            { valor: '3', etiqueta: t('3 mo.') },
            { valor: '6', etiqueta: t('6 mo.') },
            { valor: '12', etiqueta: t('12 mo.') },
            { valor: 'ano', etiqueta: t('Year') },
          ]}
        />
        {modo === 'mes' && <SelectorMes mes={mes} onChange={setMes} />}
      </View>

      <View style={{ padding: GUTTER, paddingTop: 6, gap: 14 }}>
        {isLoading ? (
          <Cargando />
        ) : (
          <>
            <Hero
              etiqueta={t('Total spent')}
              valor={format(desglose.total, 'financial')}
              frase={frase}
            />
            <BarraApilada
              total={desglose.total}
              segmentos={desglose.filas.map(f => ({
                clave: f.categoria ?? 'sin',
                valor: f.importe,
                color: colorDe(f.categoria),
                nombre: nombreDe(f.categoria),
              }))}
              onPress={clave => {
                if (clave !== 'sin') {
                  void navigate(`/reports/categoria/${clave}`);
                }
              }}
            />
          </>
        )}
      </View>

      {!isLoading && desglose.filas.length === 0 && (
        <Vacio>
          <Trans>No spending in this period.</Trans>
        </Vacio>
      )}

      {desglose.filas.length > 0 && (
        <Seccion titulo={t('By category')}>
          {desglose.filas.map(f => (
            <FilaValor
              key={f.categoria ?? 'sin'}
              nombre={nombreDe(f.categoria)}
              detalle={formatPorcentaje(f.importe / desglose.total, false)}
              valor={format(f.importe, 'financial')}
              color={colorDe(f.categoria)}
              fraccion={f.importe / (desglose.filas[0]?.importe || 1)}
              onPress={
                f.categoria
                  ? () => void navigate(`/reports/categoria/${f.categoria}`)
                  : undefined
              }
            />
          ))}
        </Seccion>
      )}

      {desglose.ingresosPositivos.length > 0 && (
        <Seccion titulo={t('Positive inflow categories')}>
          {desglose.ingresosPositivos.map(f => (
            <FilaValor
              key={f.categoria ?? 'sin'}
              nombre={nombreDe(f.categoria)}
              valor={format(f.importe, 'financial')}
              tonoValor="bien"
              color={colorDe(f.categoria)}
              onPress={
                f.categoria
                  ? () => void navigate(`/reports/categoria/${f.categoria}`)
                  : undefined
              }
            />
          ))}
        </Seccion>
      )}

      <CategoriasQueCuentanModal
        abierto={filtroAbierto}
        onClose={() => setFiltroAbierto(false)}
      />
    </PaginaInforme>
  );
}
