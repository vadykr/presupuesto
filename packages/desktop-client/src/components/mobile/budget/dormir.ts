import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

/**
 * «Dormir hasta…»: una categoría deja de pedir dinero (no cuenta como
 * infrafinanciada ni «faltan») durante varios meses. Amplía «Ignorar este
 * mes» (marca `#ignorar-mes` en la nota de mes, que sigue funcionando igual).
 *
 * Se guarda en la pref sincronizada `dormidas` (JSON aditivo, sin
 * migraciones): `{ <categoría>: { desde, hasta, asignadoAlDormir,
 * saldoAlDormir } }`. Duerme en los meses `desde ≤ mes < hasta`: el mes
 * `hasta` (el del cobro) ya está despierta.
 *
 * Despierta sola (y se borra la entrada) la próxima vez que se ve si:
 * (a) llega el mes `hasta`;
 * (b) hay gasto nuevo en la categoría (entró el cargo): en `desde`, más
 *     del que ya había al dormirla; en los meses siguientes, cualquiera;
 * (c) se saca dinero de ella: el saldo baja de lo que tenía al dormir sin
 *     que haya gasto, o lo asignado en el mes en que se durmió baja de lo
 *     que era. En el presupuesto por sobres el saldo positivo se arrastra
 *     de mes en mes y solo baja por gasto o por quitarle dinero (bajar lo
 *     asignado, «Mover» o «Cubrir» a otra categoría), así que mirar el saldo
 *     detecta cualquier salida en cualquier mes sin recorrer el historial.
 */

export type Dormida = {
  /** Primer mes dormida (`YYYY-MM`). */
  desde: string;
  /** Mes en que despierta (`YYYY-MM`, exclusivo). */
  hasta: string;
  /** Asignado en `desde` al dormirla. */
  asignadoAlDormir: IntegerAmount;
  /** Saldo al dormirla. */
  saldoAlDormir: IntegerAmount;
  /**
   * Actividad de `desde` al dormirla (el gasto que ya había ese mes no la
   * despierta). Opcional: las entradas antiguas cuentan como 0.
   */
  actividadAlDormir?: IntegerAmount;
};

export type Dormidas = Record<string, Dormida>;

const MES = /^\d{4}-\d{2}$/;

function esDormida(v: unknown): v is Dormida {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const d = v as Record<string, unknown>;
  return (
    typeof d.desde === 'string' &&
    MES.test(d.desde) &&
    typeof d.hasta === 'string' &&
    MES.test(d.hasta) &&
    typeof d.asignadoAlDormir === 'number' &&
    typeof d.saldoAlDormir === 'number'
  );
}

/** Lee la pref (tolerante: lo que no se entiende se ignora). */
export function parseDormidas(raw: string | null | undefined): Dormidas {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const resultado: Dormidas = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (esDormida(v)) {
        resultado[id] = v;
      }
    }
    return resultado;
  } catch {
    return {};
  }
}

export function conDormida(
  dormidas: Dormidas,
  categoria: string,
  dormida: Dormida | null,
): Dormidas {
  const copia = { ...dormidas };
  if (dormida) {
    copia[categoria] = dormida;
  } else {
    delete copia[categoria];
  }
  return copia;
}

/** ¿Duerme la categoría en `mes`? */
export function dormidaEn(
  dormida: Dormida | null | undefined,
  mes: string,
): boolean {
  return dormida != null && dormida.desde <= mes && mes < dormida.hasta;
}

/** Categorías dormidas en `mes`. */
export function categoriasDormidas(
  dormidas: Dormidas,
  mes: string,
): Set<string> {
  return new Set(
    Object.entries(dormidas)
      .filter(([, d]) => dormidaEn(d, mes))
      .map(([id]) => id),
  );
}

/**
 * ¿Ignorada en `mes`? Une las dos formas: la marca de la nota de mes
 * (`#ignorar-mes`, solo ese mes) y la pref `dormidas` (varios meses).
 */
export function ignoradaEn(
  marcaDeMes: boolean,
  dormida: Dormida | null | undefined,
  mes: string,
): boolean {
  return marcaDeMes || dormidaEn(dormida, mes);
}

/** Nueva dormida desde `desde` hasta `hasta` (exclusivo). */
export function dormir(
  desde: string,
  hasta: string,
  asignado: IntegerAmount,
  saldo: IntegerAmount,
  actividad: IntegerAmount = 0,
): Dormida {
  return {
    desde,
    hasta: hasta > desde ? hasta : monthUtils.nextMonth(desde),
    asignadoAlDormir: asignado,
    saldoAlDormir: saldo,
    actividadAlDormir: actividad,
  };
}

export type MotivoDespertar = 'fecha' | 'gasto' | 'salida';

/**
 * Por qué debe despertar (o `null` si sigue dormida), con lo que se ve del
 * mes visto `mes` (solo cuenta si ya duerme o pasó el inicio).
 */
export function motivoDespertar({
  dormida,
  mesActual,
  mes,
  actividad,
  saldo,
  asignado,
}: {
  dormida: Dormida;
  /** Mes de hoy. */
  mesActual: string;
  /** Mes que se está viendo (sus valores son los de abajo). */
  mes: string;
  /** Actividad del mes visto (negativa si es gasto). */
  actividad: IntegerAmount;
  /** Saldo del mes visto. */
  saldo: IntegerAmount;
  /** Asignado en el mes visto. */
  asignado: IntegerAmount;
}): MotivoDespertar | null {
  // (a) Llega la fecha.
  if (mesActual >= dormida.hasta) {
    return 'fecha';
  }
  if (mes < dormida.desde) {
    return null;
  }
  // (b) Entró el cargo (gasto nuevo desde que se durmió).
  const base = mes === dormida.desde ? (dormida.actividadAlDormir ?? 0) : 0;
  if (actividad < Math.min(0, base)) {
    return 'gasto';
  }
  // (c) Se sacó dinero: baja el saldo (sin gasto) o lo asignado al dormir.
  if (saldo < dormida.saldoAlDormir) {
    return 'salida';
  }
  if (mes === dormida.desde && asignado < dormida.asignadoAlDormir) {
    return 'salida';
  }
  return null;
}
