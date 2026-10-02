import type { CSSProperties } from 'react';

import { Text } from '@actual-app/components/text';

import { separarEmoji } from './emoji';
import { colorCategoria, radio, suave } from './tokens';

type PildoraCategoriaProps = {
  nombre: string;
  /** Hueco 0..7 de `useColoresCategorias`; sin hueco, gris. */
  hueco?: number | null;
  tamano?: 'pequena' | 'normal';
  style?: CSSProperties;
};

/** Píldora de categoría: emoji + nombre sobre su color de categoría al 18 %. */
export function PildoraCategoria({
  nombre,
  hueco,
  tamano = 'normal',
  style,
}: PildoraCategoriaProps) {
  const { emoji, resto } = separarEmoji(nombre);
  const tinta =
    hueco == null
      ? 'var(--p-fg-2, var(--color-pageTextLight))'
      : colorCategoria(hueco);
  const pequena = tamano === 'pequena';
  return (
    <Text
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: pequena ? 4 : 6,
        minHeight: pequena ? 22 : 32,
        maxWidth: '100%',
        padding: pequena ? '0 8px 0 6px' : '0 12px 0 8px',
        borderRadius: radio.pildora,
        backgroundColor: suave(tinta),
        color: tinta,
        fontWeight: 800,
        fontSize: pequena ? 11.5 : 13.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {emoji ? resto : nombre}
      </span>
    </Text>
  );
}
