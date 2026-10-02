// Ampliación del importador de YNAB 5 propia del fork «Presupuesto»: los
// objetivos de YNAB se traducen a plantillas de Actual (`#template` / `#goal`
// en la nota de la categoría). Funciones puras; la tabla de equivalencias
// está en `docs-vadym/importacion-ynab.md`.

import { importeDesdeYnab } from './ynab5-prestamos';
import type { Category } from './ynab5-types';

/** Importe en milésimas de YNAB → texto decimal para una plantilla («246.72»). */
function importeDePlantilla(milliunits: number): string {
  const centimos = importeDesdeYnab(milliunits);
  const texto = (Math.abs(centimos) / 100).toFixed(2);
  return (centimos < 0 ? '-' : '') + texto.replace(/\.?0+$/, '');
}

/** `2025-12-17` → `2025-12`. */
function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

function sumarMeses(mes: string, n: number): string {
  const [anio, mesNum] = mes.slice(0, 7).split('-').map(Number);
  const total = anio * 12 + (mesNum - 1) + n;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`;
}

/**
 * Primer día (`YYYY-MM-DD`) del mes de creación del objetivo, para los
 * «repeat every … starting …». Si YNAB no lo da, se usa el mes actual.
 */
function inicioDeCadencia(cat: Category, hoy: string): string {
  return `${mesDe(cat.goal_creation_month ?? hoy)}-01`;
}

/**
 * Primer día con el día de la semana `goal_day` (0 = domingo … 6 = sábado)
 * a partir del mes de creación, para objetivos semanales.
 */
function inicioSemanal(cat: Category, hoy: string): string {
  const inicio = inicioDeCadencia(cat, hoy);
  const diaObjetivo = cat.goal_day;
  if (diaObjetivo == null || diaObjetivo < 0 || diaObjetivo > 6) {
    return inicio;
  }
  const fecha = new Date(`${inicio}T00:00:00`);
  const desfase = (diaObjetivo - fecha.getDay() + 7) % 7;
  fecha.setDate(fecha.getDate() + desfase);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Traduce un objetivo de YNAB a líneas `#template` / `#goal` de Actual.
 * Devuelve `[]` si la categoría no tiene objetivo o no tiene traducción.
 * La tabla de equivalencias está documentada en `docs-vadym/importacion-ynab.md`.
 *
 * @param hoy Mes actual en formato `YYYY-MM` (inyectable para las pruebas).
 */
export function plantillasDeObjetivo(cat: Category, hoy: string): string[] {
  const tipo = cat.goal_type;
  const target = cat.goal_target;
  if (!tipo || target == null || target <= 0) {
    return [];
  }
  const X = importeDePlantilla(target);
  const frecuencia = Math.max(1, cat.goal_cadence_frequency ?? 1);

  switch (tipo) {
    case 'MF':
      // Monthly Funding: asignar X cada mes.
      return [`#template ${X}`];

    case 'DEBT':
      // Pago de deuda: la cuota mensual que YNAB pedía asignar.
      return [`#template ${X}`];

    case 'TB':
      // Target Balance sin fecha: objetivo de saldo, sin automatizar.
      return [`#goal ${X}`];

    case 'TBD': {
      // Target Balance by Date: ahorrar X para un mes.
      const mes = cat.goal_target_month ? mesDe(cat.goal_target_month) : null;
      return mes ? [`#template ${X} by ${mes}`] : [`#goal ${X}`];
    }

    case 'NEED':
      return plantillaNeed(cat, X, frecuencia, hoy);

    default:
      return [];
  }
}

/**
 * «Plan Your Spending» (NEED). `goal_cadence`: 0 = una sola vez, 1 = mensual,
 * 2 = semanal, 13 = anual, 3-12 = cada N meses (heredado), 14 = cada 2 años.
 * `goal_needs_whole_amount`: true = «Set aside another X» (asigna X siempre);
 * false = «Refill up to X» (rellena hasta X).
 */
function plantillaNeed(
  cat: Category,
  X: string,
  frecuencia: number,
  hoy: string,
): string[] {
  const cadencia = cat.goal_cadence ?? 1;
  const rellenar = cat.goal_needs_whole_amount === false;
  const mesObjetivo = cat.goal_target_month
    ? mesDe(cat.goal_target_month)
    : null;

  // Una sola vez: ahorrar X para una fecha.
  if (cadencia === 0) {
    return mesObjetivo ? [`#template ${X} by ${mesObjetivo}`] : [`#goal ${X}`];
  }

  // Mensual.
  if (cadencia === 1) {
    if (frecuencia === 1) {
      return rellenar ? [`#template up to ${X}`] : [`#template ${X}`];
    }
    const inicio = inicioDeCadencia(cat, hoy);
    return [
      `#template ${X} repeat every ${frecuencia} months starting ${inicio}`,
    ];
  }

  // Semanal.
  if (cadencia === 2) {
    const inicio = inicioSemanal(cat, hoy);
    const periodo = frecuencia === 1 ? 'week' : `${frecuencia} weeks`;
    return [`#template ${X} repeat every ${periodo} starting ${inicio}`];
  }

  // Anual (o cada N años).
  if (cadencia === 13 || cadencia === 14) {
    const anios = cadencia === 14 ? 2 : frecuencia;
    const mes =
      mesObjetivo ?? sumarMeses(cat.goal_creation_month ?? hoy, 12 * anios);
    const repeticion = anios === 1 ? 'year' : `${anios} years`;
    return [`#template ${X} by ${mes} repeat every ${repeticion}`];
  }

  // Cada N meses (cadencias heredadas 3-12).
  if (cadencia >= 3 && cadencia <= 12) {
    if (mesObjetivo) {
      return [
        `#template ${X} by ${mesObjetivo} repeat every ${cadencia} months`,
      ];
    }
    const inicio = inicioDeCadencia(cat, hoy);
    return [
      `#template ${X} repeat every ${cadencia} months starting ${inicio}`,
    ];
  }

  return [];
}

/**
 * Nota final de la categoría: la nota de YNAB más las líneas de plantilla.
 */
export function notaDeCategoria(cat: Category, hoy: string): string | null {
  const lineas: string[] = [];
  const notaYnab = cat.note?.trim();
  if (notaYnab) {
    lineas.push(notaYnab);
  }
  lineas.push(...plantillasDeObjetivo(cat, hoy));
  return lineas.length > 0 ? lineas.join('\n') : null;
}
