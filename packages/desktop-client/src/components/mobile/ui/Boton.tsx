import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import { Button } from '@actual-app/components/button';

import { color, movimiento, radio } from './tokens';

export type VarianteBoton = 'primario' | 'tonal' | 'fantasma' | 'aviso';

const VARIANTES: Record<VarianteBoton, { fondo: string; texto: string }> = {
  primario: { fondo: color.accent, texto: color.accentInk },
  tonal: { fondo: color.badSoft, texto: color.bad },
  aviso: { fondo: color.warnSoft, texto: color.warn },
  fantasma: { fondo: color.surface2, texto: color.fg },
};

type BotonProps = {
  variante?: VarianteBoton;
  /** Ancho completo, 54 px de alto y radio 18 (Guardar, Asignar…). */
  bloque?: boolean;
  children: ReactNode;
  style?: CSSProperties;
} & Omit<ComponentProps<typeof Button>, 'variant' | 'style' | 'children'>;

/** Botón del sistema A: 44 px mínimo, radio 14, peso 800. */
export function Boton({
  variante = 'primario',
  bloque = false,
  children,
  style,
  ...props
}: BotonProps) {
  const { fondo, texto } = VARIANTES[variante];
  return (
    <Button
      variant="bare"
      {...props}
      style={({ isPressed, isHovered, isDisabled }) => ({
        minHeight: bloque ? 54 : 44,
        width: bloque ? '100%' : undefined,
        borderRadius: bloque ? 18 : radio.boton,
        padding: '0 16px',
        fontWeight: 800,
        fontSize: bloque ? 16 : 14,
        gap: 8,
        flexShrink: 0,
        backgroundColor: fondo,
        color: texto,
        border: 0,
        opacity: isDisabled ? 0.45 : 1,
        filter: isHovered ? 'brightness(1.06)' : undefined,
        transform: isPressed ? 'scale(0.97)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
        ...style,
      })}
    >
      {children}
    </Button>
  );
}
