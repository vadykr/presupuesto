import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowThinDown,
  SvgArrowThinUp,
  SvgCalendar,
  SvgCurrencyDollar,
  SvgExclamationOutline,
  SvgLightBulb,
  SvgPiggyBank,
  SvgQuestion,
  SvgSwap,
  SvgTarget,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import {
  Cargando,
  FilaValor,
  formatPorcentaje,
  GUTTER,
  Hero,
  PaginaInforme,
  Pildoras,
  Punto,
  Seccion,
  Tarjeta,
  Vacio,
} from '#components/mobile/informes/comunes';
import { useColoresCategorias } from '#components/mobile/informes/useColoresCategorias';
import { useCategoriasInfo } from '#components/mobile/informes/useTotalesMensuales';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { usePayeesById } from '#hooks/usePayees';

import { useAccionesAnalisis } from './acciones';
import { redactar, textoAccion, textoMotivo } from './frases';
import type { Redactor } from './frases';
import type {
  Cifras,
  Consejo,
  Gravedad,
  Propuesta,
  TipoConsejo,
} from './motor';
import { useAnalisis } from './useAnalisis';
import type { Analisis } from './useAnalisis';

type Pestana = 'consejos' | 'propuesta';

/** Un `Redactor` con el formato, la moneda y los nombres del presupuesto. */
export function useRedactor(): Redactor {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const categorias = useCategoriasInfo();
  const { data: payees = {} } = usePayeesById();
  return {
    t,
    fmt: v => format(v, 'financial'),
    pct: formatPorcentaje,
    nombreDe: id =>
      id == null
        ? t('Uncategorized')
        : (categorias.get(id)?.nombre ?? t('Unknown')),
    nombrePayee: id =>
      id == null ? t('No payee') : (payees[id]?.name ?? t('Unknown')),
    nombreMes: mes => monthUtils.format(mes, 'MMMM', locale),
  };
}

/**
 * «Consejos» (`/reports/analisis`): el análisis inteligente del punto 8 del
 * plan. Pestaña Consejos (cada uno con sus cifras y su acción) y pestaña
 * Presupuesto propuesto (actual → propuesto por grupo, «Aplicar»).
 */
export function AnalisisPage() {
  const { t } = useTranslation();
  const [pestana, setPestana] = useState<Pestana>('consejos');
  const analisis = useAnalisis();

  return (
    <PaginaInforme titulo={t('Advice')} data-testid="informe-analisis">
      <View style={{ paddingTop: 12 }}>
        <Pildoras<Pestana>
          aria-label={t('Section')}
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { valor: 'consejos', etiqueta: t('Advice') },
            { valor: 'propuesta', etiqueta: t('Proposed budget') },
          ]}
        />
      </View>
      {analisis.isLoading ? (
        <Cargando />
      ) : pestana === 'consejos' ? (
        <ListaConsejos analisis={analisis} />
      ) : (
        <PropuestaPresupuesto propuesta={analisis.propuesta} />
      )}
    </PaginaInforme>
  );
}

// ---------------------------------------------------------------------------
// Consejos
// ---------------------------------------------------------------------------

export function fraseResumenConsejos(
  t: Redactor['t'],
  n: number,
  mesesCompletos: number,
): string {
  if (mesesCompletos < 4) {
    return t('Advice starts after 4 full months of history.');
  }
  if (n === 0) {
    return t(
      'Nothing stands out this month: your budget matches what you spend.',
    );
  }
  return t('{{count}} things worth a look this month.', { count: n });
}

function ListaConsejos({ analisis }: { analisis: Analisis }) {
  const { t } = useTranslation();
  const redactor = useRedactor();
  const { visibles, descartadosLista, mesesCompletos } = analisis;
  const [verDescartados, setVerDescartados] = useState(false);

  return (
    <>
      <View
        style={{ paddingLeft: GUTTER, paddingRight: GUTTER, paddingTop: 18 }}
      >
        <Hero
          valor={visibles.length}
          frase={fraseResumenConsejos(t, visibles.length, mesesCompletos)}
          tono={
            visibles.some(c => c.gravedad === 'accion')
              ? 'aviso'
              : visibles.length === 0
                ? 'bien'
                : 'neutro'
          }
        />
      </View>
      {visibles.length === 0 && mesesCompletos >= 4 && (
        <Vacio>
          <Trans>Come back next month, or check the proposed budget.</Trans>
        </Vacio>
      )}
      {visibles.map(c => (
        <TarjetaConsejo
          key={c.id}
          consejo={c}
          redactor={redactor}
          onDescartar={() => analisis.descartar(c.id)}
        />
      ))}
      {descartadosLista.length > 0 && (
        <Seccion
          titulo={t('Dismissed this month ({{count}})', {
            count: descartadosLista.length,
          })}
          accion={
            <Button variant="bare" onPress={() => setVerDescartados(v => !v)}>
              {verDescartados ? t('Hide') : t('Show')}
            </Button>
          }
        >
          {verDescartados &&
            descartadosLista.map(c => (
              <TarjetaConsejo
                key={c.id}
                consejo={c}
                redactor={redactor}
                descartado
                onDescartar={() => analisis.restaurar(c.id)}
              />
            ))}
        </Seccion>
      )}
    </>
  );
}

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

const ICONOS: Record<TipoConsejo, Icono> = {
  infrapresupuestada: SvgExclamationOutline,
  sobrepresupuestada: SvgQuestion,
  'sin-asignar': SvgTarget,
  estacionalidad: SvgCalendar,
  tendencia: SvgArrowThinUp,
  ingresos: SvgCurrencyDollar,
  'tasa-ahorro': SvgPiggyBank,
  traspasos: SvgSwap,
};

function colorGravedad(gravedad: Gravedad): string {
  switch (gravedad) {
    case 'accion':
      return theme.warningText;
    case 'aviso':
      return theme.errorText;
    default:
      return theme.noticeText;
  }
}

export function IconoConsejo({
  consejo,
  size = 18,
}: {
  consejo: Consejo;
  size?: number;
}) {
  const Icono: Icono =
    consejo.datos.tipo === 'tendencia' && consejo.datos.sentido === 'baja'
      ? SvgArrowThinDown
      : (ICONOS[consejo.datos.tipo] ?? SvgLightBulb);
  const color = colorGravedad(consejo.gravedad);
  return (
    <View
      aria-hidden
      style={{
        width: size + 14,
        height: size + 14,
        borderRadius: (size + 14) / 2,
        backgroundColor: theme.pillBackground,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icono width={size} height={size} style={{ color }} />
    </View>
  );
}

function TarjetaConsejo({
  consejo,
  redactor,
  descartado = false,
  onDescartar,
}: {
  consejo: Consejo;
  redactor: Redactor;
  descartado?: boolean;
  onDescartar: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colorDe } = useColoresCategorias();
  const { ejecutar } = useAccionesAnalisis();
  const [verCifras, setVerCifras] = useState(false);
  const [hecha, setHecha] = useState(false);
  const { titulo, texto } = redactar(consejo, redactor);
  const etiquetaAccion = textoAccion(consejo, redactor);

  return (
    <Tarjeta
      data-testid={`consejo-${consejo.datos.tipo}`}
      style={{ opacity: descartado ? 0.6 : 1 }}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconoConsejo consejo={consejo} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...styles.mediumText, fontWeight: 600 }}>
              {titulo}
            </Text>
            {consejo.categoria && (
              <Button
                variant="bare"
                onPress={() =>
                  void navigate(`/reports/categoria/${consejo.categoria}`)
                }
                style={{
                  ...styles.smallText,
                  color: theme.pageTextSubdued,
                  padding: 0,
                  justifyContent: 'flex-start',
                  gap: 5,
                }}
              >
                <Punto color={colorDe(consejo.categoria)} size={8} />
                {redactor.nombreDe(consejo.categoria)}
              </Button>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.25 }}>
          {texto}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 2,
          }}
        >
          <Button
            variant="normal"
            onPress={() => setVerCifras(v => !v)}
            aria-expanded={verCifras}
            style={{ ...styles.smallText, minHeight: 32 }}
          >
            {verCifras ? t('Hide figures') : t('See figures')}
          </Button>
          {consejo.accion && etiquetaAccion && !descartado && (
            <Button
              variant="primary"
              isDisabled={hecha}
              onPress={async () => {
                if (consejo.accion) {
                  await ejecutar(consejo.accion);
                  setHecha(true);
                }
              }}
              style={{ ...styles.smallText, minHeight: 32 }}
            >
              {hecha ? t('Done') : etiquetaAccion}
            </Button>
          )}
          <Button
            variant="bare"
            onPress={onDescartar}
            style={{
              ...styles.smallText,
              minHeight: 32,
              color: theme.pageTextSubdued,
            }}
          >
            {descartado ? t('Restore') : t('Dismiss')}
          </Button>
        </View>
        {verCifras && (
          <TablaCifras cifras={consejo.cifras} redactor={redactor} />
        )}
      </View>
    </Tarjeta>
  );
}

const ETIQUETAS_CIFRA: Record<Cifras['columnas'][number]['clave'], string> = {
  presupuestado: 'Budgeted',
  gasto: 'Spent',
  habitual: 'Usual',
  ingresos: 'Income',
  gastos: 'Spending',
  ahorro: 'Savings',
  traspasado: 'Moved',
  tasa: 'Rate',
};

/** La tabla de meses de la que sale el consejo. */
function TablaCifras({
  cifras,
  redactor,
}: {
  cifras: Cifras;
  redactor: Redactor;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const celda = {
    ...styles.smallText,
    ...styles.tnum,
    textAlign: 'right' as const,
    flex: 1,
  };
  return (
    <View
      role="table"
      data-testid="tabla-cifras"
      style={{
        marginTop: 6,
        borderTop: `1px solid ${theme.tableBorder}`,
        paddingTop: 6,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text
          style={{
            ...styles.smallText,
            color: theme.pageTextSubdued,
            flex: 1.2,
          }}
        >
          <Trans>Month</Trans>
        </Text>
        {cifras.columnas.map(c => (
          <Text
            key={c.clave}
            style={{ ...celda, color: theme.pageTextSubdued }}
          >
            {t(ETIQUETAS_CIFRA[c.clave])}
          </Text>
        ))}
      </View>
      {cifras.filas.map(fila => (
        <View key={fila.mes} style={{ flexDirection: 'row', gap: 8 }}>
          <Text
            style={{
              ...styles.smallText,
              flex: 1.2,
              textTransform: 'capitalize',
              fontWeight: fila.cumple ? 600 : 400,
              color: fila.atipico ? theme.pageTextSubdued : theme.pageText,
            }}
          >
            {monthUtils.format(fila.mes, 'MMM yy', locale).replace('.', '')}
            {fila.atipico ? ' *' : ''}
          </Text>
          {cifras.columnas.map(c => {
            const v = fila.valores[c.clave];
            return (
              <Text
                key={c.clave}
                style={{
                  ...celda,
                  fontWeight: fila.cumple ? 600 : 400,
                  color: fila.atipico ? theme.pageTextSubdued : theme.pageText,
                }}
              >
                {v === undefined
                  ? '—'
                  : c.formato === 'porcentaje'
                    ? redactor.pct(v, false)
                    : redactor.fmt(v)}
              </Text>
            );
          })}
        </View>
      ))}
      {cifras.filas.some(f => f.atipico) && (
        <Text style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
          <Trans>* one-off expense: not counted.</Trans>
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Presupuesto propuesto
// ---------------------------------------------------------------------------

function PropuestaPresupuesto({ propuesta }: { propuesta: Propuesta }) {
  const { t } = useTranslation();
  const redactor = useRedactor();
  const categorias = useCategoriasInfo();
  const { colorDe } = useColoresCategorias();
  const { aplicarPropuesta } = useAccionesAnalisis();
  const [aplicadas, setAplicadas] = useState<number | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const cambios = propuesta.filas.filter(f => f.propuesto !== f.actual);
  const diferencia = propuesta.totalPropuesto - propuesta.totalActual;
  const margen = propuesta.ingresosHabituales - propuesta.totalPropuesto;
  const nombreMes = redactor.nombreMes(propuesta.mes);

  // Agrupado por grupo de categorías, en el orden de los cambios mayores.
  const filas = verTodas ? propuesta.filas : cambios;
  const grupos = new Map<string, typeof filas>();
  for (const f of filas) {
    const g = categorias.get(f.categoria)?.nombreGrupo ?? '';
    grupos.set(g, [...(grupos.get(g) ?? []), f]);
  }

  return (
    <View data-testid="propuesta">
      <View
        style={{ paddingLeft: GUTTER, paddingRight: GUTTER, paddingTop: 18 }}
      >
        <Hero
          etiqueta={t('Proposed for {{month}}', { month: nombreMes })}
          valor={redactor.fmt(propuesta.totalPropuesto)}
          tono={margen < 0 ? 'mal' : 'neutro'}
          frase={
            cambios.length === 0
              ? t('Your budget already matches what you usually spend.')
              : `${
                  diferencia >= 0
                    ? t('{{amount}} more than now ({{current}}).', {
                        amount: redactor.fmt(diferencia),
                        current: redactor.fmt(propuesta.totalActual),
                      })
                    : t('{{amount}} less than now ({{current}}).', {
                        amount: redactor.fmt(-diferencia),
                        current: redactor.fmt(propuesta.totalActual),
                      })
                } ${
                  propuesta.ingresosHabituales > 0
                    ? margen >= 0
                      ? t(
                          'Leaves {{amount}} of your usual income ({{income}}).',
                          {
                            amount: redactor.fmt(margen),
                            income: redactor.fmt(propuesta.ingresosHabituales),
                          },
                        )
                      : t(
                          'That is {{amount}} above your usual income ({{income}}).',
                          {
                            amount: redactor.fmt(-margen),
                            income: redactor.fmt(propuesta.ingresosHabituales),
                          },
                        )
                    : ''
                }`
          }
        />
        {cambios.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 14,
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="primary"
              isDisabled={aplicadas !== null}
              onPress={() =>
                setAplicadas(aplicarPropuesta(propuesta.mes, cambios))
              }
              data-testid="aplicar-propuesta"
            >
              {aplicadas !== null
                ? t('Applied to {{count}} categories', { count: aplicadas })
                : t('Apply to {{month}}', { month: nombreMes })}
            </Button>
            <Button variant="bare" onPress={() => setVerTodas(v => !v)}>
              {verTodas ? t('Only changes') : t('All categories')}
            </Button>
          </View>
        )}
      </View>
      {[...grupos.entries()].map(([grupo, lista]) => (
        <Seccion key={grupo} titulo={grupo}>
          {lista.map(f => (
            <FilaValor
              key={f.categoria}
              color={colorDe(f.categoria)}
              nombre={redactor.nombreDe(f.categoria)}
              detalle={`${redactor.fmt(f.actual)} → ${redactor.fmt(f.propuesto)} · ${textoMotivo(f, redactor)}`}
              valor={redactor.fmt(f.propuesto)}
              valorSecundario={
                f.propuesto === f.actual
                  ? '='
                  : `${f.propuesto > f.actual ? '+' : '−'}${redactor.fmt(Math.abs(f.propuesto - f.actual))}`
              }
              tonoValor={
                f.propuesto > f.actual
                  ? 'aviso'
                  : f.propuesto < f.actual
                    ? 'bien'
                    : 'neutro'
              }
            />
          ))}
        </Seccion>
      ))}
    </View>
  );
}
