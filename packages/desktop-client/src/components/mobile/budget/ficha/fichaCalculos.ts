import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { cuotaMensual } from '#components/mobile/budget/objetivos';
import type { Objetivo } from '#components/mobile/budget/objetivos';
import {
  mad,
  mediana,
  recortarInicioSinDatos,
} from '#components/mobile/informes/estadisticaRobusta';

/**
 * Cálculos puros de la ficha de categoría («Diseño 1 · Ficha única»): estado
 * del objetivo, banda de lo habitual, series de las gráficas y las reglas
 * sencillas del Asesor propias de la ficha. Sin React ni i18n.
 */

// ---------------------------------------------------------------------------
// Objetivo
// ---------------------------------------------------------------------------

export type EstadoObjetivo = 'rumbo' | 'atrasado' | 'cumplido';

export type ResumenObjetivoFicha = {
  /** Avance 0..1 (anillo y barra). */
  progreso: number;
  /** Lo que falta (sobre el saldo en metas con fecha; sobre el mes si no). */
  falta: IntegerAmount;
  /** Cuota aproximada al mes. */
  cuota: IntegerAmount;
  /** Meses que quedan hasta la fecha (incluido el actual), si tiene fecha. */
  meses: number | null;
  estado: EstadoObjetivo;
  /** El objetivo se mide sobre el saldo (meta con fecha o `long-goal`). */
  deSaldo: boolean;
};

/** Semanas medias por mes (52/12). */
const SEMANAS_MES = 52 / 12;

function fraccion(parte: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, parte / total));
}

export function esObjetivoDeSaldo(
  objetivo: Objetivo | null,
  longGoal = false,
): boolean {
  return longGoal || objetivo?.tipo === 'una-vez' || objetivo?.tipo === 'anual';
}

/**
 * Estado del objetivo en el mes visto:
 * - Metas con fecha (una vez / cada año): avance = saldo / meta; cumplido
 *   si el saldo llega; en rumbo si lo asignado este mes cubre la cuota.
 * - Cada mes / semana: avance = asignado (o saldo si rellena) / lo pedido;
 *   en rumbo si no falta nada este mes.
 */
export function resumenObjetivo({
  objetivo,
  saldo,
  asignado,
  goal,
  month,
}: {
  objetivo: Objetivo;
  saldo: IntegerAmount;
  asignado: IntegerAmount;
  /** `goal-<id>` de la hoja (lo que piden las plantillas este mes). */
  goal: IntegerAmount | null;
  month: string;
}): ResumenObjetivoFicha {
  if (objetivo.tipo === 'una-vez' || objetivo.tipo === 'anual') {
    const inicioMes = saldo - asignado;
    const cuota = cuotaMensual(
      objetivo.importe,
      inicioMes,
      objetivo.fecha,
      month,
    );
    const meses = Math.max(
      0,
      monthUtils.differenceInCalendarMonths(objetivo.fecha.slice(0, 7), month) +
        1,
    );
    const falta = Math.max(0, objetivo.importe - saldo);
    const estado: EstadoObjetivo =
      falta === 0 ? 'cumplido' : asignado >= cuota ? 'rumbo' : 'atrasado';
    return {
      progreso: fraccion(saldo, objetivo.importe),
      falta,
      cuota,
      meses,
      estado,
      deSaldo: true,
    };
  }
  const cuota =
    goal ??
    (objetivo.tipo === 'semanal'
      ? Math.round(objetivo.importe * SEMANAS_MES)
      : objetivo.importe);
  const base = objetivo.modo === 'rellenar' ? saldo : asignado;
  const falta = Math.max(0, cuota - base);
  return {
    progreso: fraccion(base, cuota),
    falta,
    cuota,
    meses: null,
    estado: falta === 0 ? 'rumbo' : 'atrasado',
    deSaldo: false,
  };
}

// ---------------------------------------------------------------------------
// Evolución
// ---------------------------------------------------------------------------

/** Meses completos anteriores a `month` (los `n` últimos, en orden). */
export function mesesAnteriores(month: string, n: number): string[] {
  return monthUtils.rangeInclusive(
    monthUtils.subMonths(month, n),
    monthUtils.subMonths(month, 1),
  );
}

/**
 * Banda de lo habitual: mediana ± MAD. En una categoría irregular (pocos
 * meses con gasto) se calcula solo con los meses con gasto; si no, con todos
 * (con los 12 meses, la mediana de una irregular sería 0).
 */
export function bandaHabitual(
  gasto: readonly number[],
  irregular: boolean,
): { mediana: number; min: number; max: number } {
  const valores = irregular ? gasto.filter(v => v > 0) : [...gasto];
  const centro = mediana(valores);
  const d = mad(valores, centro);
  return { mediana: centro, min: Math.max(0, centro - d), max: centro + d };
}

/** Gasto irregular: ≤ la mitad de los meses con gasto (como el motor). */
export function esIrregular(gasto: readonly number[]): boolean {
  const conGasto = gasto.filter(v => v > 0).length;
  return gasto.length >= 6 && conGasto > 0 && conGasto <= gasto.length / 2;
}

/** Paso «bonito» del eje (1, 2, 5 × 10ⁿ) para unas `marcas` divisiones. */
export function pasoEje(maximo: number, marcas = 3): number {
  if (maximo <= 0) {
    return 1;
  }
  const bruto = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  const factor = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return factor * potencia;
}

/**
 * Mapa de estacionalidad: filas de 12 meses que acaban en el mes anterior a
 * `month` (la última fila) hacia atrás.
 */
export function filasEstacionalidad(month: string, anos: number): string[][] {
  const filas: string[][] = [];
  for (let a = anos - 1; a >= 0; a--) {
    const fin = monthUtils.subMonths(month, 1 + a * 12);
    filas.push(monthUtils.rangeInclusive(monthUtils.subMonths(fin, 11), fin));
  }
  return filas;
}

/**
 * Los dos meses del año (por posición en la fila) que más pesan en el gasto
 * de todas las filas, y su parte del total. `null` si no hay gasto.
 */
export function mesesFuertes(
  valores: readonly (readonly number[])[],
): { columnas: [number, number]; parte: number } | null {
  const porColumna = Array.from({ length: 12 }, (_, i) =>
    valores.reduce((s, fila) => s + Math.max(0, fila[i] ?? 0), 0),
  );
  const total = porColumna.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return null;
  }
  const orden = porColumna
    .map((v, i) => [v, i] as const)
    .sort((a, b) => b[0] - a[0]);
  const columnas: [number, number] = [orden[0][1], orden[1][1]];
  return { columnas, parte: (orden[0][0] + orden[1][0]) / total };
}

// ---------------------------------------------------------------------------
// Asesor de la ficha
// ---------------------------------------------------------------------------

/** Meses con datos mínimos para la regla de «no seguidos». */
export const MINIMO_HISTORIA_SEGUIDOS = 6;

export type ConsejoAsigna = {
  tipo: 'asigna';
  /** Lo que conviene asignar al mes. */
  importe: IntegerAmount;
  /** De dónde sale: el objetivo o el gasto habitual. */
  origen: 'objetivo' | 'habitual';
  /** Mínimo y máximo de los meses con gasto (null si no hubo gasto). */
  minimo: IntegerAmount | null;
  maximo: IntegerAmount | null;
  /** Media mensual de la ventana (todos los meses). */
  media: IntegerAmount;
};

export type ConsejoNoSeguidos = {
  tipo: 'no-seguidos';
  conGasto: number;
  meses: number;
  /** Única racha de dos o más meses seguidos con gasto (índices). */
  excepcion: { desde: number; hasta: number } | null;
};

/**
 * (a) «Asigna X; gastas mínimo Y y máximo Z (media W)». `importe` es la
 * cuota del objetivo o, sin objetivo, lo habitual. `null` si no hay nada
 * que proponer (sin objetivo ni gasto).
 */
export function consejoAsigna(
  gasto: readonly number[],
  importe: IntegerAmount | null,
  origen: ConsejoAsigna['origen'],
): ConsejoAsigna | null {
  if (importe == null || importe <= 0) {
    return null;
  }
  const conGasto = gasto.filter(v => v > 0);
  const media =
    gasto.length > 0
      ? Math.round(gasto.reduce((a, b) => a + Math.max(0, b), 0) / gasto.length)
      : 0;
  return {
    tipo: 'asigna',
    importe,
    origen,
    minimo: conGasto.length > 0 ? Math.min(...conGasto) : null,
    maximo: conGasto.length > 0 ? Math.max(...conGasto) : null,
    media,
  };
}

/** Rachas de meses seguidos con gasto: `[inicio, fin]` (índices). */
export function rachasConGasto(gasto: readonly number[]): [number, number][] {
  const rachas: [number, number][] = [];
  let inicio = -1;
  gasto.forEach((v, i) => {
    if (v > 0) {
      if (inicio < 0) {
        inicio = i;
      }
    } else if (inicio >= 0) {
      rachas.push([inicio, i - 1]);
      inicio = -1;
    }
  });
  if (inicio >= 0) {
    rachas.push([inicio, gasto.length - 1]);
  }
  return rachas;
}

/**
 * (b) «No la gastas dos meses seguidos: quizá no haga falta financiarla cada
 * mes». Con ≥ 6 meses de historia (desde el primer mes con gasto), algún mes
 * sin gasto, al menos dos con gasto y como mucho una racha de dos o más
 * meses seguidos con gasto (la excepción, p. ej. julio-agosto).
 */
export function consejoNoSeguidos(
  gasto: readonly number[],
): ConsejoNoSeguidos | null {
  const historia = recortarInicioSinDatos(gasto);
  if (historia.length < MINIMO_HISTORIA_SEGUIDOS) {
    return null;
  }
  const desplazamiento = gasto.length - historia.length;
  const conGasto = historia.filter(v => v > 0).length;
  if (conGasto < 2 || conGasto === historia.length) {
    return null;
  }
  const largas = rachasConGasto(historia).filter(([a, b]) => b > a);
  if (largas.length > 1) {
    return null;
  }
  return {
    tipo: 'no-seguidos',
    conGasto,
    meses: historia.length,
    excepcion: largas[0]
      ? {
          desde: largas[0][0] + desplazamiento,
          hasta: largas[0][1] + desplazamiento,
        }
      : null,
  };
}

/** Meses con datos (desde el primero con gasto) sobre los que se opina. */
export function mesesConHistoria(gasto: readonly number[]): number {
  return recortarInicioSinDatos(gasto).length;
}
