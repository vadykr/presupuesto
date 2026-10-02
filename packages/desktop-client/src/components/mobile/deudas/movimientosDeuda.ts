// Lectura de los movimientos de una cuenta de préstamo: saldo inicial,
// pagado, y reparto de cada letra en interés y capital. Funciones puras;
// importes en céntimos. En la cuenta del préstamo (deuda negativa) las letras
// entran como importes positivos y los intereses devengados como negativos.

import { PAYEE_INTERESES } from '@actual-app/core/shared/prestamos';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';

export type MovimientoDeuda = {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  amount: number;
  payee: string | null;
};

const RE_SALDO_INICIAL = /starting balance|saldo (inicial|de apertura)/i;

export function esInteres(m: MovimientoDeuda): boolean {
  return m.payee === PAYEE_INTERESES;
}

/** Letra (pago) = entrada positiva que no es un ajuste de interés. */
export function esPago(m: MovimientoDeuda): boolean {
  return m.amount > 0 && !esInteres(m);
}

function ordenados(movs: readonly MovimientoDeuda[]): MovimientoDeuda[] {
  return [...movs].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Deuda inicial (positiva). Orden: campo `saldo_inicial` de la nota; el
 * movimiento «Starting Balance»; el máximo de deuda de todo el historial.
 */
export function saldoInicial(
  movs: readonly MovimientoDeuda[],
  datos: Pick<DatosPrestamo, 'saldo_inicial'> | null,
): number {
  if (datos?.saldo_inicial && datos.saldo_inicial > 0) {
    return Math.round(datos.saldo_inicial * 100);
  }
  const orden = ordenados(movs);
  const apertura = orden.find(
    m => m.payee && RE_SALDO_INICIAL.test(m.payee) && m.amount < 0,
  );
  if (apertura) {
    return -apertura.amount;
  }
  let acumulado = 0;
  let maxDeuda = 0;
  for (const m of orden) {
    acumulado += m.amount;
    maxDeuda = Math.max(maxDeuda, -acumulado);
  }
  return maxDeuda;
}

/** Suma de letras del mes `YYYY-MM`. */
export function pagadoEnMes(
  movs: readonly MovimientoDeuda[],
  mes: string,
): number {
  return movs
    .filter(m => esPago(m) && m.date.startsWith(mes))
    .reduce((s, m) => s + m.amount, 0);
}

export type ReparteLetra = { interes: number; capital: number };

/**
 * Reparte cada letra en interés y capital. Si el mes de la letra tiene un
 * movimiento de «Intereses del préstamo», ese es el interés; si no, se
 * calcula sobre la deuda justo antes de la letra (saldo actual deshaciendo
 * los movimientos desde esa letra) con interés anual / 12.
 */
export function repartirLetras(
  movs: readonly MovimientoDeuda[],
  saldoActual: number,
  interesAnual: number,
): Map<string, ReparteLetra> {
  const orden = ordenados(movs);
  const resultado = new Map<string, ReparteLetra>();
  // Saldo de la cuenta justo antes de cada movimiento (de atrás hacia delante).
  let saldoPosterior = saldoActual;
  for (let i = orden.length - 1; i >= 0; i--) {
    const m = orden[i];
    const saldoAntes = saldoPosterior - m.amount;
    saldoPosterior = saldoAntes;
    if (!esPago(m)) {
      continue;
    }
    const mes = m.date.slice(0, 7);
    const registrado = orden
      .filter(x => esInteres(x) && x.date.startsWith(mes))
      .reduce((s, x) => s - x.amount, 0);
    const deudaAntes = Math.max(0, -saldoAntes);
    const calculado = Math.round((deudaAntes * interesAnual) / 100 / 12);
    const interes = Math.min(m.amount, Math.max(0, registrado || calculado));
    resultado.set(m.id, { interes, capital: m.amount - interes });
  }
  return resultado;
}

/** Interés del mes a registrar (positivo) sobre la deuda actual. */
export function interesDelMesARegistrar(
  saldoActual: number,
  interesAnual: number,
): number {
  return Math.round((Math.max(0, -saldoActual) * interesAnual) / 100 / 12);
}

export function hayInteresEnMes(
  movs: readonly MovimientoDeuda[],
  mes: string,
): boolean {
  return movs.some(m => esInteres(m) && m.date.startsWith(mes));
}
