import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgCheveronDown } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

import { evolucionCategoria, gastoPorCategoria } from './calculos';
import {
  Cargando,
  etiquetaMesCorta,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Pildoras,
  Punto,
  Seccion,
  Vacio,
} from './comunes';
import {
  clasificarMes,
  recortarInicioSinDatos,
  referenciaHabitual,
} from './estadisticaRobusta';
import type { Clasificacion } from './estadisticaRobusta';
import { BarrasMensuales } from './graficas';
import type { PuntoMes } from './graficas';
import { SelectorCategoriaModal } from './SelectorCategoriaModal';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';
import { usePresupuestado } from './usePresupuestado';
import { useTotalesMensuales } from './useTotalesMensuales';

type Ventana = '12' | '24';

/**
 * Frase del mes frente a lo habitual de la categoría. Un mes atípico se dice
 * como «gasto puntual», no como subida.
 */
export function fraseCategoria(
  t: (key: string, opts?: Record<string, unknown>) => string,
  actual: number,
  referencia: number,
  tipo: Clasificacion,
  meses: number,
  format: (v: number) => string,
): string {
  if (referencia === 0) {
    return t('{{amount}} this month; no usual level yet to compare with.', {
      amount: format(actual),
    });
  }
  const pct = formatPorcentaje(
    Math.abs(actual - referencia) / referencia,
    false,
  );
  if (tipo === 'puntual') {
    return t(
      'Usually {{reference}} a month; this month {{amount}} (one-off expense).',
      { reference: format(referencia), amount: format(actual) },
    );
  }
  if (Math.round(actual) === Math.round(referencia)) {
    return t(
      '{{amount}} this month, right on your usual {{months}}-month level.',
      {
        amount: format(actual),
        months: meses,
      },
    );
  }
  return actual > referencia
    ? t(
        '{{amount}} this month, {{pct}} above your usual {{months}}-month level ({{reference}}).',
        {
          amount: format(actual),
          pct,
          months: meses,
          reference: format(referencia),
        },
      )
    : t(
        '{{amount}} this month, {{pct}} below your usual {{months}}-month level ({{reference}}).',
        {
          amount: format(actual),
          pct,
          months: meses,
          reference: format(referencia),
        },
      );
}

/** Evolución de una categoría: 12 o 24 meses, lo habitual y lo presupuestado. */
export function CategoriaPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [ventana, setVentana] = useState<Ventana>('12');
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const { excluidas } = useCategoriasExcluidas();
  const n = Number(ventana);
  // Incluimos las excluidas: si el usuario pide una categoría, la ve.
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: n,
    incluirOcultas: true,
  });
  const mesActual = meses[meses.length - 1];
  const { presupuestado } = usePresupuestado(mesActual ? [mesActual] : []);

  // Sin categoría en la ruta: la de mayor gasto este mes.
  const desgloseMes = gastoPorCategoria(
    movimientos.filter(m => m.categoria == null || !excluidas.has(m.categoria)),
    mesActual ? [mesActual] : [],
    categorias,
  );
  const categoriaId =
    id ?? desgloseMes.filas.find(f => f.categoria)?.categoria ?? null;
  const info = categoriaId ? categorias.get(categoriaId) : undefined;
  // Una sola categoría en pantalla: toma el primer color de la vista.
  const { colorDe } = useColoresCategorias([categoriaId]);

  const valores = evolucionCategoria(
    movimientos,
    categoriaId,
    meses,
    info?.esIngreso ?? false,
  );
  const actual = valores[valores.length - 1] ?? 0;
  const previos = valores.slice(0, -1);
  const { tipo, referencia } = clasificarMes(actual, previos);
  const conDatos = recortarInicioSinDatos(valores.slice(0, -1));
  const todos = referenciaHabitual(conDatos);
  const atipicos = [
    ...valores
      .slice(0, -1)
      .map(() => false)
      .slice(conDatos.length),
    ...todos.atipicos,
    tipo === 'puntual',
  ];
  const presupuesto =
    categoriaId && mesActual
      ? presupuestado.get(mesActual)?.get(categoriaId)
      : undefined;

  const datos: PuntoMes[] = meses.map((mes, i) => ({
    mes,
    etiqueta: etiquetaMesCorta(mes, locale),
    valor: valores[i],
    atipico: atipicos[i],
  }));
  const color = colorDe(categoriaId);
  const serie = {
    clave: 'valor',
    color,
    nombre: info?.nombre ?? t('Category'),
  };

  return (
    <PaginaInforme titulo={t('Trend')} data-testid="informe-categoria">
      <View style={{ paddingTop: 10, gap: 10 }}>
        <View style={{ paddingLeft: GUTTER, paddingRight: GUTTER }}>
          <Button
            variant="bare"
            onPress={() => setSelectorAbierto(true)}
            data-testid="elegir-categoria"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: theme.tableBackground,
              border: `1px solid ${theme.tableBorder}`,
              color: theme.pageText,
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Punto color={color} size={12} />
              <Text style={{ ...styles.mediumText, fontWeight: 600 }}>
                {info?.nombre ?? t('Choose a category')}
              </Text>
              {info && (
                <Text
                  style={{ ...styles.smallText, color: theme.pageTextSubdued }}
                >
                  {info.nombreGrupo}
                </Text>
              )}
            </View>
            <SvgCheveronDown width={16} height={16} />
          </Button>
        </View>
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

      <View style={{ padding: GUTTER, paddingTop: 12, gap: 14 }}>
        {isLoading ? (
          <Cargando />
        ) : !categoriaId ? (
          <Vacio>
            <Trans>Choose a category to see how it evolves.</Trans>
          </Vacio>
        ) : (
          <Hero
            etiqueta={
              <Text style={{ textTransform: 'capitalize' }}>
                {monthUtils.format(mesActual, 'MMMM yyyy', locale)}
              </Text>
            }
            valor={format(actual, 'financial')}
            frase={fraseCategoria(
              t,
              actual,
              referencia.referencia,
              tipo,
              n,
              v => format(v, 'financial'),
            )}
            tono={tipo === 'puntual' ? 'aviso' : 'neutro'}
          />
        )}
      </View>

      {!isLoading && categoriaId && (
        <>
          <View style={{ paddingLeft: 4, paddingRight: 8 }}>
            <BarrasMensuales
              datos={datos}
              series={[serie]}
              formato={v => format(v, 'financial')}
              referencia={referencia.referencia}
              etiquetaReferencia={t('usual')}
              presupuesto={presupuesto}
              etiquetaPresupuesto={t('budgeted')}
              extraTooltip={p =>
                p.atipico ? (
                  <div style={{ marginTop: 4, ...styles.smallText }}>
                    {t('One-off expense')}
                  </div>
                ) : null
              }
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              paddingLeft: GUTTER,
              paddingTop: 4,
              flexWrap: 'wrap',
            }}
          >
            <Leyenda trazo="solido">
              {t('Usual: {{amount}}', {
                amount: format(referencia.referencia, 'financial'),
              })}
            </Leyenda>
            {presupuesto !== undefined && presupuesto > 0 && (
              <Leyenda trazo="discontinuo">
                {t('Budgeted: {{amount}}', {
                  amount: format(presupuesto, 'financial'),
                })}
              </Leyenda>
            )}
          </View>

          <Seccion
            titulo={t('Month by month')}
            accion={
              <Button
                variant="bare"
                onPress={() =>
                  void navigate(`/categories/${categoriaId}?month=${mesActual}`)
                }
                style={{ ...styles.smallText, color: theme.pageTextLink }}
              >
                <Trans>See transactions</Trans>
              </Button>
            }
          >
            {[...datos].reverse().map(p => (
              <FilaValor
                key={p.mes}
                nombre={
                  <Text style={{ textTransform: 'capitalize' }}>
                    {monthUtils.format(p.mes, 'MMMM yyyy', locale)}
                  </Text>
                }
                detalle={p.atipico ? t('one-off') : undefined}
                valor={format(Number(p.valor), 'financial')}
                tonoValor={p.atipico ? 'aviso' : 'neutro'}
                onPress={() =>
                  void navigate(`/categories/${categoriaId}?month=${p.mes}`)
                }
              />
            ))}
          </Seccion>
        </>
      )}

      <SelectorCategoriaModal
        abierto={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
        seleccionada={categoriaId}
        onSelect={nuevo =>
          void navigate(`/reports/categoria/${nuevo}`, { replace: true })
        }
      />
    </PaginaInforme>
  );
}

function Leyenda({
  trazo,
  children,
}: {
  trazo: 'solido' | 'discontinuo';
  children: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16,
          borderTop: `2px ${trazo === 'solido' ? 'solid' : 'dashed'} ${
            trazo === 'solido' ? theme.pageText : theme.pageTextSubdued
          }`,
        }}
      />
      <Text style={styles.smallText}>{children}</Text>
    </View>
  );
}
