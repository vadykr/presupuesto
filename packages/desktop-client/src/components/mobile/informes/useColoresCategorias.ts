import { useCallback, useMemo } from 'react';

import type { CategoryEntity } from '@actual-app/core/types/models';

import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  colorDeCategoria,
  huecoDeCategoria,
  parseAsignacionColores,
} from './coloresCategorias';

/**
 * Color fijo de cada categoría en las gráficas de «Informes». Las
 * personalizaciones viven en la preferencia sincronizada `category-colors`.
 */
export function useColoresCategorias() {
  const [raw, setRaw] = useSyncedPref('category-colors');
  const asignacion = useMemo(() => parseAsignacionColores(raw), [raw]);

  const colorDe = useCallback(
    (id: CategoryEntity['id'] | null | undefined) =>
      colorDeCategoria(id ?? null, asignacion),
    [asignacion],
  );

  const huecoDe = useCallback(
    (id: CategoryEntity['id']) => huecoDeCategoria(id, asignacion),
    [asignacion],
  );

  const setHueco = useCallback(
    (id: CategoryEntity['id'], hueco: number) => {
      setRaw(JSON.stringify({ ...asignacion, [id]: hueco }));
    },
    [asignacion, setRaw],
  );

  return { colorDe, huecoDe, setHueco, asignacion };
}
