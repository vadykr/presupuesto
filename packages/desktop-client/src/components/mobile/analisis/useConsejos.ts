import { useMemo } from 'react';

import { useRedactor } from './AnalisisPage';
import { redactar } from './frases';
import { useAnalisis } from './useAnalisis';

/**
 * Puente para el widget «Consejos» del Inicio (`mobile/inicio/widgets/Consejos`),
 * que carga este módulo si existe y espera `{ total, primero, isLoading }`.
 */
export function useConsejos() {
  const redactor = useRedactor();
  const { visibles, isLoading } = useAnalisis();
  return useMemo(
    () => ({
      total: visibles.length,
      primero: visibles[0] ? redactar(visibles[0], redactor) : null,
      isLoading,
    }),
    [visibles, redactor, isLoading],
  );
}
