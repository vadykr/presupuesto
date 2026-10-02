import { useEffect, useMemo, useState } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

import type { DatosCategoriaMes } from './objetivos';

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
 * «Asignar el mes» pueda sumar lo infrafinanciado.
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
      });
    }
    return datos;
  }, [celdas, ids]);
}
