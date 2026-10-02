import { useCallback, useMemo } from 'react';

import { useSyncedPref } from '#hooks/useSyncedPref';

import { escribirWidgets, leerWidgets } from './modeloWidgets';
import type { WidgetInicio } from './modeloWidgets';

/**
 * Widgets del inicio (orden y tamaño), en la preferencia sincronizada
 * `inicio-widgets` para que el inicio sea igual en todos los dispositivos.
 */
export function useInicioWidgets() {
  const [raw, setRaw] = useSyncedPref('inicio-widgets');
  const widgets = useMemo(() => leerWidgets(raw), [raw]);
  const guardar = useCallback(
    (lista: readonly WidgetInicio[]) => setRaw(escribirWidgets(lista)),
    [setRaw],
  );
  /** Vuelve al orden por defecto (borra la preferencia). */
  const restablecer = useCallback(() => setRaw(''), [setRaw]);
  return { widgets, guardar, restablecer };
}
