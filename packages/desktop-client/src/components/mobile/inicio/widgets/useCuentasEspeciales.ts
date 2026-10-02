import { useMemo } from 'react';

import { leerDatosPrestamo } from '@actual-app/core/shared/prestamos';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import { q } from '@actual-app/core/shared/query';
import type { AccountEntity, NoteEntity } from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';
import { useQuery } from '#hooks/useQuery';

export type Prestamo = { account: AccountEntity; datos: DatosPrestamo };

/**
 * Separa las cuentas abiertas que interesan al inicio:
 * - préstamos: las que llevan `#prestamo {...}` en su nota (`account-<id>`,
 *   o la nota antigua con el id a secas);
 * - huchas: cuentas fuera de presupuesto que no son préstamo (Kiara…).
 */
export function clasificarCuentas(
  cuentas: readonly AccountEntity[],
  notas: ReadonlyMap<string, string | null>,
): { prestamos: Prestamo[]; huchas: AccountEntity[] } {
  const prestamos: Prestamo[] = [];
  const huchas: AccountEntity[] = [];
  for (const account of cuentas) {
    if (account.closed) {
      continue;
    }
    const nota =
      notas.get(`account-${account.id}`) ?? notas.get(account.id) ?? null;
    const datos = leerDatosPrestamo(nota);
    if (datos) {
      prestamos.push({ account, datos });
    } else if (account.offbudget) {
      huchas.push(account);
    }
  }
  return { prestamos, huchas };
}

export function useCuentasEspeciales() {
  const { data: cuentas = [], isLoading } = useAccounts();
  const idsNotas = useMemo(
    () => cuentas.flatMap(c => [`account-${c.id}`, c.id]),
    [cuentas],
  );
  const { data: notas } = useQuery<Pick<NoteEntity, 'id' | 'note'>>(
    () =>
      idsNotas.length === 0
        ? null
        : q('notes')
            .filter({ id: { $oneof: idsNotas } })
            .select(['id', 'note']),
    [idsNotas],
  );
  return useMemo(() => {
    const mapa = new Map((notas ?? []).map(n => [n.id, n.note]));
    return {
      ...clasificarCuentas(cuentas, mapa),
      cargando: isLoading || (idsNotas.length > 0 && notas == null),
    };
  }, [cuentas, notas, isLoading, idsNotas.length]);
}
