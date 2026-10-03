import { useWindowSize } from 'usehooks-ts';

import { breakpoints } from '#tokens';

/** Ancho de la columna móvil en pantallas anchas (igual que en index.html). */
export const ANCHO_COLUMNA = 480;
/** A partir de este ancho de ventana se usa la columna centrada. */
export const ANCHO_MINIMO_COLUMNA = 600;

export function useResponsive() {
  const { height, width: anchoVentana } = useWindowSize({
    debounceDelay: 250,
  });
  // Presupuesto: en pantallas anchas (PC, tableta) la app se ve como en el
  // móvil, en una columna centrada (index.html): se mide la columna.
  const width =
    anchoVentana >= ANCHO_MINIMO_COLUMNA ? ANCHO_COLUMNA : anchoVentana;

  // Possible view modes: narrow, small, medium, wide
  // To check if we're at least small width, check !isNarrowWidth
  return {
    // atLeastMediumWidth is provided to avoid checking (isMediumWidth || isWideWidth)
    atLeastMediumWidth: width >= breakpoints.medium,
    isNarrowWidth: width < breakpoints.small,
    isSmallWidth: width >= breakpoints.small && width < breakpoints.medium,
    isMediumWidth: width >= breakpoints.medium && width < breakpoints.wide,
    // No atLeastWideWidth because that's identical to isWideWidth
    isWideWidth: width >= breakpoints.wide,
    height,
    width,
  };
}
