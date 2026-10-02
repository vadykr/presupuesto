import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgFilter2 } from '@actual-app/components/icons/v2';
import { View } from '@actual-app/components/view';

import { useFormat } from '#hooks/useFormat';
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
  Seccion,
  Vacio,
} from './comunes';
import { SelectorPeriodo, usePeriodoInformes } from './SelectorPeriodo';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';
import { useTotalesMensuales } from './useTotalesMensuales';

/** Detalle «Este mes»: dónde se va el dinero, por categoría. */
export function GastoMesPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { periodo, setPeriodo, rango } = usePeriodoInformes(params.get('mes'));
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  const { excluidas } = useCategoriasExcluidas();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    ...rango,
    categoriasExcluidas: excluidas,
  });
  const desglose = gastoPorCategoria(movimientos, meses, categorias);
  // Barra apilada y lista comparten colores; sin repetir con ≤ 12 categorías.
  const { colorDe } = useColoresCategorias([
    ...desglose.filas.map(f => f.categoria),
    ...desglose.ingresosPositivos.map(f => f.categoria),
  ]);
  const nombreDe = (id: string | null) =>
    id == null
      ? t('Uncategorized')
      : (categorias.get(id)?.nombre ?? t('Unknown'));

  const mayor = desglose.filas[0];
  // El periodo ya se lee en el botón: la frase va al grano y cabe en una línea.
  const frase =
    desglose.total === 0
      ? t('Nothing spent in this period.')
      : mayor
        ? t('{{count}} categories, mostly {{category}} ({{pct}})', {
            count: desglose.filas.length,
            category: nombreDe(mayor.categoria),
            pct: formatPorcentaje(mayor.importe / desglose.total, false),
          })
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
      <View style={{ paddingTop: 10 }}>
        <SelectorPeriodo periodo={periodo} onChange={setPeriodo} />
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
