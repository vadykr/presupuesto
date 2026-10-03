import { estadoFila, faltante } from '#components/mobile/budget/objetivos';

import {
  bandaFicha,
  bandaHabitual,
  consejoAsigna,
  consejoNoSeguidos,
  consejoSobrante,
  esIrregular,
  filasEstacionalidad,
  mesDeAccion,
  mesesAnteriores,
  mesesFuertes,
  nivelActual,
  pasoEje,
  rachasConGasto,
  resumenObjetivo,
  sugerenciaDormir,
} from './fichaCalculos';

// Vacances (maqueta): gasto de oct-2025 a sep-2026, en céntimos.
const VACANCES = [0, 0, 8000, 0, 0, 0, 12000, 0, 6000, 64000, 41000, 0];

describe('resumenObjetivo', () => {
  test('meta con fecha: avance sobre el saldo y cuota hasta la fecha', () => {
    const r = resumenObjetivo({
      objetivo: { tipo: 'una-vez', importe: 300000, fecha: '2027-07-01' },
      saldo: 123477,
      asignado: 23077,
      goal: null,
      month: '2026-10',
    });
    expect(r.deSaldo).toBe(true);
    expect(r.falta).toBe(300000 - 123477);
    expect(r.meses).toBe(10);
    // (3000 − 1004) / 10 meses
    expect(r.cuota).toBe(Math.round((300000 - 100400) / 10));
    expect(r.estado).toBe('rumbo');
    expect(r.progreso).toBeCloseTo(0.41, 2);
  });

  test('meta con fecha: atrasado si lo asignado no cubre la cuota', () => {
    const r = resumenObjetivo({
      objetivo: { tipo: 'una-vez', importe: 300000, fecha: '2027-07-01' },
      saldo: 100000,
      asignado: 0,
      goal: null,
      month: '2026-10',
    });
    expect(r.estado).toBe('atrasado');
  });

  test('meta con fecha cumplida', () => {
    const r = resumenObjetivo({
      objetivo: {
        tipo: 'anual',
        importe: 50000,
        fecha: '2027-03-15',
        cadaMeses: 12,
      },
      saldo: 60000,
      asignado: 0,
      goal: null,
      month: '2026-10',
    });
    expect(r.estado).toBe('cumplido');
    expect(r.falta).toBe(0);
    expect(r.progreso).toBe(1);
  });

  test('cada mes: en rumbo si lo asignado cubre lo pedido', () => {
    const objetivo = {
      tipo: 'mensual' as const,
      importe: 15000,
      dia: null,
      modo: 'apartar' as const,
    };
    expect(
      resumenObjetivo({
        objetivo,
        saldo: 0,
        asignado: 15000,
        goal: 15000,
        month: '2026-10',
      }).estado,
    ).toBe('rumbo');
    const r = resumenObjetivo({
      objetivo,
      saldo: 0,
      asignado: 5000,
      goal: 15000,
      month: '2026-10',
    });
    expect(r.estado).toBe('atrasado');
    expect(r.falta).toBe(10000);
    expect(r.progreso).toBeCloseTo(1 / 3);
  });

  test('cada semana sin goal en la hoja: cuota ≈ 52/12 semanas', () => {
    const r = resumenObjetivo({
      objetivo: { tipo: 'semanal', importe: 1000, modo: 'apartar' },
      saldo: 0,
      asignado: 0,
      goal: null,
      month: '2026-10',
    });
    expect(r.cuota).toBe(4333);
  });
});

describe('evolución', () => {
  test('mesesAnteriores: los n meses completos antes del mes', () => {
    expect(mesesAnteriores('2026-10', 3)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });

  test('banda: irregular con los meses con gasto; regular con todos', () => {
    expect(esIrregular(VACANCES)).toBe(true);
    const irregular = bandaHabitual(VACANCES, true);
    expect(irregular.mediana).toBe(12000);
    expect(irregular.min).toBeGreaterThan(0);
    // Con los 12 meses la mediana sería 0.
    expect(bandaHabitual(VACANCES, false).mediana).toBe(0);
    const regular = bandaHabitual([100, 100, 100, 200], false);
    expect(regular).toEqual({ mediana: 100, min: 100, max: 100 });
  });

  test('pasoEje redondea a 1-2-5', () => {
    expect(pasoEje(64000)).toBe(50000);
    expect(pasoEje(30000)).toBe(10000);
    expect(pasoEje(0)).toBe(1);
  });

  test('filasEstacionalidad: dos años que acaban el mes anterior', () => {
    const filas = filasEstacionalidad('2026-10', 2);
    expect(filas[0][0]).toBe('2024-10');
    expect(filas[0][11]).toBe('2025-09');
    expect(filas[1][0]).toBe('2025-10');
    expect(filas[1][11]).toBe('2026-09');
  });

  test('mesesFuertes: julio y agosto pesan casi todo', () => {
    const r = mesesFuertes([VACANCES, VACANCES]);
    expect(r?.columnas).toEqual([9, 10]);
    expect(r?.parte).toBeCloseTo(105000 / 131000, 3);
    expect(mesesFuertes([[0, 0]])).toBeNull();
  });
});

describe('asesor de la ficha', () => {
  test('(a) asigna X: mínimo y máximo de los meses con gasto, media de todos', () => {
    const c = consejoAsigna(VACANCES, 17652, 'objetivo');
    expect(c).toEqual({
      tipo: 'asigna',
      importe: 17652,
      origen: 'objetivo',
      minimo: 6000,
      maximo: 64000,
      media: Math.round(131000 / 12),
    });
  });

  test('(a) sin gasto: sin mínimo ni máximo; sin importe no hay consejo', () => {
    expect(consejoAsigna([0, 0], 5000, 'habitual')).toMatchObject({
      minimo: null,
      maximo: null,
      media: 0,
    });
    expect(consejoAsigna(VACANCES, null, 'habitual')).toBeNull();
    expect(consejoAsigna(VACANCES, 0, 'habitual')).toBeNull();
  });

  test('rachas de meses con gasto', () => {
    expect(rachasConGasto([1, 1, 0, 1, 0, 0, 1])).toEqual([
      [0, 1],
      [3, 3],
      [6, 6],
    ]);
  });

  test('(b) no la gastas dos meses seguidos, salvo una racha', () => {
    const c = consejoNoSeguidos(VACANCES);
    // La historia empieza en diciembre; la única racha es junio-agosto.
    expect(c).toEqual({
      tipo: 'no-seguidos',
      conGasto: 5,
      meses: 10,
      excepcion: { desde: 8, hasta: 10 },
    });
  });

  test('(b) necesita ≥ 6 meses de historia', () => {
    expect(consejoNoSeguidos([0, 0, 0, 0, 0, 0, 0, 10, 0, 10, 0])).toBeNull();
    expect(consejoNoSeguidos([0, 0, 0, 0, 0, 10, 0, 10, 0, 10, 0])).toEqual({
      tipo: 'no-seguidos',
      conGasto: 3,
      meses: 6,
      excepcion: null,
    });
  });

  test('(b) no sale con gasto casi todos los meses o con varias rachas', () => {
    expect(consejoNoSeguidos([10, 10, 10, 10, 10, 10])).toBeNull();
    expect(consejoNoSeguidos([10, 10, 0, 10, 10, 0, 0])).toBeNull();
    expect(consejoNoSeguidos([10, 0, 0, 0, 0, 0])).toBeNull();
  });
});

// Casos reales de Vadym (oct-2026).
const ANUAL = (importe: number, fecha: string) => ({
  tipo: 'anual' as const,
  importe,
  fecha,
  cadaMeses: 12 as const,
});

describe('objetivos por fecha que se repiten', () => {
  test('Basures: fecha pasada → próxima vuelta, adelantado y cumplido', () => {
    const r = resumenObjetivo({
      objetivo: ANUAL(23300, '2026-02-01'),
      saldo: 25246,
      asignado: 1942,
      actividad: 0,
      goal: null,
      month: '2026-10',
    });
    expect(r.fecha).toBe('2027-02-01');
    // feb 2026 → feb 2027: han pasado 8 de 12 meses.
    expect(r.ritmo).toBe(Math.round((23300 * 8) / 12));
    expect(r.sobrante).toBe(1946);
    expect(r.adelanto).toBe(25246 - 15533);
    expect(r.estado).toBe('cumplido');
    expect(r.falta).toBe(0);
    expect(r.cuota).toBe(0);
    expect(r.cuotaNormal).toBe(1942);
  });

  test('Basures sin llegar a la meta: por delante del ritmo, la cuota baja', () => {
    const r = resumenObjetivo({
      objetivo: ANUAL(23300, '2026-02-01'),
      saldo: 20000,
      asignado: 0,
      goal: null,
      month: '2026-10',
    });
    // Ir por delante solo baja la cuota (a 6,60: (233 − 200) / 5 meses); no
    // es otro estado: sin asignar nada este mes, aún le falta la cuota.
    expect(r.cuota).toBe(660);
    expect(r.estado).toBe('atrasado');
    expect(r.sobrante).toBe(0);
    expect(r.adelanto).toBe(20000 - 15533);
  });

  test('IBI: julio ya pasó; la cuota es la de runBy hasta jul 2027', () => {
    const r = resumenObjetivo({
      objetivo: ANUAL(30000, '2026-07-01'),
      saldo: 11829,
      asignado: 2500,
      actividad: 0,
      goal: null,
      month: '2026-10',
    });
    expect(r.fecha).toBe('2027-07-01');
    // runBy: (300 − 93,29 del mes pasado) / (9 meses + 1).
    expect(r.cuota).toBe(Math.round((30000 - 9329) / 10));
    expect(r.cuota).toBe(2067);
    expect(r.meses).toBe(10);
    expect(r.falta).toBe(30000 - 11829);
    // 3 de 12 meses del ciclo jul 2026 → jul 2027: bastarían 75.
    expect(r.ritmo).toBe(7500);
    // Con 25 asignados, la cuota de 20,67 está cubierta: rumbo fijo.
    expect(r.estado).toBe('rumbo');
  });

  test('IBI por debajo del ritmo pero con la cuota asignada: en rumbo', () => {
    const r = resumenObjetivo({
      objetivo: ANUAL(30000, '2026-07-01'),
      saldo: 4500,
      asignado: 3000,
      goal: null,
      month: '2026-10',
    });
    expect(r.estado).toBe('rumbo');
  });

  test('regla de sobrante', () => {
    expect(consejoSobrante(1946)).toEqual({ tipo: 'sobrante', importe: 1946 });
    expect(consejoSobrante(0)).toBeNull();
  });
});

// Suscripcions (sin objetivo): oct-2025 … sep-2026; ~99 desde julio.
const SUSCRIPCIONS = [
  4500, 4000, 2000, 0, 260, 6800, 10779, 8800, 1700, 8000, 9932, 9900,
];

describe('nivel actual (sin objetivo)', () => {
  test('Suscripcions: una sola cifra, el nivel nuevo (~99-100), nunca 60', () => {
    const n = nivelActual(SUSCRIPCIONS);
    expect(n).not.toBeNull();
    expect(n!.importe).toBeGreaterThanOrEqual(9500);
    expect(n!.importe).toBeLessThanOrEqual(10000);
    expect(n!.importe).not.toBe(6000);
    // Mínimo y máximo solo de los meses del nivel (desde julio).
    expect(n!.desde).toBe(9);
    expect(n!.minimo).toBe(8000);
    expect(n!.maximo).toBe(9932);
  });

  test('sin cambio de nivel: mediana robusta y sus meses', () => {
    const n = nivelActual([5000, 5200, 4800, 5100, 4900, 5000, 30000]);
    expect(n?.desde).toBeNull();
    expect(n?.nivel).toBe(5000);
    expect(n?.maximo).toBe(5200);
    expect(n?.importe).toBe(5000);
  });

  test('banda = la referencia del motor, no 2–111', () => {
    const b = bandaFicha(SUSCRIPCIONS);
    expect(b.max).toBeLessThan(9000);
  });

  test('mes de los botones: el visto si es actual y sin asignar; si no, el siguiente', () => {
    expect(mesDeAccion('2026-10', '2026-10', 0)).toBe('2026-10');
    expect(mesDeAccion('2026-10', '2026-10', 2500)).toBe('2026-11');
    expect(mesDeAccion('2026-09', '2026-10', 0)).toBe('2026-10');
    expect(mesDeAccion('2026-11', '2026-10', 0)).toBe('2026-11');
  });
});

describe('recomendación robusta ante gastos puntuales', () => {
  const base = [
    4500, 5200, 4100, 5800, 4900, 5000, 4400, 5600, 4700, 5300, 4800, 5100,
  ];

  test('(a) Capritxos: 12 meses de ~40-60 y el último a 400 → ~50, nunca 400', () => {
    const n = nivelActual([...base, 40000])!;
    expect(n.importe).toBeGreaterThanOrEqual(4500);
    expect(n.importe).toBeLessThanOrEqual(5500);
    expect(n.desde).toBeNull();
    expect(n.puntual).toBe(40000);
    expect(n.maximo).toBeLessThan(40000);
  });

  test('(b) Suscripcions: sube y se mantiene 3 meses → ~99', () => {
    const n = nivelActual(SUSCRIPCIONS)!;
    expect(n.importe).toBe(10000);
    expect(n.desde).not.toBeNull();
  });

  test('(c) dos picos sueltos no seguidos no cambian el nivel', () => {
    const n = nivelActual([...base, 30000, 5000, 32000])!;
    expect(n.desde).toBeNull();
    expect(n.importe).toBeLessThanOrEqual(5500);
    expect(n.dosMeses).toBeNull();
  });

  test('(d) solo 2 meses en el nivel nuevo: mantiene el viejo y avisa', () => {
    const n = nivelActual([...base, 9800, 10100])!;
    expect(n.desde).toBeNull();
    expect(n.importe).toBeLessThanOrEqual(5500);
    expect(n.dosMeses).toBe('sube');
  });
});

describe('IBI: un solo modelo de cuota (YNAB / runBy)', () => {
  const IBI = {
    objetivo: ANUAL(30000, '2026-07-01'),
    saldo: 11829,
    asignado: 2500,
    actividad: 0,
    month: '2026-10',
  };

  test('una sola cuota de 20,67, con o sin el goal de la hoja', () => {
    expect(resumenObjetivo({ ...IBI, goal: null }).cuota).toBe(2067);
    expect(resumenObjetivo({ ...IBI, goal: 2067 }).cuota).toBe(2067);
  });

  test('con 25 asignados no falta nada este mes (nada de «faltan 5»)', () => {
    const datos = {
      goal: 2067,
      longGoal: false,
      budgeted: 2500,
      balance: 11829,
      spent: 0,
    };
    expect(faltante(datos)).toBe(0);
    expect(estadoFila(datos).tipo).not.toBe('falta');
    expect(resumenObjetivo({ ...IBI, goal: 2067 }).estado).toBe('rumbo');
  });

  test('sugerencia de dormir coherente con la cuota', () => {
    // Quedan 9 meses tras octubre; tope 1,5 × 25 = 37,50 €/mes.
    const s = sugerenciaDormir({
      falta: 30000 - 11829,
      meses: 10,
      cuotaNormal: 2500,
    });
    expect(s).toEqual({ meses: 4, cuotaDespues: Math.round(18171 / 5) });
    expect(s!.cuotaDespues).toBeLessThanOrEqual(3750);
    // Muy justo de saldo: no se propone dormir.
    expect(
      sugerenciaDormir({ falta: 34000, meses: 10, cuotaNormal: 2500 }),
    ).toBeNull();
    expect(
      sugerenciaDormir({ falta: 18171, meses: 10, cuotaNormal: null }),
    ).toBeNull();
  });
});
