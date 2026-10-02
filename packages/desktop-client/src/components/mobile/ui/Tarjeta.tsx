import type { CSSProperties, ReactNode } from 'react';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';

import { color, espacio, movimiento, radio, sombra } from './tokens';

type TarjetaProps = {
  children: ReactNode;
  style?: CSSProperties;
  /** Si se pasa, toda la tarjeta es tocable (baja a 0,97 al pulsar). */
  onPress?: () => void;
  /** «punteada»: borde discontinuo y sin fondo (huchas, huecos vacíos). */
  variante?: 'normal' | 'punteada';
  /** Relleno interior; 0 para listas que llegan al borde. */
  relleno?: number;
  'aria-label'?: string;
  'data-testid'?: string;
};

export function estiloTarjeta(
  variante: 'normal' | 'punteada' = 'normal',
  relleno: number = espacio.margen,
): CSSProperties {
  return variante === 'punteada'
    ? {
        backgroundColor: 'transparent',
        border: `1.5px dashed ${color.line2}`,
        borderRadius: radio.tarjeta,
        padding: relleno,
      }
    : {
        backgroundColor: color.surface,
        borderRadius: radio.tarjeta,
        boxShadow: sombra.tarjeta,
        padding: relleno,
      };
}

/** Tarjeta elevada del sistema A: fondo `surface`, radio 20, sombra suave. */
export function Tarjeta({
  children,
  style,
  onPress,
  variante = 'normal',
  relleno = espacio.margen,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: TarjetaProps) {
  const base = {
    ...estiloTarjeta(variante, relleno),
    flexShrink: 0,
    minWidth: 0,
    overflow: 'hidden',
  } as const;

  if (onPress) {
    return (
      <Button
        variant="bare"
        onPress={onPress}
        aria-label={ariaLabel}
        data-testid={testId}
        style={({ isPressed }) => ({
          ...base,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          textAlign: 'left',
          color: color.fg,
          transform: isPressed ? 'scale(0.97)' : undefined,
          transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
          ...style,
        })}
      >
        {children}
      </Button>
    );
  }

  return (
    <View
      aria-label={ariaLabel}
      data-testid={testId}
      style={{ ...base, ...style }}
    >
      {children}
    </View>
  );
}
