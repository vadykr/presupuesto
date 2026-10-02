import type { CSSProperties } from 'react';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';

import type { EstadoAvance } from './avance';

/**
 * Estilos de la pantalla de inicio, TODOS aquí. Usan los tokens del tema
 * actual de Actual (`theme.*`); el pase visual (concepto A · Cartera) puede
 * sustituir este archivo sin tocar los widgets: radios, sombras, tipografía
 * y colores de estado salen solo de estas constantes.
 */

export const medidas = {
  /** Margen lateral de la página y relleno de tarjeta. */
  margen: 16,
  /** Separación entre tarjetas. */
  entreTarjetas: 14,
  /** Separación dentro de una fila. */
  dentroFila: 8,
  /** Entre icono y texto. */
  iconoTexto: 12,
  radioTarjeta: 20,
  radioBoton: 14,
  radioPildora: 999,
  radioCajaIcono: 14,
  cajaIcono: 40,
  barra: 8,
} as const;

export const tipos = {
  display: {
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.05,
  },
  cifra: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    ...styles.tnum,
  },
  titulo: { fontSize: 16, fontWeight: 800 },
  fila: { fontSize: 15, fontWeight: 700, lineHeight: 1.2 },
  texto: { fontSize: 13, fontWeight: 500, lineHeight: 1.4 },
  etiqueta: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
} satisfies Record<string, CSSProperties>;

export const colores = {
  texto: theme.pageText,
  textoSuave: theme.pageTextSubdued,
  textoClaro: theme.pageTextLight,
  acento: theme.pageTextPositive,
  superficie: theme.cardBackground,
  superficie2: theme.tableRowBackgroundHover,
  pista: theme.tableBorder,
  linea: theme.tableBorder,
  borde: theme.cardBorder,
  sombra: theme.cardShadow,
} as const;

/** Color de texto/trazo y fondo suave por estado (píldoras, anillos, iconos). */
export const coloresEstado: Record<
  EstadoAvance,
  { color: string; fondo: string }
> = {
  bien: { color: theme.noticeTextLight, fondo: theme.noticeBackgroundLight },
  aviso: { color: theme.warningText, fondo: theme.warningBackground },
  mal: { color: theme.errorText, fondo: theme.errorBackground },
  neutro: { color: theme.pageTextSubdued, fondo: theme.pillBackgroundLight },
};

export const estilos = {
  pagina: { paddingBottom: 24 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingLeft: medidas.margen,
    paddingRight: medidas.margen,
    gap: medidas.dentroFila,
  },
  cabeceraMes: {
    ...tipos.display,
    textTransform: 'capitalize',
    color: colores.texto,
  },
  cabeceraDia: {
    fontSize: 13,
    fontWeight: 700,
    color: colores.textoSuave,
  },
  botonCabecera: {
    fontWeight: 700,
    color: colores.acento,
    minHeight: 36,
  },
  lista: {
    gap: medidas.entreTarjetas,
    paddingTop: medidas.entreTarjetas,
    paddingLeft: 10,
    paddingRight: 10,
  },
  tarjeta: {
    borderRadius: medidas.radioTarjeta,
    padding: 0,
    margin: 0,
    overflow: 'hidden',
  },
  tarjetaCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: medidas.margen,
    paddingRight: 6,
    paddingTop: 12,
    minHeight: 32,
  },
  tarjetaTitulo: {
    ...tipos.etiqueta,
    color: colores.textoSuave,
  },
  tarjetaCuerpo: {
    padding: `8px ${medidas.margen}px ${medidas.margen}px`,
    gap: 10,
  },
  fila: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: medidas.iconoTexto,
    minHeight: 52,
  },
  filaSeparada: {
    borderTop: `1px solid ${colores.linea}`,
    paddingTop: 8,
  },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  filaTitulo: { ...tipos.fila, color: colores.texto },
  filaSub: { ...tipos.texto, color: colores.textoSuave, ...styles.tnum },
  cajaIcono: {
    width: medidas.cajaIcono,
    height: medidas.cajaIcono,
    borderRadius: medidas.radioCajaIcono,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  boton: {
    minHeight: 40,
    borderRadius: medidas.radioBoton,
    paddingLeft: 16,
    paddingRight: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  pildora: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
    padding: '0 10px',
    borderRadius: medidas.radioPildora,
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: 'nowrap',
    ...styles.tnum,
  },
  barraPista: {
    height: medidas.barra,
    borderRadius: medidas.barra / 2,
    backgroundColor: colores.pista,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cifra: { ...tipos.cifra, color: colores.texto },
  resumenRejilla: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  resumenEtiqueta: { fontSize: 12, fontWeight: 700, color: colores.textoSuave },
  resumenValor: {
    fontSize: 15,
    fontWeight: 800,
    color: colores.texto,
    whiteSpace: 'nowrap',
    ...styles.tnum,
  },
  fijadasRejilla: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  fijadaBaldosa: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '12px 6px',
    borderRadius: 18,
    backgroundColor: colores.superficie2,
    minWidth: 0,
  },
  fijadaNombre: {
    fontSize: 13,
    fontWeight: 700,
    color: colores.textoClaro,
    maxWidth: '100%',
    textAlign: 'center',
  },
  vacio: {
    alignItems: 'center',
    gap: 8,
    padding: '18px 12px',
    textAlign: 'center',
  },
  vacioTexto: { ...tipos.texto, color: colores.textoSuave },
  // --- modo «Editar inicio» ---
  editarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: '10px 10px',
    borderRadius: 16,
    backgroundColor: colores.superficie,
    border: `1px solid ${colores.borde}`,
    marginBottom: 8,
  },
  editarNombre: { ...tipos.fila, color: colores.texto, flex: 1, minWidth: 0 },
  segmentado: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: colores.superficie2,
    padding: 2,
    gap: 2,
  },
  segmento: {
    minWidth: 30,
    height: 28,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    padding: '0 6px',
  },
  segmentoActivo: {
    backgroundColor: colores.superficie,
    color: colores.acento,
    boxShadow: colores.sombra,
  },
  botonIcono: {
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 10,
    color: colores.textoSuave,
  },
  seccion: {
    ...tipos.etiqueta,
    color: colores.textoSuave,
    padding: '16px 4px 8px',
  },
} satisfies Record<string, CSSProperties>;

// ---------------------------------------------------------------------------
// Movimiento: la barra y el anillo se llenan al aparecer. Con «reducir
// movimiento» se quedan quietos en su valor.
// ---------------------------------------------------------------------------

export const DURACION_LLENADO_MS = 700;
export const CURVA_MUELLE = 'cubic-bezier(.2,.9,.3,1.15)';
export const TRANSICION_LLENADO = `${DURACION_LLENADO_MS}ms ${CURVA_MUELLE}`;

export const sinMovimiento = '@media (prefers-reduced-motion: reduce)';
