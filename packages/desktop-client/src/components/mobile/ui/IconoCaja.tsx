import type { CSSProperties, ReactNode } from 'react';

import { View } from '@actual-app/components/view';

import { Icono } from './Icono';
import type { NombreIcono } from './Icono';
import { color, radio, suave } from './tokens';

export type TonoCaja = 'acento' | 'ok' | 'aviso' | 'rojo' | 'neutro' | 'plano';

const TONOS: Record<TonoCaja, { fondo: string; texto: string }> = {
  acento: { fondo: color.accentSoft, texto: color.accent },
  ok: { fondo: color.okSoft, texto: color.ok },
  aviso: { fondo: color.warnSoft, texto: color.warn },
  rojo: { fondo: color.badSoft, texto: color.bad },
  neutro: { fondo: color.surface2, texto: color.fg2 },
  plano: { fondo: color.surface, texto: color.fg },
};

type IconoCajaProps = {
  /** Icono Lucide; o `children` (un emoji, por ejemplo). */
  icono?: NombreIcono;
  children?: ReactNode;
  tono?: TonoCaja;
  /** Color propio (p. ej. un color de categoría): fondo al 18 %. */
  colorPropio?: string;
  /** Lado de la caja: 32, 36, 40 o 44. */
  size?: number;
  redonda?: boolean;
  style?: CSSProperties;
};

/**
 * El icono como pieza física de la tarjeta: Lucide 2 px dentro de una cajita
 * de color suave de 32-44 px.
 */
export function IconoCaja({
  icono,
  children,
  tono = 'neutro',
  colorPropio,
  size = 44,
  redonda = false,
  style,
}: IconoCajaProps) {
  const { fondo, texto } = colorPropio
    ? { fondo: suave(colorPropio), texto: colorPropio }
    : TONOS[tono];
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: redonda
          ? '50%'
          : size >= 44
            ? radio.boton
            : size >= 36
              ? radio.sm
              : 10,
        backgroundColor: fondo,
        color: texto,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
        ...style,
      }}
    >
      {icono ? (
        <Icono nombre={icono} size={Math.round(size * 0.48)} />
      ) : (
        children
      )}
    </View>
  );
}
