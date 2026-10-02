import type { CSSProperties } from 'react';

import { keyframes } from '@emotion/css';

const mecer = keyframes({
  '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
  '50%': { transform: 'translateY(-3px) rotate(2deg)' },
});

type BarquitoProps = {
  /** Se mece en bucle (2,4 s); quieto con «reducir movimiento». */
  meciendose?: boolean;
  width?: number;
  style?: CSSProperties;
};

/** Barquito de línea sobre las olas (guiño discreto a One Piece). */
export function Barquito({
  meciendose = false,
  width = 140,
  style,
}: BarquitoProps) {
  return (
    <svg
      viewBox="0 0 140 46"
      width={width}
      height={(width * 46) / 140}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: '50% 100%',
          animation: meciendose
            ? `${mecer} 2.4s ease-in-out infinite`
            : undefined,
        }}
        className="barquito"
      >
        <path d="M54 30h32l-5 7H59z" />
        <path d="M70 30V10" />
        <path d="M70 11c8 3 11 9 11 16H70" />
      </g>
      <path d="M8 41c8-4 14-4 22 0s14 4 22 0 14-4 22 0 14 4 22 0 14-4 22 0 14 4 18 1" />
      <style>
        {
          '@media (prefers-reduced-motion: reduce){.barquito{animation:none!important}}'
        }
      </style>
    </svg>
  );
}

/** Sombrero de paja de línea, con la cinta en el color de acento. */
export function Sombrero({
  width = 150,
  style,
}: {
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 150 80"
      width={width}
      height={(width * 80) / 150}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      <path d="M48 46c-22 3-36 8-36 14 0 8 28 14 63 14s63-6 63-14c0-6-14-11-36-14" />
      <path d="M48 47c0-17 12-29 27-29s27 12 27 29" />
      <path
        d="M48 44c8 3 17 4.5 27 4.5S94 47 102 44"
        stroke="var(--p-accent, currentColor)"
        strokeWidth={3}
      />
      <path d="M60 26c3-4 8-6 13-6" opacity={0.45} />
    </svg>
  );
}
