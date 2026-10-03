import {
  bandaHabitual,
  consejoAsigna,
  consejoNoSeguidos,
  esIrregular,
  filasEstacionalidad,
  mesesAnteriores,
  mesesFuertes,
  pasoEje,
  rachasConGasto,
  resumenObjetivo,
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
