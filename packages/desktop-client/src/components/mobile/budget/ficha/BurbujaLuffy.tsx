import { useEffect } from 'react';
import { Trans } from 'react-i18next';

import { css, keyframes } from '@emotion/css';

import { color, suave } from '#components/mobile/ui/tokens';

/**
 * Guiño a One Piece al ignorar el mes: la burbuja de mocos de Luffy cuando
 * duerme. Un sombrero de paja (SVG propio) se inclina, crece una burbuja
 * translúcida con «zZ» y hace «pop». Al despertar, la burbuja revienta y el
 * sombrero da un saltito («¡Arriba!»). Solo CSS/SVG, ~1,2 s, superpuesta al
 * botón (posición absoluta, sin mover nada) y nada con «reducir movimiento».
 */

export const DURACION_BURBUJA = 1250;

const inclinar = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '25%, 100%': { transform: 'rotate(-14deg)' },
});

const crecer = keyframes({
  '0%, 15%': { transform: 'scale(0)', opacity: 0.2 },
  '62%': { transform: 'scale(1)', opacity: 1 },
  '70%': { transform: 'scale(0.94)', opacity: 1 },
  '78%': { transform: 'scale(1.12)', opacity: 1 },
  '84%': { transform: 'scale(1.32)', opacity: 0 },
  '100%': { transform: 'scale(1.32)', opacity: 0 },
});

const reventar = keyframes({
  '0%': { transform: 'scale(1)', opacity: 1 },
  '14%': { transform: 'scale(1.1)', opacity: 1 },
  '24%, 100%': { transform: 'scale(1.35)', opacity: 0 },
});

const chispas = (inicio: number) =>
  keyframes({
    '0%': { transform: 'scale(0.5)', opacity: 0 },
    [`${inicio}%`]: { transform: 'scale(0.5)', opacity: 0 },
    [`${inicio + 4}%`]: { transform: 'scale(0.8)', opacity: 1 },
    [`${inicio + 18}%, 100%`]: { transform: 'scale(1.35)', opacity: 0 },
  });

const chispasDormir = chispas(80);
const chispasDespertar = chispas(18);

const saltar = keyframes({
  '0%': { transform: 'translateY(0) rotate(-14deg)' },
  '30%': { transform: 'translateY(0) rotate(0deg)' },
  '48%': { transform: 'translateY(-16px) rotate(6deg)' },
  '66%': { transform: 'translateY(0) rotate(0deg)' },
  '76%': { transform: 'translateY(-4px) rotate(0deg)' },
  '86%, 100%': { transform: 'translateY(0) rotate(0deg)' },
});

const arriba = keyframes({
  '0%, 40%': { transform: 'translateY(6px)', opacity: 0 },
  '58%, 88%': { transform: 'translateY(0)', opacity: 1 },
  '100%': { transform: 'translateY(-4px)', opacity: 0 },
});

const desvanecer = keyframes({
  '0%, 86%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const sinMovimiento = css({
  '@media (prefers-reduced-motion: reduce)': { display: 'none' },
});

function reduceMovimiento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function BurbujaLuffy({
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

  const dormir = modo === 'dormir';
  const ms = `${DURACION_BURBUJA}ms`;
  const tinta = color.fg2;
  const burbuja = color.accent;
  const anim = (k: string, origen: string) => ({
    transformBox: 'fill-box' as const,
    transformOrigin: origen,
    animation: `${k} ${ms} cubic-bezier(.3,.7,.3,1) both`,
  });

  return (
    <div
      aria-hidden
      data-testid={`burbuja-${modo}`}
      className={sinMovimiento}
      style={{
        position: 'absolute',
        bottom: 'calc(100% - 6px)',
        left: '50%',
        width: 120,
        height: 92,
        marginLeft: -60,
        pointerEvents: 'none',
        zIndex: 5,
        animation: `${desvanecer} ${ms} linear both`,
      }}
    >
      <svg viewBox="0 0 120 92" width={120} height={92}>
        {/* Sombrero de paja */}
        <g
          style={anim(dormir ? inclinar : saltar, '50% 100%')}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse
            cx={66}
            cy={78}
            rx={36}
            ry={8}
            fill={suave(color.warn, 55)}
            stroke={tinta}
            strokeWidth={1.6}
          />
          <path
            d="M44 77c0-17 10-27 22-27s22 10 22 27"
            fill={suave(color.warn, 70)}
            stroke={tinta}
            strokeWidth={1.6}
          />
          <path
            d="M44.5 71c7 3 14 4 21.5 4s14.5-1 21.5-4"
            fill="none"
            stroke={color.bad}
            strokeWidth={4}
          />
          <path
            d="M55 58c2-3 6-5 10-5"
            fill="none"
            stroke={tinta}
            strokeWidth={1.2}
            opacity={0.45}
          />
        </g>

        {/* Burbuja con «zZ» */}
        <g style={anim(dormir ? crecer : reventar, '80% 90%')}>
          <circle
            cx={30}
            cy={50}
            r={18}
            fill={suave(burbuja, 18)}
            stroke={suave(burbuja, 70)}
            strokeWidth={1.4}
          />
          <path
            d="M20 44a11 11 0 0 1 8-7"
            fill="none"
            stroke={color.surface}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.9}
          />
          <text
            x={30}
            y={55}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill={tinta}
            style={{ letterSpacing: '-0.04em' }}
          >
            zZ
          </text>
        </g>

        {/* «Pop» */}
        <g
          style={anim(dormir ? chispasDormir : chispasDespertar, '50% 50%')}
          stroke={suave(burbuja, 80)}
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M30 26v-6M30 74v6M6 50H0M54 50h6M13 33l-4-4M47 33l4-4M13 67l-4 4M47 67l4 4" />
        </g>

        {!dormir && (
          <text
            x={66}
            y={16}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill={color.accent}
            style={{ animation: `${arriba} ${ms} ease-out both` }}
          >
            <Trans>Wake up!</Trans>
          </text>
        )}
      </svg>
    </div>
  );
}
