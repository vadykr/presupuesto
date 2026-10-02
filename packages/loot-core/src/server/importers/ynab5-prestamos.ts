// Ampliación del importador de YNAB 5 propia del fork «Presupuesto»: saldos
// de préstamo fieles a YNAB y datos de deuda para la fase 4. Son funciones
// puras para poder probarlas con datos sintéticos; el importador (`ynab5.ts`)
// las conecta con la base de datos.

import { PAYEE_INTERESES, PREFIJO_PRESTAMO } from '#shared/prestamos';
import type { DatosPrestamo } from '#shared/prestamos';

import type { Account, AccountType, Transaction } from './ynab5-types';

/** Tipos de cuenta de YNAB que son préstamos (acumulan intereses «virtuales»). */
const TIPOS_DE_DEUDA: ReadonlySet<AccountType> = new Set<AccountType>([
  'mortgage',
  'autoLoan',
  'studentLoan',
  'personalLoan',
  'medicalDebt',
  'otherDebt',
]);

export const PAYEE_AJUSTE = 'Ajuste de saldo';
export const NOTA_INTERESES =
  'Intereses acumulados en YNAB hasta la importación';
export const NOTA_AJUSTE = 'Ajuste para cuadrar con el saldo de YNAB';

// El formato `#prestamo {...}` y su lectura viven en `shared/prestamos` para que
// el cliente (pantalla de deuda) los use sin importar código del servidor.
export {
  PAYEE_INTERESES,
  PREFIJO_PRESTAMO,
  leerDatosPrestamo,
} from '#shared/prestamos';
export type { DatosPrestamo } from '#shared/prestamos';

export function esCuentaDeDeuda(account: Pick<Account, 'type'>): boolean {
  return TIPOS_DE_DEUDA.has(account.type);
}

/** YNAB usa milésimas (milliunits); Actual, céntimos. */
export function importeDesdeYnab(amount: number): number {
  return Math.round(amount / 10);
}

export type AjusteDeSaldo = {
  /** Importe en céntimos que falta para que la cuenta cuadre con YNAB. */
  amount: number;
  date: string;
  payeeName: string;
  notes: string;
};

/**
 * Calcula el movimiento de ajuste que hace falta para que el saldo de una
 * cuenta en Actual coincida con `account.balance` de YNAB. Devuelve `null`
 * si ya cuadra. La fecha es la del último movimiento de la cuenta o, si no
 * tiene, el primer día de `lastMonth` (p. ej. `2026-11-01`).
 */
export function calcularAjusteDeSaldo(
  account: Pick<Account, 'type' | 'balance'>,
  transactions: ReadonlyArray<Pick<Transaction, 'amount' | 'date' | 'deleted'>>,
  lastMonth: string | null | undefined,
): AjusteDeSaldo | null {
  let suma = 0;
  let ultimaFecha: string | null = null;
  for (const transaction of transactions) {
    if (transaction.deleted) {
      continue;
    }
    // Se redondea movimiento a movimiento, igual que al importarlos.
    suma += importeDesdeYnab(transaction.amount);
    if (ultimaFecha === null || transaction.date > ultimaFecha) {
      ultimaFecha = transaction.date;
    }
  }

  const diferencia = importeDesdeYnab(account.balance) - suma;
  if (diferencia === 0) {
    return null;
  }

  const esDeuda = esCuentaDeDeuda(account);
  return {
    amount: diferencia,
    date: ultimaFecha ?? primerDiaDelMes(lastMonth),
    payeeName: esDeuda ? PAYEE_INTERESES : PAYEE_AJUSTE,
    notes: esDeuda ? NOTA_INTERESES : NOTA_AJUSTE,
  };
}

function primerDiaDelMes(month: string | null | undefined): string {
  if (month && /^\d{4}-\d{2}/.test(month)) {
    return `${month.slice(0, 7)}-01`;
  }
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-01`;
}

function ultimoValor(
  valores: Record<string, number> | null | undefined,
): { fecha: string; valor: number } | null {
  if (!valores) {
    return null;
  }
  const fechas = Object.keys(valores).sort();
  if (fechas.length === 0) {
    return null;
  }
  const fecha = fechas[fechas.length - 1];
  return { fecha, valor: valores[fecha] };
}

/**
 * Extrae los datos de deuda de una cuenta de préstamo de YNAB. Devuelve
 * `null` para cuentas que no son préstamos.
 *
 * YNAB expresa el interés en milésimas de % (8720 = 8,72 % anual) y las
 * cuotas en milésimas de unidad (246720 = 246,72 €).
 */
export function extraerDatosPrestamo(account: Account): DatosPrestamo | null {
  if (!esCuentaDeDeuda(account)) {
    return null;
  }

  const interes = ultimoValor(account.debt_interest_rates);
  const cuota = ultimoValor(account.debt_minimum_payments);
  const escrow = ultimoValor(account.debt_escrow_amounts);

  const datos: DatosPrestamo = {
    tipo: account.type,
    interes_anual: interes ? interes.valor / 1000 : null,
    cuota_minima: cuota ? cuota.valor / 1000 : null,
    desde: interes?.fecha ?? cuota?.fecha ?? null,
  };
  if (escrow && escrow.valor !== 0) {
    datos.escrow = escrow.valor / 1000;
  }
  return datos;
}

/**
 * Compone la nota de la cuenta: la nota que tenía en YNAB y, si es un
 * préstamo, una línea `#prestamo {...}` legible con los datos de deuda.
 * Devuelve `null` si no hay nada que guardar.
 */
export function notaDeCuenta(account: Account): string | null {
  const lineas: string[] = [];
  const notaYnab = account.note?.trim();
  if (notaYnab) {
    lineas.push(notaYnab);
  }
  const prestamo = extraerDatosPrestamo(account);
  if (prestamo) {
    lineas.push(`${PREFIJO_PRESTAMO} ${JSON.stringify(prestamo)}`);
  }
  return lineas.length > 0 ? lineas.join('\n') : null;
}
