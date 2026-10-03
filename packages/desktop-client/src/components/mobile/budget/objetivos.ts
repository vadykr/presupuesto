import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { Template } from '@actual-app/core/types/models/templates';

/**
 * Objetivos de categoría al estilo YNAB sobre las plantillas de Actual.
 *
 * Funciones puras, sin React: lo que falta por asignar («infrafinanciado»),
 * el estado que enseña cada fila de «Asignar el mes» y la traducción entre
 * el formulario «Editar objetivo» y las líneas `#template …` de la nota de
 * la categoría (sintaxis en packages/docs/docs/experimental/goal-templates.md).
 */

// ---------------------------------------------------------------------------
// Infrafinanciado y estado de la fila
// ---------------------------------------------------------------------------

/** Valores de la hoja de un mes para una categoría (céntimos). */
export type DatosCategoriaMes = {
  /** `goal-<id>`: lo que piden las plantillas este mes; `null` sin objetivo. */
  goal: IntegerAmount | null;
  /** `long-goal-<id>` = 1: el objetivo se mide sobre el saldo, no lo asignado. */
  longGoal: boolean;
  /** `budget-<id>`: asignado este mes. */
  budgeted: IntegerAmount;
  /** `leftover-<id>`: disponible (saldo). */
  balance: IntegerAmount;
  /** `sum-amount-<id>`: actividad del mes (negativa si es gasto). */
  spent: IntegerAmount;
  /**
   * «Ignorar este mes» (el *snooze* de YNAB): la categoría no cuenta como
   * infrafinanciada este mes aunque no llegue al objetivo. Solo afecta a ese
   * mes; la plantilla y el objetivo no se tocan.
   */
  ignorada?: boolean;
};

/**
 * Cuánto falta para cumplir el objetivo este mes (0 si no falta nada o si
 * la categoría está ignorada este mes).
 */
export function faltante(datos: DatosCategoriaMes): IntegerAmount {
  if (datos.goal == null || datos.ignorada) {
    return 0;
  }
  const base = datos.longGoal ? datos.balance : datos.budgeted;
  return Math.max(0, datos.goal - base);
}

/** Suma de lo que falta en todas las categorías («infrafinanciadas»). */
export function totalInfrafinanciado(
  datos: Iterable<DatosCategoriaMes>,
): IntegerAmount {
  let total = 0;
  for (const d of datos) {
    total += faltante(d);
  }
  return total;
}

/**
 * Lo que sobra por encima del objetivo y se puede devolver a «Listo para
 * asignar» («Reducir sobrefinanciación» de YNAB): lo asignado (o el saldo si
 * la plantilla es `#goal`) por encima del objetivo, sin pasar del saldo para
 * no dejar la categoría en negativo. 0 sin objetivo.
 */
export function sobrefinanciado(datos: DatosCategoriaMes): IntegerAmount {
  if (datos.goal == null) {
    return 0;
  }
  const base = datos.longGoal ? datos.balance : datos.budgeted;
  return Math.max(0, Math.min(base - datos.goal, datos.balance));
}

/**
 * Estado único de una fila (YNAB): uno solo, por prioridad
 * gastado de más > ignorada > le falta > sobrefinanciada > financiada > sin
 * objetivo. El gasto de más no suma a lo que falta (no se cuenta dos veces).
 */
export type EstadoFila =
  | { tipo: 'gastado-de-mas'; importe: IntegerAmount; progreso: number }
  | { tipo: 'falta'; importe: IntegerAmount; progreso: number }
  | { tipo: 'sobrefinanciada'; importe: IntegerAmount; progreso: number }
  | { tipo: 'financiada'; progreso: number }
  | { tipo: 'sin-objetivo'; progreso: number }
  /** Ignorada este mes: no se pide nada, aunque el objetivo no se cumpla. */
  | { tipo: 'ignorada'; progreso: number };

export type TipoEstado = EstadoFila['tipo'];

function fraccion(parte: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, parte / total));
}

/** Estado de una fila de «Asignar el mes»: tipo, importe y barra. */
export function estadoFila(datos: DatosCategoriaMes): EstadoFila {
  if (datos.balance < 0) {
    return { tipo: 'gastado-de-mas', importe: -datos.balance, progreso: 1 };
  }
  const base = datos.longGoal ? datos.balance : datos.budgeted;
  if (datos.ignorada) {
    return {
      tipo: 'ignorada',
      progreso: datos.goal != null ? fraccion(base, datos.goal) : 0,
    };
  }
  if (datos.goal == null) {
    return {
      tipo: 'sin-objetivo',
      progreso:
        datos.budgeted > 0 ? fraccion(datos.balance, datos.budgeted) : 0,
    };
  }
  const falta = faltante(datos);
  if (falta > 0) {
    return {
      tipo: 'falta',
      importe: falta,
      progreso: fraccion(base, datos.goal),
    };
  }
  const sobra = sobrefinanciado(datos);
  if (sobra > 0) {
    return { tipo: 'sobrefinanciada', importe: sobra, progreso: 1 };
  }
  return { tipo: 'financiada', progreso: 1 };
}

/** Filtros fijos de «Asignar el mes». */
export type FiltroEstado =
  | 'infrafinanciadas'
  | 'sobrefinanciadas'
  | 'gastado-de-mas';

/**
 * ¿Entra la categoría en el filtro? Usa las mismas definiciones que la
 * cabecera y el auto-asignar: infrafinanciada = le falta algo para el
 * objetivo (aunque además esté en negativo), sobrefinanciada = le sobra algo
 * que se puede devolver, gastado de más = disponible negativo.
 */
export function cumpleFiltro(
  filtro: FiltroEstado,
  datos: DatosCategoriaMes,
): boolean {
  switch (filtro) {
    case 'infrafinanciadas':
      return faltante(datos) > 0;
    case 'sobrefinanciadas':
      return sobrefinanciado(datos) > 0;
    case 'gastado-de-mas':
      return datos.balance < 0;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Auto-asignar
// ---------------------------------------------------------------------------

export type ImporteCategoria = { category: string; amount: IntegerAmount };

/**
 * «Auto-asignar por infrafinanciadas»: reparte lo disponible de arriba abajo,
 * dando a cada categoría lo que le falta hasta agotar `disponible`.
 * Devuelve el nuevo importe asignado de cada categoría que cambia.
 */
export function asignarInfrafinanciadas(
  filas: { id: string; datos: DatosCategoriaMes }[],
  disponible: IntegerAmount,
): ImporteCategoria[] {
  const resultado: ImporteCategoria[] = [];
  let restante = Math.max(0, disponible);
  for (const { id, datos } of filas) {
    if (restante <= 0) {
      break;
    }
    const falta = faltante(datos);
    if (falta <= 0) {
      continue;
    }
    const dado = Math.min(falta, restante);
    restante -= dado;
    resultado.push({ category: id, amount: datos.budgeted + dado });
  }
  return resultado;
}

/**
 * «Reducir sobrefinanciación»: quita a cada categoría lo que le sobra sobre
 * el objetivo (vuelve a «Listo para asignar»).
 */
export function reducirSobrefinanciacion(
  filas: { id: string; datos: DatosCategoriaMes }[],
): ImporteCategoria[] {
  return filas
    .map(({ id, datos }) => ({ id, datos, sobra: sobrefinanciado(datos) }))
    .filter(f => f.sobra > 0)
    .map(f => ({ category: f.id, amount: f.datos.budgeted - f.sobra }));
}

/**
 * Media por categoría de varios meses (céntimos, redondeada). `meses` es una
 * lista de mapas id → valor; los que no tienen valor cuentan como 0.
 */
export function mediaPorCategoria(
  ids: readonly string[],
  meses: readonly Map<string, number | null>[],
): Map<string, IntegerAmount> {
  const media = new Map<string, IntegerAmount>();
  for (const id of ids) {
    if (meses.length === 0) {
      media.set(id, 0);
      continue;
    }
    const suma = meses.reduce((s, m) => s + (m.get(id) ?? 0), 0);
    media.set(id, Math.round(suma / meses.length));
  }
  return media;
}

/**
 * «Auto-asignar por gastado el mes pasado»: asigna a cada categoría lo que
 * gastó el mes anterior (`sum-amount` del mes anterior, negativo si gasto).
 */
export function asignarGastadoMesPasado(
  filas: { id: string; gastadoMesPasado: IntegerAmount | null }[],
): ImporteCategoria[] {
  return filas
    .map(({ id, gastadoMesPasado }) => ({
      category: id,
      amount: Math.max(0, -(gastadoMesPasado ?? 0)),
    }))
    .filter(f => f.amount > 0);
}

// ---------------------------------------------------------------------------
// Objetivo ↔ plantillas
// ---------------------------------------------------------------------------

/** Cadencias de «Cada año (o cada N meses)», en meses. */
export const CADENCIAS_ANUALES = [12, 24, 6, 3] as const;
export type CadenciaMeses = (typeof CADENCIAS_ANUALES)[number];

export type Objetivo =
  | {
      tipo: 'mensual';
      importe: IntegerAmount;
      /** «Antes del día N» (solo informativo: Actual no lo usa). */
      dia: number | null;
      /** El mes que viene: apartar otros X / rellenar hasta X. */
      modo: 'apartar' | 'rellenar';
    }
  | { tipo: 'semanal'; importe: IntegerAmount; modo: 'apartar' | 'rellenar' }
  | {
      tipo: 'anual';
      importe: IntegerAmount;
      /** Fecha límite `YYYY-MM-DD`; la plantilla usa su mes. */
      fecha: string;
      cadaMeses: CadenciaMeses;
    }
  | { tipo: 'una-vez'; importe: IntegerAmount; fecha: string };

export type TipoObjetivo = Objetivo['tipo'];

/** Línea propia de la nota que guarda lo que Actual no sabe representar. */
const PREFIJO_MARCA = '#objetivo';
const PREFIJO_PLANTILLA = '#template';
const PREFIJO_GOAL = '#goal';

/** Importe en céntimos → texto de plantilla («31.5», sin ceros sobrantes). */
export function importeDePlantilla(importe: IntegerAmount): string {
  const texto = (Math.abs(importe) / 100).toFixed(2);
  return texto.replace(/\.?0+$/, '');
}

function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

function repeticion(cadaMeses: CadenciaMeses): string {
  switch (cadaMeses) {
    case 12:
      return 'year';
    case 24:
      return '2 years';
    default:
      return `${cadaMeses} months`;
  }
}

/**
 * Líneas que van en la nota de la categoría para un objetivo. La primera es
 * siempre la plantilla de Actual; la marca `#objetivo …` guarda el día o la
 * fecha, que la plantilla no sabe representar.
 *
 * @param hoy Día actual `YYYY-MM-DD` (inicio de las plantillas semanales).
 */
export function lineasDeObjetivo(objetivo: Objetivo, hoy: string): string[] {
  const X = importeDePlantilla(objetivo.importe);
  switch (objetivo.tipo) {
    case 'mensual': {
      const plantilla =
        objetivo.modo === 'rellenar'
          ? `${PREFIJO_PLANTILLA} up to ${X}`
          : `${PREFIJO_PLANTILLA} ${X}`;
      return objetivo.dia
        ? [plantilla, `${PREFIJO_MARCA} día ${objetivo.dia}`]
        : [plantilla];
    }
    case 'semanal': {
      const inicio = monthUtils.firstDayOfMonth(hoy);
      return objetivo.modo === 'rellenar'
        ? [`${PREFIJO_PLANTILLA} up to ${X} per week starting ${inicio}`]
        : [`${PREFIJO_PLANTILLA} ${X} repeat every week starting ${inicio}`];
    }
    case 'anual':
      return [
        `${PREFIJO_PLANTILLA} ${X} by ${mesDe(objetivo.fecha)} repeat every ${repeticion(objetivo.cadaMeses)}`,
        `${PREFIJO_MARCA} fecha ${objetivo.fecha}`,
      ];
    case 'una-vez':
      return [
        `${PREFIJO_PLANTILLA} ${X} by ${mesDe(objetivo.fecha)}`,
        `${PREFIJO_MARCA} fecha ${objetivo.fecha}`,
      ];
    default:
      throw new Error(`Tipo de objetivo desconocido: ${String(objetivo)}`);
  }
}

function esLineaDeObjetivo(linea: string): boolean {
  const i = linea.indexOf('#');
  if (i < 0) {
    return false;
  }
  const texto = linea.slice(i).trim().toLowerCase();
  return (
    texto.startsWith(PREFIJO_PLANTILLA) ||
    texto.startsWith(PREFIJO_GOAL) ||
    texto.startsWith(PREFIJO_MARCA)
  );
}

/**
 * Nota de la categoría con el objetivo sustituido: se quitan las líneas
 * `#template`, `#goal` y `#objetivo` anteriores y se añaden las nuevas al
 * final. El resto de la nota se conserva.
 */
export function notaConObjetivo(
  nota: string | null | undefined,
  lineas: string[],
): string {
  const resto = (nota ?? '')
    .split('\n')
    .filter(linea => !esLineaDeObjetivo(linea))
    .join('\n')
    .replace(/\n+$/, '');
  if (lineas.length === 0) {
    return resto;
  }
  return resto === '' ? lineas.join('\n') : `${resto}\n${lineas.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Ignorar este mes
// ---------------------------------------------------------------------------

/**
 * Línea de la nota de mes de la categoría (id `<categoría>-<AAAA-MM>`) que
 * marca «Ignorar este mes». Va en la nota del mes, no en la de la categoría,
 * para que solo afecte a ese mes y no toque la plantilla.
 */
export const MARCA_IGNORAR_MES = '#ignorar-mes';

/** Id de la nota de mes de una categoría (la misma que usa Actual). */
export function idNotaMes(categoryId: string, month: string): string {
  return `${categoryId}-${month}`;
}

function esLineaIgnorar(linea: string): boolean {
  return linea.trim().toLowerCase() === MARCA_IGNORAR_MES;
}

/** `true` si la nota de mes lleva la marca `#ignorar-mes`. */
export function notaIgnoraMes(nota: string | null | undefined): boolean {
  return (nota ?? '').split('\n').some(esLineaIgnorar);
}

/**
 * Nota de mes con la marca `#ignorar-mes` puesta o quitada. El resto de la
 * nota se conserva; si queda vacía devuelve `''`.
 */
export function notaConIgnorarMes(
  nota: string | null | undefined,
  ignorar: boolean,
): string {
  const resto = (nota ?? '')
    .split('\n')
    .filter(linea => !esLineaIgnorar(linea))
    .join('\n')
    .replace(/\n+$/, '');
  if (!ignorar) {
    return resto;
  }
  return resto === '' ? MARCA_IGNORAR_MES : `${resto}\n${MARCA_IGNORAR_MES}`;
}

/**
 * Categorías ignoradas en `month` a partir de todas las notas: las de id
 * `<categoría>-<mes>` cuyo texto lleva la marca.
 */
export function categoriasIgnoradas(
  notas: readonly { id: string; note: string | null }[] | null | undefined,
  month: string,
): Set<string> {
  const sufijo = `-${month}`;
  const ignoradas = new Set<string>();
  for (const nota of notas ?? []) {
    if (nota.id.endsWith(sufijo) && notaIgnoraMes(nota.note)) {
      ignoradas.add(nota.id.slice(0, -sufijo.length));
    }
  }
  return ignoradas;
}

/** Marca `#objetivo …` de la nota: día del mes o fecha. */
export function marcaDeNota(nota: string | null | undefined): {
  dia: number | null;
  fecha: string | null;
} {
  const resultado: { dia: number | null; fecha: string | null } = {
    dia: null,
    fecha: null,
  };
  for (const linea of (nota ?? '').split('\n')) {
    const i = linea.indexOf(PREFIJO_MARCA);
    if (i < 0) {
      continue;
    }
    const texto = linea.slice(i + PREFIJO_MARCA.length).trim();
    const dia = texto.match(/^d[ií]a\s+(\d{1,2})$/i);
    if (dia) {
      const n = parseInt(dia[1], 10);
      if (n >= 1 && n <= 31) {
        resultado.dia = n;
      }
      continue;
    }
    const fecha = texto.match(/^fecha\s+(\d{4}-\d{2}-\d{2})$/i);
    if (fecha) {
      resultado.fecha = fecha[1];
    }
  }
  return resultado;
}

function centimos(amount: number): IntegerAmount {
  return Math.round(amount * 100);
}

/**
 * Reconstruye el objetivo a partir de las plantillas guardadas (`goal_def`,
 * ya sean las que escribe el parser de notas o las de la UI de
 * automatizaciones) y de la marca de la nota.
 *
 * - `null`: la categoría no tiene objetivo.
 * - `'otro'`: tiene plantillas que esta pantalla no sabe editar (p. ej.
 *   `#goal`, porcentajes, varias líneas).
 */
export function objetivoDesdePlantillas(
  templates: readonly Template[],
  nota: string | null | undefined,
): Objetivo | null | 'otro' {
  const activas = templates.filter(t => t.directive !== 'error');
  if (activas.length === 0) {
    return templates.length === 0 ? null : 'otro';
  }
  const marca = marcaDeNota(nota);

  // Rellenar hasta X: `#template up to X` (simple con límite) o la pareja
  // refill + limit de la UI de automatizaciones.
  const limite = activas.find(t => t.type === 'limit');
  const refill = activas.find(t => t.type === 'refill');
  if (
    activas.length === 2 &&
    limite &&
    limite.type === 'limit' &&
    refill &&
    (limite.period === 'monthly' || limite.period === 'weekly')
  ) {
    return limite.period === 'weekly'
      ? { tipo: 'semanal', importe: centimos(limite.amount), modo: 'rellenar' }
      : {
          tipo: 'mensual',
          importe: centimos(limite.amount),
          dia: marca.dia,
          modo: 'rellenar',
        };
  }

  if (activas.length !== 1) {
    return 'otro';
  }
  const t = activas[0];
  switch (t.type) {
    case 'simple': {
      if (t.monthly != null && !t.limit) {
        return {
          tipo: 'mensual',
          importe: centimos(t.monthly),
          dia: marca.dia,
          modo: 'apartar',
        };
      }
      if (t.monthly == null && t.limit) {
        if (t.limit.period === 'monthly') {
          return {
            tipo: 'mensual',
            importe: centimos(t.limit.amount),
            dia: marca.dia,
            modo: 'rellenar',
          };
        }
        if (t.limit.period === 'weekly') {
          return {
            tipo: 'semanal',
            importe: centimos(t.limit.amount),
            modo: 'rellenar',
          };
        }
      }
      return 'otro';
    }
    case 'periodic': {
      if (t.limit || t.period.amount !== 1) {
        return 'otro';
      }
      if (t.period.period === 'month') {
        return {
          tipo: 'mensual',
          importe: centimos(t.amount),
          dia: marca.dia,
          modo: 'apartar',
        };
      }
      if (t.period.period === 'week') {
        return {
          tipo: 'semanal',
          importe: centimos(t.amount),
          modo: 'apartar',
        };
      }
      return 'otro';
    }
    case 'by': {
      const fecha =
        marca.fecha && mesDe(marca.fecha) === t.month
          ? marca.fecha
          : `${t.month}-01`;
      if (t.annual === undefined && t.repeat == null) {
        return { tipo: 'una-vez', importe: centimos(t.amount), fecha };
      }
      const meses = t.annual ? (t.repeat ?? 1) * 12 : (t.repeat ?? 1);
      const cadaMeses = CADENCIAS_ANUALES.find(c => c === meses);
      if (!cadaMeses) {
        return 'otro';
      }
      return { tipo: 'anual', importe: centimos(t.amount), fecha, cadaMeses };
    }
    default:
      return 'otro';
  }
}

/**
 * Cuota mensual aproximada para llegar a `importe` en `fecha` partiendo del
 * saldo actual (lo que YNAB enseña como «necesitas X al mes»).
 */
export function cuotaMensual(
  importe: IntegerAmount,
  saldo: IntegerAmount,
  fecha: string,
  mesActual: string,
): IntegerAmount {
  const meses = monthUtils.differenceInCalendarMonths(mesDe(fecha), mesActual);
  if (meses < 0) {
    return Math.max(0, importe - saldo);
  }
  return Math.max(0, Math.round((importe - saldo) / (meses + 1)));
}

/**
 * Nota de una categoría tal como se enseña en el móvil: sin las líneas del
 * objetivo (`#template`, `#goal`, `#objetivo`), que ya resume el botón
 * «Objetivo · 38,47 € al mes». Devuelve '' si no queda nada.
 */
export function notaSinObjetivo(nota: string | null | undefined): string {
  return (nota ?? '')
    .split('\n')
    .filter(linea => !/^\s*#(template|goal|objetivo)\b/i.test(linea))
    .join('\n')
    .trim();
}
