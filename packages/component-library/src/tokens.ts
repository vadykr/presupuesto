enum BreakpointNames {
  small = 'small',
  medium = 'medium',
  wide = 'wide',
}

type NumericBreakpoints = {
  [key in BreakpointNames]: number;
};

// Presupuesto: con la interfaz escalada en el móvil (index.html, Ajustes →
// Tamaño) la página tiene más ancho lógico; los puntos de corte se escalan
// igual para que siga viéndose la versión móvil.
const escala =
  (typeof window !== 'undefined' &&
    (window as unknown as { __presupuestoEscala?: number })
      .__presupuestoEscala) ||
  1;

export const breakpoints: NumericBreakpoints = {
  small: Math.round(512 / escala),
  medium: Math.round(730 / escala),
  wide: Math.round(1100 / escala),
};

type BreakpointsPx = {
  [B in keyof NumericBreakpoints as `breakpoint_${B}`]: string;
};

// Provide the same breakpoints in a form usable by CSS media queries
// {
//   breakpoint_small: '512px',
//   breakpoint_medium: '740px',
//   breakpoint_wide: '1100px',
// }
export const tokens: BreakpointsPx = Object.entries(
  breakpoints,
).reduce<BreakpointsPx>(
  (acc, [key, val]) => ({
    ...acc,
    [`breakpoint_${key}`]: `${val}px`,
  }),
  {} as BreakpointsPx,
);

type SpacingSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const spacing: Record<SpacingSize, number> = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

type RadiusSize = 'sm' | 'pill';

export const radius: Record<RadiusSize, number> = {
  sm: 4,
  pill: 999,
};
