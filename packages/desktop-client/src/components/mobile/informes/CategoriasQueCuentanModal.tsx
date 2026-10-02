import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { Checkbox } from '#components/forms';
import { useCategories } from '#hooks/useCategories';

import { Punto } from './comunes';
import { ModalLocal } from './ModalLocal';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';

/**
 * Filtro «qué categorías cuentan» en Informes. Marcada = cuenta como gasto.
 * Los cambios se guardan al momento en la preferencia sincronizada.
 */
export function CategoriasQueCuentanModal({
  abierto,
  onClose,
}: {
  abierto: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: { grouped } = { grouped: [] } } = useCategories();
  const { excluidas, setExcluidas, restablecer, esPorDefecto } =
    useCategoriasExcluidas();
  const { colorDe } = useColoresCategorias();

  const grupos = grouped.filter(g => !g.is_income);

  function alternar(id: string) {
    const nuevas = new Set(excluidas);
    if (nuevas.has(id)) {
      nuevas.delete(id);
    } else {
      nuevas.add(id);
    }
    setExcluidas(nuevas);
  }

  function alternarGrupo(grupo: CategoryGroupEntity) {
    const ids = (grupo.categories ?? []).map(c => c.id);
    const todasCuentan = ids.every(id => !excluidas.has(id));
    const nuevas = new Set(excluidas);
    for (const id of ids) {
      if (todasCuentan) {
        nuevas.add(id);
      } else {
        nuevas.delete(id);
      }
    }
    setExcluidas(nuevas);
  }

  return (
    <ModalLocal
      titulo={t('What counts as spending')}
      abierto={abierto}
      onClose={onClose}
      data-testid="modal-que-cuenta"
      pie={
        <>
          <Button
            variant="normal"
            onPress={restablecer}
            isDisabled={esPorDefecto}
          >
            <Trans>Reset</Trans>
          </Button>
          <Button variant="primary" onPress={onClose}>
            <Trans>Done</Trans>
          </Button>
        </>
      }
    >
      <Text
        style={{
          ...styles.smallText,
          color: theme.pageTextSubdued,
          padding: '0 16px 8px',
        }}
      >
        <Trans>
          Unchecked categories (debts, investments, non-countable items) are
          left out of every report.
        </Trans>
      </Text>
      {grupos.map(grupo => {
        const categorias = grupo.categories ?? [];
        const cuentan = categorias.filter(c => !excluidas.has(c.id)).length;
        return (
          <View key={grupo.id} style={{ paddingBottom: 6 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                padding: '0 16px',
                backgroundColor: theme.tableRowHeaderBackground,
              }}
            >
              <Checkbox
                checked={cuentan === categorias.length}
                onChange={() => alternarGrupo(grupo)}
                aria-label={t('Toggle whole group {{groupName}}', {
                  groupName: grupo.name,
                })}
              />
              <Text style={{ ...styles.mediumText, fontWeight: 600, flex: 1 }}>
                {grupo.name}
              </Text>
              <Text
                style={{ ...styles.smallText, color: theme.pageTextSubdued }}
              >
                {t('{{count}} of {{total}}', {
                  count: cuentan,
                  total: categorias.length,
                })}
              </Text>
            </label>
            {categorias.map(c => (
              <label
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 44,
                  padding: '0 16px 0 28px',
                  borderTop: `1px solid ${theme.tableBorder}`,
                  opacity: excluidas.has(c.id) ? 0.55 : 1,
                }}
              >
                <Checkbox
                  checked={!excluidas.has(c.id)}
                  onChange={() => alternar(c.id)}
                />
                <Punto color={colorDe(c.id)} />
                <Text
                  style={{ ...styles.mediumText, fontWeight: 400, flex: 1 }}
                >
                  {c.name}
                </Text>
              </label>
            ))}
          </View>
        );
      })}
    </ModalLocal>
  );
}
