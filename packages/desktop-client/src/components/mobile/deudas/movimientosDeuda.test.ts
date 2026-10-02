import {
  hayInteresEnMes,
  interesDelMesARegistrar,
  pagadoEnMes,
  repartirLetras,
  saldoInicial,
} from './movimientosDeuda';
import type { MovimientoDeuda } from './movimientosDeuda';

const apertura: MovimientoDeuda = {
  id: 'a',
  date: '2026-07-01',
  amount: -1_200_000,
  payee: 'Starting Balance',
};
const letra = (id: string, date: string): MovimientoDeuda => ({
  id,
  date,
  amount: 24_672,
  payee: 'Cuenta corriente',
});

describe('saldoInicial', () => {
  it('usa el campo de la nota primero', () => {
    expect(saldoInicial([apertura], { saldo_inicial: 15000 })).toBe(1_500_000);
  });
  it('usa Starting Balance', () => {
    expect(saldoInicial([letra('l', '2026-08-01'), apertura], null)).toBe(
      1_200_000,
    );
  });
  it('si no, el máximo de deuda del historial', () => {
    const movs = [
      { id: 'x', date: '2026-01-01', amount: -500_000, payee: 'Otro' },
      { id: 'y', date: '2026-02-01', amount: -100_000, payee: 'Otro' },
      { id: 'z', date: '2026-03-01', amount: 200_000, payee: 'Otro' },
    ];
    expect(saldoInicial(movs, null)).toBe(600_000);
  });
});

describe('pagadoEnMes', () => {
  it('suma solo letras del mes', () => {
    const movs = [
      apertura,
      letra('l1', '2026-08-02'),
      letra('l2', '2026-09-02'),
    ];
    expect(pagadoEnMes(movs, '2026-09')).toBe(24_672);
    expect(pagadoEnMes(movs, '2026-07')).toBe(0);
  });
});

describe('repartirLetras', () => {
  it('calcula el interés sobre la deuda anterior a la letra', () => {
    const movs = [apertura, letra('l1', '2026-08-02')];
    const saldoActual = -1_200_000 + 24_672;
    const r = repartirLetras(movs, saldoActual, 8.72).get('l1')!;
    expect(r.interes).toBe(8720);
    expect(r.capital).toBe(24_672 - 8720);
  });

  it('segunda letra: la deuda ya bajó', () => {
    const movs = [
      apertura,
      letra('l1', '2026-08-02'),
      letra('l2', '2026-09-02'),
    ];
    const saldoActual = -1_200_000 + 2 * 24_672;
    const r = repartirLetras(movs, saldoActual, 8.72);
    const deuda2 = 1_200_000 - 24_672;
    expect(r.get('l2')!.interes).toBe(Math.round((deuda2 * 8.72) / 1200));
  });

  it('usa el interés registrado del mes si existe', () => {
    const interes: MovimientoDeuda = {
      id: 'i',
      date: '2026-08-01',
      amount: -9000,
      payee: 'Intereses del préstamo',
    };
    const movs = [apertura, interes, letra('l1', '2026-08-02')];
    const saldoActual = -1_200_000 - 9000 + 24_672;
    const r = repartirLetras(movs, saldoActual, 8.72).get('l1')!;
    expect(r).toEqual({ interes: 9000, capital: 24_672 - 9000 });
    expect(hayInteresEnMes(movs, '2026-08')).toBe(true);
    expect(hayInteresEnMes(movs, '2026-09')).toBe(false);
  });

  it('el interés nunca supera la letra', () => {
    const movs = [apertura, { ...letra('l1', '2026-08-02'), amount: 1000 }];
    const r = repartirLetras(movs, -1_200_000 + 1000, 8.72).get('l1')!;
    expect(r).toEqual({ interes: 1000, capital: 0 });
  });
});

describe('interesDelMesARegistrar', () => {
  it('interés mensual sobre la deuda', () => {
    expect(interesDelMesARegistrar(-1_200_000, 8.72)).toBe(8720);
    expect(interesDelMesARegistrar(0, 8.72)).toBe(0);
  });
});
