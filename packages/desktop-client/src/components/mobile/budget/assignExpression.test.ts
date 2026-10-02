import {
  describe as describeExpression,
  EMPTY_EXPRESSION,
  evaluate,
  isDirty,
  pressBackspace,
  pressDigit,
  pressEquals,
  pressOperator,
} from './assignExpression';
import type { AssignExpression } from './assignExpression';

function type(
  keys: string,
  live: number,
  start: AssignExpression = EMPTY_EXPRESSION,
) {
  return [...keys].reduce((e, key) => {
    if (key === '+' || key === '-') return pressOperator(e, key, live);
    if (key === '=') return pressEquals(e, live);
    if (key === '<') return pressBackspace(e);
    return pressDigit(e, key);
  }, start);
}

describe('assignExpression', () => {
  // Lo asignado hoy: 246,72 €.
  const live = 246_72;

  it('sin teclear nada vale lo asignado y no está sucia', () => {
    expect(evaluate(EMPTY_EXPRESSION, live)).toBe(246_72);
    expect(isDirty(EMPTY_EXPRESSION)).toBe(false);
    expect(describeExpression(EMPTY_EXPRESSION, live)).toEqual({
      primary: 246_72,
      secondary: null,
    });
  });

  it('los dígitos entran como céntimos: «1300» = 13,00', () => {
    const e = type('1300', live);
    expect(evaluate(e, live)).toBe(13_00);
    expect(describeExpression(e, live).primary).toBe(13_00);
  });

  it('«+1300» muestra «246,72 +13,00» y al evaluar suma', () => {
    const e = type('+1300', live);
    expect(describeExpression(e, live)).toEqual({
      primary: 246_72,
      secondary: { op: '+', amount: 13_00 },
    });
    expect(evaluate(e, live)).toBe(259_72);
    expect(pressEquals(e, live)).toEqual({
      base: 259_72,
      op: null,
      digits: '',
    });
  });

  it('«−500» resta', () => {
    expect(evaluate(type('-500', live), live)).toBe(241_72);
  });

  it('un número sin operador sustituye; con operador después, es la base', () => {
    const e = type('1000+250', live);
    expect(describeExpression(e, live)).toEqual({
      primary: 10_00,
      secondary: { op: '+', amount: 2_50 },
    });
    expect(evaluate(e, live)).toBe(12_50);
  });

  it('un segundo operador evalúa el anterior (un solo operando pendiente)', () => {
    const e = type('+1000-250', live);
    expect(e.base).toBe(256_72);
    expect(e.op).toBe('-');
    expect(evaluate(e, live)).toBe(254_22);
  });

  it('pulsar un operador sin dígitos solo cambia el operador', () => {
    const e = type('+-', live);
    expect(e).toEqual({ base: null, op: '-', digits: '' });
    expect(evaluate(e, live)).toBe(246_72);
  });

  it('⌫ borra el último dígito y, si no hay, el operador', () => {
    expect(type('+13<', live)).toEqual({ base: null, op: '+', digits: '1' });
    expect(type('+1<<', live)).toEqual(EMPTY_EXPRESSION);
    expect(pressBackspace(EMPTY_EXPRESSION)).toBe(EMPTY_EXPRESSION);
  });

  it('«=» deja el resultado como base y sigue sucia', () => {
    const e = type('+1300=', live);
    expect(e).toEqual({ base: 259_72, op: null, digits: '' });
    expect(isDirty(e)).toBe(true);
    // Si lo asignado vivo cambia, la base ya fijada manda.
    expect(evaluate(e, 0)).toBe(259_72);
  });

  it('ignora teclas no numéricas y ceros a la izquierda', () => {
    expect(pressDigit(EMPTY_EXPRESSION, 'a')).toBe(EMPTY_EXPRESSION);
    expect(type('0005', live).digits).toBe('5');
    expect(type('0', live).digits).toBe('0');
  });

  it('limita la longitud a 10 dígitos', () => {
    const e = type('12345678901', live);
    expect(e.digits).toBe('1234567890');
  });

  it('acepta resultados negativos', () => {
    expect(evaluate(type('-30000', live), live)).toBe(-53_28);
  });
});
