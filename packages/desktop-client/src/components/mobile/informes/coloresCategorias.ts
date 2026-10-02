/**
 * Colores de categoría para las gráficas de «Informes».
 *
 * La paleta categórica tiene 12 huecos (orden fijo, validado para daltonismo
 * en claro y oscuro con el método `dataviz`, vecinos incluido el 12.º con el
 * 1.º). Dentro de una vista (`asignarColoresVista`) las categorías visibles,
 * ordenadas por importe, toman huecos distintos en orden: con ≤ 12 no se
 * repite ningún color. Fuera de una vista (píldoras, movimientos) cada
 * categoría usa un hueco estable por hash de su id. La preferencia
 * sincronizada `category-colors` (JSON `{ [idCategoria]: hueco }`) manda
 * siempre sobre ambas.
 */

export const NUM_HUECOS = 12;

/**
 * Paleta categórica de 12 huecos (dataviz, validada con `validate_palette.js`
 * sobre la superficie de tarjeta de cada tema, vecinos y el par 12.º↔1.º:
 * oscuro ΔE CVD ≥ 14,0 y normal ≥ 26,3; claro ΔE CVD ≥ 14,0 y normal ≥ 26,5).
 * Mismo tono por hueco en claro y oscuro, con la luminosidad de cada modo.
 */
export const PALETA_CLARA = [
  '#0061be', // azul
  '#e36927', // naranja
  '#12a7a7', // turquesa
  '#af2843', // granate
  '#00a1cb', // azul petróleo
  '#865901', // ámbar
  '#b96dd8', // orquídea
  '#15ac7d', // verde agua
  '#8a7ff4', // lavanda
  '#3b7402', // verde hoja
  '#d861aa', // rosa
  '#a09600', // oliva
] as const;

export const PALETA_OSCURA = [
  '#0267c7',
  '#a94608',
  '#12a7a7',
  '#b52f48',
  '#00779e',
  '#c28412',
  '#b96dd8',
  '#15ac7d',
  '#8a7ff4',
  '#3f7b04',
  '#d861aa',
  '#736c01',
] as const;

/** Variable CSS del hueco `n` (0..11), definida por `<PaletaInformes />`. */
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

/**
 * Huecos de color de las categorías de una vista. `ids` va en orden de
 * importancia (de más a menos importe): la primera toma el hueco 0, la
 * siguiente el 1… Las que tienen color propio en `asignacion` lo conservan y
 * su hueco se salta para las demás. Con más categorías que huecos se vuelve a
 * empezar (cíclico). Los ids repetidos o `null` se ignoran.
 */
export function asignarColoresVista(
  ids: ReadonlyArray<string | null | undefined>,
  asignacion: AsignacionColores = {},
): Map<string, number> {
  const resultado = new Map<string, number>();
  const unicos = [...new Set(ids.filter((id): id is string => id != null))];
  let usados = new Set<number>();
  for (const id of unicos) {
    const propio = asignacion[id];
    if (propio !== undefined) {
      resultado.set(id, propio);
      usados.add(propio);
    }
  }
  let siguiente = 0;
  for (const id of unicos) {
    if (resultado.has(id)) {
      continue;
    }
    if (usados.size >= NUM_HUECOS) {
      usados = new Set();
    }
    while (usados.has(siguiente % NUM_HUECOS)) {
      siguiente++;
    }
    const hueco = siguiente % NUM_HUECOS;
    resultado.set(id, hueco);
    usados.add(hueco);
    siguiente++;
  }
  return resultado;
}
