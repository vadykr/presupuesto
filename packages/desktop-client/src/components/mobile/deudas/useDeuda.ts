import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import { q } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { usePayees } from '#hooks/usePayees';
import { useQuery } from '#hooks/useQuery';
import { useSheetValue } from '#hooks/useSheetValue';
import * as bindings from '#spreadsheet/bindings';

import { calcularAmortizacion, sumarMeses } from './amortizacion';
import type { Amortizacion } from './amortizacion';
import {
  saldoInicial as calcularSaldoInicial,
  esPago,
  hayInteresEnMes,
  pagadoEnMes,
  repartirLetras,
} from './movimientosDeuda';
import type { MovimientoDeuda, ReparteLetra } from './movimientosDeuda';

export type Letra = MovimientoDeuda & ReparteLetra;

export type EstadoDeuda = {
  cargando: boolean;
  /** Deuda pendiente en céntimos, positiva. */
  saldo: number;
  saldoInicial: number;
  pagado: number;
  /** 0..1 */
  porcentajePagado: number;
  pagadoEsteMes: number;
  movimientos: MovimientoDeuda[];
  /** Últimas letras primero. */
  letras: Letra[];
  hayInteresEsteMes: boolean;
  /** Mes del próximo pago (`YYYY-MM`). */
  mesProximoPago: string;
  interesAnual: number | null;
  /** Cuota mensual en céntimos. */
  cuota: number | null;
  amortizacion: Amortizacion | null;
};

/** Reúne saldo, movimientos y tabla de amortización de una cuenta de préstamo. */
export function useDeuda(
  account: AccountEntity,
  datos: DatosPrestamo | null,
): EstadoDeuda {
  const balance = useSheetValue<'account', 'balance'>(
    bindings.accountBalance(account.id),
  );
  const { data: payees = [] } = usePayees();
  const { data: transacciones, isLoading } = useQuery<
    Pick<
      TransactionEntity,
      'id' | 'date' | 'amount' | 'payee' | 'starting_balance_flag'
    >
  >(
    () =>
      q('transactions')
        .filter({ account: account.id })
        .options({ splits: 'none' })
        .select(['id', 'date', 'amount', 'payee', 'starting_balance_flag']),
    [account.id],
  );

  const saldoCuenta = balance ?? 0;
  const mesActual = monthUtils.currentMonth();

  return useMemo(() => {
    const nombres = new Map(payees.map(p => [p.id, p.name]));
    const movimientos: MovimientoDeuda[] = (transacciones ?? []).map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      payee: t.payee ? (nombres.get(t.payee) ?? null) : null,
      apertura: !!t.starting_balance_flag,
    }));

    const saldo = Math.max(0, -saldoCuenta);
    const inicial = Math.max(calcularSaldoInicial(movimientos, datos), saldo);
    const pagado = Math.max(0, inicial - saldo);
    const pagadoEsteMes = pagadoEnMes(movimientos, mesActual);
    const mesProximoPago =
      pagadoEsteMes > 0 ? sumarMeses(mesActual, 1) : mesActual;

    const interesAnual = datos?.interes_anual ?? null;
    const cuota =
      datos?.cuota_minima != null ? Math.round(datos.cuota_minima * 100) : null;
    const amortizacion =
      interesAnual != null && cuota != null
        ? calcularAmortizacion(saldo, interesAnual, cuota, mesProximoPago)
        : null;

    const reparto = repartirLetras(movimientos, saldoCuenta, interesAnual ?? 0);
    const letras: Letra[] = movimientos
      .filter(esPago)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(m => ({
        ...m,
        ...(reparto.get(m.id) ?? { interes: 0, capital: m.amount }),
      }));

    return {
      cargando: isLoading || transacciones == null,
      saldo,
      saldoInicial: inicial,
      pagado,
      porcentajePagado: inicial > 0 ? Math.min(1, pagado / inicial) : 0,
      pagadoEsteMes,
      movimientos,
      letras,
      hayInteresEsteMes: hayInteresEnMes(movimientos, mesActual),
      mesProximoPago,
      interesAnual,
      cuota,
      amortizacion,
    };
  }, [transacciones, payees, saldoCuenta, datos, mesActual, isLoading]);
}
