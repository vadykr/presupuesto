import { integerToAmount } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';

import {
  recortarInicioSinDatos,
  referenciaHabitual,
} from '#components/mobile/informes/estadisticaRobusta';

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

/** Meses completos que entran en el gasto previsto. */
export const MESES_PREVISTO = 12;

/** Tolerancia al reconocer un traspaso ya hecho: ±5 % del importe a ingresar. */
export const TOLERANCIA_TRASPASO = 0.05;

/** Día del mes anterior desde el que se busca el traspaso. */
export const DIA_INICIO_BUSQUEDA = 20;

/**
 * Estado «Traspasado» por mes: pref sincronizada `cuenta-comun-traspasado`
 * (JSON `{ "2026-10": true }`).
 */
export function leerTraspasados(
  raw: string | undefined | null,
): Record<string, boolean> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const resultado: Record<string, boolean> = {};
    for (const [mes, valor] of Object.entries(parsed)) {
      if (valor === true) {
        resultado[mes] = true;
      }
    }
    return resultado;
  } catch {
    return {};
  }
}

/** Devuelve el JSON de la pref con el mes marcado o desmarcado. */
export function marcarTraspasado(
  raw: string | undefined | null,
  mes: string,
  traspasado: boolean,
): string {
  const actual = leerTraspasados(raw);
  if (traspasado) {
    actual[mes] = true;
  } else {
    delete actual[mes];
  }
  return JSON.stringify(actual);
}

/**
 * Gasto previsto al mes: mediana robusta (sin atípicos) de las salidas
 * mensuales de la cuenta en los `meses` meses completos anteriores a `mes`.
 * `salidas` da, por mes 'yyyy-MM', el total de salidas en positivo y en
 * céntimos (sin traspasos entre cuentas propias). Los meses iniciales sin
 * movimientos no cuentan (la cuenta aún no se usaba).
 */
export function gastoPrevisto(
  salidas: Readonly<Record<string, number>>,
  mesesAnteriores: readonly string[],
): { previsto: IntegerAmount; meses: number } {
  const serie = recortarInicioSinDatos(
    mesesAnteriores.map(mes => Math.abs(salidas[mes] ?? 0)),
  );
  if (serie.length === 0) {
    return { previsto: 0, meses: 0 };
  }
  return {
    previsto: referenciaHabitual(serie).referencia,
    meses: serie.length,
  };
}

/** Cobertura = saldo / previsto (0 si no hay previsto). */
export function cobertura(saldo: IntegerAmount, previsto: IntegerAmount) {
  const fraccion = previsto > 0 ? Math.max(0, saldo) / previsto : 0;
  return { fraccion, cubre: previsto > 0 && saldo >= previsto };
}

export type EntradaCuenta = { date: string; amount: IntegerAmount };

/**
 * Busca un traspaso hacia la cuenta común entre el día 20 del mes anterior y
 * hoy por un importe dentro de ±5 % de lo que toca ingresar. Si hay varios,
 * el más cercano al importe (y el más reciente en empate).
 */
export function sugerirTraspaso(
  entradas: readonly EntradaCuenta[],
  importe: IntegerAmount,
  hoy: string,
  mesAnterior: string,
): EntradaCuenta | null {
  if (importe <= 0) {
    return null;
  }
  const desde = `${mesAnterior}-${String(DIA_INICIO_BUSQUEDA).padStart(2, '0')}`;
  let mejor: EntradaCuenta | null = null;
  for (const e of entradas) {
    if (e.date < desde || e.date > hoy || e.amount <= 0) {
      continue;
    }
    const diferencia = Math.abs(e.amount - importe);
    if (diferencia > importe * TOLERANCIA_TRASPASO) {
      continue;
    }
    if (
      !mejor ||
      diferencia < Math.abs(mejor.amount - importe) ||
      (diferencia === Math.abs(mejor.amount - importe) && e.date > mejor.date)
    ) {
      mejor = e;
    }
  }
  return mejor;
}
