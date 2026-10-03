import { useCallback, useEffect, useMemo, useRef } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { useNotes } from '#hooks/useNotes';
import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  conDormida,
  dormidaEn,
  dormir,
  motivoDespertar,
  parseDormidas,
} from './dormir';
import type { Dormida, MotivoDespertar } from './dormir';
import { idNotaMes, notaConIgnorarMes, notaIgnoraMes } from './objetivos';

/** Pref sincronizada `dormidas` («Dormir hasta…»). */
export function useDormidas() {
  const [raw, setRaw] = useSyncedPref('dormidas');
  const dormidas = useMemo(() => parseDormidas(raw), [raw]);
  // La última versión, para no pisar cambios hechos en el mismo render.
  const actual = useRef(dormidas);
  actual.current = dormidas;
  const setDormida = useCallback(
    (categoria: string, dormida: Dormida | null) => {
      const nuevas = conDormida(actual.current, categoria, dormida);
      actual.current = nuevas;
      setRaw(JSON.stringify(nuevas));
    },
    [setRaw],
  );
  return { dormidas, setDormida };
}

/**
 * «Ignorar este mes» y «Dormir hasta…» de una categoría. Ignorada = marca
 * `#ignorar-mes` en su nota de mes (id `<categoría>-<AAAA-MM>`, solo ese mes)
 * o dormida en ese mes (pref `dormidas`). La plantilla y el objetivo no se
 * tocan. `setIgnorada(false)` también la despierta.
 */
export function useIgnorarMes(categoryId: string, month: string) {
  const id = idNotaMes(categoryId, month);
  const nota = useNotes(id);
  const marcaDeMes = notaIgnoraMes(nota);
  const { dormidas, setDormida } = useDormidas();
  const dormidaGuardada = dormidas[categoryId] ?? null;
  const dormida = dormidaEn(dormidaGuardada, month) ? dormidaGuardada : null;
  const ignorada = marcaDeMes || dormida != null;

  const setIgnorada = useCallback(
    async (ignorar: boolean) => {
      if (!ignorar && dormidaGuardada) {
        setDormida(categoryId, null);
      }
      if (ignorar !== marcaDeMes) {
        await send('notes-save', {
          id,
          note: notaConIgnorarMes(nota, ignorar),
        });
      }
    },
    [categoryId, dormidaGuardada, id, marcaDeMes, nota, setDormida],
  );

  /** Duerme desde el mes visto hasta `hasta` (exclusivo). */
  const dormirHasta = useCallback(
    (
      hasta: string,
      asignado: IntegerAmount,
      saldo: IntegerAmount,
      actividad: IntegerAmount = 0,
    ) => {
      setDormida(categoryId, dormir(month, hasta, asignado, saldo, actividad));
    },
    [categoryId, month, setDormida],
  );

  return {
    ignorada,
    marcaDeMes,
    dormida,
    dormidaGuardada,
    setIgnorada,
    dormirHasta,
    despertar: () => setDormida(categoryId, null),
  };
}

/**
 * Despertar automático (ver `dormir.ts`): con los valores del mes visto,
 * si llegó la fecha, entró gasto o se sacó dinero, borra la dormida y
 * avisa una vez (`onDespierta`) para que la burbuja haga «pop».
 */
export function useDespertarAuto({
  categoryId,
  month,
  actividad,
  saldo,
  asignado,
  onDespierta,
}: {
  categoryId: string;
  month: string;
  /** `null` mientras la hoja carga: entonces no se decide nada. */
  actividad: IntegerAmount | null | undefined;
  saldo: IntegerAmount | null | undefined;
  asignado: IntegerAmount | null | undefined;
  onDespierta?: (motivo: MotivoDespertar) => void;
}) {
  const { dormidas, setDormida } = useDormidas();
  const dormida = dormidas[categoryId];
  const cargado = actividad != null && saldo != null && asignado != null;
  const motivo =
    dormida && cargado
      ? motivoDespertar({
          dormida,
          mesActual: monthUtils.currentMonth(),
          mes: month,
          actividad,
          saldo,
          asignado,
        })
      : null;
  useEffect(() => {
    if (motivo) {
      setDormida(categoryId, null);
      onDespierta?.(motivo);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- una vez por motivo
  }, [motivo, categoryId]);
}
