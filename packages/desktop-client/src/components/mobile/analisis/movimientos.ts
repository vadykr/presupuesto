import type { IntegerAmount } from '@actual-app/core/shared/util';

import type { Categorias } from '#components/mobile/informes/calculos';

import type { MovimientoDinero } from './motor';

/**
 * Lectura de las notas de movimiento que Actual escribe al cubrir un
 * sobregasto o traspasar dinero entre categorías
 * (`loot-core/src/server/budget/actions.ts`, `addMovementNotes`). Van en la
 * nota del mes (`budget-<AAAA-MM>`), una línea por movimiento:
 *
 *     - Reassigned 40,00 € from Capritxos → Bebot on October 02
 *
 * El importe sale con el formato de número del presupuesto y las categorías
 * por su NOMBRE (no por id), así que la lectura es aproximada: un nombre
 * repetido en dos grupos no se puede resolver y se ignora.
 */

/** Id de la nota de mes del presupuesto. */
export function idNotaPresupuesto(mes: string): string {
  return `budget-${mes}`;
}

const LINEA_MOVIMIENTO =
  /Reassigned\s+(.+?)\s+from\s+(.+?)\s+→\s+(.+?)\s+on\s+.+$/;

/**
 * Importe formateado («40,00 €», «1.234,56», «1,234.56», «40») → céntimos.
 * El último separador seguido de 1 o 2 cifras es el decimal; el resto, de
 * miles. `null` si no hay cifras.
 */
export function parseImporteTexto(texto: string): IntegerAmount | null {
  const limpio = texto.replace(/[^0-9.,]/g, '');
  if (!/\d/.test(limpio)) {
    return null;
  }
  const decimal = limpio.match(/[.,](\d{1,2})$/);
  const entero = (
    decimal ? limpio.slice(0, -decimal[0].length) : limpio
  ).replace(/[.,]/g, '');
  const centimos = decimal ? decimal[1].padEnd(2, '0') : '00';
  return parseInt(`${entero || '0'}${centimos}`, 10);
}

/** Mapa nombre → id de categoría; los nombres repetidos se descartan. */
export function indicePorNombre(categorias: Categorias): Map<string, string> {
  const vistos = new Map<string, string | null>();
  for (const c of categorias.values()) {
    vistos.set(c.nombre, vistos.has(c.nombre) ? null : c.id);
  }
  const indice = new Map<string, string>();
  for (const [nombre, id] of vistos) {
    if (id !== null) {
      indice.set(nombre, id);
    }
  }
  return indice;
}

function resolver(
  nombre: string,
  indice: ReadonlyMap<string, string>,
): string | 'to-budget' | 'overbudgeted' | null {
  if (nombre === 'To Budget') {
    return 'to-budget';
  }
  if (nombre === 'Overbudgeted') {
    return 'overbudgeted';
  }
  return indice.get(nombre) ?? null;
}

/**
 * Movimientos de dinero de una nota de mes. Las líneas que no se entienden
 * (categoría borrada, nombre repetido, importe ilegible) se saltan.
 */
export function parseNotaMovimientos(
  mes: string,
  nota: string | null | undefined,
  indice: ReadonlyMap<string, string>,
): MovimientoDinero[] {
  const resultado: MovimientoDinero[] = [];
  for (const linea of (nota ?? '').split('\n')) {
    const m = LINEA_MOVIMIENTO.exec(linea);
    if (!m) {
      continue;
    }
    const importe = parseImporteTexto(m[1]);
    const desde = resolver(m[2].trim(), indice);
    const hacia = resolver(m[3].trim(), indice);
    if (
      importe === null ||
      desde === null ||
      desde === 'overbudgeted' ||
      hacia === null
    ) {
      continue;
    }
    resultado.push({ mes, desde, hacia, importe });
  }
  return resultado;
}

/** Todas las notas `budget-<mes>` → lista de movimientos. */
export function movimientosDeNotas(
  notas: readonly { id: string; note: string | null }[],
  categorias: Categorias,
): MovimientoDinero[] {
  const indice = indicePorNombre(categorias);
  const resultado: MovimientoDinero[] = [];
  for (const nota of notas) {
    const m = /^budget-(\d{4}-\d{2})$/.exec(nota.id);
    if (m) {
      resultado.push(...parseNotaMovimientos(m[1], nota.note, indice));
    }
  }
  return resultado;
}
