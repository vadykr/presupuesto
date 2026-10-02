import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import {
  evolucionCategoria,
  ingresosGastosPorMes,
  nominasPorPayee,
} from '#components/mobile/informes/calculos';
import type {
  CategoriaInfo,
  Categorias,
  Movimiento,
} from '#components/mobile/informes/calculos';
import {
  clasificarMes,
  mediana,
  recortarInicioSinDatos,
  referenciaHabitual,
} from '#components/mobile/informes/estadisticaRobusta';
import type { ReferenciaHabitual } from '#components/mobile/informes/estadisticaRobusta';

/**
 * Motor del «análisis inteligente» (PLAN.md, punto 8): a partir de los
 * totales mensuales por categoría, lo presupuestado, los traspasos entre
 * categorías, los ingresos y los objetivos, produce una lista de consejos
 * tipados y una propuesta de presupuesto para el mes siguiente.
 *
 * Funciones puras, sin React ni i18n: las frases se redactan en `frases.ts`.
 * Importes en céntimos enteros. Toda referencia de «lo habitual» es la
 * mediana robusta de `estadisticaRobusta.ts`: un gasto puntual no genera
 * consejos de tendencia ni desplaza las propuestas.
 *
 * El mes actual está a medias, así que todas las reglas se evalúan sobre los
 * meses COMPLETOS (anteriores al actual); el mes actual solo cuenta para la
 * estacionalidad («este mes suele ser caro») y como destino de las acciones.
 */

// ---------------------------------------------------------------------------
// Umbrales (documentados en docs-vadym/analisis.md)
// ---------------------------------------------------------------------------

/** Ventana de las reglas «crónicas»: los últimos 4 meses completos. */
export const MESES_VENTANA = 4;
/** …de los que al menos 3 deben cumplir la condición. */
export const MINIMO_REPETICIONES = 3;
/** Meses completos que forman «lo habitual» de una categoría. */
export const MESES_HABITUAL = 12;
/** Con menos meses habituales que esto no hay referencia fiable. */
export const MINIMO_MESES_HABITUAL = 3;
/** Sobrepresupuestada: gasto por debajo de esta fracción de lo asignado. */
export const FRACCION_SOBREPRESUPUESTADA = 0.5;
/** Sin asignar: gasto habitual por encima de esto (10 €) para que importe. */
export const MINIMO_GASTO_SIN_ASIGNAR = 1000;
/** Diferencia mínima (5 €) entre lo asignado y lo propuesto para aconsejar. */
export const MINIMO_DIFERENCIA = 500;
/** Redondeo de las propuestas: a 5 €. */
export const REDONDEO = 500;
/** Estacionalidad: años anteriores con datos del mismo mes. */
export const MINIMO_ANOS_ESTACIONALIDAD = 2;
/** Tendencia: desviación mínima (10 €) para mencionarla. */
export const MINIMO_DESVIACION_TENDENCIA = 1000;
/** Ingresos: cambio mínimo de la nómina, en fracción y en céntimos (10 €). */
export const MINIMO_CAMBIO_INGRESOS_PCT = 0.02;
export const MINIMO_CAMBIO_INGRESOS = 1000;
/** Ingresos: meses que se comparan (los 3 últimos frente a los 3 anteriores). */
export const MESES_COMPARACION_INGRESOS = 3;
/** Tasa de ahorro: diferencia mínima frente a la habitual, en puntos (10 pp). */
export const MINIMO_DIFERENCIA_TASA = 0.1;
/** Traspasos: meses que se miran y en cuántos debe repetirse el traspaso. */
export const MESES_TRASPASOS = 6;
export const MINIMO_MESES_TRASPASOS = 3;
/** Gasto irregular: como mucho esta fracción de los últimos 12 meses con gasto. */
export const FRACCION_MESES_IRREGULAR = 0.5;
/** Sobrepresupuestada: no aplica si algún mes gastó ≥ 3× lo asignado (factura anual). */
export const FACTOR_GASTO_ANUAL = 3;
/** Meses que marcan el «nivel reciente» cuando hay tendencia confirmada. */
export const MESES_NIVEL_RECIENTE = 3;
/** Grupos que cuentan como ahorro (por nombre, sin acentos ni mayúsculas). */
export const GRUPOS_AHORRO_POR_DEFECTO = ['estalvis', 'inversions'] as const;

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

/** Objetivo vigente de una categoría (celdas `goal-` y `long-goal-`). */
export type ObjetivoCategoria = {
  importe: IntegerAmount;
  /**
   * `true` si el objetivo se mide sobre el saldo acumulado (plantillas
   * «ahorrar X para una fecha»): gastar 0 un mes es lo esperado.
   */
  acumulativo: boolean;
};

/** Un traspaso de dinero entre categorías (nota de movimiento de Actual). */
export type MovimientoDinero = {
  mes: string;
  desde: string | 'to-budget';
  hacia: string | 'to-budget' | 'overbudgeted';
  importe: IntegerAmount;
};

export type EntradaAnalisis = {
  /** Meses en orden cronológico; el último es `mesActual`. */
  meses: readonly string[];
  mesActual: string;
  /** Totales mes × categoría × beneficiario (signo original). */
  movimientos: readonly Movimiento[];
  categorias: Categorias;
  /** Asignado: mes → categoría → importe. Puede faltar algún mes. */
  presupuestado: ReadonlyMap<string, ReadonlyMap<string, IntegerAmount>>;
  /** Objetivo vigente por categoría (`null` o ausente = sin objetivo). */
  objetivos: ReadonlyMap<string, ObjetivoCategoria | null>;
  traspasos: readonly MovimientoDinero[];
  /** Qué categorías cuentan como ahorro; por defecto, por nombre de grupo. */
  esAhorro?: (categoria: CategoriaInfo) => boolean;
};

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------

export type Gravedad = 'info' | 'aviso' | 'accion';

export type ClaveCifra =
  | 'presupuestado'
  | 'gasto'
  | 'habitual'
  | 'ingresos'
  | 'gastos'
  | 'ahorro'
  | 'traspasado'
  | 'tasa';

export type ColumnaCifra = {
  clave: ClaveCifra;
  /** `tasa` va en fracción (0,25); el resto en céntimos. */
  formato: 'importe' | 'porcentaje';
};

export type FilaCifra = {
  /** Mes 'yyyy-MM'. */
  mes: string;
  valores: Partial<Record<ClaveCifra, number>>;
  /** Mes atípico (gasto puntual): no cuenta para la regla. */
  atipico?: boolean;
  /** Mes que cumple la condición de la regla (se resalta). */
  cumple?: boolean;
};

/** Los números de los que sale el consejo («Ver cifras»). */
export type Cifras = { columnas: ColumnaCifra[]; filas: FilaCifra[] };

export type Accion = {
  tipo: 'fijar-objetivo' | 'ajustar-presupuesto';
  categoria: string;
  importe: IntegerAmount;
  /** Mes al que se aplica (ajustar-presupuesto). */
  mes: string;
};

type OrigenTraspasos = {
  desde: string | 'to-budget';
  /** Meses (de los últimos `MESES_TRASPASOS`) con traspaso desde ahí. */
  meses: number;
  /** Importe habitual del traspaso (mediana). */
  habitual: IntegerAmount;
};

export type DatosConsejo =
  | {
      tipo: 'infrapresupuestada';
      presupuestado: IntegerAmount;
      habitual: IntegerAmount;
      propuesto: IntegerAmount;
      mesesSobre: number;
      meses: number;
      origen?: OrigenTraspasos;
    }
  | {
      tipo: 'sobrepresupuestada';
      presupuestado: IntegerAmount;
      habitual: IntegerAmount;
      propuesto: IntegerAmount;
      mesesBajo: number;
      meses: number;
      sinGasto: boolean;
    }
  | {
      tipo: 'sin-asignar';
      habitual: IntegerAmount;
      propuesto: IntegerAmount;
      mesesConGasto: number;
      meses: number;
      tieneObjetivo: boolean;
    }
  | {
      tipo: 'estacionalidad';
      /** Mes al que se refiere (actual o siguiente). */
      mes: string;
      habitualAnual: IntegerAmount;
      habitualMes: IntegerAmount;
      /** (habitualMes − habitualAnual) / habitualAnual. */
      pct: number;
      presupuestado: IntegerAmount;
      propuesto: IntegerAmount;
      anos: number;
    }
  | {
      tipo: 'tendencia';
      sentido: 'sube' | 'baja';
      mes: string;
      actual: IntegerAmount;
      habitual: IntegerAmount;
      desviacion: IntegerAmount;
      pct: number | null;
      /** Nivel de los últimos 3 meses (mediana). */
      nivel: IntegerAmount;
      /** Asignado este mes. */
      presupuestado: IntegerAmount;
      /** Presupuesto propuesto para el nuevo nivel (si difiere ≥ 5 €). */
      propuesto: IntegerAmount | null;
    }
  | {
      tipo: 'ingresos';
      payee: string | null;
      antes: IntegerAmount;
      ahora: IntegerAmount;
      diferencia: IntegerAmount;
      /** Cambio del gasto (sin ahorro) entre los dos tramos. */
      aGasto: IntegerAmount;
      /** Cambio de lo asignado a ahorro entre los dos tramos. */
      aAhorro: IntegerAmount;
    }
  | {
      tipo: 'tasa-ahorro';
      mes: string;
      tasa: number;
      tasaHabitual: number;
      ahorro: IntegerAmount;
      ingresos: IntegerAmount;
    }
  | {
      tipo: 'traspasos';
      desde: string | 'to-budget';
      hacia: string;
      meses: number;
      de: number;
      habitual: IntegerAmount;
    };

export type TipoConsejo = DatosConsejo['tipo'];

export type Consejo = {
  /** Estable entre ejecuciones: `tipo:categoría[:mes]`; sirve para descartar. */
  id: string;
  gravedad: Gravedad;
  /** Importe afectado (céntimos): ordena la lista. */
  relevancia: IntegerAmount;
  categoria?: string;
  datos: DatosConsejo;
  cifras: Cifras;
  accion?: Accion;
};

export type MotivoPropuesta =
  | 'habitual'
  | 'tendencia'
  | 'irregular'
  | 'estacional'
  | 'objetivo'
  | 'sin-datos';

export type FilaPropuesta = {
  categoria: string;
  actual: IntegerAmount;
  propuesto: IntegerAmount;
  habitual: IntegerAmount;
  motivo: MotivoPropuesta;
};

export type Propuesta = {
  mes: string;
  filas: FilaPropuesta[];
  totalActual: IntegerAmount;
  totalPropuesto: IntegerAmount;
  /** Mediana de los ingresos de los últimos meses completos. */
  ingresosHabituales: IntegerAmount;
};

export type ResultadoAnalisis = {
  consejos: Consejo[];
  propuesta: Propuesta;
  /** Cuántos meses completos había para analizar. */
  mesesCompletos: number;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function normalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Ahorro por defecto: grupos «Estalvis» o «Inversions». */
export function esAhorroPorDefecto(categoria: CategoriaInfo): boolean {
  const n = normalizar(categoria.nombreGrupo);
  return GRUPOS_AHORRO_POR_DEFECTO.some(patron => n.includes(patron));
}

/** Redondea a 5 € hacia arriba (`ceil`) o al más cercano (`round`). */
export function redondearA5(
  importe: IntegerAmount,
  modo: 'ceil' | 'round' = 'round',
): IntegerAmount {
  const f = modo === 'ceil' ? Math.ceil : Math.round;
  return f(importe / REDONDEO) * REDONDEO;
}

function presupuestoDe(
  presupuestado: EntradaAnalisis['presupuestado'],
  mes: string,
  categoria: string,
): IntegerAmount | null {
  const porCategoria = presupuestado.get(mes);
  if (!porCategoria) {
    return null;
  }
  return porCategoria.get(categoria) ?? 0;
}

function contar<T>(valores: readonly T[], condicion: (v: T) => boolean) {
  return valores.filter(condicion).length;
}

const COL_PRESUPUESTO_GASTO: ColumnaCifra[] = [
  { clave: 'presupuestado', formato: 'importe' },
  { clave: 'gasto', formato: 'importe' },
];

export type Caracter = {
  /** Referencia habitual sobre los últimos `MESES_HABITUAL` meses con datos. */
  habitual: ReferenciaHabitual;
  /** Índice del primer mes con datos (−1 si ninguno). */
  primerMes: number;
  /**
   * Tendencia confirmada en el último mes (`clasificarMes`): el nivel vigente
   * es la mediana de los últimos 3 meses, no la referencia de 12.
   */
  tendencia: {
    sentido: 'sube' | 'baja';
    referencia: ReferenciaHabitual;
  } | null;
  /** Lo que conviene presupuestar: nivel reciente si hay tendencia; si no, lo habitual. */
  vigente: IntegerAmount;
  /** Gasto irregular (facturas anuales, bimestrales…): ≤ la mitad de los meses con gasto. */
  irregular: boolean;
  /** Media mensual de los últimos 12 meses (total / meses), para las irregulares. */
  mediaMensual: IntegerAmount;
  /** Mayor gasto mensual de los últimos 12 meses. */
  maximo: IntegerAmount;
};

type SerieCategoria = Caracter & {
  info: CategoriaInfo;
  /** Gasto por mes completo (positivo), alineado con `completos`. */
  gasto: IntegerAmount[];
};

/**
 * Carácter de una serie mensual: referencia habitual de los últimos
 * `MESES_HABITUAL` meses con datos (sin los iniciales a 0: la categoría aún
 * no existía), tendencia confirmada, irregularidad y nivel vigente.
 */
export function caracterizarSerie(gasto: readonly number[]): Caracter {
  const primerMes = gasto.findIndex(v => v !== 0);
  const conDatos = recortarInicioSinDatos(gasto);
  const ultimos = conDatos.slice(-MESES_HABITUAL);
  const habitual = referenciaHabitual(ultimos);
  const conGasto = ultimos.filter(v => v !== 0).length;
  const mediaMensual =
    ultimos.length > 0
      ? Math.round(ultimos.reduce((a, b) => a + b, 0) / ultimos.length)
      : 0;
  // Irregular = pocos meses con gasto pero gasto neto positivo (una
  // categoría de devoluciones, con media negativa, no lo es).
  const irregular =
    ultimos.length >= MESES_HABITUAL / 2 &&
    conGasto > 0 &&
    mediaMensual > 0 &&
    conGasto <= ultimos.length * FRACCION_MESES_IRREGULAR;
  const maximo = ultimos.length > 0 ? Math.max(...ultimos) : 0;

  let tendencia: Caracter['tendencia'] = null;
  if (!irregular && conDatos.length >= MESES_HABITUAL / 2) {
    const previos = conDatos.slice(0, -1);
    const actual = conDatos[conDatos.length - 1];
    const { tipo, referencia } = clasificarMes(actual, previos);
    if (tipo === 'sube' || tipo === 'baja') {
      tendencia = { sentido: tipo, referencia };
    }
  }
  const vigente = tendencia
    ? mediana(conDatos.slice(-MESES_NIVEL_RECIENTE))
    : habitual.referencia;
  return {
    habitual,
    primerMes,
    tendencia,
    vigente,
    irregular,
    mediaMensual,
    maximo,
  };
}

// ---------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------

export function analizar(entrada: EntradaAnalisis): ResultadoAnalisis {
  const {
    meses,
    mesActual,
    movimientos,
    categorias,
    presupuestado,
    objetivos,
    traspasos,
    esAhorro = esAhorroPorDefecto,
  } = entrada;
  const completos = meses.filter(m => m < mesActual);
  const mesSiguiente = monthUtils.nextMonth(mesActual);

  // Series de gasto de cada categoría de gasto visible.
  const series = new Map<string, SerieCategoria>();
  for (const info of categorias.values()) {
    if (info.esIngreso || info.oculta) {
      continue;
    }
    const gasto = evolucionCategoria(movimientos, info.id, completos);
    series.set(info.id, { info, gasto, ...caracterizarSerie(gasto) });
  }

  const consejos: Consejo[] = [];
  const ultimos = completos.slice(-MESES_VENTANA);
  const indiceUltimos = ultimos.map(m => completos.indexOf(m));
  const traspasosRecientes = traspasosEnVentana(
    traspasos,
    completos,
    mesActual,
  );

  // a, b, c: presupuesto frente a gasto en los últimos meses completos.
  if (ultimos.length === MESES_VENTANA) {
    for (const serie of series.values()) {
      if (esAhorro(serie.info)) {
        continue;
      }
      const objetivo = objetivos.get(serie.info.id) ?? null;
      if (objetivo?.acumulativo) {
        // «Ahorrar X para una fecha»: gastar 0 es lo esperado.
        continue;
      }
      const presup = ultimos.map(
        m => presupuestoDe(presupuestado, m, serie.info.id) ?? 0,
      );
      const gasto = indiceUltimos.map(i => serie.gasto[i]);
      // Atípicos según la referencia de 12 meses. Si se repiten en ≥ 3 de
      // los 4 meses ya no son gastos puntuales sino un nuevo nivel.
      let atipicos = indiceUltimos.map(i => esMesAtipico(serie, i));
      if (contar(atipicos, Boolean) >= MINIMO_REPETICIONES) {
        atipicos = atipicos.map(() => false);
      }
      const filas: FilaCifra[] = ultimos.map((mes, k) => ({
        mes,
        valores: { presupuestado: presup[k], gasto: gasto[k] },
        atipico: atipicos[k],
      }));
      const presupActual =
        presupuestoDe(presupuestado, mesActual, serie.info.id) ??
        mediana(presup);
      // Lo que conviene presupuestar: el nivel reciente si hay tendencia.
      const habitual = serie.vigente;
      // Sin referencia fiable no se opina, salvo que la categoría no haya
      // tenido gasto nunca: entonces la pregunta es si hace falta asignarle.
      const nuncaGasto = serie.primerMes < 0;
      if (
        serie.irregular ||
        (serie.habitual.habituales < MINIMO_MESES_HABITUAL && !nuncaGasto)
      ) {
        continue;
      }

      const consejo =
        reglaInfrapresupuestada({
          serie,
          presup,
          gasto,
          atipicos,
          filas,
          presupActual,
          habitual,
          objetivo,
          mesActual,
          origen: origenHabitual(traspasosRecientes, serie.info.id),
        }) ??
        reglaSobrepresupuestada({
          serie,
          presup,
          gasto,
          filas,
          presupActual,
          habitual: serie.habitual.referencia,
          vigente: habitual,
          objetivo,
          mesActual,
        }) ??
        reglaSinAsignar({
          serie,
          presup,
          gasto,
          atipicos,
          filas,
          habitual,
          objetivo,
          mesActual,
        });
      if (consejo) {
        consejos.push(consejo);
      }
    }
  }

  // d. Estacionalidad del mes actual y del siguiente.
  const estacionalesSiguiente = new Map<string, IntegerAmount>();
  for (const mesObjetivo of [mesActual, mesSiguiente]) {
    for (const serie of series.values()) {
      if (esAhorro(serie.info)) {
        continue;
      }
      const estacional = estacionalidad(serie, completos, mesObjetivo);
      if (!estacional) {
        continue;
      }
      const propuesto = redondearA5(estacional.habitualMes, 'ceil');
      if (mesObjetivo === mesSiguiente) {
        estacionalesSiguiente.set(serie.info.id, propuesto);
      }
      const presup =
        presupuestoDe(presupuestado, mesObjetivo, serie.info.id) ?? 0;
      if (presup >= estacional.habitualMes) {
        continue; // ya está preparado
      }
      const relevancia = propuesto - presup;
      if (relevancia < MINIMO_DIFERENCIA) {
        continue;
      }
      consejos.push({
        id: `estacionalidad:${serie.info.id}:${mesObjetivo}`,
        gravedad: 'accion',
        relevancia,
        categoria: serie.info.id,
        datos: {
          tipo: 'estacionalidad',
          mes: mesObjetivo,
          habitualAnual: estacional.habitualAnual,
          habitualMes: estacional.habitualMes,
          pct: estacional.pct,
          presupuestado: presup,
          propuesto,
          anos: estacional.filas.length,
        },
        cifras: {
          columnas: [
            { clave: 'gasto', formato: 'importe' },
            { clave: 'habitual', formato: 'importe' },
          ],
          filas: estacional.filas,
        },
        accion: {
          tipo: 'ajustar-presupuesto',
          categoria: serie.info.id,
          importe: propuesto,
          mes: mesObjetivo,
        },
      });
    }
  }

  // e. Tendencia confirmada en el último mes completo.
  const mesRef = completos[completos.length - 1];
  if (mesRef) {
    for (const serie of series.values()) {
      if (esAhorro(serie.info)) {
        continue;
      }
      // Si ya hay un consejo de presupuesto para la categoría, la tendencia
      // está explicada ahí.
      if (consejos.some(c => c.categoria === serie.info.id)) {
        continue;
      }
      const consejo = reglaTendencia(
        serie,
        completos,
        mesRef,
        presupuestoDe(presupuestado, mesActual, serie.info.id) ?? 0,
        objetivos.get(serie.info.id) ?? null,
        mesActual,
      );
      if (consejo) {
        consejos.push(consejo);
      }
    }
  }

  // f, g: ingresos y tasa de ahorro.
  const porMes = ingresosGastosPorMes(movimientos, completos, categorias);
  const ingresosConsejo = reglaIngresos({
    movimientos,
    completos,
    categorias,
    presupuestado,
    esAhorro,
  });
  if (ingresosConsejo) {
    consejos.push(ingresosConsejo);
  }
  const tasaConsejo = reglaTasaAhorro(porMes);
  if (tasaConsejo) {
    consejos.push(tasaConsejo);
  }

  // h. Traspasos repetidos (los ya explicados en «infrapresupuestada» no se repiten).
  const explicados = new Set<string>();
  for (const c of consejos) {
    if (c.datos.tipo === 'infrapresupuestada' && c.datos.origen) {
      explicados.add(`${c.datos.origen.desde}→${c.categoria}`);
    }
  }
  for (const consejo of reglaTraspasos(traspasosRecientes, categorias)) {
    if (consejo.datos.tipo === 'traspasos') {
      const clave = `${consejo.datos.desde}→${consejo.datos.hacia}`;
      if (!explicados.has(clave)) {
        consejos.push(consejo);
      }
    }
  }

  consejos.sort((a, b) => b.relevancia - a.relevancia);

  const propuesta = propuestaPresupuesto({
    series,
    mesActual,
    mesSiguiente,
    presupuestado,
    objetivos,
    estacionales: estacionalesSiguiente,
    porMes,
  });

  return { consejos, propuesta, mesesCompletos: completos.length };
}

// ---------------------------------------------------------------------------
// Reglas a, b, c
// ---------------------------------------------------------------------------

/** El mes `i` de `completos` es atípico frente a la referencia de la serie. */
function esMesAtipico(serie: SerieCategoria, i: number): boolean {
  if (serie.primerMes < 0 || i < serie.primerMes) {
    return false;
  }
  const inicio = Math.max(serie.primerMes, serie.gasto.length - MESES_HABITUAL);
  const k = i - inicio;
  return k >= 0 ? (serie.habitual.atipicos[k] ?? false) : false;
}

function accionPara(
  objetivo: ObjetivoCategoria | null,
  categoria: string,
  importe: IntegerAmount,
  mes: string,
): Accion {
  // Si la categoría se gobierna por un objetivo mensual, lo que hay que
  // cambiar es el objetivo; si no, lo asignado este mes.
  return {
    tipo:
      objetivo && !objetivo.acumulativo
        ? 'fijar-objetivo'
        : 'ajustar-presupuesto',
    categoria,
    importe,
    mes,
  };
}

type ContextoRegla = {
  serie: SerieCategoria;
  presup: IntegerAmount[];
  gasto: IntegerAmount[];
  filas: FilaCifra[];
  habitual: IntegerAmount;
  objetivo: ObjetivoCategoria | null;
  mesActual: string;
};

function reglaInfrapresupuestada({
  serie,
  presup,
  gasto,
  atipicos,
  filas,
  presupActual,
  habitual,
  objetivo,
  mesActual,
  origen,
}: ContextoRegla & {
  atipicos: boolean[];
  presupActual: IntegerAmount;
  origen: OrigenTraspasos | null;
}): Consejo | null {
  const cumple = presup.map((p, k) => p > 0 && gasto[k] > p && !atipicos[k]);
  const mesesSobre = contar(cumple, Boolean);
  if (mesesSobre < MINIMO_REPETICIONES) {
    return null;
  }
  const propuesto = redondearA5(habitual, 'ceil');
  if (propuesto - presupActual < MINIMO_DIFERENCIA) {
    return null;
  }
  return {
    id: `infrapresupuestada:${serie.info.id}`,
    gravedad: 'accion',
    relevancia: propuesto - presupActual,
    categoria: serie.info.id,
    datos: {
      tipo: 'infrapresupuestada',
      presupuestado: presupActual,
      habitual,
      propuesto,
      mesesSobre,
      meses: presup.length,
      ...(origen ? { origen } : {}),
    },
    cifras: {
      columnas: COL_PRESUPUESTO_GASTO,
      filas: filas.map((f, k) => ({ ...f, cumple: cumple[k] })),
    },
    accion: accionPara(objetivo, serie.info.id, propuesto, mesActual),
  };
}

function reglaSobrepresupuestada({
  serie,
  presup,
  gasto,
  filas,
  presupActual,
  habitual,
  vigente,
  objetivo,
  mesActual,
}: ContextoRegla & {
  presupActual: IntegerAmount;
  vigente: IntegerAmount;
}): Consejo | null {
  const cumple = presup.map(
    (p, k) => p > 0 && gasto[k] < p * FRACCION_SOBREPRESUPUESTADA,
  );
  const mesesBajo = contar(cumple, Boolean);
  if (mesesBajo < MINIMO_REPETICIONES || presupActual <= 0) {
    return null;
  }
  // Un mes con un gasto de varias veces lo asignado delata una factura
  // anual que se va apartando: no está sobrepresupuestada.
  if (serie.maximo >= presupActual * FACTOR_GASTO_ANUAL) {
    return null;
  }
  const propuesto = redondearA5(vigente, 'round');
  if (presupActual - propuesto < MINIMO_DIFERENCIA) {
    return null;
  }
  const sinGasto = gasto.every(g => g === 0);
  return {
    id: `sobrepresupuestada:${serie.info.id}`,
    gravedad: 'aviso',
    relevancia: presupActual - propuesto,
    categoria: serie.info.id,
    datos: {
      tipo: 'sobrepresupuestada',
      presupuestado: presupActual,
      habitual,
      propuesto,
      mesesBajo,
      meses: presup.length,
      sinGasto,
    },
    cifras: {
      columnas: COL_PRESUPUESTO_GASTO,
      filas: filas.map((f, k) => ({ ...f, cumple: cumple[k] })),
    },
    accion: accionPara(objetivo, serie.info.id, propuesto, mesActual),
  };
}

function reglaSinAsignar({
  serie,
  presup,
  gasto,
  atipicos,
  filas,
  habitual,
  objetivo,
  mesActual,
}: ContextoRegla & { atipicos: boolean[] }): Consejo | null {
  const sinAsignar = contar(presup, p => p === 0);
  const cumple = gasto.map(
    (g, k) => g > MINIMO_GASTO_SIN_ASIGNAR && !atipicos[k],
  );
  const mesesConGasto = contar(cumple, Boolean);
  if (
    sinAsignar < MINIMO_REPETICIONES ||
    mesesConGasto < MINIMO_REPETICIONES ||
    habitual <= MINIMO_GASTO_SIN_ASIGNAR
  ) {
    return null;
  }
  const propuesto = redondearA5(habitual, 'ceil');
  return {
    id: `sin-asignar:${serie.info.id}`,
    gravedad: 'accion',
    relevancia: propuesto,
    categoria: serie.info.id,
    datos: {
      tipo: 'sin-asignar',
      habitual,
      propuesto,
      mesesConGasto,
      meses: presup.length,
      tieneObjetivo: objetivo != null,
    },
    cifras: {
      columnas: COL_PRESUPUESTO_GASTO,
      filas: filas.map((f, k) => ({ ...f, cumple: cumple[k] })),
    },
    accion: {
      tipo: objetivo ? 'ajustar-presupuesto' : 'fijar-objetivo',
      categoria: serie.info.id,
      importe: propuesto,
      mes: mesActual,
    },
  };
}

// ---------------------------------------------------------------------------
// d. Estacionalidad
// ---------------------------------------------------------------------------

type Estacional = {
  habitualMes: IntegerAmount;
  habitualAnual: IntegerAmount;
  pct: number;
  filas: FilaCifra[];
};

/**
 * ¿El mismo mes de años anteriores (≥ 2 con datos) supera siempre lo
 * habitual del resto de ese año en más del umbral robusto? Devuelve la
 * mediana de esos meses y de las referencias anuales.
 */
export function estacionalidad(
  serie: Pick<SerieCategoria, 'gasto' | 'primerMes'>,
  completos: readonly string[],
  mesObjetivo: string,
): Estacional | null {
  if (serie.primerMes < 0) {
    return null;
  }
  const mm = mesObjetivo.slice(5);
  const anoObjetivo = parseInt(mesObjetivo.slice(0, 4), 10);
  const filas: FilaCifra[] = [];
  const referencias: number[] = [];
  const valores: number[] = [];

  for (let i = serie.primerMes; i < completos.length; i++) {
    const mes = completos[i];
    if (mes.slice(5) !== mm || parseInt(mes.slice(0, 4), 10) >= anoObjetivo) {
      continue;
    }
    // Los otros 11 meses alrededor (6 antes, 5 después, si existen).
    const otros: number[] = [];
    for (
      let j = Math.max(serie.primerMes, i - 6);
      j <= Math.min(completos.length - 1, i + 5);
      j++
    ) {
      if (j !== i) {
        otros.push(serie.gasto[j]);
      }
    }
    if (otros.length < 6) {
      continue; // sin bastante contexto anual
    }
    const ref = referenciaHabitual(otros);
    const valor = serie.gasto[i];
    const supera = valor > ref.referencia + ref.umbral;
    filas.push({
      mes,
      valores: { gasto: valor, habitual: ref.referencia },
      cumple: supera,
    });
    referencias.push(ref.referencia);
    valores.push(valor);
    if (!supera) {
      return null; // basta un año que no lo cumpla
    }
  }
  if (filas.length < MINIMO_ANOS_ESTACIONALIDAD) {
    return null;
  }
  const habitualMes = mediana(valores);
  const habitualAnual = mediana(referencias);
  const pct =
    habitualAnual > 0 ? (habitualMes - habitualAnual) / habitualAnual : 1;
  return { habitualMes, habitualAnual, pct, filas };
}

// ---------------------------------------------------------------------------
// e. Tendencia
// ---------------------------------------------------------------------------

function reglaTendencia(
  serie: SerieCategoria,
  completos: readonly string[],
  mesRef: string,
  presupActual: IntegerAmount,
  objetivo: ObjetivoCategoria | null,
  mesActual: string,
): Consejo | null {
  if (!serie.tendencia) {
    return null;
  }
  const { sentido, referencia } = serie.tendencia;
  const actual = serie.gasto[serie.gasto.length - 1] ?? 0;
  const desviacion = actual - referencia.referencia;
  if (
    referencia.referencia < MINIMO_DESVIACION_TENDENCIA ||
    Math.abs(desviacion) < MINIMO_DESVIACION_TENDENCIA
  ) {
    return null;
  }
  // Presupuesto para el nuevo nivel: si lo asignado ya lo cubre (o la
  // diferencia es pequeña) la tendencia es vieja y no hay nada que hacer.
  const nivel = serie.vigente;
  const candidato = redondearA5(nivel, sentido === 'sube' ? 'ceil' : 'round');
  // Solo tiene sentido proponer en el sentido de la tendencia: si sube y lo
  // asignado ya cubre el nuevo nivel, no hay nada que hacer.
  const enSentido =
    sentido === 'sube'
      ? candidato - presupActual >= MINIMO_DIFERENCIA
      : presupActual - candidato >= MINIMO_DIFERENCIA;
  const propuesto = enSentido ? candidato : null;
  if (propuesto === null && (presupActual > 0 || sentido === 'sube')) {
    return null;
  }
  const n = Math.min(6, serie.gasto.length);
  const alto = referencia.referencia + referencia.umbral;
  const bajo = referencia.referencia - referencia.umbral;
  const filas: FilaCifra[] = completos.slice(-n).map((mes, k) => {
    const valor = serie.gasto[completos.length - n + k];
    return {
      mes,
      valores: { gasto: valor, habitual: referencia.referencia },
      cumple: sentido === 'sube' ? valor > alto : valor < bajo,
    };
  });
  return {
    id: `tendencia:${serie.info.id}:${sentido}`,
    gravedad:
      propuesto !== null ? 'accion' : sentido === 'sube' ? 'aviso' : 'info',
    relevancia:
      propuesto !== null
        ? Math.abs(propuesto - presupActual)
        : Math.abs(desviacion),
    categoria: serie.info.id,
    datos: {
      tipo: 'tendencia',
      sentido,
      mes: mesRef,
      actual,
      habitual: referencia.referencia,
      desviacion,
      pct:
        referencia.referencia > 0 ? desviacion / referencia.referencia : null,
      nivel,
      presupuestado: presupActual,
      propuesto,
    },
    cifras: {
      columnas: [
        { clave: 'gasto', formato: 'importe' },
        { clave: 'habitual', formato: 'importe' },
      ],
      filas,
    },
    ...(propuesto !== null
      ? { accion: accionPara(objetivo, serie.info.id, propuesto, mesActual) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// f. Ingresos
// ---------------------------------------------------------------------------

function reglaIngresos({
  movimientos,
  completos,
  categorias,
  presupuestado,
  esAhorro,
}: {
  movimientos: readonly Movimiento[];
  completos: readonly string[];
  categorias: Categorias;
  presupuestado: EntradaAnalisis['presupuestado'];
  esAhorro: (c: CategoriaInfo) => boolean;
}): Consejo | null {
  const n = MESES_COMPARACION_INGRESOS;
  if (completos.length < 2 * n) {
    return null;
  }
  const ventana = completos.slice(-2 * n);
  const nominas = nominasPorPayee(movimientos, ventana, categorias);
  const principal = nominas[0];
  if (!principal) {
    return null;
  }
  const antes = mediana(principal.porMes.slice(0, n));
  const ahora = mediana(principal.porMes.slice(n));
  if (antes <= 0 || ahora <= 0) {
    return null;
  }
  const diferencia = ahora - antes;
  if (
    Math.abs(diferencia) < MINIMO_CAMBIO_INGRESOS ||
    Math.abs(diferencia) < antes * MINIMO_CAMBIO_INGRESOS_PCT
  ) {
    return null;
  }

  // Gasto sin ahorro y asignado a ahorro en cada tramo.
  const ahorroIds = new Set(
    [...categorias.values()]
      .filter(c => !c.esIngreso && esAhorro(c))
      .map(c => c.id),
  );
  const gastoSinAhorro = ventana.map(mes => {
    let total = 0;
    for (const m of movimientos) {
      if (
        m.mes === mes &&
        m.categoria != null &&
        !ahorroIds.has(m.categoria) &&
        !(categorias.get(m.categoria)?.esIngreso ?? false)
      ) {
        total -= m.importe;
      }
    }
    return total;
  });
  const ahorro = ventana.map(mes => {
    const porCategoria = presupuestado.get(mes);
    let total = 0;
    for (const id of ahorroIds) {
      total += porCategoria?.get(id) ?? 0;
    }
    return total;
  });
  const aGasto =
    mediana(gastoSinAhorro.slice(n)) - mediana(gastoSinAhorro.slice(0, n));
  const aAhorro = mediana(ahorro.slice(n)) - mediana(ahorro.slice(0, n));
  return {
    id: `ingresos:${principal.payee ?? ''}`,
    gravedad: 'info',
    relevancia: Math.abs(diferencia),
    datos: {
      tipo: 'ingresos',
      payee: principal.payee,
      antes,
      ahora,
      diferencia,
      aGasto,
      aAhorro,
    },
    cifras: {
      columnas: [
        { clave: 'ingresos', formato: 'importe' },
        { clave: 'gastos', formato: 'importe' },
        { clave: 'ahorro', formato: 'importe' },
      ],
      filas: ventana.map((mes, k) => ({
        mes,
        valores: {
          ingresos: principal.porMes[k],
          gastos: gastoSinAhorro[k],
          ahorro: ahorro[k],
        },
        cumple: k >= n,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// g. Tasa de ahorro
// ---------------------------------------------------------------------------

function reglaTasaAhorro(
  porMes: ReturnType<typeof ingresosGastosPorMes>,
): Consejo | null {
  const ultimos12 = porMes.slice(-MESES_HABITUAL);
  const ultimo = ultimos12[ultimos12.length - 1];
  if (!ultimo || ultimo.tasa === null) {
    return null;
  }
  const previas = ultimos12
    .slice(0, -1)
    .map(m => m.tasa)
    .filter((t): t is number => t !== null);
  if (previas.length < MINIMO_MESES_HABITUAL) {
    return null;
  }
  // Con unos ingresos atípicos (paga extra, devolución) la tasa del mes no
  // dice nada de los hábitos.
  const ingresosPrevios = ultimos12.slice(0, -1).map(m => m.ingresos);
  if (clasificarMes(ultimo.ingresos, ingresosPrevios).tipo === 'puntual') {
    return null;
  }
  const tasaHabitual = mediana(previas.map(t => Math.round(t * 10000))) / 10000;
  const diferencia = ultimo.tasa - tasaHabitual;
  if (Math.abs(diferencia) < MINIMO_DIFERENCIA_TASA) {
    return null;
  }
  return {
    id: `tasa-ahorro:${ultimo.mes}`,
    gravedad: diferencia < 0 ? 'aviso' : 'info',
    relevancia: Math.abs(Math.round(diferencia * ultimo.ingresos)),
    datos: {
      tipo: 'tasa-ahorro',
      mes: ultimo.mes,
      tasa: ultimo.tasa,
      tasaHabitual,
      ahorro: ultimo.ahorro,
      ingresos: ultimo.ingresos,
    },
    cifras: {
      columnas: [
        { clave: 'ingresos', formato: 'importe' },
        { clave: 'gastos', formato: 'importe' },
        { clave: 'tasa', formato: 'porcentaje' },
      ],
      // Sin los meses iniciales vacíos (antes de empezar a usar la app).
      filas: ultimos12
        .slice(ultimos12.findIndex(m => m.ingresos !== 0 || m.gastos !== 0))
        .map(m => ({
          mes: m.mes,
          valores: {
            ingresos: m.ingresos,
            gastos: m.gastos,
            ...(m.tasa === null ? {} : { tasa: m.tasa }),
          },
          cumple: m.mes === ultimo.mes,
        })),
    },
  };
}

// ---------------------------------------------------------------------------
// h. Traspasos entre categorías
// ---------------------------------------------------------------------------

/** Traspasos de los últimos `MESES_TRASPASOS` meses completos más el actual. */
function traspasosEnVentana(
  traspasos: readonly MovimientoDinero[],
  completos: readonly string[],
  mesActual: string,
): { lista: MovimientoDinero[]; meses: string[] } {
  const meses = [...completos.slice(-MESES_TRASPASOS), mesActual];
  const conjunto = new Set(meses);
  return { lista: traspasos.filter(t => conjunto.has(t.mes)), meses };
}

type Pareja = { desde: string; hacia: string; porMes: Map<string, number> };

function parejas(ventana: { lista: MovimientoDinero[] }): Pareja[] {
  const mapa = new Map<string, Pareja>();
  for (const t of ventana.lista) {
    if (
      t.hacia === 'to-budget' ||
      t.hacia === 'overbudgeted' ||
      t.importe <= 0
    ) {
      continue;
    }
    const clave = `${t.desde}→${t.hacia}`;
    let pareja = mapa.get(clave);
    if (!pareja) {
      pareja = { desde: t.desde, hacia: t.hacia, porMes: new Map() };
      mapa.set(clave, pareja);
    }
    pareja.porMes.set(t.mes, (pareja.porMes.get(t.mes) ?? 0) + t.importe);
  }
  return [...mapa.values()];
}

/** De dónde recibe dinero una categoría casi cada mes (≥ 2 meses). */
function origenHabitual(
  ventana: { lista: MovimientoDinero[] },
  categoria: string,
): OrigenTraspasos | null {
  let mejor: OrigenTraspasos | null = null;
  for (const p of parejas(ventana)) {
    if (p.hacia !== categoria) {
      continue;
    }
    const meses = p.porMes.size;
    if (meses >= 2 && (!mejor || meses > mejor.meses)) {
      mejor = {
        desde: p.desde,
        meses,
        habitual: mediana([...p.porMes.values()]),
      };
    }
  }
  return mejor;
}

function reglaTraspasos(
  ventana: { lista: MovimientoDinero[]; meses: string[] },
  categorias: Categorias,
): Consejo[] {
  const consejos: Consejo[] = [];
  for (const p of parejas(ventana)) {
    if (p.porMes.size < MINIMO_MESES_TRASPASOS) {
      continue;
    }
    if (p.desde !== 'to-budget' && !categorias.has(p.desde)) {
      continue;
    }
    if (!categorias.has(p.hacia)) {
      continue;
    }
    const habitual = mediana([...p.porMes.values()]);
    consejos.push({
      id: `traspasos:${p.desde}:${p.hacia}`,
      gravedad: 'info',
      relevancia: habitual,
      categoria: p.hacia,
      datos: {
        tipo: 'traspasos',
        desde: p.desde,
        hacia: p.hacia,
        meses: p.porMes.size,
        de: ventana.meses.length,
        habitual,
      },
      cifras: {
        columnas: [{ clave: 'traspasado', formato: 'importe' }],
        filas: ventana.meses.map(mes => ({
          mes,
          valores: { traspasado: p.porMes.get(mes) ?? 0 },
          cumple: p.porMes.has(mes),
        })),
      },
    });
  }
  return consejos;
}

// ---------------------------------------------------------------------------
// i. Propuesta de presupuesto para el mes siguiente
// ---------------------------------------------------------------------------

function propuestaPresupuesto({
  series,
  mesActual,
  mesSiguiente,
  presupuestado,
  objetivos,
  estacionales,
  porMes,
}: {
  series: Map<string, SerieCategoria>;
  mesActual: string;
  mesSiguiente: string;
  presupuestado: EntradaAnalisis['presupuestado'];
  objetivos: EntradaAnalisis['objetivos'];
  estacionales: ReadonlyMap<string, IntegerAmount>;
  porMes: ReturnType<typeof ingresosGastosPorMes>;
}): Propuesta {
  const filas: FilaPropuesta[] = [];
  for (const serie of series.values()) {
    const id = serie.info.id;
    // «Ahora» es lo asignado este mes: el siguiente suele estar aún a 0.
    const actual =
      presupuestoDe(presupuestado, mesActual, id) ??
      presupuestoDe(presupuestado, mesSiguiente, id) ??
      0;
    const habitual = serie.habitual.referencia;
    const objetivo = objetivos.get(id) ?? null;
    let propuesto: IntegerAmount;
    let motivo: MotivoPropuesta;
    const estacional = estacionales.get(id);
    if (objetivo?.acumulativo) {
      propuesto = actual;
      motivo = 'objetivo';
    } else if (serie.irregular) {
      propuesto = redondearA5(serie.mediaMensual, 'round');
      motivo = 'irregular';
    } else if (serie.habitual.habituales < MINIMO_MESES_HABITUAL) {
      propuesto = actual;
      motivo = 'sin-datos';
    } else if (estacional !== undefined) {
      propuesto = estacional;
      motivo = 'estacional';
    } else if (serie.tendencia) {
      propuesto = redondearA5(
        serie.vigente,
        serie.tendencia.sentido === 'sube' ? 'ceil' : 'round',
      );
      motivo = 'tendencia';
    } else {
      propuesto = redondearA5(habitual, 'round');
      motivo = 'habitual';
    }
    // Nunca se propone un presupuesto negativo (categorías con devoluciones).
    propuesto = Math.max(0, propuesto);
    filas.push({ categoria: id, actual, propuesto, habitual, motivo });
  }
  filas.sort(
    (a, b) =>
      Math.abs(b.propuesto - b.actual) - Math.abs(a.propuesto - a.actual),
  );
  const ingresos = porMes
    .slice(-MESES_HABITUAL / 2)
    .map(m => m.ingresos)
    .filter(v => v > 0);
  const totalActual = filas.reduce((s, f) => s + f.actual, 0);
  const totalPropuesto = filas.reduce((s, f) => s + f.propuesto, 0);
  return {
    mes: mesSiguiente,
    filas,
    totalActual,
    totalPropuesto,
    ingresosHabituales: mediana(ingresos),
  };
}
