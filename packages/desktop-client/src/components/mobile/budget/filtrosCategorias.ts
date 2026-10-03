/**
 * Filtros propios de categorías («Facturas anuales»…) para «Asignar el mes».
 * Se guardan en la pref sincronizada `asignar-filtros` como JSON
 * `[{ id, nombre, categorias: [ids] }]`, así viajan entre dispositivos.
 */

export type FiltroPropio = {
  id: string;
  nombre: string;
  categorias: string[];
};

/** Lee la pref; ignora lo que no tenga forma de filtro. */
export function leerFiltros(raw: string | null | undefined): FiltroPropio[] {
  if (!raw) {
    return [];
  }
  let datos: unknown;
  try {
    datos = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) {
    return [];
  }
  const filtros: FiltroPropio[] = [];
  for (const f of datos) {
    if (
      f &&
      typeof f === 'object' &&
      typeof f.id === 'string' &&
      typeof f.nombre === 'string' &&
      Array.isArray(f.categorias)
    ) {
      filtros.push({
        id: f.id,
        nombre: f.nombre,
        categorias: f.categorias.filter(
          (c: unknown): c is string => typeof c === 'string',
        ),
      });
    }
  }
  return filtros;
}

export function escribirFiltros(filtros: readonly FiltroPropio[]): string {
  return JSON.stringify(filtros);
}

/** Crea o sustituye (por id) un filtro; nombre recortado, sin duplicados. */
export function guardarFiltro(
  filtros: readonly FiltroPropio[],
  filtro: FiltroPropio,
): FiltroPropio[] {
  const limpio: FiltroPropio = {
    id: filtro.id,
    nombre: filtro.nombre.trim(),
    categorias: [...new Set(filtro.categorias)],
  };
  const i = filtros.findIndex(f => f.id === filtro.id);
  if (i < 0) {
    return [...filtros, limpio];
  }
  return filtros.map(f => (f.id === filtro.id ? limpio : f));
}

export function borrarFiltro(
  filtros: readonly FiltroPropio[],
  id: string,
): FiltroPropio[] {
  return filtros.filter(f => f.id !== id);
}

/** Marca o desmarca una categoría en la selección del editor. */
export function alternarCategoria(
  seleccion: readonly string[],
  id: string,
): string[] {
  return seleccion.includes(id)
    ? seleccion.filter(c => c !== id)
    : [...seleccion, id];
}

/**
 * Aplica un predicado a los grupos: deja solo las categorías que lo cumplen
 * y quita los grupos que se quedan vacíos.
 */
export function filtrarGrupos<
  C extends { id: string },
  G extends { categories: C[] },
>(grupos: readonly G[], cumple: (categoria: C) => boolean): G[] {
  return grupos
    .map(g => ({ ...g, categories: g.categories.filter(cumple) }))
    .filter(g => g.categories.length > 0);
}
