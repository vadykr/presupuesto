import { useCallback } from 'react';

import type { CategoryEntity } from '@actual-app/core/types/models';

import { useNavigate } from '#hooks/useNavigate';

/** Ruta de la ficha de una categoría (`?editar=1` abre el editor del objetivo). */
export function rutaFicha(
  id: CategoryEntity['id'],
  month: string,
  editar = false,
): string {
  return `/categories/${id}/ficha?month=${month}${editar ? '&editar=1' : ''}`;
}

/**
 * Abre la ficha única de una categoría (`FichaCategoriaPage`: disponible,
 * objetivo editable en el sitio, evolución, Asesor, notas y acciones). La
 * usan el Plan (mantener pulsado, «Detalles» del teclado) y «Asignar el mes».
 */
export function useFichaCategoria(month: string) {
  const navigate = useNavigate();
  return useCallback(
    (id: CategoryEntity['id'], opciones?: { editar?: boolean }) => {
      void navigate(rutaFicha(id, month, opciones?.editar));
    },
    [month, navigate],
  );
}
