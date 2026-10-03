import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import {
  cuotaMensual,
  proximoVencimiento,
  sumarMeses,
} from '#components/mobile/budget/objetivos';
import type { Objetivo } from '#components/mobile/budget/objetivos';

export { proximoVencimiento, sumarMeses };

/**
 * «Gasto anual»: cálculo puro (sin React) de las categorías que se pagan una
 * vez al año o en una fecha (IBI, seguro del coche, ITV…) y que se van
 * pagando poco a poco cada mes. Cada categoría sale con su próximo
 * vencimiento, lo ahorrado (disponible), la cuota mensual y un estado:
 *
 * - `cubierta`: lo ahorrado ya llega al importe.
 * - `al-dia`: la cuota de este mes ya está asignada.
 * - `faltan`: falta parte de la cuota de este mes (ámbar).
 * - `atrasada`: el vencimiento ya pasó o es este mes y no llega (rojo).
 * - `sin-objetivo`: grupo marcado por el usuario sin objetivo con fecha.
 */

export type EstadoAnual =
  | 'cubierta'
  | 'al-dia'
  | 'faltan'
  | 'atrasada'
  | 'sin-objetivo';

/** Una categoría candidata, con los datos del mes actual (céntimos). */
export type EntradaAnual = {
  id: string;
  nombre: string;
  grupoId: string;
  grupoNombre: string;
  /** Objetivo de la categoría (solo cuentan `anual` y `una-vez`). */
  objetivo: Objetivo | null;
  /** Disponible (`leftover`) del mes actual. */
  saldo: IntegerAmount;
  /** Asignado este mes. */
  asignado: IntegerAmount;
  /** Actividad del mes (negativa si es gasto). */
  actividad: IntegerAmount;
};

export type FilaAnual = {
  id: string;
  nombre: string;
  grupoId: string;
  grupoNombre: string;
  /** Importe del objetivo; `null` si no tiene objetivo con fecha. */
  importe: IntegerAmount | null;
  /** Próximo vencimiento `YYYY-MM-DD`; `null` sin objetivo con fecha. */
  vence: string | null;
  /** Mes del vencimiento `YYYY-MM`. */
  mesVence: string | null;
  /** Disponible (puede ser negativo). */
  saldo: IntegerAmount;
  /** Ahorrado para el objetivo: el saldo recortado a 0..importe. */
  ahorrado: IntegerAmount;
  /** Cuota mensual necesaria (planificada al inicio del mes). */
  cuota: IntegerAmount;
  /** Lo que falta por asignar este mes para ir al día. */
  faltaEsteMes: IntegerAmount;
  /** Lo que falta en total hasta el importe. */
  faltaTotal: IntegerAmount;
  estado: EstadoAnual;
  /** 0..1 */
  progreso: number;
};

/** `true` si el objetivo es de los que se miden por fecha. */
export function esObjetivoAnual(
  objetivo: Objetivo | null | undefined,
): objetivo is Extract<Objetivo, { tipo: 'anual' | 'una-vez' }> {
  return objetivo?.tipo === 'anual' || objetivo?.tipo === 'una-vez';
}

function fraccion(parte: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, parte / total));
}

/**
 * Fila de «Gasto anual» de una categoría, o `null` si no debe aparecer
 * (objetivo de una sola vez ya vencido y pagado).
 *
 * Reglas:
 * - Si el vencimiento ya pasó (o es de este mes y su día ya pasó) y se ha
 *   gastado algo este mes, se da por pagado y se pasa al siguiente.
 * - Una sola vez vencida en un mes anterior solo se enseña si aún queda
 *   dinero ahorrado; si no, se da por cerrada.
 * - Cuota = `cuotaMensual` con el saldo de antes de asignar este mes, de modo
 *   que no cambia al asignar: «Al día» cuando lo asignado la cubre.
 */
export function calcularFila(
  entrada: EntradaAnual,
  hoy: string,
): FilaAnual | null {
  const base = {
    id: entrada.id,
    nombre: entrada.nombre,
    grupoId: entrada.grupoId,
    grupoNombre: entrada.grupoNombre,
    saldo: entrada.saldo,
  };
  const { objetivo } = entrada;
  if (!esObjetivoAnual(objetivo)) {
    return {
      ...base,
      importe: null,
      vence: null,
      mesVence: null,
      ahorrado: Math.max(0, entrada.saldo),
      cuota: 0,
      faltaEsteMes: 0,
      faltaTotal: 0,
      estado: 'sin-objetivo',
      progreso: 0,
    };
  }

  const mesActual = hoy.slice(0, 7);
  const importe = objetivo.importe;
  let vence = proximoVencimiento(objetivo, hoy);
  const pagado = entrada.actividad < 0;

  if (vence < hoy && pagado) {
    if (objetivo.tipo === 'una-vez') {
      return null;
    }
    // Pagado este mes: el siguiente vencimiento es el de la próxima vuelta.
    vence = sumarMeses(vence, objetivo.cadaMeses);
  }
  if (
    objetivo.tipo === 'una-vez' &&
    vence.slice(0, 7) < mesActual &&
    entrada.saldo <= 0
  ) {
    return null;
  }

  const mesVence = vence.slice(0, 7);
  const ahorrado = Math.max(0, Math.min(entrada.saldo, importe));
  const faltaTotal = Math.max(0, importe - entrada.saldo);
  const comun = {
    ...base,
    importe,
    vence,
    mesVence,
    ahorrado,
    faltaTotal,
    progreso: fraccion(ahorrado, importe),
  };

  if (faltaTotal === 0) {
    return {
      ...comun,
      cuota: 0,
      faltaEsteMes: 0,
      estado: 'cubierta',
    };
  }
  if (vence < hoy) {
    return {
      ...comun,
      cuota: faltaTotal,
      faltaEsteMes: faltaTotal,
      estado: 'atrasada',
    };
  }

  const saldoInicio = entrada.saldo - entrada.asignado;
  const cuota = cuotaMensual(importe, saldoInicio, vence, mesActual);
  const faltaEsteMes = Math.min(
    faltaTotal,
    Math.max(0, cuota - Math.max(0, entrada.asignado)),
  );
  return {
    ...comun,
    cuota,
    faltaEsteMes,
    estado: faltaEsteMes > 0 ? 'faltan' : 'al-dia',
  };
}

/** Filas de todas las entradas, ordenadas por vencimiento (sin fecha al final). */
export function calcularFilas(
  entradas: readonly EntradaAnual[],
  hoy: string,
): FilaAnual[] {
  const filas: FilaAnual[] = [];
  for (const entrada of entradas) {
    const fila = calcularFila(entrada, hoy);
    if (fila) {
      filas.push(fila);
    }
  }
  return filas.sort((a, b) => {
    if (a.vence == null || b.vence == null) {
      return a.vence == null ? (b.vence == null ? 0 : 1) : -1;
    }
    return a.vence === b.vence
      ? a.nombre.localeCompare(b.nombre)
      : a.vence.localeCompare(b.vence);
  });
}

export type GrupoMes = {
  /** `YYYY-MM`; `null` para las que no tienen fecha. */
  mes: string | null;
  filas: FilaAnual[];
};

/**
 * Agrupa por mes de vencimiento en orden cronológico (los meses ya pasados,
 * si los hay, primero; las filas sin fecha, al final).
 */
export function agruparPorMes(filas: readonly FilaAnual[]): GrupoMes[] {
  const porMes = new Map<string | null, FilaAnual[]>();
  for (const fila of filas) {
    const lista = porMes.get(fila.mesVence) ?? [];
    lista.push(fila);
    porMes.set(fila.mesVence, lista);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => {
      if (a == null || b == null) {
        return a == null ? (b == null ? 0 : 1) : -1;
      }
      return a.localeCompare(b);
    })
    .map(([mes, lista]) => ({
      mes,
      filas: [...lista].sort(
        (a, b) =>
          (a.vence ?? '').localeCompare(b.vence ?? '') ||
          a.nombre.localeCompare(b.nombre),
      ),
    }));
}

export type ResumenAnual = {
  /** Ahorrado para lo que vence en los próximos 12 meses. */
  ahorrado: IntegerAmount;
  /** Importe de lo que vence en los próximos 12 meses. */
  objetivo: IntegerAmount;
  /** Lo que toca asignar este mes para ir al día. */
  esteMes: IntegerAmount;
  /** Cuántas filas hay por estado. */
  porEstado: Record<EstadoAnual, number>;
};

/** Totales de la cabecera de «Gasto anual». */
export function resumir(
  filas: readonly FilaAnual[],
  mesActual: string,
): ResumenAnual {
  const resumen: ResumenAnual = {
    ahorrado: 0,
    objetivo: 0,
    esteMes: 0,
    porEstado: {
      cubierta: 0,
      'al-dia': 0,
      faltan: 0,
      atrasada: 0,
      'sin-objetivo': 0,
    },
  };
  for (const fila of filas) {
    resumen.porEstado[fila.estado] += 1;
    resumen.esteMes += fila.faltaEsteMes;
    if (
      fila.importe != null &&
      fila.mesVence != null &&
      monthUtils.differenceInCalendarMonths(fila.mesVence, mesActual) < 12
    ) {
      resumen.objetivo += fila.importe;
      resumen.ahorrado += fila.ahorrado;
    }
  }
  return resumen;
}

/** `true` si la fila está «al día» o «cubierta» (se puede plegar en el Plan). */
export function esPlegable(fila: Pick<FilaAnual, 'estado'>): boolean {
  return fila.estado === 'al-dia' || fila.estado === 'cubierta';
}

/** Ids que el Plan puede plegar. */
export function idsPlegables(filas: readonly FilaAnual[]): Set<string> {
  return new Set(filas.filter(esPlegable).map(f => f.id));
}

/** Pref `anual-grupos`: JSON array de ids de grupo. */
export function parseGrupos(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Pref `anual-seleccion`: qué entra en «Gasto anual». Una categoría entra si
 * su grupo está en `grupos` y ella no está en `excluidas`, o si está en
 * `categorias`.
 */
export type SeleccionAnual = {
  grupos: string[];
  categorias: string[];
  excluidas: string[];
};

function listaIds(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((id): id is string => typeof id === 'string')
    : [];
}

/** `null` si la pref no existe o no es válida (se usa el modo antiguo). */
export function parseSeleccion(raw: string | undefined): SeleccionAnual | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    return {
      grupos: listaIds(o.grupos),
      categorias: listaIds(o.categorias),
      excluidas: listaIds(o.excluidas),
    };
  } catch {
    return null;
  }
}

/** ¿Entra la categoría en la selección? */
export function incluida(
  seleccion: SeleccionAnual,
  categoriaId: string,
  grupoId: string,
): boolean {
  if (seleccion.categorias.includes(categoriaId)) {
    return true;
  }
  return (
    seleccion.grupos.includes(grupoId) &&
    !seleccion.excluidas.includes(categoriaId)
  );
}

/**
 * Selección que reproduce lo que salía antes: los grupos de `anual-grupos`
 * más las categorías automáticas (objetivo anual) de los demás grupos.
 */
export function seleccionInicial(
  grupos: readonly string[],
  automaticas: readonly { id: string; grupoId: string }[],
): SeleccionAnual {
  return {
    grupos: [...grupos],
    categorias: automaticas
      .filter(c => !grupos.includes(c.grupoId))
      .map(c => c.id),
    excluidas: [],
  };
}

export type GrupoSeleccionable = { id: string; categorias: { id: string }[] };

/** `todas`, `algunas` (estado intermedio) o `ninguna` para un grupo. */
export function estadoGrupo(
  seleccion: SeleccionAnual,
  grupo: GrupoSeleccionable,
): 'todas' | 'algunas' | 'ninguna' {
  if (grupo.categorias.length === 0) {
    return seleccion.grupos.includes(grupo.id) ? 'todas' : 'ninguna';
  }
  const n = grupo.categorias.filter(c =>
    incluida(seleccion, c.id, grupo.id),
  ).length;
  if (n === 0) {
    return 'ninguna';
  }
  return n === grupo.categorias.length ? 'todas' : 'algunas';
}

/** Marca todas las categorías del grupo, o las desmarca si ya están todas. */
export function conmutarGrupo(
  seleccion: SeleccionAnual,
  grupo: GrupoSeleccionable,
): SeleccionAnual {
  const ids = new Set(grupo.categorias.map(c => c.id));
  const resto = (l: string[]) => l.filter(id => !ids.has(id));
  const sinGrupo = seleccion.grupos.filter(g => g !== grupo.id);
  if (estadoGrupo(seleccion, grupo) === 'todas') {
    return {
      grupos: sinGrupo,
      categorias: resto(seleccion.categorias),
      excluidas: resto(seleccion.excluidas),
    };
  }
  return {
    grupos: [...sinGrupo, grupo.id],
    categorias: resto(seleccion.categorias),
    excluidas: resto(seleccion.excluidas),
  };
}

/** Marca o desmarca una categoría suelta. */
export function conmutarCategoria(
  seleccion: SeleccionAnual,
  categoriaId: string,
  grupoId: string,
): SeleccionAnual {
  const sin = (l: string[]) => l.filter(id => id !== categoriaId);
  const grupoMarcado = seleccion.grupos.includes(grupoId);
  if (incluida(seleccion, categoriaId, grupoId)) {
    return {
      ...seleccion,
      categorias: sin(seleccion.categorias),
      excluidas: grupoMarcado
        ? [...sin(seleccion.excluidas), categoriaId]
        : seleccion.excluidas,
    };
  }
  return grupoMarcado
    ? { ...seleccion, excluidas: sin(seleccion.excluidas) }
    : { ...seleccion, categorias: [...seleccion.categorias, categoriaId] };
}
