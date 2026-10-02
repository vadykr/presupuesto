import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';

import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import { useServerURL } from '#components/ServerContext';
import {
  solicitarConfigServidor,
  solicitarListaDePresupuestos,
} from '#presupuesto';
import { useDispatch } from '#redux';

import { Setting } from './UI';

/**
 * Presupuesto: la configuración del servidor de sincronización (dirección y
 * contraseña) ya no sale al abrir la app; se llega desde aquí. Cierra el
 * presupuesto y abre la pantalla de configuración del servidor.
 */
export function ServerSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const serverURL = useServerURL();

  const onConfigure = () => {
    solicitarConfigServidor();
    solicitarListaDePresupuestos();
    void dispatch(closeBudget());
  };

  return (
    <Setting
      primaryAction={
        <Button onPress={onConfigure}>
          {serverURL ? (
            <Trans>Change server</Trans>
          ) : (
            <Trans>Set up server</Trans>
          )}
        </Button>
      }
    >
      <Text>
        {serverURL
          ? t('Server: {{serverURL}}', { serverURL })
          : t('Server: none. Your budget is only stored on this device.')}
      </Text>
    </Setting>
  );
}
