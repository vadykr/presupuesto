/**
 * Tokens del sistema de diseño móvil (concepto A · Cartera).
 *
 * Cada token es una variable CSS `--p-*` definida por los temas
 * «Presupuesto» (`@actual-app/components/themes/presupuesto-*.css`). Llevan
 * un valor de reserva con los colores de Actual para que la app siga siendo
 * legible si se elige un tema de Actual (Light, Dark, Midnight o uno
 * personalizado). Guía: docs-vadym/diseno.md.
 */

function v(nombre: string, reserva: string) {
  return `var(--p-${nombre}, ${reserva})`;
}

export const color = {
  bg: v('bg', 'var(--color-mobilePageBackground)'),
  surface: v('surface', 'var(--color-cardBackground)'),
  surface2: v('surface-2', 'var(--color-tableRowBackgroundHover)'),
  surface3: v('surface-3', 'var(--color-tableBorder)'),
  line: v('line', 'var(--color-tableBorder)'),
  line2: v('line-2', 'var(--color-tableBorderSeparator)'),
  fg: v('fg', 'var(--color-pageText)'),
  fg2: v('fg-2', 'var(--color-pageTextLight)'),
  fg3: v('fg-3', 'var(--color-pageTextSubdued)'),
  accent: v('accent', 'var(--color-buttonPrimaryBackground)'),
  accent2: v('accent-2', 'var(--color-buttonPrimaryBackgroundHover)'),
  accentInk: v('accent-ink', 'var(--color-buttonPrimaryText)'),
  accentSoft: v('accent-soft', 'var(--color-pillBackgroundSelected)'),
  ok: v('ok', 'var(--color-noticeTextLight)'),
  okSoft: v('ok-soft', 'var(--color-noticeBackgroundLight)'),
  warn: v('warn', 'var(--color-warningText)'),
  warnSoft: v('warn-soft', 'var(--color-warningBackground)'),
  bad: v('bad', 'var(--color-errorText)'),
  badSoft: v('bad-soft', 'var(--color-errorBackground)'),
  muteSoft: v('mute-soft', 'var(--color-pillBackground)'),
  heroA: v('hero-a', 'var(--color-noticeBackgroundDark)'),
  heroB: v('hero-b', 'var(--color-noticeBackground)'),
  heroFg: v('hero-fg', 'var(--color-noticeTextDark)'),
  cardA: v('card-a', 'var(--color-tableHeaderBackground)'),
  cardB: v('card-b', 'var(--color-tableBackground)'),
  cardC: v('card-c', 'var(--color-mobileHeaderBackground)'),
  cardD: v('card-d', 'var(--color-tableHeaderBackground)'),
} as const;

/** Huecos de la paleta categórica (`--p-k0..k11`). */
export const NUM_COLORES_CATEGORIA = 12;

/** Los 12 colores de categoría (los mismos huecos que `useColoresCategorias`). */
export const COLORES_CATEGORIA = Array.from(
  { length: NUM_COLORES_CATEGORIA },
  (_, i) =>
    `var(--p-k${i}, var(--informes-c${i}, var(--color-chartQual${(i % 8) + 1})))`,
);

export function colorCategoria(hueco: number): string {
  const n = NUM_COLORES_CATEGORIA;
  return COLORES_CATEGORIA[((hueco % n) + n) % n];
}

/** Mezcla un color con transparente (fondo suave de píldoras y cajitas). */
export function suave(colorCss: string, porcentaje = 18): string {
  return `color-mix(in srgb, ${colorCss} ${porcentaje}%, transparent)`;
}

export const radio = {
  /** cajitas de icono pequeñas */
  sm: 12,
  /** botones y teclas */
  boton: 14,
  /** tarjetas */
  tarjeta: 20,
  /** héroe, hojas y barra de pestañas */
  heroe: 24,
  pildora: 999,
} as const;

export const espacio = {
  /** dentro de una fila */
  fila: 8,
  /** entre icono y texto */
  icono: 12,
  /** entre tarjetas */
  tarjetas: 14,
  /** margen de página y relleno de tarjeta */
  margen: 16,
  /** entre secciones */
  seccion: 24,
} as const;

export const sombra = {
  tarjeta: v(
    'shadow',
    '0 1px 2px rgba(20, 30, 60, 0.06), 0 8px 24px rgba(20, 30, 60, 0.08)',
  ),
  hoja: v('shadow-sheet', '0 -8px 24px rgba(0, 0, 0, 0.2)'),
} as const;

/** Interlineado general del texto corrido. */
export const INTERLINEADO = 1.25;

/**
 * Tamaños tipográficos (Manrope, pesos altos). Escala contenida (pulido,
 * oct-2026): cabecera 28, héroe 32, títulos 15-16, cuerpo 14-15, secundario 13.
 */
export const texto = {
  display: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' },
  /** Número héroe (Asignar, detalle de informe). */
  heroe: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.05,
  },
  cifra: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' },
  titulo: { fontSize: 16, fontWeight: 800 },
  /** Título de sección sobre un grupo de tarjetas. */
  seccion: { fontSize: 15, fontWeight: 800 },
  fila: { fontSize: 15, fontWeight: 700 },
  cuerpo: { fontSize: 14, fontWeight: 500, lineHeight: INTERLINEADO },
  /** Texto secundario (frases bajo un número, detalles). */
  secundario: { fontSize: 13, fontWeight: 500, lineHeight: INTERLINEADO },
  pequeno: { fontSize: 12.5, fontWeight: 700 },
  etiqueta: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
} as const;

export const num = { fontVariantNumeric: 'tabular-nums' } as const;

/** Movimiento: físico, con muelle. */
export const movimiento = {
  muelle: 'cubic-bezier(.2,.9,.3,1.15)',
  suave: 'cubic-bezier(.2,.8,.2,1)',
  tarjeta: 380,
  hoja: 320,
  fondo: 200,
  pildora: 180,
  cifra: 400,
  pulsar: 90,
} as const;

/** Alto mínimo de cualquier zona táctil. */
export const TACTIL = 44;
