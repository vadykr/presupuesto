import type { IntegerAmount } from '@actual-app/core/shared/util';

import type { Categorias, Movimiento } from './calculos';

/**
 * «No contar como ingreso».
 *
 * Un movimiento con categoría de ingreso sigue sumando a «Listo para
 * asignar» (eso lo hace el presupuesto de Actual y no se toca), pero NO
 * cuenta como ingreso en los informes (nóminas, ingresos vs gastos, tasa de
 * ahorro), en las reglas del análisis ni en el resumen del mes de Inicio
 * cuando:
 *
 * - su beneficiario es de traspaso (`payee.transfer_acct`): dinero que viene
 *   de una cuenta propia (p. ej. ahorro fuera de presupuesto → cuenta
 *   corriente) nunca es ingreso; o
 * - su nota lleva la etiqueta `#noingreso` (interruptor «No contar como
 *   ingreso» de la pantalla de movimiento). Va en la nota para que sea
 *   aditivo y se sincronice sin migraciones; Actual la pinta como etiqueta.
 */
export const ETIQUETA_NO_INGRESO = '#noingreso';

const RE_ETIQUETA = /(^|\s)#noingreso(?=\s|$)/i;

export function tieneEtiquetaNoIngreso(notes: string | null | undefined) {
  return RE_ETIQUETA.test(notes ?? '');
}

/** Pone o quita la etiqueta en la nota, sin tocar el resto del texto. */
export function conEtiquetaNoIngreso(
  notes: string | null | undefined,
  activa: boolean,
): string {
  const base = notes ?? '';
  if (activa) {
    if (tieneEtiquetaNoIngreso(base)) {
      return base;
    }
    return base.trim() === ''
      ? ETIQUETA_NO_INGRESO
      : `${base.trimEnd()} ${ETIQUETA_NO_INGRESO}`;
  }
  return base
    .replace(/(^|\s)#noingreso(?=\s|$)/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** ¿El movimiento queda fuera de los cálculos de ingresos? */
export function noCuentaComoIngreso(tx: {
  notes?: string | null;
  esTraspaso: boolean;
}): boolean {
  return tx.esTraspaso || tieneEtiquetaNoIngreso(tx.notes);
}

/**
 * Condición AQL de los movimientos que no cuentan como ingreso (traspaso o
 * etiqueta). Se combina con los mismos filtros de periodo y cuenta que la
 * consulta principal.
 */
export const condicionNoIngreso = {
  $or: [
    { 'payee.transfer_acct': { $ne: null } },
    { notes: { $like: `%${ETIQUETA_NO_INGRESO}%` } },
  ],
};

function clave(m: Pick<Movimiento, 'mes' | 'categoria' | 'payee'>) {
  return `${m.mes}|${m.categoria ?? ''}|${m.payee ?? ''}`;
}

/**
 * Descuenta de los movimientos (mes × categoría × beneficiario) lo que no
 * cuenta como ingreso. Solo afecta a las categorías de ingreso: en una de
 * gasto la etiqueta no cambia nada (un reembolso sigue restando gasto). Las
 * filas que se quedan a cero desaparecen.
 */
export function descontarNoIngresos(
  movimientos: readonly Movimiento[],
  excluidos: readonly Movimiento[],
  categorias: Categorias,
): Movimiento[] {
  const resta = new Map<string, IntegerAmount>();
  for (const e of excluidos) {
    if (e.categoria == null || !categorias.get(e.categoria)?.esIngreso) {
      continue;
    }
    resta.set(clave(e), (resta.get(clave(e)) ?? 0) + e.importe);
  }
  if (resta.size === 0) {
    return [...movimientos];
  }
  const resultado: Movimiento[] = [];
  for (const m of movimientos) {
    const r = resta.get(clave(m));
    if (r == null) {
      resultado.push(m);
      continue;
    }
    const importe = m.importe - r;
    if (importe !== 0) {
      resultado.push({ ...m, importe });
    }
  }
  return resultado;
}

/** Suma de lo que no cuenta como ingreso en categorías de ingreso. */
export function ingresoNoContado(
  excluidos: readonly Movimiento[],
  categorias: Categorias,
): IntegerAmount {
  let total = 0;
  for (const e of excluidos) {
    if (e.categoria != null && categorias.get(e.categoria)?.esIngreso) {
      total += e.importe;
    }
  }
  return total;
}
