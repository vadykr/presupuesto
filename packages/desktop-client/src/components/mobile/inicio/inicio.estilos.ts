import type { CSSProperties } from 'react';

import { keyframes } from '@emotion/css';

import type { EstadoPildora } from '#components/mobile/ui/Pildora';
import {
  color,
  espacio,
  movimiento,
  num,
  radio,
  TACTIL,
  texto,
} from '#components/mobile/ui/tokens';

import type { EstadoAvance } from './avance';

/**
 * Estilos de la pantalla de inicio con el sistema A · Cartera
 * (docs-vadym/diseno.md). Todo sale de `#components/mobile/ui/tokens`: nada
 * de hex ni de colores de Actual aquí.
 */

/** Color de texto/trazo y fondo suave por estado (anillos, cajitas). */
export const coloresEstado: Record<
  EstadoAvance,
  { color: string; fondo: string }
> = {
  bien: { color: color.ok, fondo: color.okSoft },
  aviso: { color: color.warn, fondo: color.warnSoft },
  mal: { color: color.bad, fondo: color.badSoft },
  neutro: { color: color.fg3, fondo: color.muteSoft },
};

/** Estado de avance → estado de la `Pildora` del sistema. */
export const pildoraDeEstado: Record<EstadoAvance, EstadoPildora> = {
  bien: 'ok',
  aviso: 'aviso',
  mal: 'rojo',
  neutro: 'neutro',
};

export const estilos = {
  /** Contenido de la página bajo la cabecera grande. */
  lista: {
    gap: espacio.tarjetas,
    paddingTop: espacio.fila,
    paddingLeft: espacio.margen,
    paddingRight: espacio.margen,
    flexShrink: 0,
  },
  /** Bloque de un widget: título de sección + tarjeta. */
  widget: { gap: 6, flexShrink: 0, minWidth: 0 },
  tituloSeccion: { padding: '0 4px', minHeight: 32 },
  /** Acción de texto a la derecha de un título («Editar», «Ver»…). */
  accionTexto: {
    minHeight: TACTIL,
    padding: '0 4px',
    fontSize: 13,
    fontWeight: 700,
    color: color.accent,
    borderRadius: radio.sm,
  },
  /** Cabecera dentro de la tarjeta (Cuenta común, Resumen). */
  tarjetaCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.fila,
    minHeight: 24,
  },
  tarjetaTitulo: { ...texto.fila, fontWeight: 800, color: color.fg },
  tarjetaCuerpo: { gap: 12 },
  fila: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.icono,
    minHeight: 56,
  },
  filaSeparada: { borderTop: `1px solid ${color.line}` },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  filaTitulo: {
    ...texto.fila,
    fontWeight: 800,
    lineHeight: 1.2,
    color: color.fg,
  },
  filaSub: { fontSize: 13, fontWeight: 500, color: color.fg2, ...num },
  /** Botón a ancho completo dentro de una fila que se toca entera. */
  filaBoton: {
    justifyContent: 'flex-start',
    textAlign: 'left',
    padding: '8px 0',
    borderRadius: 0,
    width: '100%',
    color: color.fg,
  },
  cifra: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    color: color.fg,
    ...num,
  },
  etiquetaPequena: { fontSize: 13, fontWeight: 700, color: color.fg3 },
  resumenRejilla: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: espacio.fila,
  },
  resumenEtiqueta: { fontSize: 12, fontWeight: 700, color: color.fg3 },
  resumenValor: {
    fontSize: 15,
    fontWeight: 800,
    color: color.fg,
    whiteSpace: 'nowrap',
    ...num,
  },
  barraPista: {
    height: 8,
    borderRadius: 4,
    backgroundColor: color.surface3,
    overflow: 'hidden',
    flexDirection: 'row',
    flexShrink: 0,
  },
  // --- Fijadas ---
  fijadasRejilla: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  fijadaBaldosa: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: espacio.fila,
    padding: '12px 10px',
    minHeight: 96,
    minWidth: 0,
    borderRadius: 18,
    textAlign: 'left',
  },
  fijadasMitades: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  fijadaPorcentaje: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...num,
  },
  fijadaHeroe: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
    width: '100%',
    padding: 20,
    textAlign: 'left',
    borderRadius: 24,
  },
  fijadaHeroeCifras: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    borderTop: `1px solid ${color.line}`,
    paddingTop: 14,
  },
  fijadaNombre: {
    width: '100%',
    maxWidth: '100%',
    fontSize: 13,
    fontWeight: 700,
    color: color.fg2,
  },
  // --- Consejos ---
  consejoTexto: {
    fontSize: 14,
    fontWeight: 500,
    color: color.fg2,
    lineHeight: 1.45,
  },
  // --- modo «Editar inicio» ---
  editarSeccion: {
    ...texto.etiqueta,
    color: color.fg3,
    padding: '16px 4px 8px',
  },
  editarItem: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    padding: '8px 12px 12px 2px',
    marginBottom: 10,
  },
  editarNombre: {
    ...texto.fila,
    fontWeight: 800,
    color: color.fg,
    flex: 1,
    minWidth: 0,
  },
  segmentado: {
    flexDirection: 'row',
    borderRadius: radio.boton,
    backgroundColor: color.surface2,
    padding: 3,
    gap: 2,
  },
  segmento: {
    minWidth: 30,
    minHeight: 38,
    borderRadius: 11,
    fontSize: 12.5,
    fontWeight: 800,
    padding: '0 6px',
    color: color.fg2,
    transition: `background-color ${movimiento.pildora}ms, color ${movimiento.pildora}ms`,
  },
  segmentoActivo: {
    backgroundColor: color.surface,
    color: color.accent,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)',
  },
  botonIcono: {
    width: TACTIL,
    height: TACTIL,
    minWidth: TACTIL,
    padding: 0,
    borderRadius: radio.boton,
    color: color.fg2,
  },
} satisfies Record<string, CSSProperties>;

// ---------------------------------------------------------------------------
// Movimiento: las tarjetas entran escalonadas, y la barra y el anillo se
// llenan al aparecer. Con «reducir movimiento» todo se queda quieto.
// ---------------------------------------------------------------------------

export const DURACION_LLENADO_MS = 700;
export const CURVA_MUELLE = movimiento.muelle;
export const TRANSICION_LLENADO = `${DURACION_LLENADO_MS}ms ${CURVA_MUELLE}`;

export const sinMovimiento = '@media (prefers-reduced-motion: reduce)';

const entrar = keyframes({
  from: { opacity: 0, transform: 'translateY(12px) scale(0.985)' },
  to: { opacity: 1, transform: 'none' },
});

/** Paso entre tarjetas y tope (las de abajo no esperan de más). */
const PASO_MS = 55;
const MAX_ESCALONES = 8;

/**
 * Estilo (para `css()`) de un contenedor cuyos hijos directos entran
 * escalonados: opacidad + 12 px con el muelle de las tarjetas.
 */
export const entradaEscalonada = {
  '& > *': {
    animation: `${entrar} ${movimiento.tarjeta}ms ${movimiento.muelle} both`,
  },
  ...Object.fromEntries(
    Array.from({ length: MAX_ESCALONES }, (_, i) => [
      `& > *:nth-of-type(${i + 1})`,
      { animationDelay: `${i * PASO_MS}ms` },
    ]),
  ),
  [`& > *:nth-of-type(n + ${MAX_ESCALONES + 1})`]: {
    animationDelay: `${MAX_ESCALONES * PASO_MS}ms`,
  },
  [sinMovimiento]: { '& > *': { animation: 'none' } },
};
