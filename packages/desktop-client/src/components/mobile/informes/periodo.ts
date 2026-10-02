import * as monthUtils from '@actual-app/core/shared/months';

/**
 * Periodo de un informe. Se guarda en la preferencia sincronizada
 * `informes-periodo` como texto: `mes` (el mes en curso, se mueve solo),
 * `mes:2026-09` (un mes concreto), `3` / `6` / `12` (últimos N meses, el
 * actual incluido), `ano` (año en curso), `ano-pasado` o `todo`.
 */
export type Periodo =
  | { tipo: 'mes'; mes: string | null }
  | { tipo: 'ultimos'; meses: 3 | 6 | 12 }
  | { tipo: 'ano' }
  | { tipo: 'ano-pasado' }
  | { tipo: 'todo' };

export type ClavePeriodo =
  | 'mes'
  | '3'
  | '6'
  | '12'
  | 'ano'
  | 'ano-pasado'
  | 'todo';

export const PERIODO_POR_DEFECTO: Periodo = { tipo: 'mes', mes: null };

export function parsePeriodo(raw: string | undefined | null): Periodo {
  if (!raw) {
    return PERIODO_POR_DEFECTO;
  }
  if (raw === 'mes') {
    return PERIODO_POR_DEFECTO;
  }
  const mes = /^mes:(\d{4}-\d{2})$/.exec(raw);
  if (mes) {
    return { tipo: 'mes', mes: mes[1] };
  }
  if (raw === '3' || raw === '6' || raw === '12') {
    return { tipo: 'ultimos', meses: Number(raw) as 3 | 6 | 12 };
  }
  if (raw === 'ano' || raw === 'ano-pasado' || raw === 'todo') {
    return { tipo: raw };
  }
  return PERIODO_POR_DEFECTO;
}

export function serializarPeriodo(
  periodo: Periodo,
  actual = monthUtils.currentMonth(),
): string {
  switch (periodo.tipo) {
    case 'mes':
      return periodo.mes == null || periodo.mes === actual
        ? 'mes'
        : `mes:${periodo.mes}`;
    case 'ultimos':
      return String(periodo.meses);
    default:
      return periodo.tipo;
  }
}

export function clavePeriodo(periodo: Periodo): ClavePeriodo {
  switch (periodo.tipo) {
    case 'mes':
      return 'mes';
    case 'ultimos':
      return String(periodo.meses) as ClavePeriodo;
    default:
      return periodo.tipo;
  }
}

/**
 * Meses que cubre el periodo para `useTotalesMensuales`: `meses` acabando en
 * `hasta`. `primerMes` es el primer mes con movimientos (para «Todo»).
 */
export function rangoDePeriodo(
  periodo: Periodo,
  primerMes: string | null,
  actual = monthUtils.currentMonth(),
): { meses: number; hasta: string } {
  const anio = Number(actual.slice(0, 4));
  switch (periodo.tipo) {
    case 'mes':
      return { meses: 1, hasta: periodo.mes ?? actual };
    case 'ultimos':
      return { meses: periodo.meses, hasta: actual };
    case 'ano':
      return { meses: Number(actual.slice(5, 7)), hasta: actual };
    case 'ano-pasado':
      return { meses: 12, hasta: `${anio - 1}-12` };
    case 'todo': {
      const desde = primerMes && primerMes < actual ? primerMes : actual;
      return {
        meses: monthUtils.rangeInclusive(desde, actual).length,
        hasta: actual,
      };
    }
    default:
      return { meses: 1, hasta: actual };
  }
}
