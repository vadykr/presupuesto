import type { IntegerAmount } from '@actual-app/core/shared/util';

import { ingresoNoContado } from './noIngreso';
import {
  useCategoriasInfo,
  useMovimientosMensuales,
} from './useTotalesMensuales';

/**
 * Lo que entró en categorías de ingreso en `mes` pero no cuenta como ingreso
 * (traspasos desde cuentas propias y movimientos con `#noingreso`). Sirve
 * para restarlo de `envelopeBudget.totalIncome`, que lo incluye porque suma a
 * «Listo para asignar».
 */
export function useIngresoNoContado(mes: string): IntegerAmount {
  const { data } = useMovimientosMensuales(mes, mes);
  const categorias = useCategoriasInfo();
  return data ? ingresoNoContado(data.excluidos, categorias) : 0;
}
