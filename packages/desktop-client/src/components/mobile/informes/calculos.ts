import type { IntegerAmount } from '@actual-app/core/shared/util';

import { clasificarMes } from './estadisticaRobusta';
import type { Clasificacion } from './estadisticaRobusta';

/**
 * Cálculos puros de la pestaña «Informes» (móvil). Todo en céntimos enteros.
 * Un «movimiento» es la suma de las transacciones de un mes × categoría ×
 * beneficiario, con el signo original (gasto negativo, ingreso positivo).
 */

export type Movimiento = {
  mes: string; // 'yyyy-MM'
  categoria: string | null;
  payee: string | null;
  importe: IntegerAmount;
};

export type CategoriaInfo = {
  id: string;
  nombre: string;
  grupo: string | null;
  nombreGrupo: string;
  esIngreso: boolean;
  oculta: boolean;
};

export type Categorias = ReadonlyMap<string, CategoriaInfo>;

export type FilaGasto = {
  categoria: string | null;
  importe: IntegerAmount; // gasto en positivo
};

export type DesgloseGasto = {
  total: IntegerAmount; // gasto total en positivo
  filas: FilaGasto[]; // ordenadas de mayor a menor gasto
  ingresosPositivos: FilaGasto[]; // categorías de gasto con saldo neto positivo
};

function esDeIngreso(categoria: string | null, categorias: Categorias) {
  return categoria != null && (categorias.get(categoria)?.esIngreso ?? false);
}

/**
 * Gasto por categoría en un conjunto de meses. Las categorías de ingreso no
 * cuentan; las de gasto cuyo neto sale positivo (devoluciones) van aparte,
 * como «ingresos positivos», para que la barra apilada no se descuadre.
 */
export function gastoPorCategoria(
  movimientos: readonly Movimiento[],
  meses: readonly string[],
  categorias: Categorias,
): DesgloseGasto {
  const conjunto = new Set(meses);
  const neto = new Map<string | null, IntegerAmount>();
  for (const m of movimientos) {
    if (!conjunto.has(m.mes) || esDeIngreso(m.categoria, categorias)) {
      continue;
    }
    neto.set(m.categoria, (neto.get(m.categoria) ?? 0) + m.importe);
  }

  const filas: FilaGasto[] = [];
  const ingresosPositivos: FilaGasto[] = [];
  let total = 0;
  for (const [categoria, importe] of neto) {
    if (importe < 0) {
      filas.push({ categoria, importe: -importe });
      total += -importe;
    } else if (importe > 0) {
      ingresosPositivos.push({ categoria, importe });
    }
  }
  filas.sort((a, b) => b.importe - a.importe);
  ingresosPositivos.sort((a, b) => b.importe - a.importe);
  return { total, filas, ingresosPositivos };
}

export type MesIngresosGastos = {
  mes: string;
  ingresos: IntegerAmount; // positivo
  gastos: IntegerAmount; // positivo (neto de las categorías de gasto)
  ahorro: IntegerAmount; // ingresos − gastos
  tasa: number | null; // (ingresos − gastos) / ingresos, en fracción
};

/** Tasa de ahorro = (ingresos − gastos) / ingresos. Sin ingresos no hay tasa. */
export function tasaDeAhorro(
  ingresos: IntegerAmount,
  gastos: IntegerAmount,
): number | null {
  if (ingresos <= 0) {
    return null;
  }
  return (ingresos - gastos) / ingresos;
}

export function ingresosGastosPorMes(
  movimientos: readonly Movimiento[],
  meses: readonly string[],
  categorias: Categorias,
): MesIngresosGastos[] {
  const porMes = new Map<string, { ingresos: number; gastos: number }>();
  for (const mes of meses) {
    porMes.set(mes, { ingresos: 0, gastos: 0 });
  }
  for (const m of movimientos) {
    const acumulado = porMes.get(m.mes);
    if (!acumulado) {
      continue;
    }
    if (esDeIngreso(m.categoria, categorias)) {
      acumulado.ingresos += m.importe;
    } else {
      acumulado.gastos -= m.importe;
    }
  }
  return meses.map(mes => {
    const { ingresos, gastos } = porMes.get(mes) ?? { ingresos: 0, gastos: 0 };
    return {
      mes,
      ingresos,
      gastos,
      ahorro: ingresos - gastos,
      tasa: tasaDeAhorro(ingresos, gastos),
    };
  });
}

/**
 * Importe de una categoría mes a mes, alineado con `meses`. Para categorías
 * de gasto devuelve el gasto en positivo; para las de ingreso, el ingreso.
 */
export function evolucionCategoria(
  movimientos: readonly Movimiento[],
  categoria: string | null,
  meses: readonly string[],
  esIngreso = false,
): IntegerAmount[] {
  const porMes = new Map<string, number>();
  for (const m of movimientos) {
    if (m.categoria !== categoria) {
      continue;
    }
    porMes.set(m.mes, (porMes.get(m.mes) ?? 0) + m.importe);
  }
  return meses.map(mes => {
    const neto = porMes.get(mes) ?? 0;
    // `0 - 0` daría -0 y se formatearía como «-0,00».
    return neto === 0 ? 0 : esIngreso ? neto : -neto;
  });
}

/** Media aritmética; 0 si no hay valores. Redondeada al céntimo. */
export function media(valores: readonly number[]): number {
  if (valores.length === 0) {
    return 0;
  }
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/**
 * Desviación de un valor frente a su media, en fracción (0,25 = un 25 % por
 * encima). `null` cuando no hay media con la que comparar.
 */
export function desviacionPct(valor: number, mediaRef: number): number | null {
  if (mediaRef === 0) {
    return null;
  }
  return (valor - mediaRef) / Math.abs(mediaRef);
}

export type FilaRanking = {
  categoria: string;
  actual: IntegerAmount; // gasto del mes, en positivo
  /** Lo habitual: mediana de los meses previos sin atípicos. */
  referencia: IntegerAmount;
  desviacion: IntegerAmount; // actual − referencia (positivo = sube)
  desviacionPct: number | null;
  /** sube/baja (se repite), puntual (gasto puntual) o normal. */
  tipo: Clasificacion;
};

/**
 * Qué sube y qué baja: para cada categoría de gasto, el gasto del mes frente a
 * lo habitual de los meses previos (mediana robusta; los meses atípicos no
 * cuentan). Solo entran categorías con referencia ≥ `minimoReferencia`.
 * Ordenado por desviación en € de mayor subida a mayor bajada. Los gastos
 * puntuales (`tipo: 'puntual'`) se listan aparte, no como tendencia.
 */
export function rankingSubeBaja(
  movimientos: readonly Movimiento[],
  mes: string,
  mesesPrevios: readonly string[],
  categorias: Categorias,
  minimoReferencia: IntegerAmount = 1000,
): FilaRanking[] {
  if (mesesPrevios.length === 0) {
    return [];
  }
  const indicePrevio = new Map(mesesPrevios.map((m, i) => [m, i] as const));
  const actual = new Map<string, number>();
  const previos = new Map<string, number[]>();
  for (const m of movimientos) {
    if (m.categoria == null || esDeIngreso(m.categoria, categorias)) {
      continue;
    }
    if (m.mes === mes) {
      actual.set(m.categoria, (actual.get(m.categoria) ?? 0) - m.importe);
      continue;
    }
    const i = indicePrevio.get(m.mes);
    if (i === undefined) {
      continue;
    }
    let serie = previos.get(m.categoria);
    if (!serie) {
      serie = mesesPrevios.map(() => 0);
      previos.set(m.categoria, serie);
    }
    serie[i] -= m.importe;
  }

  const filas: FilaRanking[] = [];
  for (const [categoria, serie] of previos) {
    const gastoActual = actual.get(categoria) ?? 0;
    const { tipo, referencia } = clasificarMes(gastoActual, serie);
    if (referencia.referencia < minimoReferencia) {
      continue;
    }
    filas.push({
      categoria,
      actual: gastoActual,
      referencia: referencia.referencia,
      desviacion: gastoActual - referencia.referencia,
      desviacionPct: desviacionPct(gastoActual, referencia.referencia),
      tipo,
    });
  }
  filas.sort((a, b) => b.desviacion - a.desviacion);
  return filas;
}

export type FilaNomina = {
  payee: string | null;
  porMes: IntegerAmount[]; // alineado con `meses`
  total: IntegerAmount;
};

/**
 * Ingresos (categorías de ingreso) por beneficiario y mes. Ordenado por total.
 */
export function nominasPorPayee(
  movimientos: readonly Movimiento[],
  meses: readonly string[],
  categorias: Categorias,
): FilaNomina[] {
  const indice = new Map(meses.map((mes, i) => [mes, i] as const));
  const porPayee = new Map<string | null, IntegerAmount[]>();
  for (const m of movimientos) {
    const i = indice.get(m.mes);
    if (i === undefined || !esDeIngreso(m.categoria, categorias)) {
      continue;
    }
    let fila = porPayee.get(m.payee);
    if (!fila) {
      fila = meses.map(() => 0);
      porPayee.set(m.payee, fila);
    }
    fila[i] += m.importe;
  }
  const filas: FilaNomina[] = [];
  for (const [payee, porMes] of porPayee) {
    const total = porMes.reduce((a, b) => a + b, 0);
    if (total !== 0) {
      filas.push({ payee, porMes, total });
    }
  }
  filas.sort((a, b) => b.total - a.total);
  return filas;
}

/** Variación de un valor frente al anterior, en fracción; null sin referencia. */
export function variacion(actual: number, anterior: number): number | null {
  return desviacionPct(actual, anterior);
}
