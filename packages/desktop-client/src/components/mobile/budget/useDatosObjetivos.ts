import { useEffect, useMemo, useState } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { CategoryEntity, NoteEntity } from '@actual-app/core/types/models';

import { useQuery } from '#hooks/useQuery';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { categoriasDormidas } from './dormir';
import {
  categoriasIgnoradas,
  metaDeObjetivo,
  objetivoDesdePlantillas,
} from './objetivos';
import type { DatosCategoriaMes } from './objetivos';
import { useDormidas } from './useIgnorarMes';

const CAMPOS = [
  'goal',
  'long-goal',
  'budget',
  'leftover',
  'sum-amount',
] as const;

/**
 * Valores vivos de la hoja de un mes (objetivo, asignado, saldo, gastado)
 * para una lista de categorías. Se suscribe a las celdas igual que
 * `useSheetValue`, pero para todas a la vez, de modo que la cabecera de
 * «Asignar el mes» pueda sumar lo infrafinanciado. Incluye si la categoría
 * está «ignorada este mes» (marca `#ignorar-mes` en su nota de mes).
 */
export function useDatosObjetivos(
  month: string,
  categories: readonly CategoryEntity[],
): Map<CategoryEntity['id'], DatosCategoriaMes> {
  const spreadsheet = useSpreadsheet();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const sheetName = monthUtils.sheetForMonth(month);
  const [celdas, setCeldas] = useState<Record<string, number | null>>({});

  const ids = useMemo(() => categories.map(c => c.id), [categories]);

  // Notas: solo para la marca «#ignorar-mes» de las notas de mes
  // (`<categoría>-<mes>`). Se filtran aquí porque AQL no admite `$like`
  // sobre un campo de tipo id.
  const { data: notas } = useQuery<NoteEntity>(
    () => q('notes').select('*'),
    [],
  );
  // Ignoradas = marca de la nota de mes o dormidas ese mes (`dormir.ts`).
  const { dormidas } = useDormidas();
  const ignoradas = useMemo(
    () =>
      new Set([
        ...categoriasIgnoradas(notas, month),
        ...categoriasDormidas(dormidas, month),
      ]),
    [notas, month, dormidas],
  );

  // Meta total de los objetivos por fecha: lo que sobra se mide sobre ella.
  const metas = useMemo(() => {
    const notaDe = new Map((notas ?? []).map(n => [n.id, n.note]));
    const mapa = new Map<string, number | null>();
    for (const c of categories) {
      if (!c.goal_def) {
        continue;
      }
      try {
        const plantillas = JSON.parse(c.goal_def);
        if (Array.isArray(plantillas)) {
          mapa.set(
            c.id,
            metaDeObjetivo(
              objetivoDesdePlantillas(plantillas, notaDe.get(c.id)),
            ),
          );
        }
      } catch {
        // goal_def ilegible: sin meta.
      }
    }
    return mapa;
  }, [categories, notas]);

  useEffect(() => {
    setCeldas({});
    const unbinds: (() => void)[] = [];
    for (const id of ids) {
      for (const campo of CAMPOS) {
        const name = `${campo}-${id}`;
        unbinds.push(
          spreadsheet.bind(sheetName, { name }, result => {
            const value =
              typeof result.value === 'number' ? result.value : null;
            setCeldas(prev =>
              prev[name] === value ? prev : { ...prev, [name]: value },
            );
          }),
        );
      }
    }
    return () => {
      unbinds.forEach(unbind => unbind());
    };
  }, [ids, sheetName, spreadsheet, budgetType]);

  return useMemo(() => {
    const datos = new Map<CategoryEntity['id'], DatosCategoriaMes>();
    for (const id of ids) {
      datos.set(id, {
        goal: celdas[`goal-${id}`] ?? null,
        longGoal: celdas[`long-goal-${id}`] === 1,
        budgeted: celdas[`budget-${id}`] ?? 0,
        balance: celdas[`leftover-${id}`] ?? 0,
        spent: celdas[`sum-amount-${id}`] ?? 0,
        ignorada: ignoradas.has(id),
        meta: metas.get(id) ?? null,
      });
    }
    return datos;
  }, [celdas, ids, ignoradas, metas]);
}
