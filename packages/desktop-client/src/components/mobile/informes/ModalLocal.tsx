import type { ReactNode } from 'react';
import {
  Dialog,
  ModalOverlay,
  Modal as ReactAriaModal,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

/**
 * Modal autocontenido (react-aria) para las páginas de «Informes», sin pasar
 * por la pila global de modales: filtro de categorías y selector de categoría.
 */
export function ModalLocal({
  titulo,
  abierto,
  onClose,
  children,
  pie,
  'data-testid': testId,
}: {
  titulo: ReactNode;
  abierto: boolean;
  onClose: () => void;
  children: ReactNode;
  pie?: ReactNode;
  'data-testid'?: string;
}) {
  const { t } = useTranslation();
  return (
    <ModalOverlay
      isOpen={abierto}
      isDismissable
      onOpenChange={isOpen => !isOpen && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <ReactAriaModal style={{ width: '100%' }}>
        <Dialog
          aria-label={typeof titulo === 'string' ? titulo : t('Dialog')}
          style={{ outline: 'none' }}
        >
          <View
            data-testid={testId}
            style={{
              backgroundColor: theme.modalBackground,
              color: theme.pageText,
              borderRadius: '14px 14px 0 0',
              maxHeight: 'calc(var(--visual-viewport-height, 100vh) * 0.85)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 8px 8px 16px',
                flexShrink: 0,
              }}
            >
              <Text style={{ ...styles.largeText, fontSize: 18 }}>
                {titulo}
              </Text>
              <Button
                variant="bare"
                aria-label={t('Close')}
                onPress={onClose}
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <SvgDelete width={12} height={12} />
              </Button>
            </View>
            <View style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {children}
            </View>
            {pie && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: 8,
                  padding: 12,
                  borderTop: `1px solid ${theme.tableBorder}`,
                  flexShrink: 0,
                }}
              >
                {pie}
              </View>
            )}
          </View>
        </Dialog>
      </ReactAriaModal>
    </ModalOverlay>
  );
}
