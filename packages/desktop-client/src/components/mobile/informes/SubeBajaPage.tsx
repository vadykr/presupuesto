import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowThinDown,
  SvgArrowThinUp,
} from '@actual-app/components/icons/v1';
import { SvgFilter2 } from '@actual-app/components/icons/v2';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

import { rankingSubeBaja } from './calculos';
import type { FilaRanking } from './calculos';
import { CategoriasQueCuentanModal } from './CategoriasQueCuentanModal';
import {
  Cargando,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Seccion,
  SelectorMes,
  Vacio,
} from './comunes';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';
import { useTotalesMensuales } from './useTotalesMensuales';

export const MESES_REFERENCIA = 6;

/** Último mes completo (el actual aún está a medias). */
export function mesPorDefectoSubeBaja(hoy = monthUtils.currentMonth()): string {
  return monthUtils.prevMonth(hoy);
}

export function fraseSubeBaja(
  t: (key: string, opts?: Record<string, unknown>) => string,
  ranking: FilaRanking[],
  nombreDe: (id: string) => string,
  format: (v: number) => string,
): { valor: string; frase: string; tono: 'bien' | 'mal' | 'neutro' | 'aviso' } {
  const subidas = ranking.filter(f => f.tipo === 'sube');
  const bajadas = ranking.filter(f => f.tipo === 'baja');
  const puntuales = ranking.filter(f => f.tipo === 'puntual');
  if (subidas.length > 0) {
    const s = subidas[0];
    return {
      valor: `+${format(s.desviacion)}`,
      frase: t(
        '{{category}} keeps rising: {{amount}} this month against a usual {{reference}}.',
        {
          category: nombreDe(s.categoria),
          amount: format(s.actual),
          reference: format(s.referencia),
        },
      ),
      tono: 'mal',
    };
  }
  if (puntuales.length > 0) {
    const p = puntuales[0];
    return {
      valor: `+${format(p.desviacion)}`,
      frase: t(
        'No category is trending up. {{category}} had a one-off expense of {{amount}} (usually {{reference}}).',
        {
          category: nombreDe(p.categoria),
          amount: format(p.actual),
          reference: format(p.referencia),
        },
      ),
      tono: 'aviso',
    };
  }
  if (bajadas.length > 0) {
    const b = bajadas[bajadas.length - 1];
    return {
      valor: `−${format(-b.desviacion)}`,
      frase: t(
        'Nothing is rising. {{category}} keeps falling: {{amount}} against a usual {{reference}}.',
        {
          category: nombreDe(b.categoria),
          amount: format(b.actual),
          reference: format(b.referencia),
        },
      ),
      tono: 'bien',
    };
  }
  return {
    valor: format(0),
    frase: t('Everything is within its usual range this month.'),
    tono: 'bien',
  };
}

/** Qué sube y qué baja: cada categoría frente a lo habitual de 6 meses. */
export function SubeBajaPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const navigate = useNavigate();
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  // Por defecto el último mes completo: a mitad de mes todo parecería «bajar».
  const [mes, setMes] = useState(mesPorDefectoSubeBaja());
  const { excluidas } = useCategoriasExcluidas();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: MESES_REFERENCIA + 1,
    hasta: mes,
    categoriasExcluidas: excluidas,
  });
  const { colorDe } = useColoresCategorias();
  const mesActual = meses[meses.length - 1];
  const ranking = rankingSubeBaja(
    movimientos,
    mesActual,
    meses.slice(0, -1),
    categorias,
  );
  const nombreDe = (id: string) => categorias.get(id)?.nombre ?? t('Unknown');
  const resumen = fraseSubeBaja(t, ranking, nombreDe, v =>
    format(v, 'financial'),
  );

  const grupos: Array<{ titulo: string; filas: FilaRanking[] }> = [
    {
      titulo: t('One-off expenses this month'),
      filas: ranking.filter(f => f.tipo === 'puntual'),
    },
    { titulo: t('Rising'), filas: ranking.filter(f => f.tipo === 'sube') },
    {
      titulo: t('Falling'),
      filas: [...ranking.filter(f => f.tipo === 'baja')].reverse(),
    },
    { titulo: t('As usual'), filas: ranking.filter(f => f.tipo === 'normal') },
  ];

  return (
    <PaginaInforme
      titulo={t('Rising and falling')}
      subtitulo={
        mesActual
          ? t('{{month}} vs. the usual of the last {{count}} months', {
              month: monthUtils.format(mesActual, 'MMMM', locale),
              count: MESES_REFERENCIA,
            })
          : undefined
      }
      data-testid="informe-sube-baja"
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
      <View style={{ paddingTop: 6 }}>
        <SelectorMes mes={mes} onChange={setMes} />
      </View>
      <View style={{ padding: GUTTER, paddingTop: 4, gap: 14 }}>
        {isLoading ? (
          <Cargando />
        ) : (
          <Hero
            etiqueta={t('Biggest change')}
            valor={resumen.valor}
            frase={resumen.frase}
            tono={resumen.tono}
          />
        )}
      </View>
      {!isLoading && ranking.length === 0 && (
        <Vacio>
          <Trans>
            Not enough history yet: it needs a few months of spending.
          </Trans>
        </Vacio>
      )}
      {grupos
        .filter(g => g.filas.length > 0)
        .map(g => (
          <Seccion key={g.titulo} titulo={g.titulo}>
            {g.filas.map(f => (
              <FilaValor
                key={f.categoria}
                nombre={nombreDe(f.categoria)}
                detalle={t('usually {{amount}}', {
                  amount: format(f.referencia, 'financial'),
                })}
                color={colorDe(f.categoria)}
                icono={<Flecha desviacion={f.desviacion} tipo={f.tipo} />}
                valor={format(f.actual, 'financial')}
                valorSecundario={`${f.desviacion >= 0 ? '+' : '−'}${format(
                  Math.abs(f.desviacion),
                  'financial',
                )}${
                  f.desviacionPct !== null
                    ? ` · ${formatPorcentaje(f.desviacionPct)}`
                    : ''
                }`}
                tonoValor={
                  f.tipo === 'sube'
                    ? 'mal'
                    : f.tipo === 'baja'
                      ? 'bien'
                      : f.tipo === 'puntual'
                        ? 'aviso'
                        : 'neutro'
                }
                onPress={() =>
                  void navigate(`/reports/categoria/${f.categoria}`)
                }
              />
            ))}
          </Seccion>
        ))}
      <CategoriasQueCuentanModal
        abierto={filtroAbierto}
        onClose={() => setFiltroAbierto(false)}
      />
    </PaginaInforme>
  );
}

export function Flecha({
  desviacion,
  tipo,
}: {
  desviacion: number;
  tipo: FilaRanking['tipo'];
}) {
  const color =
    tipo === 'sube'
      ? theme.errorText
      : tipo === 'baja'
        ? theme.noticeText
        : tipo === 'puntual'
          ? theme.warningText
          : theme.pageTextSubdued;
  const Icono = desviacion >= 0 ? SvgArrowThinUp : SvgArrowThinDown;
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
      aria-hidden
    >
      <Icono width={14} height={14} />
    </View>
  );
}
