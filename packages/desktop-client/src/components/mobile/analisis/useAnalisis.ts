import { useCallback, useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { CategoryEntity, NoteEntity } from '@actual-app/core/types/models';
import type { Template } from '@actual-app/core/types/models/templates';

import { useCategoriasExcluidas } from '#components/mobile/informes/useCategoriasExcluidas';
import { usePresupuestado } from '#components/mobile/informes/usePresupuestado';
import { useTotalesMensuales } from '#components/mobile/informes/useTotalesMensuales';
import { useCategories } from '#hooks/useCategories';
import { useQuery } from '#hooks/useQuery';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { analizar } from './motor';
import type { Consejo, ObjetivoCategoria, ResultadoAnalisis } from './motor';
import { idNotaPresupuesto, movimientosDeNotas } from './movimientos';

/** Meses de historial que mira el análisis (3 años + el actual). */
export const MESES_HISTORIAL = 37;
/** Meses de presupuesto que se cargan (los últimos 13 + el siguiente). */
const MESES_PRESUPUESTO = 13;

function parseGoalDef(goalDef: string | null | undefined): Template[] {
  if (!goalDef) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(goalDef);
    return Array.isArray(parsed) ? (parsed as Template[]) : [];
  } catch {
    return [];
  }
}

/**
 * Objetivo de una categoría a partir de sus plantillas (`goal_def`, las
 * mismas que escribe el parser de notas o la UI de automatizaciones).
 * «Acumulativo» = se ahorra para una fecha o un periodo largo (`by`,
 * `schedule`, `periodic` anual…): gastar 0 un mes es lo esperado.
 */
export function objetivoDePlantillas(
  goalDef: string | null | undefined,
): ObjetivoCategoria | null {
  const plantillas = parseGoalDef(goalDef).filter(t => t.type !== 'error');
  if (plantillas.length === 0) {
    return null;
  }
  let importe = 0;
  let acumulativo = false;
  for (const t of plantillas) {
    switch (t.type) {
      case 'simple':
        importe += Math.round((t.monthly ?? t.limit?.amount ?? 0) * 100);
        break;
      case 'periodic':
        if (t.period.period === 'month' || t.period.period === 'week') {
          importe += Math.round(t.amount * 100);
        } else {
          acumulativo = true;
        }
        break;
      case 'by':
      case 'schedule':
        acumulativo = true;
        break;
      case 'limit':
        importe += Math.round(t.amount * 100);
        break;
      default:
        break;
    }
  }
  return { importe, acumulativo };
}

function objetivosDeCategorias(
  categorias: readonly CategoryEntity[],
): Map<string, ObjetivoCategoria | null> {
  const mapa = new Map<string, ObjetivoCategoria | null>();
  for (const c of categorias) {
    mapa.set(c.id, objetivoDePlantillas(c.goal_def));
  }
  return mapa;
}

export function parseDescartados(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Clave de descarte: un consejo se descarta para el mes en curso. */
export function claveDescarte(id: string, mes: string): string {
  return `${id}@${mes}`;
}

/** Consejos descartados este mes (pref sincronizada `analisis-descartados`). */
export function useDescartados(mesActual: string) {
  const [raw, setRaw] = useSyncedPref('analisis-descartados');
  const descartados = useMemo(() => parseDescartados(raw), [raw]);
  const descartar = useCallback(
    (id: string) => {
      // Solo se guardan los del mes en curso: los viejos caducan solos.
      const vigentes = [...parseDescartados(raw)].filter(k =>
        k.endsWith(`@${mesActual}`),
      );
      setRaw(
        JSON.stringify([
          ...new Set([...vigentes, claveDescarte(id, mesActual)]),
        ]),
      );
    },
    [raw, setRaw, mesActual],
  );
  const restaurar = useCallback(
    (id: string) => {
      const clave = claveDescarte(id, mesActual);
      setRaw(
        JSON.stringify([...parseDescartados(raw)].filter(k => k !== clave)),
      );
    },
    [raw, setRaw, mesActual],
  );
  return { descartados, descartar, restaurar };
}

export type Analisis = ResultadoAnalisis & {
  /** Consejos sin los descartados este mes. */
  visibles: Consejo[];
  descartadosLista: Consejo[];
  mesActual: string;
  isLoading: boolean;
  descartar: (id: string) => void;
  restaurar: (id: string) => void;
};

/**
 * Datos y resultado del análisis inteligente: 37 meses de movimientos (las
 * categorías excluidas de Informes tampoco cuentan aquí), lo presupuestado
 * de los últimos 13 meses y el siguiente, los objetivos (plantillas de cada
 * categoría) y las notas de movimiento de dinero de los últimos 7 meses.
 */
export function useAnalisis(): Analisis {
  const mesActual = monthUtils.currentMonth();
  const { excluidas } = useCategoriasExcluidas();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: MESES_HISTORIAL,
    categoriasExcluidas: excluidas,
  });

  const mesesPresupuesto = useMemo(
    () => [
      ...monthUtils.rangeInclusive(
        monthUtils.subMonths(mesActual, MESES_PRESUPUESTO - 1),
        mesActual,
      ),
      monthUtils.nextMonth(mesActual),
    ],
    [mesActual],
  );
  const { presupuestado, isLoading: cargandoPresupuesto } =
    usePresupuestado(mesesPresupuesto);
  const { data: { list: listaCategorias } = { list: [] } } = useCategories();
  const objetivos = useMemo(
    () => objetivosDeCategorias(listaCategorias),
    [listaCategorias],
  );

  const idsNotas = useMemo(
    () => mesesPresupuesto.slice(-8).map(idNotaPresupuesto),
    [mesesPresupuesto],
  );
  const { data: notas } = useQuery<NoteEntity>(
    () =>
      q('notes')
        .filter({ id: { $oneof: idsNotas } })
        .select('*'),
    [idsNotas],
  );
  const traspasos = useMemo(
    () => movimientosDeNotas(notas ?? [], categorias),
    [notas, categorias],
  );
  // Las categorías que no cuentan en Informes tampoco entran en la propuesta.
  const categoriasVisibles = useMemo(
    () => new Map([...categorias].filter(([id]) => !excluidas.has(id))),
    [categorias, excluidas],
  );

  const resultado = useMemo(
    () =>
      analizar({
        meses,
        mesActual,
        movimientos,
        categorias: categoriasVisibles,
        presupuestado,
        objetivos,
        traspasos,
      }),
    [
      meses,
      mesActual,
      movimientos,
      categoriasVisibles,
      presupuestado,
      objetivos,
      traspasos,
    ],
  );

  const { descartados, descartar, restaurar } = useDescartados(mesActual);
  const visibles = useMemo(
    () =>
      resultado.consejos.filter(
        c => !descartados.has(claveDescarte(c.id, mesActual)),
      ),
    [resultado.consejos, descartados, mesActual],
  );
  const descartadosLista = useMemo(
    () =>
      resultado.consejos.filter(c =>
        descartados.has(claveDescarte(c.id, mesActual)),
      ),
    [resultado.consejos, descartados, mesActual],
  );

  return {
    ...resultado,
    visibles,
    descartadosLista,
    mesActual,
    isLoading: isLoading || cargandoPresupuesto,
    descartar,
    restaurar,
  };
}
