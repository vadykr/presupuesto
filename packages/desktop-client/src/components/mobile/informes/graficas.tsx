import type { ReactNode } from 'react';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LabelProps, TooltipContentProps } from 'recharts';

import { useRechartsAnimation } from '#components/reports/chart-theme';
import { Container } from '#components/reports/Container';

/**
 * Gráficas de «Informes» (recharts), pensadas para 358 px de ancho útil:
 * marcas finas, ejes mínimos, rejilla de hairline sólida, tooltip táctil.
 * La lista bajo la gráfica hace de leyenda; aquí solo etiquetamos el extremo.
 */

export type Formato = (centimos: number) => string;

export type PuntoMes = {
  mes: string;
  etiqueta: string;
  /** Mes atípico (gasto puntual): barra hueca. */
  atipico?: boolean;
  [serie: string]: number | string | boolean | undefined;
};

export type Serie = { clave: string; color: string; nombre: string };

const TICK = { fontSize: 11, fill: theme.pageTextSubdued };

/** Eje Y compacto: «1,2k» para miles, enteros por debajo. */
export function formatoEje(centimos: number): string {
  const euros = centimos / 100;
  if (Math.abs(euros) >= 1000) {
    const miles = euros / 1000;
    return `${(Math.round(miles * 10) / 10).toLocaleString('es-ES')}k`;
  }
  return Math.round(euros).toLocaleString('es-ES');
}

/** Intervalo de etiquetas del eje X para que no se pisen. */
function intervaloEjeX(n: number): number {
  if (n <= 7) return 0;
  if (n <= 13) return 1;
  return Math.ceil(n / 7) - 1;
}

function esPuntoMes(x: unknown): x is PuntoMes {
  return (
    typeof x === 'object' &&
    x !== null &&
    'mes' in x &&
    typeof (x as { mes: unknown }).mes === 'string'
  );
}

/** El punto de datos bajo el puntero, si el tooltip está activo. */
function puntoActivo(props: TooltipContentProps): PuntoMes | null {
  if (!props.active || props.payload.length === 0) {
    return null;
  }
  const candidato: unknown = props.payload[0].payload;
  return esPuntoMes(candidato) ? candidato : null;
}

function TooltipInforme({
  punto,
  series,
  formato,
  extra,
}: {
  punto: PuntoMes | null;
  series: Serie[];
  formato: Formato;
  extra?: (punto: PuntoMes) => ReactNode;
}) {
  if (!punto) {
    return null;
  }
  return (
    <div
      className={css({
        zIndex: 1000,
        pointerEvents: 'none',
        borderRadius: 6,
        boxShadow: '0 1px 6px rgba(0, 0, 0, .2)',
        backgroundColor: theme.menuBackground,
        color: theme.menuItemText,
        padding: '8px 10px',
        fontSize: 13,
        minWidth: 120,
      })}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 4,
          textTransform: 'capitalize',
        }}
      >
        {punto.etiqueta}
      </div>
      {series.map(s => (
        <div
          key={s.clave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'space-between',
            lineHeight: 1.6,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 2,
                backgroundColor: s.color,
                display: 'inline-block',
              }}
            />
            <span style={{ color: theme.pageTextSubdued }}>{s.nombre}</span>
          </span>
          <strong style={styles.tnum}>
            {formato(Number(punto[s.clave] ?? 0))}
          </strong>
        </div>
      ))}
      {extra?.(punto)}
    </div>
  );
}

/** Etiqueta directa solo sobre la última barra (el mes actual). */
function etiquetaUltima(total: number, formato: Formato) {
  return function Etiqueta({ x, y, width, value, index }: LabelProps) {
    if (index !== total - 1 || typeof value !== 'number' || value === 0) {
      return <g />;
    }
    const cx = Number(x) + Number(width) / 2;
    return (
      <text
        x={cx}
        y={Number(y) - 6}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={theme.pageText}
      >
        {formato(value)}
      </text>
    );
  };
}

type BarrasMensualesProps = {
  datos: PuntoMes[];
  series: Serie[];
  formato: Formato;
  alto?: number;
  /** Línea sólida: lo habitual (mediana robusta). */
  referencia?: number;
  etiquetaReferencia?: string;
  /** Línea discontinua: lo presupuestado (objetivo). */
  presupuesto?: number;
  etiquetaPresupuesto?: string;
  extraTooltip?: (punto: PuntoMes) => ReactNode;
  onPressMes?: (mes: string) => void;
};

export function BarrasMensuales({
  datos,
  series,
  formato,
  alto = 190,
  referencia,
  etiquetaReferencia,
  presupuesto,
  etiquetaPresupuesto,
  extraTooltip,
  onPressMes,
}: BarrasMensualesProps) {
  const animacion = useRechartsAnimation();
  const n = datos.length;
  return (
    <Container style={{ height: alto }}>
      {(width, height) => (
        <BarChart
          width={width}
          height={height}
          data={datos}
          margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="22%"
          barGap={2}
          onClick={estado => {
            const indice = Number(estado?.activeIndex);
            const punto = Number.isInteger(indice) ? datos[indice] : undefined;
            if (punto && onPressMes) {
              onPressMes(punto.mes);
            }
          }}
        >
          <CartesianGrid vertical={false} stroke={theme.tableBorder} />
          <XAxis
            dataKey="etiqueta"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: theme.tableBorder }}
            interval={intervaloEjeX(n)}
            height={20}
          />
          <YAxis
            width={38}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tickFormatter={formatoEje}
          />
          <Tooltip
            cursor={{ fill: theme.tableRowBackgroundHover, opacity: 0.6 }}
            content={props => (
              <TooltipInforme
                punto={puntoActivo(props)}
                series={series}
                formato={formato}
                extra={extraTooltip}
              />
            )}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 1000 }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              {...animacion}
            >
              {i === 0 &&
                datos.map(p => (
                  <Cell
                    key={p.mes}
                    fill={p.atipico ? 'transparent' : s.color}
                    stroke={p.atipico ? s.color : undefined}
                    strokeWidth={p.atipico ? 2 : 0}
                  />
                ))}
              {i === series.length - 1 && (
                <LabelList
                  dataKey={series[0].clave}
                  content={etiquetaUltima(n, formato)}
                />
              )}
            </Bar>
          ))}
          {referencia !== undefined && referencia > 0 && (
            <ReferenceLine
              y={referencia}
              stroke={theme.pageText}
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={
                etiquetaReferencia
                  ? {
                      value: etiquetaReferencia,
                      position: 'insideBottomLeft',
                      fontSize: 10,
                      fill: theme.pageText,
                    }
                  : undefined
              }
            />
          )}
          {presupuesto !== undefined && presupuesto > 0 && (
            <ReferenceLine
              y={presupuesto}
              stroke={theme.pageTextSubdued}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              ifOverflow="extendDomain"
              label={
                etiquetaPresupuesto
                  ? {
                      value: etiquetaPresupuesto,
                      position: 'insideTopLeft',
                      fontSize: 10,
                      fill: theme.pageTextSubdued,
                    }
                  : undefined
              }
            />
          )}
        </BarChart>
      )}
    </Container>
  );
}

type PuntoDot = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: unknown;
};

type LineaMensualProps = {
  datos: PuntoMes[];
  serie: Serie;
  formato: Formato;
  alto?: number;
};

/** Línea de 2 px con lavado al 10 %, punto final con anillo y etiqueta. */
export function LineaMensual({
  datos,
  serie,
  formato,
  alto = 190,
}: LineaMensualProps) {
  const animacion = useRechartsAnimation();
  const n = datos.length;
  const gradientId = `informes-area-${serie.clave}`;
  return (
    <Container style={{ height: alto }}>
      {(width, height) => (
        <AreaChart
          width={width}
          height={height}
          data={datos}
          margin={{ top: 18, right: 52, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={serie.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={serie.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.tableBorder} />
          <XAxis
            dataKey="etiqueta"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: theme.tableBorder }}
            interval={intervaloEjeX(n)}
            height={20}
          />
          <YAxis
            width={38}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tickFormatter={formatoEje}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: theme.pageTextSubdued, strokeWidth: 1 }}
            content={props => (
              <TooltipInforme
                punto={puntoActivo(props)}
                series={[serie]}
                formato={formato}
              />
            )}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 1000 }}
          />
          <ReferenceLine y={0} stroke={theme.tableBorderSeparator} />
          <Area
            type="monotone"
            dataKey={serie.clave}
            name={serie.nombre}
            stroke={serie.color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{
              r: 5,
              stroke: theme.cardBackground,
              strokeWidth: 2,
              fill: serie.color,
            }}
            dot={(p: PuntoDot) => {
              if (
                p.index !== n - 1 ||
                p.cx === undefined ||
                p.cy === undefined
              ) {
                return <g key={p.index} />;
              }
              return (
                <g key={p.index}>
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={5}
                    fill={serie.color}
                    stroke={theme.cardBackground}
                    strokeWidth={2}
                  />
                  <text
                    x={p.cx + 8}
                    y={p.cy + 4}
                    fontSize={11}
                    fontWeight={600}
                    fill={theme.pageText}
                  >
                    {formatoEje(
                      esPuntoMes(p.payload)
                        ? Number(p.payload[serie.clave] ?? 0)
                        : 0,
                    )}
                  </text>
                </g>
              );
            }}
            {...animacion}
          />
        </AreaChart>
      )}
    </Container>
  );
}
