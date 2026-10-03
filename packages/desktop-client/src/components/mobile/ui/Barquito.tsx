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

/** Barquito de línea sobre las olas (dibujo propio). */
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

/** Ancla de línea (nada pendiente: «fondeado»), dibujo propio. */
export function Ancla({
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
      <circle cx="75" cy="13" r="6" />
      <path d="M75 19v52" />
      <path d="M63 29h24" />
      <path
        d="M49 50c2 13 13 21 26 21s24-8 26-21"
        stroke="var(--p-accent, currentColor)"
        strokeWidth={3}
      />
      <path d="M44 55l5-6 6 5M106 55l-5-6-6 5" />
    </svg>
  );
}
