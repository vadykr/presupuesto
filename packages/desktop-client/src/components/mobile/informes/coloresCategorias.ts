/**
 * Color fijo por categoría para todas las gráficas de «Informes».
 *
 * La paleta categórica tiene 8 huecos (orden fijo, validado para daltonismo en
 * claro y oscuro con el método `dataviz`). Cada categoría toma un hueco de
 * forma estable a partir de su id (hash FNV-1a), así el color no cambia al
 * filtrar ni al reordenar. La preferencia sincronizada `category-colors`
 * guarda las personalizaciones (JSON `{ [idCategoria]: hueco }`).
 */

export const NUM_HUECOS = 8;

/** Paleta categórica (dataviz, referencia): la misma tonalidad en claro y oscuro. */
export const PALETA_CLARA = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aguamarina
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
] as const;

export const PALETA_OSCURA = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

/** Variable CSS del hueco `n` (0..7), definida por `<PaletaInformes />`. */
export function variableDeHueco(hueco: number): string {
  return `var(--informes-c${((hueco % NUM_HUECOS) + NUM_HUECOS) % NUM_HUECOS})`;
}

/** Color neutro para «sin categoría». */
export const COLOR_SIN_CATEGORIA = 'var(--color-pageTextSubdued)';

/** Hash FNV-1a de 32 bits: estable entre sesiones y dispositivos. */
export function hashEstable(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function huecoPorDefecto(idCategoria: string): number {
  return hashEstable(idCategoria) % NUM_HUECOS;
}

export type AsignacionColores = Record<string, number>;

export function parseAsignacionColores(
  raw: string | undefined,
): AsignacionColores {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const resultado: AsignacionColores = {};
    for (const [id, hueco] of Object.entries(parsed)) {
      if (
        typeof hueco === 'number' &&
        Number.isInteger(hueco) &&
        hueco >= 0 &&
        hueco < NUM_HUECOS
      ) {
        resultado[id] = hueco;
      }
    }
    return resultado;
  } catch {
    return {};
  }
}

export function huecoDeCategoria(
  idCategoria: string,
  asignacion: AsignacionColores,
): number {
  return asignacion[idCategoria] ?? huecoPorDefecto(idCategoria);
}

export function colorDeCategoria(
  idCategoria: string | null,
  asignacion: AsignacionColores = {},
): string {
  if (idCategoria == null) {
    return COLOR_SIN_CATEGORIA;
  }
  return variableDeHueco(huecoDeCategoria(idCategoria, asignacion));
}
