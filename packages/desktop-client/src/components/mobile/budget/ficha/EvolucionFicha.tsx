import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { formatoEje } from '#components/mobile/informes/graficas';
import {
  color,
  colorCategoria,
  movimiento,
  num,
  radio,
  suave,
  TACTIL,
} from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';

import { mesesFuertes, pasoEje } from './fichaCalculos';

export type VistaEvolucion = 'gasto' | 'saldo' | 'meses';

const COLOR_GASTO = colorCategoria(0);
const ALTO = 150;
const IZQ = 34;
const ABAJO = 20;
const ARRIBA = 16;
const ETIQUETA = { fontSize: 11, fontWeight: 600 } as const;

/** Ancho real del contenedor, para dibujar el SVG sin escalar el texto. */
function useAncho() {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const medir = () => setAncho(el.clientWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, ancho };
}

function mesCorto(
  mes: string,
  locale: Parameters<typeof monthUtils.format>[2],
) {
  return monthUtils.format(mes, 'MMM', locale).replace('.', '');
}

function Leyenda({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 14,
        rowGap: 4,
        marginTop: 8,
      }}
    >
      {children}
    </View>
  );
}

function ItemLeyenda({
  marca,
  children,
}: {
  marca: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {marca}
      <Text style={{ fontSize: 12, fontWeight: 600, color: color.fg2, ...num }}>
        {children}
      </Text>
    </View>
  );
}

const cuadro = (fondo: string) => (
  <View
    style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: fondo }}
  />
);
const raya = (trazo: string, discontinua = false) => (
  <svg width={16} height={6} aria-hidden>
    <line
      x1={0}
      y1={3}
      x2={16}
      y2={3}
      stroke={trazo}
      strokeWidth={2}
      strokeDasharray={discontinua ? '4 3' : undefined}
    />
  </svg>
);

/** Ejes horizontales con sus marcas (0, paso, 2·paso…). */
function Rejilla({
  ancho,
  maximo,
  y,
}: {
  ancho: number;
  maximo: number;
  y: (v: number) => number;
}) {
  const paso = pasoEje(maximo);
  const marcas: number[] = [];
  for (let v = 0; v <= maximo + 1; v += paso) {
    marcas.push(v);
  }
  return (
    <g>
      {marcas.map(v => (
        <g key={v}>
          <line
            x1={IZQ}
            x2={ancho}
            y1={y(v)}
            y2={y(v)}
            stroke={color.line}
            strokeWidth={1}
          />
          <text
            x={IZQ - 6}
            y={y(v) + 4}
            textAnchor="end"
            fill={color.fg3}
            style={ETIQUETA}
          >
            {formatoEje(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** A · Gasto mensual: barras, línea de lo asignado y banda de lo habitual. */
export function GraficoGasto({
  meses,
  gasto,
  asignado,
  banda,
}: {
  meses: readonly string[];
  gasto: readonly IntegerAmount[];
  asignado: readonly IntegerAmount[];
  banda: { min: number; max: number };
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { ref, ancho } = useAncho();
  const maximo = Math.max(1000, ...gasto, ...asignado, banda.max) * 1.12;
  const paso = pasoEje(maximo);
  const tope = Math.ceil(maximo / paso) * paso;
  const y = (v: number) => ARRIBA + (ALTO - ARRIBA - ABAJO) * (1 - v / tope);
  const anchoUtil = Math.max(0, ancho - IZQ);
  const col = anchoUtil / Math.max(1, meses.length);
  const barra = Math.min(22, col * 0.6);
  const x = (i: number) => IZQ + col * i + col / 2;
  const ultimoAsignado = asignado[asignado.length - 1] ?? 0;
  const pasos = asignado
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${IZQ + col * i} ${y(v)}H${IZQ + col * (i + 1)}`,
    )
    .join('');

  return (
    <View>
      <div
        ref={ref}
        style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}
        data-testid="grafico-gasto"
      >
        {ancho > 0 && (
          <PrivacyFilter>
            <svg width={ancho} height={ALTO} role="img" aria-label={t('Spend')}>
              <Rejilla ancho={ancho} maximo={tope} y={y} />
              {banda.max > 0 && (
                <rect
                  x={IZQ}
                  width={anchoUtil}
                  y={y(banda.max)}
                  height={Math.max(1, y(banda.min) - y(banda.max))}
                  fill={color.surface3}
                  opacity={0.6}
                />
              )}
              {gasto.map((v, i) => {
                const alto = Math.max(v > 0 ? 2 : 3, y(0) - y(Math.max(0, v)));
                return (
                  <g key={meses[i]}>
                    <rect
                      x={x(i) - barra / 2}
                      y={y(0) - alto}
                      width={barra}
                      height={alto}
                      rx={3}
                      fill={v > 0 ? COLOR_GASTO : color.surface3}
                    />
                    {v > banda.max && v > 0 && (
                      <text
                        x={x(i)}
                        y={y(v) - 4}
                        textAnchor="middle"
                        fill={color.fg2}
                        style={{ ...ETIQUETA, fontWeight: 800 }}
                      >
                        {formatoEje(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              {asignado.some(v => v !== 0) && (
                <>
                  <path
                    d={pasos}
                    fill="none"
                    stroke={color.accent}
                    strokeWidth={2}
                  />
                  <text
                    x={ancho - 2}
                    y={y(ultimoAsignado) - 5}
                    textAnchor="end"
                    fill={color.accent}
                    style={{ ...ETIQUETA, fontWeight: 800 }}
                  >
                    {formatoEje(ultimoAsignado)}
                  </text>
                </>
              )}
              {meses.map((mes, i) => (
                <text
                  key={mes}
                  x={x(i)}
                  y={ALTO - 4}
                  textAnchor="middle"
                  fill={color.fg3}
                  style={ETIQUETA}
                >
                  {mesCorto(mes, locale).slice(0, 3)}
                </text>
              ))}
            </svg>
          </PrivacyFilter>
        )}
      </div>
      <Leyenda>
        <ItemLeyenda marca={cuadro(COLOR_GASTO)}>
          <Trans>Spend</Trans>
        </ItemLeyenda>
        <ItemLeyenda marca={raya(color.accent)}>
          <Trans>Assigned</Trans>
        </ItemLeyenda>
        <ItemLeyenda marca={cuadro(color.surface3)}>
          {t('Usual {{from}}–{{to}}', {
            from: format(banda.min, 'financial-no-decimals'),
            to: format(banda.max, 'financial-no-decimals'),
          })}
        </ItemLeyenda>
      </Leyenda>
    </View>
  );
}

/**
 * B · Saldo hacia la meta: saldo real al final de cada mes, proyección
 * punteada a la cuota hasta la fecha y la meta como línea horizontal.
 */
export function GraficoSaldo({
  meses,
  saldo,
  meta,
}: {
  meses: readonly string[];
  saldo: readonly IntegerAmount[];
  meta: { importe: IntegerAmount; mes: string } | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const { ref, ancho } = useAncho();
  const hoy = meses[meses.length - 1];
  const fin = meta && meta.mes > hoy ? meta.mes : hoy;
  const total = monthUtils.differenceInCalendarMonths(fin, meses[0]) + 1;
  const maximo = Math.max(1000, ...saldo, meta?.importe ?? 0) * 1.1;
  const minimo = Math.min(0, ...saldo);
  const paso = pasoEje(maximo);
  const tope = Math.ceil(maximo / paso) * paso;
  const y = (v: number) =>
    ARRIBA + (ALTO - ARRIBA - ABAJO) * (1 - (v - minimo) / (tope - minimo));
  const anchoUtil = Math.max(0, ancho - IZQ - 10);
  const x = (i: number) => IZQ + (anchoUtil * i) / Math.max(1, total - 1);
  const iHoy = meses.length - 1;
  const saldoHoy = saldo[iHoy] ?? 0;
  const linea = saldo
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(v)}`)
    .join('');
  const area = `${linea}L${x(iHoy)} ${y(Math.max(0, minimo))}L${x(0)} ${y(Math.max(0, minimo))}Z`;
  const etiquetas = [0, iHoy, ...(total - 1 > iHoy ? [total - 1] : [])];

  return (
    <View>
      <div
        ref={ref}
        style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}
        data-testid="grafico-saldo"
      >
        {ancho > 0 && (
          <PrivacyFilter>
            <svg
              width={ancho}
              height={ALTO}
              role="img"
              aria-label={t('Balance')}
            >
              <Rejilla ancho={ancho} maximo={tope} y={y} />
              {meta && (
                <line
                  x1={IZQ}
                  x2={ancho}
                  y1={y(meta.importe)}
                  y2={y(meta.importe)}
                  stroke={color.fg3}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              )}
              <line
                x1={x(iHoy)}
                x2={x(iHoy)}
                y1={ARRIBA - 6}
                y2={y(minimo)}
                stroke={color.line2}
                strokeWidth={1}
              />
              <path d={area} fill={suave(color.accent, 14)} />
              <path
                d={linea}
                fill="none"
                stroke={color.accent}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {meta && meta.mes > hoy && (
                <>
                  <line
                    x1={x(iHoy)}
                    y1={y(saldoHoy)}
                    x2={x(total - 1)}
                    y2={y(meta.importe)}
                    stroke={color.accent}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <circle
                    cx={x(total - 1)}
                    cy={y(meta.importe)}
                    r={4.5}
                    fill={color.surface}
                    stroke={color.accent}
                    strokeWidth={2}
                  />
                </>
              )}
              <circle cx={x(iHoy)} cy={y(saldoHoy)} r={4} fill={color.accent} />
              {etiquetas.map(i => {
                const mes = monthUtils.addMonths(meses[0], i);
                return (
                  <text
                    key={i}
                    x={x(i)}
                    y={ALTO - 4}
                    textAnchor={
                      i === 0
                        ? 'start'
                        : i === iHoy && i !== total - 1
                          ? 'middle'
                          : 'end'
                    }
                    fill={i === iHoy ? color.fg2 : color.fg3}
                    style={ETIQUETA}
                  >
                    {monthUtils
                      .format(mes, "MMM ''yy", locale)
                      .replace('.', '')}
                  </text>
                );
              })}
            </svg>
          </PrivacyFilter>
        )}
      </div>
      <Leyenda>
        <ItemLeyenda marca={raya(color.accent)}>
          {t('Balance {{amount}}', { amount: format(saldoHoy, 'financial') })}
        </ItemLeyenda>
        {meta && meta.mes > hoy && (
          <ItemLeyenda marca={raya(color.accent, true)}>
            <Trans>Projection</Trans>
          </ItemLeyenda>
        )}
        {meta && (
          <ItemLeyenda marca={raya(color.fg3, true)}>
            {t('Goal {{amount}}', {
              amount: format(meta.importe, 'financial-no-decimals'),
            })}
          </ItemLeyenda>
        )}
      </Leyenda>
    </View>
  );
}

/** C · Mapa de estacionalidad: 12 meses × años (filas). */
export function MapaMeses({
  filas,
  valores,
}: {
  filas: readonly (readonly string[])[];
  valores: readonly (readonly IntegerAmount[])[];
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const maximo = Math.max(0, ...valores.flat());
  const fuertes = mesesFuertes(valores);
  const ultima = filas[filas.length - 1] ?? [];
  const etiquetaFila = (fila: readonly string[]) =>
    `${fila[0].slice(2, 4)}-${fila[11].slice(2, 4)}`;

  return (
    <View data-testid="grafico-meses">
      <PrivacyFilter>
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: '38px repeat(12, minmax(0, 1fr))',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <View />
          {ultima.map(mes => (
            <Text
              key={mes}
              style={{ ...ETIQUETA, color: color.fg3, textAlign: 'center' }}
            >
              {mesCorto(mes, locale).slice(0, 3)}
            </Text>
          ))}
          {filas.map((fila, f) => (
            <View key={fila[0]} style={{ display: 'contents' }}>
              <Text style={{ ...ETIQUETA, color: color.fg2, ...num }}>
                {etiquetaFila(fila)}
              </Text>
              {fila.map((mes, i) => {
                const v = Math.max(0, valores[f]?.[i] ?? 0);
                const nivel = maximo > 0 ? v / maximo : 0;
                const fuerte = nivel >= 0.6;
                return (
                  <View
                    key={mes}
                    title={`${monthUtils.format(mes, 'MMMM yyyy', locale)}: ${format(v, 'financial')}`}
                    style={{
                      height: 30,
                      borderRadius: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        v > 0
                          ? suave(COLOR_GASTO, Math.round(22 + 78 * nivel))
                          : color.surface2,
                    }}
                  >
                    {fuerte && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: color.surface,
                          letterSpacing: '-0.03em',
                          ...num,
                        }}
                      >
                        {formatoEje(v)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </PrivacyFilter>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontSize: 12, color: color.fg3, ...num }}>
            {format(0, 'financial-no-decimals')}
          </Text>
          {[22, 45, 70, 100].map(p => (
            <View key={p}>{cuadro(suave(COLOR_GASTO, p))}</View>
          ))}
          <Text style={{ fontSize: 12, color: color.fg3, ...num }}>
            <PrivacyFilter>
              {format(maximo, 'financial-no-decimals')}
            </PrivacyFilter>
          </Text>
        </View>
        {fuertes && fuertes.parte >= 0.5 && (
          <Text style={{ fontSize: 12, fontWeight: 700, color: color.fg2 }}>
            {t('{{months}}: {{percent}} of the year', {
              months: fuertes.columnas
                .slice()
                .sort((a, b) => a - b)
                .map(c => mesCorto(ultima[c], locale).slice(0, 3))
                .join(' + '),
              percent: `${Math.round(fuertes.parte * 100)} %`,
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Chips «Gasto · Saldo · Meses» de la tarjeta «Evolución». */
export function ChipsEvolucion({
  vista,
  onChange,
}: {
  vista: VistaEvolucion;
  onChange: (vista: VistaEvolucion) => void;
}) {
  const { t } = useTranslation();
  const opciones: [VistaEvolucion, string][] = [
    ['gasto', t('Spend')],
    ['saldo', t('Balance')],
    ['meses', t('Months')],
  ];
  return (
    <View role="group" style={{ flexDirection: 'row', gap: 4 }}>
      {opciones.map(([valor, texto]) => {
        const activa = valor === vista;
        return (
          <Button
            key={valor}
            variant="bare"
            aria-pressed={activa}
            onPress={() => onChange(valor)}
            data-testid={`evolucion-${valor}`}
            style={{
              minHeight: TACTIL,
              padding: '0 2px',
              backgroundColor: 'transparent',
            }}
          >
            <Text
              style={{
                padding: '5px 10px',
                borderRadius: radio.pildora,
                fontSize: 13,
                fontWeight: 700,
                color: activa ? color.surface : color.fg2,
                backgroundColor: activa ? color.fg : color.surface2,
                transition: `background-color ${movimiento.pildora}ms`,
              }}
            >
              {texto}
            </Text>
          </Button>
        );
      })}
    </View>
  );
}
