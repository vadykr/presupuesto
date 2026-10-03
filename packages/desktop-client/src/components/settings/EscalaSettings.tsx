import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';

import { Setting } from './UI';

const CLAVE = 'presupuesto:escala';
const OPCIONES = ['0.6', '0.7', '0.8', '0.9', '1'];

function leer(): string {
  try {
    return localStorage.getItem(CLAVE) || '0.7';
  } catch {
    return '0.7';
  }
}

/** Tamaño de la interfaz en el móvil (escala del viewport, ver index.html). */
export function EscalaSettings() {
  const { t } = useTranslation();
  const [escala, setEscala] = useState(leer);

  return (
    <Setting
      primaryAction={
        <Select
          aria-label={t('Interface size')}
          options={OPCIONES.map(o => [o, `${Math.round(Number(o) * 100)} %`])}
          value={escala}
          onChange={valor => {
            setEscala(valor);
            try {
              localStorage.setItem(CLAVE, valor);
            } catch {
              // sin almacenamiento: no se recuerda
            }
            window.location.reload();
          }}
        />
      }
    >
      <Text>
        <Trans>
          <strong>Interface size</strong> on the phone: everything (text,
          spacing, rows) scales together. Saved on this device.
        </Trans>
      </Text>
    </Setting>
  );
}
