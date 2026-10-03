import { createContext, useContext } from 'react';

/** `true` mientras el Plan tiene un filtro activo: no se puede reordenar. */
export const SinArrastreContext = createContext(false);

export function useSinArrastre() {
  return useContext(SinArrastreContext);
}
