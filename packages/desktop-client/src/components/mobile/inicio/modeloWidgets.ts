/**
 * Modelo puro de la pantalla de inicio personalizable: qué widgets hay, en
 * qué orden y con qué tamaño. Se guarda en la preferencia sincronizada
 * `inicio-widgets` como JSON: `[{ "id": "por-hacer", "tamano": "normal" }, …]`.
 *
 * Sin React: todas las operaciones devuelven una lista nueva.
 */

export const IDS_WIDGETS = [
  'por-hacer',
  'fijadas',
  'cuenta-comun',
  'consejos',
  'resumen-mes',
  'deudas',
  'gasto-mes',
  'huchas',
] as const;

export type IdWidget = (typeof IDS_WIDGETS)[number];

export const TAMANOS = ['compacto', 'normal', 'grande'] as const;
export type Tamano = (typeof TAMANOS)[number];

export type WidgetInicio = { id: IdWidget; tamano: Tamano };

/** Orden por defecto: el de la pantalla «Inicio» del concepto A (Cartera). */
export const WIDGETS_POR_DEFECTO: readonly WidgetInicio[] = [
  { id: 'por-hacer', tamano: 'normal' },
  { id: 'fijadas', tamano: 'normal' },
  { id: 'cuenta-comun', tamano: 'normal' },
  { id: 'consejos', tamano: 'normal' },
  { id: 'resumen-mes', tamano: 'normal' },
];

export function esIdWidget(valor: unknown): valor is IdWidget {
  return (
    typeof valor === 'string' &&
    (IDS_WIDGETS as readonly string[]).includes(valor)
  );
}

export function esTamano(valor: unknown): valor is Tamano {
  return (
    typeof valor === 'string' && (TAMANOS as readonly string[]).includes(valor)
  );
}

/**
 * Lee la preferencia. Sin valor (o ilegible) → orden por defecto. Una lista
 * vacía es válida (el usuario lo ha quitado todo). Se descartan ids
 * desconocidos y repetidos; un tamaño desconocido pasa a «normal».
 */
export function leerWidgets(raw: string | undefined | null): WidgetInicio[] {
  if (raw == null || raw === '') {
    return [...WIDGETS_POR_DEFECTO];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...WIDGETS_POR_DEFECTO];
  }
  if (!Array.isArray(parsed)) {
    return [...WIDGETS_POR_DEFECTO];
  }
  const vistos = new Set<IdWidget>();
  const lista: WidgetInicio[] = [];
  for (const item of parsed) {
    // Se acepta también un id suelto ("fijadas") por comodidad.
    const id: unknown =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? (item as { id?: unknown }).id
          : null;
    if (!esIdWidget(id) || vistos.has(id)) {
      continue;
    }
    vistos.add(id);
    const tamano: unknown =
      item && typeof item === 'object'
        ? (item as { tamano?: unknown }).tamano
        : null;
    lista.push({ id, tamano: esTamano(tamano) ? tamano : 'normal' });
  }
  return lista;
}

export function escribirWidgets(lista: readonly WidgetInicio[]): string {
  return JSON.stringify(lista.map(({ id, tamano }) => ({ id, tamano })));
}

/** Widgets que se pueden añadir (los que no están en la lista). */
export function widgetsDisponibles(lista: readonly WidgetInicio[]): IdWidget[] {
  const presentes = new Set(lista.map(w => w.id));
  return IDS_WIDGETS.filter(id => !presentes.has(id));
}

/** Añade un widget al final (o en `posicion`). Si ya está, no cambia nada. */
export function anadirWidget(
  lista: readonly WidgetInicio[],
  id: IdWidget,
  tamano: Tamano = 'normal',
  posicion: number = lista.length,
): WidgetInicio[] {
  if (lista.some(w => w.id === id)) {
    return [...lista];
  }
  const i = Math.max(0, Math.min(posicion, lista.length));
  return [...lista.slice(0, i), { id, tamano }, ...lista.slice(i)];
}

export function quitarWidget(
  lista: readonly WidgetInicio[],
  id: IdWidget,
): WidgetInicio[] {
  return lista.filter(w => w.id !== id);
}

export function cambiarTamano(
  lista: readonly WidgetInicio[],
  id: IdWidget,
  tamano: Tamano,
): WidgetInicio[] {
  return lista.map(w => (w.id === id ? { ...w, tamano } : w));
}

/** Sube (−1) o baja (+1) un widget una posición. En los bordes no hace nada. */
export function moverWidget(
  lista: readonly WidgetInicio[],
  id: IdWidget,
  paso: -1 | 1,
): WidgetInicio[] {
  const i = lista.findIndex(w => w.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) {
    return [...lista];
  }
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/**
 * Arrastrar y soltar: coloca `id` antes o después de `destino`. Mismo
 * contrato que `onReorder` de react-aria (`dropPosition`).
 */
export function reordenarWidget(
  lista: readonly WidgetInicio[],
  id: IdWidget,
  destino: IdWidget,
  posicion: 'before' | 'after',
): WidgetInicio[] {
  const movido = lista.find(w => w.id === id);
  if (!movido || id === destino) {
    return [...lista];
  }
  const resto = lista.filter(w => w.id !== id);
  const i = resto.findIndex(w => w.id === destino);
  if (i < 0) {
    return [...lista];
  }
  const en = posicion === 'after' ? i + 1 : i;
  return [...resto.slice(0, en), movido, ...resto.slice(en)];
}
