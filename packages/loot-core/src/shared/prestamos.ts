// Datos de deuda de las cuentas de préstamo del fork «Presupuesto».
// Viven en la nota de la cuenta (id `account-<id>`) como una línea
// `#prestamo {...}` con un JSON en una sola línea. Módulo compartido entre el
// importador de YNAB (servidor) y la pantalla de deuda (cliente).

export const PAYEE_INTERESES = 'Intereses del préstamo';

/** Prefijo de la línea de la nota de cuenta que guarda los datos de deuda. */
export const PREFIJO_PRESTAMO = '#prestamo';

export type DatosPrestamo = {
  /** Tipo de cuenta de YNAB (`mortgage`, `autoLoan`, …). */
  tipo: string;
  /** Interés anual en %, p. ej. 8.72. */
  interes_anual: number | null;
  /** Cuota mínima mensual en euros, p. ej. 246.72. */
  cuota_minima: number | null;
  /** Mes (`YYYY-MM-DD`) desde el que rigen el interés y la cuota actuales. */
  desde: string | null;
  /** Importe de la plica/escrow mensual en euros, si YNAB lo tenía. */
  escrow?: number;
  /** Saldo inicial en euros (positivo) si no se puede deducir de los movimientos. */
  saldo_inicial?: number;
};

/** Lee los datos de deuda de una nota de cuenta. `null` si no hay línea válida. */
export function leerDatosPrestamo(
  note: string | null | undefined,
): DatosPrestamo | null {
  if (!note) {
    return null;
  }
  for (const linea of note.split('\n')) {
    const recortada = linea.trim();
    if (!recortada.startsWith(PREFIJO_PRESTAMO)) {
      continue;
    }
    try {
      const datos = JSON.parse(recortada.slice(PREFIJO_PRESTAMO.length).trim());
      return datos && typeof datos === 'object' ? datos : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Devuelve la nota con la línea `#prestamo` sustituida (o añadida al final)
 * por los datos dados. El resto de la nota se conserva.
 */
export function escribirDatosPrestamo(
  note: string | null | undefined,
  datos: DatosPrestamo,
): string {
  const linea = `${PREFIJO_PRESTAMO} ${JSON.stringify(datos)}`;
  const lineas = (note ?? '').split('\n');
  const i = lineas.findIndex(l => l.trim().startsWith(PREFIJO_PRESTAMO));
  if (i >= 0) {
    lineas[i] = linea;
    return lineas.join('\n');
  }
  const base = (note ?? '').replace(/\s+$/, '');
  return base ? `${base}\n${linea}` : linea;
}
