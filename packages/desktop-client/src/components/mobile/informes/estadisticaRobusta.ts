/**
 * Estadística robusta para «Informes»: la referencia de lo «habitual» de una
 * categoría es la mediana, no la media aritmética, y un mes muy distinto de
 * los demás se trata como «gasto puntual»: no desplaza la referencia ni cuenta
 * como tendencia.
 *
 * Sin parámetros por categoría: el umbral de atípico se adapta a la dispersión
 * de cada serie (MAD escalada) con un mínimo absoluto para series muy estables.
 * Todo en céntimos enteros.
 */

/** Factor que hace la MAD comparable a la desviación típica en una normal. */
export const ESCALA_MAD = 1.4826;

/** Con menos meses que esto, la MAD no se usa (umbral del 25 % / 10 €). */
export const MINIMO_MESES_DISPERSION = 3;

/** Mínimo absoluto del umbral de atípico: 10 €. */
export const MINIMO_UMBRAL = 1000;

/** Mediana; 0 si no hay valores. Redondeada al céntimo. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) {
    return 0;
  }
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) {
    return ordenados[medio];
  }
  return Math.round((ordenados[medio - 1] + ordenados[medio]) / 2);
}

/** Desviación absoluta mediana, escalada ×1,4826. */
export function mad(
  valores: readonly number[],
  centro: number = mediana(valores),
): number {
  if (valores.length === 0) {
    return 0;
  }
  const desvios = valores.map(v => Math.abs(v - centro));
  return Math.round(mediana(desvios) * ESCALA_MAD);
}

/**
 * Umbral a partir del cual un valor se considera atípico respecto a la mediana:
 * max(3·MAD, 25 % de la mediana, 10 €). El 25 % protege a las categorías con
 * MAD≈0 (siempre el mismo importe) y el mínimo absoluto a las muy pequeñas.
 */
export function umbralAtipico(
  medianaRef: number,
  madRef: number,
  minimo: number = MINIMO_UMBRAL,
): number {
  return Math.max(3 * madRef, Math.round(0.25 * Math.abs(medianaRef)), minimo);
}

export type ReferenciaHabitual = {
  /** Mediana de todos los valores (incluidos atípicos). */
  mediana: number;
  /** MAD escalada de todos los valores. */
  mad: number;
  /** Umbral de atípico alrededor de la mediana. */
  umbral: number;
  /** Para cada valor, si es atípico. */
  atipicos: boolean[];
  /** Lo habitual: mediana de los valores no atípicos. */
  referencia: number;
  /** Cuántos valores quedan tras quitar los atípicos. */
  habituales: number;
};

export function esAtipico(
  valor: number,
  medianaRef: number,
  umbral: number,
): boolean {
  return Math.abs(valor - medianaRef) > umbral;
}

/**
 * Referencia habitual de una serie mensual: mediana y MAD de todos los meses,
 * umbral adaptado, meses atípicos marcados y referencia = mediana de los
 * meses no atípicos.
 */
export function referenciaHabitual(
  valores: readonly number[],
  minimo: number = MINIMO_UMBRAL,
): ReferenciaHabitual {
  const med = mediana(valores);
  // Con menos de 3 meses la dispersión no es fiable: solo cuenta el 25 %.
  const dispersion =
    valores.length < MINIMO_MESES_DISPERSION ? 0 : mad(valores, med);
  const umbral = umbralAtipico(med, dispersion, minimo);
  const atipicos = valores.map(v => esAtipico(v, med, umbral));
  const normales = valores.filter((_, i) => !atipicos[i]);
  return {
    mediana: med,
    mad: dispersion,
    umbral,
    atipicos,
    referencia: normales.length > 0 ? mediana(normales) : med,
    habituales: normales.length,
  };
}

export type Clasificacion = 'sube' | 'baja' | 'puntual' | 'normal';

/**
 * Quita los meses iniciales sin dato (0): la categoría aún no existía y no
 * deben contar como «meses a 0» en la referencia.
 */
export function recortarInicioSinDatos(valores: readonly number[]): number[] {
  const primero = valores.findIndex(v => v !== 0);
  return primero < 0 ? [] : valores.slice(primero);
}

/** Meses recientes que se dejan fuera de la base al clasificar (ventana «últimos 3»). */
const MESES_VENTANA_RECIENTE = 2;
/** Con menos meses previos que esto, la base es toda la serie. */
const MINIMO_MESES_BASE = 4;

/**
 * Clasifica el último mes de una serie frente a la referencia habitual de los
 * meses previos:
 * - `sube` / `baja`: fuera del umbral y se repite (≥ 2 de los últimos 3 meses
 *   en el mismo lado del umbral);
 * - `puntual`: por encima del umbral pero sin repetirse (gasto puntual);
 * - `normal`: dentro de lo habitual (o una bajada aislada).
 *
 * `previos` son los meses anteriores (los más recientes al final) y `actual`
 * el mes a clasificar. Los meses iniciales sin dato no cuentan (la categoría
 * no existía). La referencia se calcula sin los dos meses previos más
 * recientes (cuando quedan al menos 4), para que una subida que empieza no
 * infle su propio umbral y se detecte como tendencia.
 */
export function clasificarMes(
  actual: number,
  previos: readonly number[],
  minimo: number = MINIMO_UMBRAL,
): { tipo: Clasificacion; referencia: ReferenciaHabitual } {
  const conDatos = recortarInicioSinDatos(previos);
  const base =
    conDatos.length >= MINIMO_MESES_BASE
      ? conDatos.slice(0, -MESES_VENTANA_RECIENTE)
      : conDatos;
  const referencia = referenciaHabitual(base, minimo);
  const alto = referencia.referencia + referencia.umbral;
  const bajo = referencia.referencia - referencia.umbral;
  const ultimosTres = [...previos.slice(-MESES_VENTANA_RECIENTE), actual];
  const subidas = ultimosTres.filter(v => v > alto).length;
  const bajadas = ultimosTres.filter(v => v < bajo).length;

  if (actual > alto) {
    return { tipo: subidas >= 2 ? 'sube' : 'puntual', referencia };
  }
  if (actual < bajo) {
    return { tipo: bajadas >= 2 ? 'baja' : 'normal', referencia };
  }
  return { tipo: 'normal', referencia };
}

/** Meses seguidos que hacen falta para dar por bueno un cambio de nivel. */
export const MESES_CAMBIO_NIVEL = 3;

export type CambioNivel = {
  sentido: 'sube' | 'baja';
  /** Meses seguidos (al final de la serie) en el nivel nuevo (≥ 3). */
  meses: number;
  /** Nivel nuevo: mediana de esos meses. */
  nivel: number;
  /** Referencia de los meses anteriores (frente a la que se mide). */
  referencia: ReferenciaHabitual;
};

/**
 * Cambio de nivel PERSISTENTE al final de una serie mensual: al menos 3
 * meses SEGUIDOS en el mismo lado de lo habitual (más allá de
 * max(25 %, mínimo) de la referencia de los meses anteriores y con su
 * mediana a más de 1 MAD), coherentes entre sí (dentro del umbral robusto de
 * su propia mediana). Un gasto puntual o dos picos sueltos nunca lo son.
 *
 * `dosMeses`: solo los dos últimos meses están en otro nivel (aviso «ojo: dos
 * meses por encima»), sin cambiar todavía el nivel.
 */
export function cambioDeNivel(
  valores: readonly number[],
  minimo: number = MINIMO_UMBRAL,
): { cambio: CambioNivel | null; dosMeses: 'sube' | 'baja' | null } {
  const serie = recortarInicioSinDatos(valores);
  const analizar = (k: number) => {
    const nuevos = serie.slice(-k);
    const base = serie.slice(Math.max(0, serie.length - k - 12), -k);
    if (base.length < MINIMO_MESES_DISPERSION) {
      return null;
    }
    const referencia = referenciaHabitual(base, minimo);
    const margen = Math.max(
      Math.round(0.25 * Math.abs(referencia.referencia)),
      minimo,
    );
    const nivel = mediana(nuevos);
    const coherentes = nuevos.every(
      v =>
        !esAtipico(v, nivel, umbralAtipico(nivel, mad(nuevos, nivel), minimo)),
    );
    if (!coherentes) {
      return null;
    }
    if (
      nuevos.every(v => v > referencia.referencia + margen) &&
      nivel > referencia.mediana + referencia.mad
    ) {
      return { sentido: 'sube' as const, nivel, referencia };
    }
    if (
      nuevos.every(v => v < referencia.referencia - margen) &&
      nivel < referencia.mediana - referencia.mad
    ) {
      return { sentido: 'baja' as const, nivel, referencia };
    }
    return null;
  };

  const tres = analizar(MESES_CAMBIO_NIVEL);
  if (tres) {
    // Alarga la racha mientras los meses anteriores sigan en el nivel nuevo.
    let mejor = { ...tres, meses: MESES_CAMBIO_NIVEL };
    for (let k = MESES_CAMBIO_NIVEL + 1; k <= serie.length - 3; k++) {
      const r = analizar(k);
      if (!r || r.sentido !== tres.sentido) {
        break;
      }
      mejor = { ...r, meses: k };
    }
    return { cambio: mejor, dosMeses: null };
  }
  const dos = analizar(2);
  return { cambio: null, dosMeses: dos ? dos.sentido : null };
}
