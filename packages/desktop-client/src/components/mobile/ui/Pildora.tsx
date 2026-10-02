import type { CSSProperties, ReactNode } from 'react';

import { Text } from '@actual-app/components/text';

import { IconoZz } from './IconoZz';
import { color, movimiento, num, radio } from './tokens';

export type EstadoPildora = 'ok' | 'aviso' | 'rojo' | 'neutro' | 'ignorada';

const COLORES: Record<EstadoPildora, { fondo: string; texto: string }> = {
  ok: { fondo: color.okSoft, texto: color.ok },
  aviso: { fondo: color.warnSoft, texto: color.warn },
  rojo: { fondo: color.badSoft, texto: color.bad },
  neutro: { fondo: color.muteSoft, texto: color.fg2 },
  ignorada: { fondo: color.muteSoft, texto: color.fg3 },
};

export function coloresPildora(estado: EstadoPildora) {
  return COLORES[estado];
}

type PildoraProps = {
  estado: EstadoPildora;
  children?: ReactNode;
  /** «grande» (36 px) para chips tocables; «normal» (28 px) para estados. */
  tamano?: 'normal' | 'grande';
  style?: CSSProperties;
  'data-testid'?: string;
};

/**
 * Píldora de estado rellena: el color va en el fondo y en el texto.
 * Verde cubierta, ámbar le falta, rojo gastado de más, gris nada pendiente;
 * «ignorada» lleva zZ delante.
 */
export function Pildora({
  estado,
  children,
  tamano = 'normal',
  style,
  'data-testid': testId,
}: PildoraProps) {
  const { fondo, texto } = COLORES[estado];
  return (
    <Text
      data-testid={testId}
      data-estado={estado}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minHeight: tamano === 'grande' ? 36 : 28,
        padding: tamano === 'grande' ? '0 14px' : '0 10px',
        borderRadius: radio.pildora,
        backgroundColor: fondo,
        color: texto,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: `background-color ${movimiento.pildora}ms, color ${movimiento.pildora}ms`,
        ...num,
        ...style,
      }}
    >
      {estado === 'ignorada' && <IconoZz />}
      {children}
    </Text>
  );
}
