import { useMemo } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { useQueries } from '@tanstack/react-query';

import type { BudgetMonthCell } from '#components/reports/spreadsheets/budgetMonthCell';

export type Presupuestado = Map<
  string,
  Map<CategoryEntity['id'], IntegerAmount>
>;

const CELDA_ASIGNADO = /^[^!]*!budget-(.+)$/;

function extraerPresupuestado(celdas: BudgetMonthCell[]) {
  const porCategoria = new Map<CategoryEntity['id'], IntegerAmount>();
  for (const celda of celdas) {
    // Las celdas de lo asignado son `<hoja>!budget-<id>`.
    const coincidencia = CELDA_ASIGNADO.exec(celda.name);
    const valor = Number(celda.value);
    if (coincidencia && Number.isFinite(valor)) {
      porCategoria.set(coincidencia[1], valor);
    }
  }
  return porCategoria;
}

/**
 * Lo presupuestado (asignado) por categoría en cada uno de los meses pedidos,
 * vía `envelope-budget-month`.
 */
export function usePresupuestado(meses: readonly string[]): {
  presupuestado: Presupuestado;
  isLoading: boolean;
} {
  const consultas = useQueries({
    queries: meses.map(mes => ({
      queryKey: ['informes', 'presupuestado', mes],
      queryFn: async () =>
        extraerPresupuestado(
          await send('envelope-budget-month', { month: mes }),
        ),
      staleTime: 30_000,
    })),
  });

  const datos = consultas.map(c => c.data);
  const isLoading = consultas.some(c => c.isLoading);
  const presupuestado = useMemo(() => {
    const mapa: Presupuestado = new Map();
    meses.forEach((mes, i) => {
      const porCategoria = datos[i];
      if (porCategoria) {
        mapa.set(mes, porCategoria);
      }
    });
    return mapa;
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `datos` se deriva de las consultas
  }, [meses, ...datos]);

  return { presupuestado, isLoading };
}
