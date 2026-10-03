import { useEffect } from 'react';

import { css, keyframes } from '@emotion/css';

import { color, suave } from '#components/mobile/ui/tokens';

/**
 * Burbuja de sueño clásica del manga: la categoría «se duerme» y le sale una
 * burbuja translúcida con «zZ» que se hincha despacio, como respirando.
 * Mientras duerme queda pequeña junto al botón zZ (`BurbujaDormida`),
 * respirando; al despertarla revienta con partículas («pop»). Solo CSS/SVG,
 * superpuesta (posición absoluta, sin mover nada) y quieta o ausente con
 * «reducir movimiento». Dibujo propio.
 */

export const DURACION_BURBUJA = 1200;

const hincharse = keyframes({
  '0%': { transform: 'scale(0.15)', opacity: 0 },
  '30%': { transform: 'scale(0.55)', opacity: 0.9 },
  '55%': { transform: 'scale(0.5)', opacity: 1 },
  '85%': { transform: 'scale(1.05)', opacity: 1 },
  '100%': { transform: 'scale(1)', opacity: 1 },
});

const respirar = keyframes({
  '0%, 100%': { transform: 'scale(0.9)' },
  '50%': { transform: 'scale(1.08)' },
});

const reventar = keyframes({
  '0%': { transform: 'scale(1)', opacity: 1 },
  '22%': { transform: 'scale(1.25)', opacity: 1 },
  '34%, 100%': { transform: 'scale(1.5)', opacity: 0 },
});

const particulas = keyframes({
  '0%, 24%': { transform: 'scale(0.4)', opacity: 0 },
  '32%': { transform: 'scale(0.8)', opacity: 1 },
  '70%, 100%': { transform: 'scale(1.6)', opacity: 0 },
});

const sinMovimiento = css({
  '@media (prefers-reduced-motion: reduce)': {
    '& *': { animation: 'none !important' },
  },
});

function reduceMovimiento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** La burbuja en sí (SVG 40×40): círculo translúcido, brillo y «zZ». */
function Burbuja({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <circle
        cx={20}
        cy={20}
        r={17}
        fill={suave(color.accent, 16)}
        stroke={suave(color.accent, 65)}
        strokeWidth={1.4}
      />
      <path
        d="M10 15a11 11 0 0 1 7-6"
        fill="none"
        stroke={color.surface}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.9}
      />
      <text
        x={20}
        y={25}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill={color.fg2}
        style={{ letterSpacing: '-0.04em' }}
      >
        zZ
      </text>
    </svg>
  );
}

/** Burbuja pequeña que respira mientras la categoría duerme. */
export function BurbujaDormida({
  size = 22,
  'data-testid': testId,
}: {
  size?: number;
  'data-testid'?: string;
}) {
  return (
    <span
      className={sinMovimiento}
      data-testid={testId}
      style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}
    >
      <span
        style={{
          display: 'inline-flex',
          transformOrigin: '50% 80%',
          animation: `${respirar} 3.2s ease-in-out infinite`,
        }}
      >
        <Burbuja size={size} />
      </span>
    </span>
  );
}

/**
 * Animación de transición, superpuesta encima del botón zZ: «dormir» (la
 * burbuja se hincha despacio) o «despertar» (revienta con partículas).
 */
export function BurbujaSueno({
  modo,
  onFin,
}: {
  modo: 'dormir' | 'despertar';
  onFin: () => void;
}) {
  const reducir = reduceMovimiento();

  useEffect(() => {
    const id = window.setTimeout(onFin, reducir ? 0 : DURACION_BURBUJA);
    return () => window.clearTimeout(id);
  }, [onFin, reducir]);

  if (reducir) {
    return null;
  }

  const ms = `${DURACION_BURBUJA}ms`;
  const dormir = modo === 'dormir';
  return (
    <div
      aria-hidden
      data-testid={`burbuja-${modo}`}
      className={sinMovimiento}
      style={{
        position: 'absolute',
        bottom: 'calc(100% - 4px)',
        left: '50%',
        width: 64,
        height: 64,
        marginLeft: -32,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 6,
          transformOrigin: '50% 90%',
          animation: `${dormir ? hincharse : reventar} ${ms} cubic-bezier(.3,.7,.3,1) both`,
        }}
      >
        <Burbuja size={52} />
      </div>
      {!dormir && (
        <svg
          viewBox="0 0 64 64"
          width={64}
          height={64}
          style={{
            position: 'absolute',
            inset: 0,
            animation: `${particulas} ${ms} ease-out both`,
          }}
        >
          <g
            stroke={suave(color.accent, 85)}
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <path d="M32 6v-4M32 58v4M6 32H2M58 32h4M13 13l-3-3M51 13l3-3M13 51l-3 3M51 51l3 3" />
          </g>
          <g fill={suave(color.accent, 70)}>
            <circle cx={20} cy={8} r={2} />
            <circle cx={50} cy={22} r={1.6} />
            <circle cx={10} cy={44} r={1.8} />
            <circle cx={46} cy={56} r={2} />
          </g>
        </svg>
      )}
    </div>
  );
}
