import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { useQuery } from '@tanstack/react-query';

import { useCategories } from '#hooks/useCategories';
import { aqlQuery } from '#queries/aqlQuery';

import type { CategoriaInfo, Categorias, Movimiento } from './calculos';

type FilaConsulta = {
  date: string; // 'yyyy-MM'
  category: string | null;
  payee: string | null;
  amount: IntegerAmount;
};

/** Caducidad de la caché de movimientos (reutilizada entre páginas). */
const CADUCIDAD_MS = 30_000;

export function consultaMovimientos(desde: string, hasta: string) {
  return q('transactions')
    .filter({
      $and: [
        { date: { $transform: '$month', $gte: desde } },
        { date: { $transform: '$month', $lte: hasta } },
      ],
      // Solo cuentas del presupuesto…
      'account.offbudget': false,
      // …y sin traspasos entre cuentas del presupuesto (dinero que no sale).
      $or: [
        { 'payee.transfer_acct': null },
        { 'payee.transfer_acct.offbudget': true },
      ],
    })
    .groupBy([{ $month: '$date' }, { $id: '$category' }, { $id: '$payee' }])
    .select([
      { date: { $month: '$date' } },
      { category: { $id: '$category.id' } },
      { payee: { $id: '$payee.id' } },
      { amount: { $sum: '$amount' } },
    ]);
}

export function useMovimientosMensuales(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['informes', 'movimientos', desde, hasta],
    queryFn: async () => {
      const { data } = await aqlQuery(consultaMovimientos(desde, hasta));
      return (data as FilaConsulta[]).map<Movimiento>(fila => ({
        mes: fila.date,
        categoria: fila.category,
        payee: fila.payee,
        importe: fila.amount,
      }));
    },
    staleTime: CADUCIDAD_MS,
  });
}

/** Mapa id → info de categoría (nombre, grupo, ingreso, oculta). */
export function useCategoriasInfo(): Categorias {
  const { data: { grouped: grupos } = { grouped: [] } } = useCategories();
  return useMemo(() => {
    const mapa = new Map<string, CategoriaInfo>();
    for (const grupo of grupos) {
      for (const cat of grupo.categories ?? []) {
        mapa.set(cat.id, {
          id: cat.id,
          nombre: cat.name,
          grupo: grupo.id,
          nombreGrupo: grupo.name,
          esIngreso: Boolean(grupo.is_income || cat.is_income),
          oculta: Boolean(cat.hidden || grupo.hidden),
        });
      }
    }
    return mapa;
  }, [grupos]);
}

type Opciones = {
  /** Número de meses, acabando en `hasta` (incluido). */
  meses: number;
  /** Último mes del periodo ('yyyy-MM'); por defecto el actual. */
  hasta?: string;
  incluirOcultas?: boolean;
  /** Categorías que no cuentan. */
  categoriasExcluidas?: ReadonlySet<CategoryEntity['id']>;
};

export type TotalesMensuales = {
  movimientos: Movimiento[];
  categorias: Categorias;
  /** Meses del periodo en orden cronológico. */
  meses: string[];
  isLoading: boolean;
};

/**
 * Movimientos agrupados por mes × categoría × beneficiario para el periodo
 * pedido, sin traspasos ni cuentas fuera de presupuesto, con las categorías
 * ocultas y las excluidas ya filtradas. Con caché compartida entre páginas.
 */
export function useTotalesMensuales({
  meses,
  hasta = monthUtils.currentMonth(),
  incluirOcultas = false,
  categoriasExcluidas,
}: Opciones): TotalesMensuales {
  const desde = monthUtils.subMonths(hasta, Math.max(meses, 1) - 1);
  const { data, isLoading } = useMovimientosMensuales(desde, hasta);
  const categorias = useCategoriasInfo();

  const movimientos = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.filter(m => {
      if (m.categoria == null) {
        return true;
      }
      if (categoriasExcluidas?.has(m.categoria)) {
        return false;
      }
      const info = categorias.get(m.categoria);
      return incluirOcultas || !info?.oculta;
    });
  }, [data, categorias, categoriasExcluidas, incluirOcultas]);

  const rango = useMemo(
    () => monthUtils.rangeInclusive(desde, hasta),
    [desde, hasta],
  );

  return { movimientos, categorias, meses: rango, isLoading };
}
