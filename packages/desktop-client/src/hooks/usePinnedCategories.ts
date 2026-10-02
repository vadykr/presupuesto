import { useCallback, useMemo } from 'react';

import type { CategoryEntity } from '@actual-app/core/types/models';

import { useSyncedPref } from './useSyncedPref';

/**
 * Categorías fijadas en la pantalla de inicio («Presupuesto»). Se guardan en
 * la preferencia sincronizada `pinned-categories` como un array JSON de ids,
 * para que estén iguales en todos los dispositivos.
 */
export function parsePinnedCategories(
  raw: string | undefined,
): CategoryEntity['id'][] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function usePinnedCategories() {
  const [raw, setRaw] = useSyncedPref('pinned-categories');

  const pinnedIds = useMemo(() => parsePinnedCategories(raw), [raw]);

  const isPinned = useCallback(
    (id: CategoryEntity['id']) => pinnedIds.includes(id),
    [pinnedIds],
  );

  const setPinnedIds = useCallback(
    (ids: CategoryEntity['id'][]) => {
      setRaw(JSON.stringify(ids));
    },
    [setRaw],
  );

  const togglePinned = useCallback(
    (id: CategoryEntity['id']) => {
      setPinnedIds(
        pinnedIds.includes(id)
          ? pinnedIds.filter(pinnedId => pinnedId !== id)
          : [...pinnedIds, id],
      );
    },
    [pinnedIds, setPinnedIds],
  );

  return { pinnedIds, isPinned, togglePinned, setPinnedIds };
}
