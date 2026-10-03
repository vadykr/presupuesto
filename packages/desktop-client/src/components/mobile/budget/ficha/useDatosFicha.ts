import { useMemo } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import { useQueries } from '@tanstack/react-query';

const CELDA = /^[^!]*!(budget|leftover)-(.+)$/;

type CeldasMes = Map<string, IntegerAmount>;

function extraer(celdas: Awaited<ReturnType<typeof enviar>>): CeldasMes {
  const mapa: CeldasMes = new Map();
  for (const celda of celdas) {
    const m = CELDA.exec(celda.name);
    const valor = Number(celda.value);
    if (m && Number.isFinite(valor)) {
      mapa.set(`${m[1]}-${m[2]}`, valor);
    }
  }
  return mapa;
}

function enviar(month: string) {
  return send('envelope-budget-month', { month });
}

/**
 * Asignado y saldo de una categoría al final de cada mes pedido (vía
 * `envelope-budget-month`), para las gráficas de la ficha: la línea de lo
 * asignado (A) y el saldo acumulado (B).
 */
export function useHistoriaCategoria(
  categoryId: string,
  meses: readonly string[],
): { asignado: IntegerAmount[]; saldo: IntegerAmount[]; isLoading: boolean } {
  const consultas = useQueries({
    queries: meses.map(mes => ({
      queryKey: ['ficha', 'celdas', mes],
      queryFn: async () => extraer(await enviar(mes)),
      staleTime: 5_000,
    })),
  });
  const datos = consultas.map(c => c.data);
  const isLoading = consultas.some(c => c.isLoading);
  return useMemo(
    () => ({
      asignado: datos.map(d => d?.get(`budget-${categoryId}`) ?? 0),
      saldo: datos.map(d => d?.get(`leftover-${categoryId}`) ?? 0),
      isLoading,
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `datos` se deriva de las consultas
    [categoryId, isLoading, ...datos],
  );
}
