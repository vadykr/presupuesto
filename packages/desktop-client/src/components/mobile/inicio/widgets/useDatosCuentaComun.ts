import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import { useQuery } from '@tanstack/react-query';

import type { EntradaCuenta } from '#components/mobile/inicio/cuentaComun';
import { aqlQuery } from '#queries/aqlQuery';

const CADUCIDAD_MS = 30_000;

export type DatosCuentaComun = {
  /** Salidas por mes ('yyyy-MM'), en positivo, sin traspasos. */
  salidas: Record<string, IntegerAmount>;
  /** Traspasos recibidos en la cuenta (importe positivo). */
  entradas: EntradaCuenta[];
};

/**
 * Movimientos de la cuenta común: salidas mensuales sin traspasos (para el
 * gasto previsto) y traspasos recibidos desde el día 20 del mes anterior (para
 * sugerir «Traspasado»).
 */
export function useDatosCuentaComun(
  cuentaId: string | undefined,
  mes: string,
  meses: number,
) {
  const desde = monthUtils.subMonths(mes, meses);
  const mesAnterior = monthUtils.subMonths(mes, 1);
  return useQuery({
    queryKey: ['inicio', 'cuenta-comun', cuentaId, desde, mes],
    enabled: Boolean(cuentaId),
    staleTime: CADUCIDAD_MS,
    queryFn: async (): Promise<DatosCuentaComun> => {
      const { data: filas } = await aqlQuery(
        q('transactions')
          .filter({
            account: cuentaId,
            amount: { $lt: 0 },
            'payee.transfer_acct': null,
            $and: [
              { date: { $transform: '$month', $gte: desde } },
              { date: { $transform: '$month', $lte: mes } },
            ],
          })
          .groupBy({ $month: '$date' })
          .select([
            { date: { $month: '$date' } },
            { amount: { $sum: '$amount' } },
          ]),
      );
      const salidas: Record<string, IntegerAmount> = {};
      for (const f of filas as { date: string; amount: number }[]) {
        salidas[f.date] = Math.abs(f.amount);
      }
      const { data: recibidos } = await aqlQuery(
        q('transactions')
          .filter({
            account: cuentaId,
            amount: { $gt: 0 },
            'payee.transfer_acct': { $ne: null },
            date: { $gte: `${mesAnterior}-20` },
          })
          .select(['date', 'amount']),
      );
      return { salidas, entradas: recibidos as EntradaCuenta[] };
    },
  });
}
