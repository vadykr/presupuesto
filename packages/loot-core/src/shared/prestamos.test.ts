import {
  escribirDatosPrestamo,
  leerDatosPrestamo,
  PREFIJO_PRESTAMO,
} from './prestamos';

const datos = {
  tipo: 'autoLoan',
  interes_anual: 8.72,
  cuota_minima: 246.72,
  desde: '2026-07-01',
};

describe('prestamos', () => {
  it('lee la línea #prestamo entre otras notas', () => {
    const nota = `Ford Kuga\n${PREFIJO_PRESTAMO} ${JSON.stringify(datos)}\notra`;
    expect(leerDatosPrestamo(nota)).toEqual(datos);
  });

  it('devuelve null sin línea o con JSON roto', () => {
    expect(leerDatosPrestamo(null)).toBeNull();
    expect(leerDatosPrestamo('hola')).toBeNull();
    expect(leerDatosPrestamo('#prestamo {roto')).toBeNull();
  });

  it('escribe añadiendo o sustituyendo la línea', () => {
    const nueva = escribirDatosPrestamo('Mi coche', datos);
    expect(nueva).toBe(
      `Mi coche\n${PREFIJO_PRESTAMO} ${JSON.stringify(datos)}`,
    );
    const cambiada = escribirDatosPrestamo(nueva, {
      ...datos,
      interes_anual: 5,
    });
    expect(leerDatosPrestamo(cambiada)?.interes_anual).toBe(5);
    expect(cambiada.split('\n')).toHaveLength(2);
    expect(escribirDatosPrestamo(null, datos)).toMatch(/^#prestamo /);
  });
});
