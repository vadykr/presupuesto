// Modelo puro de amortización de un préstamo (método francés) para la
// pantalla de deudas. Todos los importes son céntimos enteros y positivos
// (la deuda se pasa en positivo). Los meses son cadenas `YYYY-MM`.
// Interés mensual = interés anual / 12 sobre el saldo pendiente.

/** Tope de seguridad: más de 100 años se considera que no se amortiza. */
export const MAX_MESES = 1200;

export type FilaAmortizacion = {
  /** Mes del pago, `YYYY-MM`. */
  mes: string;
  /** Pago total del mes (cuota, o menos en el último mes). */
  pago: number;
  interes: number;
  capital: number;
  /** Saldo pendiente después del pago. */
  saldo: number;
};

export type Amortizacion = {
  filas: FilaAmortizacion[];
  /** Meses que faltan para terminar; `null` si no se amortiza nunca. */
  mesesRestantes: number | null;
  /** Mes del último pago (`YYYY-MM`); `null` si no se amortiza. */
  fechaFin: string | null;
  /** Suma de los intereses de todas las filas. */
  interesTotal: number;
  /** true si la cuota no cubre ni el interés mensual (la deuda no baja). */
  noAmortiza: boolean;
};

/** Suma `n` meses a un `YYYY-MM`. */
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${anio}-${String(mm).padStart(2, '0')}`;
}

/** Meses entre dos `YYYY-MM` (b - a). */
export function diferenciaMeses(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

function interesDelMes(saldo: number, interesAnual: number): number {
  return Math.round((saldo * interesAnual) / 100 / 12);
}

/**
 * Tabla de amortización. `mesActual` es el mes del próximo pago (la primera
 * fila). Si la cuota no supera el interés mensual, o el plazo pasaría de
 * `MAX_MESES`, devuelve `noAmortiza: true` y sin filas.
 */
export function calcularAmortizacion(
  saldo: number,
  interesAnual: number,
  cuota: number,
  mesActual: string,
): Amortizacion {
  if (saldo <= 0) {
    return {
      filas: [],
      mesesRestantes: 0,
      fechaFin: null,
      interesTotal: 0,
      noAmortiza: false,
    };
  }
  const sinAmortizar: Amortizacion = {
    filas: [],
    mesesRestantes: null,
    fechaFin: null,
    interesTotal: 0,
    noAmortiza: true,
  };
  if (cuota <= 0 || cuota <= interesDelMes(saldo, interesAnual)) {
    return sinAmortizar;
  }

  const filas: FilaAmortizacion[] = [];
  let pendiente = saldo;
  let interesTotal = 0;
  for (let i = 0; pendiente > 0; i++) {
    if (i >= MAX_MESES) {
      return sinAmortizar;
    }
    const interes = interesDelMes(pendiente, interesAnual);
    const pago = Math.min(cuota, pendiente + interes);
    const capital = pago - interes;
    pendiente -= capital;
    interesTotal += interes;
    filas.push({
      mes: sumarMeses(mesActual, i),
      pago,
      interes,
      capital,
      saldo: pendiente,
    });
  }
  return {
    filas,
    mesesRestantes: filas.length,
    fechaFin: filas[filas.length - 1].mes,
    interesTotal,
    noAmortiza: false,
  };
}

/** Cuota constante que amortiza `saldo` en `meses` pagos (redondeada hacia arriba). */
export function cuotaParaPlazo(
  saldo: number,
  interesAnual: number,
  meses: number,
): number {
  if (meses <= 0) {
    return saldo;
  }
  const r = interesAnual / 100 / 12;
  if (r === 0) {
    return Math.ceil(saldo / meses);
  }
  return Math.ceil((saldo * r) / (1 - Math.pow(1 + r, -meses)));
}

export type ModoExtra = 'reducir-plazo' | 'reducir-cuota';

export type ResultadoSimulacion = {
  actual: Amortizacion;
  simulada: Amortizacion;
  /** Cuota mensual tras la simulación. */
  nuevaCuota: number;
  nuevaFechaFin: string | null;
  mesesAhorrados: number;
  /** Interés total que se deja de pagar (puede ser 0). */
  interesAhorrado: number;
  /** true si la simulación deja la deuda saldada de golpe. */
  saldada: boolean;
  /** true si ni siquiera la deuda actual se amortiza con la cuota dada. */
  noAmortiza: boolean;
};

/**
 * Simula una amortización anticipada.
 * - `reducir-plazo`: el extra único baja el saldo y el extra mensual se suma a
 *   la cuota; la deuda acaba antes.
 * - `reducir-cuota`: el extra único baja el saldo y se recalcula la cuota para
 *   acabar en la misma fecha. El extra mensual no se usa en este modo.
 */
export function simularExtra(
  saldo: number,
  interesAnual: number,
  cuota: number,
  extraUnico: number,
  extraMensual: number,
  modo: ModoExtra,
  mesActual: string,
): ResultadoSimulacion {
  const actual = calcularAmortizacion(saldo, interesAnual, cuota, mesActual);
  const unico = Math.max(0, extraUnico);
  const mensual = modo === 'reducir-plazo' ? Math.max(0, extraMensual) : 0;
  const saldoNuevo = Math.max(0, saldo - unico);

  if (saldoNuevo === 0) {
    return {
      actual,
      simulada: calcularAmortizacion(0, interesAnual, cuota, mesActual),
      nuevaCuota: 0,
      nuevaFechaFin: mesActual,
      mesesAhorrados: actual.mesesRestantes ?? 0,
      interesAhorrado: actual.interesTotal,
      saldada: true,
      noAmortiza: actual.noAmortiza,
    };
  }

  let nuevaCuota = cuota + mensual;
  if (modo === 'reducir-cuota' && actual.mesesRestantes) {
    nuevaCuota = Math.min(
      cuota,
      cuotaParaPlazo(saldoNuevo, interesAnual, actual.mesesRestantes),
    );
  }
  const simulada = calcularAmortizacion(
    saldoNuevo,
    interesAnual,
    nuevaCuota,
    mesActual,
  );

  const mesesAhorrados =
    actual.mesesRestantes !== null && simulada.mesesRestantes !== null
      ? actual.mesesRestantes - simulada.mesesRestantes
      : 0;
  const interesAhorrado =
    !actual.noAmortiza && !simulada.noAmortiza
      ? actual.interesTotal - simulada.interesTotal
      : 0;

  return {
    actual,
    simulada,
    nuevaCuota,
    nuevaFechaFin: simulada.fechaFin,
    mesesAhorrados,
    interesAhorrado,
    saldada: false,
    noAmortiza: actual.noAmortiza || simulada.noAmortiza,
  };
}

/** Descompone meses en años y meses restantes. */
export function descomponerMeses(meses: number): {
  anios: number;
  meses: number;
} {
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
}
