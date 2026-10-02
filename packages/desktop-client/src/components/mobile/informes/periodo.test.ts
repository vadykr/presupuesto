import { parsePeriodo, rangoDePeriodo, serializarPeriodo } from './periodo';

describe('periodo de informes', () => {
  it('lee y guarda la preferencia', () => {
    expect(parsePeriodo(undefined)).toEqual({ tipo: 'mes', mes: null });
    expect(parsePeriodo('mes:2026-09')).toEqual({
      tipo: 'mes',
      mes: '2026-09',
    });
    expect(parsePeriodo('6')).toEqual({ tipo: 'ultimos', meses: 6 });
    expect(parsePeriodo('ano-pasado')).toEqual({ tipo: 'ano-pasado' });
    expect(parsePeriodo('raro')).toEqual({ tipo: 'mes', mes: null });
    // El mes en curso se guarda como «mes» para que avance solo.
    expect(serializarPeriodo({ tipo: 'mes', mes: '2026-10' }, '2026-10')).toBe(
      'mes',
    );
    expect(serializarPeriodo({ tipo: 'mes', mes: '2026-09' }, '2026-10')).toBe(
      'mes:2026-09',
    );
    expect(serializarPeriodo({ tipo: 'ultimos', meses: 12 })).toBe('12');
  });

  it('calcula los meses de cada periodo', () => {
    const hoy = '2026-10';
    expect(rangoDePeriodo({ tipo: 'mes', mes: null }, null, hoy)).toEqual({
      meses: 1,
      hasta: hoy,
    });
    expect(rangoDePeriodo({ tipo: 'ultimos', meses: 3 }, null, hoy)).toEqual({
      meses: 3,
      hasta: hoy,
    });
    expect(rangoDePeriodo({ tipo: 'ano' }, null, hoy)).toEqual({
      meses: 10,
      hasta: hoy,
    });
    expect(rangoDePeriodo({ tipo: 'ano-pasado' }, null, hoy)).toEqual({
      meses: 12,
      hasta: '2025-12',
    });
    expect(rangoDePeriodo({ tipo: 'todo' }, '2025-11', hoy)).toEqual({
      meses: 12,
      hasta: hoy,
    });
    expect(rangoDePeriodo({ tipo: 'todo' }, null, hoy)).toEqual({
      meses: 1,
      hasta: hoy,
    });
  });
});
