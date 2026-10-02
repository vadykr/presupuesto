import type { CSSProperties } from 'react';

type IconoZzProps = {
  width?: number;
  height?: number;
  style?: CSSProperties;
};

/** Icono «zZ» (categoría ignorada este mes, el *snooze* de YNAB). */
export function IconoZz({ width = 14, height = 14, style }: IconoZzProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M3 14h6l-6 7h6" />
      <path d="M13 3h8l-8 9h8" />
    </svg>
  );
}
