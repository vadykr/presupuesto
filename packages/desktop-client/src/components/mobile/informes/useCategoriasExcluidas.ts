import { useCallback, useMemo } from 'react';

import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { useCategories } from '#hooks/useCategories';
import { useSyncedPref } from '#hooks/useSyncedPref';

/**
 * Grupos que, por defecto, no cuentan como gasto en «Informes»: deudas,
 * partidas no computables e inversiones (traspasos de patrimonio, no consumo).
 */
export const GRUPOS_EXCLUIDOS_POR_DEFECTO = [
  'deutes',
  'no computables',
  'inversions',
] as const;

function normalizar(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function esGrupoExcluidoPorDefecto(nombre: string): boolean {
  const n = normalizar(nombre);
  return GRUPOS_EXCLUIDOS_POR_DEFECTO.some(patron => n.includes(patron));
}

export function parseExcluidas(raw: string | undefined): string[] | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : null;
  } catch {
    return null;
  }
}

/**
 * Categorías excluidas por defecto: todas las de los grupos cuyo nombre
 * contenga «Deutes», «No computables» o «Inversions».
 */
export function excluidasPorDefecto(
  grupos: readonly CategoryGroupEntity[],
): string[] {
  return grupos
    .filter(g => !g.is_income && esGrupoExcluidoPorDefecto(g.name))
    .flatMap(g => (g.categories ?? []).map(c => c.id));
}

/**
 * Filtro persistente «qué categorías cuentan» (preferencia sincronizada
 * `informes-excluidas`, JSON array de ids). Sin preferencia guardada se usa
 * el criterio por defecto por nombre de grupo.
 */
export function useCategoriasExcluidas() {
  const [raw, setRaw] = useSyncedPref('informes-excluidas');
  const { data: { grouped: grupos } = { grouped: [] } } = useCategories();

  const guardadas = useMemo(() => parseExcluidas(raw), [raw]);
  const esPorDefecto = guardadas === null;

  const excluidas = useMemo(
    () => new Set(guardadas ?? excluidasPorDefecto(grupos)),
    [guardadas, grupos],
  );

  const setExcluidas = useCallback(
    (ids: Iterable<CategoryEntity['id']>) => {
      setRaw(JSON.stringify([...ids]));
    },
    [setRaw],
  );

  const restablecer = useCallback(() => {
    setRaw(undefined);
  }, [setRaw]);

  return { excluidas, setExcluidas, restablecer, esPorDefecto };
}
