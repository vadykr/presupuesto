import type { IntegerAmount } from '@actual-app/core/shared/util';

/**
 * Modelo del teclado de asignación al estilo YNAB.
 *
 * Los dígitos se teclean como céntimos: «1300» = 13,00 €. Un número sin
 * operador sustituye lo asignado; «+1300» o «−1300» suman o restan a lo
 * asignado. Solo hay un operando pendiente: al pulsar un segundo operador se
 * evalúa el anterior. «=» evalúa y deja el resultado como nueva base.
 */
export type Operator = '+' | '-';

export type AssignExpression = {
  /** Base en céntimos; `null` = usar el importe asignado vivo de la hoja. */
  base: IntegerAmount | null;
  op: Operator | null;
  /** Dígitos tecleados (céntimos), '' si no hay ninguno. */
  digits: string;
};

export const EMPTY_EXPRESSION: AssignExpression = {
  base: null,
  op: null,
  digits: '',
};

/** Tope de dígitos para no desbordar (99.999.999,99). */
const MAX_DIGITS = 10;

export function digitsToAmount(digits: string): IntegerAmount {
  return digits === '' ? 0 : parseInt(digits, 10);
}

export function pressDigit(
  expression: AssignExpression,
  digit: string,
): AssignExpression {
  if (!/^[0-9]$/.test(digit)) {
    return expression;
  }
  const next = (expression.digits + digit).replace(/^0+(?=\d)/, '');
  if (next.length > MAX_DIGITS) {
    return expression;
  }
  return { ...expression, digits: next };
}

/** Importe que vale la expresión ahora mismo, dado lo asignado vivo. */
export function evaluate(
  expression: AssignExpression,
  live: IntegerAmount,
): IntegerAmount {
  const base = expression.base ?? live;
  const typed = digitsToAmount(expression.digits);
  if (expression.op === '+') {
    return base + typed;
  }
  if (expression.op === '-') {
    return base - typed;
  }
  return expression.digits === '' ? base : typed;
}

export function pressOperator(
  expression: AssignExpression,
  op: Operator,
  live: IntegerAmount,
): AssignExpression {
  if (expression.digits === '') {
    // Solo cambia (o pone) el operador.
    return { ...expression, op };
  }
  // Hay un número tecleado: pasa a ser la base (evaluando el operador
  // anterior si lo había) y queda el nuevo operador pendiente.
  return { base: evaluate(expression, live), op, digits: '' };
}

export function pressEquals(
  expression: AssignExpression,
  live: IntegerAmount,
): AssignExpression {
  return { base: evaluate(expression, live), op: null, digits: '' };
}

export function pressBackspace(expression: AssignExpression): AssignExpression {
  if (expression.digits !== '') {
    return { ...expression, digits: expression.digits.slice(0, -1) };
  }
  if (expression.op) {
    return { ...expression, op: null };
  }
  return expression;
}

/** ¿Hay algo que aplicar distinto de lo que ya está en la hoja? */
export function isDirty(expression: AssignExpression): boolean {
  return (
    expression.base !== null ||
    expression.op !== null ||
    expression.digits !== ''
  );
}

export type ExpressionDisplay = {
  /** Línea principal: la base o el número que sustituye. */
  primary: IntegerAmount;
  /** Línea secundaria (en color): operador y operando pendiente. */
  secondary: { op: Operator; amount: IntegerAmount } | null;
};

/** Lo que enseña la celda «Asignado» mientras se teclea. */
export function describe(
  expression: AssignExpression,
  live: IntegerAmount,
): ExpressionDisplay {
  const base = expression.base ?? live;
  if (expression.op) {
    return {
      primary: base,
      secondary: {
        op: expression.op,
        amount: digitsToAmount(expression.digits),
      },
    };
  }
  return {
    primary:
      expression.digits === '' ? base : digitsToAmount(expression.digits),
    secondary: null,
  };
}
