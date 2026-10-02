import {
  calcularAmortizacion,
  cuotaParaPlazo,
  descomponerMeses,
  diferenciaMeses,
  simularExtra,
  sumarMeses,
} from './amortizacion';

describe('meses', () => {
  it('suma y resta meses cruzando de año', () => {
    expect(sumarMeses('2026-11', 3)).toBe('2027-02');
    expect(sumarMeses('2026-01', 0)).toBe('2026-01');
    expect(diferenciaMeses('2026-11', '2027-02')).toBe(3);
    expect(descomponerMeses(30)).toEqual({ anios: 2, meses: 6 });
  });
});

describe('calcularAmortizacion', () => {
  it('coche 12.000 € al 8,72 % con cuota 246,72 €', () => {
    const a = calcularAmortizacion(1_200_000, 8.72, 24_672, '2026-10');
    expect(a.noAmortiza).toBe(false);
    // 12000 * 0,0872/12 = 87,20 € de interés el primer mes
    expect(a.filas[0]).toMatchObject({
      mes: '2026-10',
      interes: 8720,
      capital: 24_672 - 8720,
      pago: 24_672,
    });
    expect(a.mesesRestantes).toBe(a.filas.length);
    expect(a.mesesRestantes).toBeGreaterThanOrEqual(60);
    expect(a.mesesRestantes).toBeLessThanOrEqual(62);
    const ultima = a.filas[a.filas.length - 1];
    expect(ultima.saldo).toBe(0);
    expect(ultima.pago).toBeLessThanOrEqual(24_672);
    expect(a.fechaFin).toBe(ultima.mes);
    // El capital pagado suma exactamente el saldo y el interés cuadra.
    expect(a.filas.reduce((s, f) => s + f.capital, 0)).toBe(1_200_000);
    expect(a.filas.reduce((s, f) => s + f.interes, 0)).toBe(a.interesTotal);
  });

  it('interés 0: solo capital', () => {
    const a = calcularAmortizacion(100_000, 0, 25_000, '2026-01');
    expect(a.mesesRestantes).toBe(4);
    expect(a.interesTotal).toBe(0);
    expect(a.fechaFin).toBe('2026-04');
  });

  it('último pago menor que la cuota', () => {
    const a = calcularAmortizacion(100_000, 0, 30_000, '2026-01');
    expect(a.filas.map(f => f.pago)).toEqual([30_000, 30_000, 30_000, 10_000]);
  });

  it('cuota que no cubre el interés: no se amortiza', () => {
    // interés mensual de 12.000 € al 8,72 % = 87,20 €
    const a = calcularAmortizacion(1_200_000, 8.72, 8720, '2026-10');
    expect(a.noAmortiza).toBe(true);
    expect(a.filas).toEqual([]);
    expect(a.mesesRestantes).toBeNull();
    expect(a.fechaFin).toBeNull();
  });

  it('saldo cero o cuota cero', () => {
    expect(calcularAmortizacion(0, 5, 1000, '2026-01').mesesRestantes).toBe(0);
    expect(calcularAmortizacion(1000, 5, 0, '2026-01').noAmortiza).toBe(true);
  });
});

describe('cuotaParaPlazo', () => {
  it('con interés 0 reparte el saldo', () => {
    expect(cuotaParaPlazo(100_000, 0, 3)).toBe(33_334);
  });
  it('amortiza en el plazo pedido', () => {
    const cuota = cuotaParaPlazo(1_200_000, 8.72, 60);
    const a = calcularAmortizacion(1_200_000, 8.72, cuota, '2026-10');
    expect(a.mesesRestantes).toBeLessThanOrEqual(60);
  });
});

describe('simularExtra', () => {
  const base = [1_200_000, 8.72, 24_672] as const;

  it('reducir plazo con extra único: acaba antes y ahorra interés', () => {
    const r = simularExtra(...base, 200_000, 0, 'reducir-plazo', '2026-10');
    expect(r.nuevaCuota).toBe(24_672);
    expect(r.mesesAhorrados).toBeGreaterThan(0);
    expect(r.interesAhorrado).toBeGreaterThan(0);
    expect(diferenciaMeses(r.nuevaFechaFin!, r.actual.fechaFin!)).toBe(
      r.mesesAhorrados,
    );
  });

  it('reducir plazo con extra mensual sube la cuota', () => {
    const r = simularExtra(...base, 0, 5000, 'reducir-plazo', '2026-10');
    expect(r.nuevaCuota).toBe(29_672);
    expect(r.mesesAhorrados).toBeGreaterThan(0);
  });

  it('reducir cuota mantiene la fecha y baja la cuota', () => {
    const r = simularExtra(...base, 200_000, 9999, 'reducir-cuota', '2026-10');
    expect(r.nuevaCuota).toBeLessThan(24_672);
    expect(r.simulada.mesesRestantes).toBeLessThanOrEqual(
      r.actual.mesesRestantes!,
    );
    expect(r.mesesAhorrados).toBeLessThanOrEqual(1);
    expect(r.interesAhorrado).toBeGreaterThan(0);
  });

  it('extra mayor que el saldo salda la deuda', () => {
    const r = simularExtra(...base, 2_000_000, 0, 'reducir-plazo', '2026-10');
    expect(r.saldada).toBe(true);
    expect(r.nuevaCuota).toBe(0);
    expect(r.interesAhorrado).toBe(r.actual.interesTotal);
  });

  it('sin extra no cambia nada', () => {
    const r = simularExtra(...base, 0, 0, 'reducir-plazo', '2026-10');
    expect(r.mesesAhorrados).toBe(0);
    expect(r.interesAhorrado).toBe(0);
  });

  it('cuota insuficiente avisa; un extra mensual puede arreglarlo', () => {
    const r = simularExtra(
      1_200_000,
      8.72,
      5000,
      0,
      0,
      'reducir-plazo',
      '2026-10',
    );
    expect(r.noAmortiza).toBe(true);
    expect(r.interesAhorrado).toBe(0);
    const r2 = simularExtra(
      1_200_000,
      8.72,
      5000,
      0,
      20_000,
      'reducir-plazo',
      '2026-10',
    );
    expect(r2.simulada.noAmortiza).toBe(false);
  });
});
