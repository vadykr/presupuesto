import {
  categoriasDormidas,
  conDormida,
  dormidaEn,
  dormir,
  ignoradaEn,
  motivoDespertar,
  parseDormidas,
} from './dormir';

// IBI: dormida en oct-2026 hasta el cobro de jul-2027, con 118,29 de saldo.
const IBI = dormir('2026-10', '2027-07', 2500, 11829);

describe('dormir: en qué meses duerme', () => {
  test('duerme de «desde» a «hasta» (exclusivo)', () => {
    expect(dormidaEn(IBI, '2026-09')).toBe(false);
    expect(dormidaEn(IBI, '2026-10')).toBe(true);
    expect(dormidaEn(IBI, '2027-06')).toBe(true);
    expect(dormidaEn(IBI, '2027-07')).toBe(false);
    expect(dormidaEn(null, '2026-10')).toBe(false);
  });

  test('«hasta» nunca antes de «desde»: al menos un mes', () => {
    expect(dormir('2026-10', '2026-10', 0, 0).hasta).toBe('2026-11');
  });

  test('compatibilidad con «Ignorar este mes» (marca de la nota de mes)', () => {
    expect(ignoradaEn(true, null, '2026-10')).toBe(true);
    expect(ignoradaEn(false, IBI, '2026-12')).toBe(true);
    expect(ignoradaEn(false, IBI, '2027-08')).toBe(false);
    expect(ignoradaEn(false, null, '2026-10')).toBe(false);
  });

  test('pref: lectura tolerante, alta y baja', () => {
    expect(parseDormidas(undefined)).toEqual({});
    expect(parseDormidas('no es json')).toEqual({});
    expect(parseDormidas('[1,2]')).toEqual({});
    const raw = JSON.stringify({ ibi: IBI, mala: { desde: 'x' } });
    const d = parseDormidas(raw);
    expect(Object.keys(d)).toEqual(['ibi']);
    expect(categoriasDormidas(d, '2027-01')).toEqual(new Set(['ibi']));
    expect(categoriasDormidas(d, '2027-07').size).toBe(0);
    const otra = conDormida(d, 'basures', dormir('2026-10', '2027-03', 0, 1));
    expect(Object.keys(otra).sort()).toEqual(['basures', 'ibi']);
    expect(conDormida(otra, 'ibi', null)).not.toHaveProperty('ibi');
  });
});

describe('dormir: despertar', () => {
  const base = {
    dormida: IBI,
    mesActual: '2026-11',
    mes: '2026-11',
    actividad: 0,
    saldo: 11829,
    asignado: 0,
  };

  test('sigue dormida si no pasa nada (o si se le añade dinero)', () => {
    expect(motivoDespertar(base)).toBeNull();
    expect(
      motivoDespertar({ ...base, saldo: 15000, asignado: 3171 }),
    ).toBeNull();
  });

  test('(a) llega la fecha', () => {
    expect(motivoDespertar({ ...base, mesActual: '2027-07' })).toBe('fecha');
  });

  test('(b) hay gasto (entró el cargo)', () => {
    expect(motivoDespertar({ ...base, actividad: -30000, saldo: 0 })).toBe(
      'gasto',
    );
  });

  test('(b) el gasto que ya había al dormirla no la despierta', () => {
    const conGasto = dormir('2026-10', '2027-07', 2500, 10329, -1500);
    const enOct = {
      ...base,
      dormida: conGasto,
      mesActual: '2026-10',
      mes: '2026-10',
      saldo: 10329,
      asignado: 2500,
    };
    expect(motivoDespertar({ ...enOct, actividad: -1500 })).toBeNull();
    expect(motivoDespertar({ ...enOct, actividad: -2000, saldo: 9829 })).toBe(
      'gasto',
    );
  });

  test('(c) se saca dinero: baja el saldo sin gasto', () => {
    expect(motivoDespertar({ ...base, saldo: 9000 })).toBe('salida');
  });

  test('(c) se baja lo asignado del mes en que se durmió', () => {
    expect(
      motivoDespertar({
        ...base,
        mesActual: '2026-10',
        mes: '2026-10',
        asignado: 1000,
        saldo: 11829,
      }),
    ).toBe('salida');
  });

  test('un mes anterior a «desde» no la despierta', () => {
    expect(
      motivoDespertar({ ...base, mes: '2026-09', actividad: -500, saldo: 0 }),
    ).toBeNull();
  });
});
