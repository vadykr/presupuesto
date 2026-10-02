import type { TFunction } from 'i18next';

import { descomponerMeses } from './amortizacion';

/** «4 años y 1 mes», «7 meses», «2 años». */
export function textoDuracion(t: TFunction, meses: number): string {
  const { anios, meses: m } = descomponerMeses(meses);
  const textoAnios = t('{{count}} year', { count: anios });
  const textoMeses = t('{{count}} month', { count: m });
  if (anios > 0 && m > 0) {
    return t('{{years}} and {{months}}', {
      years: textoAnios,
      months: textoMeses,
    });
  }
  return anios > 0 ? textoAnios : textoMeses;
}

/** `2031-11` → «noviembre 2031». */
export function textoMes(mes: string, locale: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}
