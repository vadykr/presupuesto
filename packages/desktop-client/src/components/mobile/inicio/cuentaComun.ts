import { integerToAmount } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';

/**
 * «Cuánto ingresar a la cuenta común» (la vista «Ingrés comuna» de YNAB):
 * la suma de lo ASIGNADO este mes en las categorías elegidas, guardadas en la
 * preferencia sincronizada `cuenta-comun-categorias` (JSON array de ids).
 */

export function leerCategoriasComunes(
  raw: string | undefined | null,
): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [
      ...new Set(parsed.filter((id): id is string => typeof id === 'string')),
    ];
  } catch {
    return [];
  }
}

export function alternarCategoriaComun(
  ids: readonly string[],
  id: string,
): string[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}

/**
 * Suma de lo asignado este mes. `asignado` da los céntimos asignados por id
 * (lo de la hoja `budget-<id>`); lo negativo (desasignado) resta, y las
 * categorías que ya no existen (sin dato) no cuentan.
 */
export function importeCuentaComun(
  ids: readonly string[],
  asignado: (id: string) => IntegerAmount | null | undefined,
): IntegerAmount {
  let total = 0;
  for (const id of ids) {
    total += asignado(id) ?? 0;
  }
  return Math.max(0, total);
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Cuentas del traspaso: origen = la personal («Cuenta Personal», «Compte
 * personal»…), destino = la común («Conte conjunt», «Cuenta común»…). Solo
 * cuentas abiertas. `null` si no se encuentra alguna.
 */
export function cuentasDelTraspaso(cuentas: readonly AccountEntity[]): {
  origen: AccountEntity | null;
  destino: AccountEntity | null;
} {
  const abiertas = cuentas.filter(c => !c.closed);
  const destino =
    abiertas.find(c => /conjunt|comun|compartid/.test(normalizar(c.name))) ??
    null;
  const origen =
    abiertas.find(c => c !== destino && /personal/.test(normalizar(c.name))) ??
    null;
  return { origen, destino };
}

/**
 * Enlace a «nueva transacción» con el traspaso rellenado: en la cuenta de
 * origen, beneficiario = la cuenta destino (el beneficiario de traspaso se
 * llama como la cuenta) y el importe como salida.
 */
export function enlaceTraspaso({
  origen,
  destino,
  importe,
  nota,
}: {
  origen: string;
  destino: string;
  importe: IntegerAmount;
  nota?: string;
}): string {
  const params = new URLSearchParams({
    account: origen,
    payee: destino,
    amount: String(integerToAmount(importe)),
  });
  if (nota) {
    params.set('notes', nota);
  }
  return `/transactions/new?${params.toString()}`;
}
