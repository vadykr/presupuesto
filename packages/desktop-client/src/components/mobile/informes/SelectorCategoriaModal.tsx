import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { useCategories } from '#hooks/useCategories';

import { Punto } from './comunes';
import { ModalLocal } from './ModalLocal';
import { useColoresCategorias } from './useColoresCategorias';

/** Elegir una categoría (gasto o ingreso) para ver su evolución. */
export function SelectorCategoriaModal({
  abierto,
  onClose,
  seleccionada,
  onSelect,
}: {
  abierto: boolean;
  onClose: () => void;
  seleccionada?: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data: { grouped } = { grouped: [] } } = useCategories();
  const { colorDe } = useColoresCategorias();

  return (
    <ModalLocal
      titulo={t('Choose a category')}
      abierto={abierto}
      onClose={onClose}
      data-testid="modal-elegir-categoria"
    >
      {grouped
        .filter(g => !g.hidden)
        .map(grupo => (
          <View key={grupo.id} style={{ paddingBottom: 6 }}>
            <Text
              style={{
                ...styles.smallText,
                fontWeight: 600,
                color: theme.pageTextSubdued,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '10px 16px 4px',
              }}
            >
              {grupo.name}
            </Text>
            {(grupo.categories ?? [])
              .filter(c => !c.hidden)
              .map(c => (
                <Button
                  key={c.id}
                  variant="bare"
                  onPress={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 10,
                    minHeight: 44,
                    padding: '0 16px',
                    borderRadius: 0,
                    borderTop: `1px solid ${theme.tableBorder}`,
                    fontWeight: c.id === seleccionada ? 700 : 400,
                    color: theme.pageText,
                    backgroundColor:
                      c.id === seleccionada
                        ? theme.tableRowBackgroundHighlight
                        : undefined,
                  }}
                >
                  <Punto color={colorDe(c.id)} />
                  <Text style={{ ...styles.mediumText, fontWeight: 'inherit' }}>
                    {c.name}
                  </Text>
                </Button>
              ))}
          </View>
        ))}
    </ModalLocal>
  );
}
