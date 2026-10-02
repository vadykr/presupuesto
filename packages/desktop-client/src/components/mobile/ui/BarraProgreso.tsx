import type { CSSProperties } from 'react';

import { View } from '@actual-app/components/view';
import { keyframes } from '@emotion/css';

import { color as colores, movimiento } from './tokens';

const llenar = keyframes({
  from: { transform: 'scaleX(0)' },
  to: { transform: 'scaleX(1)' },
});

type BarraProgresoProps = {
  /** Fracción 0..1 (se recorta). */
  valor: number;
  /** Color del relleno (token o color CSS). */
  color?: string;
  alto?: number;
  style?: CSSProperties;
  'aria-label'?: string;
};

/** Barra de progreso de 8 px, redonda, con pista visible; se llena al aparecer. */
export function BarraProgreso({
  valor,
  color = colores.accent,
  alto = 8,
  style,
  'aria-label': ariaLabel,
}: BarraProgresoProps) {
  const fraccion = Math.max(0, Math.min(1, Number.isFinite(valor) ? valor : 0));
  return (
    <View
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraccion * 100)}
      style={{
        height: alto,
        borderRadius: alto / 2,
        backgroundColor: colores.surface3,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <View
        style={{
          width: `${fraccion * 100}%`,
          height: '100%',
          borderRadius: alto / 2,
          backgroundColor: color,
          transformOrigin: 'left center',
          animation: `${llenar} ${movimiento.cifra}ms ${movimiento.suave} both`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
    </View>
  );
}
