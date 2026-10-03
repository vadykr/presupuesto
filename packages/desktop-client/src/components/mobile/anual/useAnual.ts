import { useCallback, useEffect, useMemo, useState } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { CategoryEntity, NoteEntity } from '@actual-app/core/types/models';
import type { Template } from '@actual-app/core/types/models/templates';

import { prewarmMonth } from '#components/budget/util';
import { objetivoDesdePlantillas } from '#components/mobile/budget/objetivos';
import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import { useCategories } from '#hooks/useCategories';
import { useQuery } from '#hooks/useQuery';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  calcularFilas,
  esObjetivoAnual,
  incluida,
  parseGrupos,
  parseSeleccion,
  resumir,
} from './anual';
import type {
  EntradaAnual,
  FilaAnual,
  ResumenAnual,
  SeleccionAnual,
} from './anual';

export function plantillasDe(goalDef: string | null | undefined): Template[] {
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

/** Pref sincronizada `anual-grupos`: grupos marcados como «gasto anual». */
export function useGruposAnuales() {
  const [raw, setRaw] = useSyncedPref('anual-grupos');
  const grupos = useMemo(() => parseGrupos(raw), [raw]);
  const guardar = useCallback(
    (ids: Iterable<string>) => setRaw(JSON.stringify([...ids])),
    [setRaw],
  );
  return { grupos, guardar };
}

/** Pref sincronizada `anual-seleccion`; `null` mientras no existe. */
export function useSeleccionAnual() {
  const [raw, setRaw] = useSyncedPref('anual-seleccion');
  const seleccion = useMemo(() => parseSeleccion(raw), [raw]);
  const guardar = useCallback(
    (nueva: SeleccionAnual) => setRaw(JSON.stringify(nueva)),
    [setRaw],
  );
  return { seleccion, guardar };
}

/** Pref sincronizada `anual-ocultar-en-plan`: plegar lo «al día» en el Plan. */
export function useOcultarEnPlan() {
  const [raw, setRaw] = useSyncedPref('anual-ocultar-en-plan');
  const guardar = useCallback(
    (valor: boolean) => setRaw(valor ? 'true' : 'false'),
    [setRaw],
  );
  return { ocultar: raw === 'true', guardar };
}

export type DatosAnual = {
  filas: FilaAnual[];
  resumen: ResumenAnual;
  /** Hasta que los saldos del mes actual están cargados. */
  cargando: boolean;
  mesActual: string;
  /** Todas las categorías visibles; `automatica` si tienen objetivo anual. */
  todas: { categoria: CategoryEntity; automatica: boolean }[];
};

/**
 * Categorías de «Gasto anual» con su estado: las de objetivo anual o por
 * fecha, más las de los grupos marcados (`anual-grupos`); con `anual-seleccion`
 * solo entra lo seleccionado. Los saldos
 * son siempre los del mes actual. Con `activo = false` no se suscribe a nada.
 */
export function useAnual(activo = true): DatosAnual {
  const spreadsheet = useSpreadsheet();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const { data: { grouped } = { grouped: [] } } = useCategories();
  const { grupos: marcados } = useGruposAnuales();
  const { seleccion } = useSeleccionAnual();
  const mesActual = monthUtils.currentMonth();
  const hoy = monthUtils.currentDay();

  const { data: notas } = useQuery<NoteEntity>(
    () => q('notes').select('*'),
    [],
  );

  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!activo) {
      return;
    }
    let cancelado = false;
    void prewarmMonth(budgetType, spreadsheet, mesActual).then(() => {
      if (!cancelado) {
        setListo(true);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [activo, budgetType, spreadsheet, mesActual]);

  const todas = useMemo(() => {
    if (!activo) {
      return [];
    }
    const notaDe = new Map((notas ?? []).map(n => [n.id, n.note]));
    const lista: {
      categoria: CategoryEntity;
      grupoNombre: string;
      objetivo: ReturnType<typeof objetivoDesdePlantillas> | null;
      automatica: boolean;
    }[] = [];
    for (const grupo of grouped) {
      if (grupo.is_income || grupo.hidden) {
        continue;
      }
      for (const categoria of grupo.categories ?? []) {
        if (categoria.hidden) {
          continue;
        }
        const plantillas = plantillasDe(categoria.goal_def);
        const objetivo =
          plantillas.length > 0
            ? objetivoDesdePlantillas(plantillas, notaDe.get(categoria.id))
            : null;
        lista.push({
          categoria,
          grupoNombre: grupo.name,
          objetivo,
          automatica: esObjetivoAnual(objetivo === 'otro' ? null : objetivo),
        });
      }
    }
    return lista;
  }, [activo, grouped, notas]);

  const candidatas = useMemo(() => {
    const marcadas = new Set(marcados);
    return todas
      .filter(c =>
        seleccion
          ? incluida(seleccion, c.categoria.id, c.categoria.group)
          : c.automatica || marcadas.has(c.categoria.group),
      )
      .map(({ categoria, grupoNombre, objetivo }) => ({
        categoria,
        grupoNombre,
        objetivo,
      }));
  }, [todas, marcados, seleccion]);

  const categoriasCandidatas = useMemo(
    () => candidatas.map(c => c.categoria),
    [candidatas],
  );
  const datos = useDatosObjetivos(mesActual, categoriasCandidatas);

  const filas = useMemo(() => {
    const entradas: EntradaAnual[] = candidatas.map(
      ({ categoria, grupoNombre, objetivo }) => {
        const d = datos.get(categoria.id);
        return {
          id: categoria.id,
          nombre: categoria.name,
          grupoId: categoria.group,
          grupoNombre,
          objetivo: objetivo === 'otro' ? null : objetivo,
          saldo: d?.balance ?? 0,
          asignado: d?.budgeted ?? 0,
          actividad: d?.spent ?? 0,
        };
      },
    );
    return calcularFilas(entradas, hoy);
  }, [candidatas, datos, hoy]);

  const resumen = useMemo(() => resumir(filas, mesActual), [filas, mesActual]);

  return { filas, resumen, cargando: activo && !listo, mesActual, todas };
}
