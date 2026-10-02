import { useCallback, useMemo } from 'react';

import type { CategoryEntity } from '@actual-app/core/types/models';

import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  asignarColoresVista,
  COLOR_SIN_CATEGORIA,
  colorDeCategoria,
  huecoDeCategoria,
  parseAsignacionColores,
  variableDeHueco,
} from './coloresCategorias';

type Id = CategoryEntity['id'] | null | undefined;

/**
 * Colores de categoría en «Informes». Sin `idsVista`, cada categoría usa su
 * hueco estable (hash del id). Con `idsVista` (las categorías que se ven en la
 * pantalla, de más a menos importe) se reparten huecos distintos entre ellas
 * para que no se repita ningún color (`asignarColoresVista`); la misma
 * categoría conserva su color en toda la pantalla. La preferencia
 * sincronizada `category-colors` manda en ambos casos.
 */
export function useColoresCategorias(idsVista?: ReadonlyArray<Id>) {
  const [raw, setRaw] = useSyncedPref('category-colors');
  const asignacion = useMemo(() => parseAsignacionColores(raw), [raw]);

  const claveVista = idsVista ? idsVista.map(id => id ?? '').join('|') : null;
  const vista = useMemo(
    () =>
      claveVista == null
        ? null
        : asignarColoresVista(
            claveVista.split('|').map(id => id || null),
            asignacion,
          ),
    [claveVista, asignacion],
  );

  const huecoDe = useCallback(
    (id: CategoryEntity['id']) =>
      vista?.get(id) ?? huecoDeCategoria(id, asignacion),
    [asignacion, vista],
  );

  const colorDe = useCallback(
    (id: Id) => {
      if (id == null) {
        return COLOR_SIN_CATEGORIA;
      }
      const hueco = vista?.get(id);
      return hueco !== undefined
        ? variableDeHueco(hueco)
        : colorDeCategoria(id, asignacion);
    },
    [asignacion, vista],
  );

  const setHueco = useCallback(
    (id: CategoryEntity['id'], hueco: number) => {
      setRaw(JSON.stringify({ ...asignacion, [id]: hueco }));
    },
    [asignacion, setRaw],
  );

  return { colorDe, huecoDe, setHueco, asignacion };
}
