import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Cabecera } from '#components/mobile/ui/Cabecera';
import { Icono } from '#components/mobile/ui/Icono';
import type { NombreIcono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Tarjeta } from '#components/mobile/ui/Tarjeta';
import { color, espacio } from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

type Entrada = { nombre: string; ruta: string; icono: NombreIcono };

/** Lista de accesos de «Más» (se reutiliza en Ajustes, sin la entrada de Ajustes). */
export function ListaMas({ sinAjustes = false }: { sinAjustes?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const conServidor = syncServerStatus !== 'no-server' || isTestEnv;

  const entradas: Entrada[] = [
    { nombre: t('Annual spending'), ruta: '/anual', icono: 'cal' },
    { nombre: t('Schedules'), ruta: '/schedules', icono: 'cal' },
    { nombre: t('Payees'), ruta: '/payees', icono: 'store' },
    { nombre: t('Rules'), ruta: '/rules', icono: 'sliders' },
    ...(conServidor
      ? [
          {
            nombre: t('Bank Sync'),
            ruta: '/bank-sync',
            icono: 'refresh' as const,
          },
        ]
      : []),
    ...(sinAjustes
      ? []
      : [
          {
            nombre: t('Settings'),
            ruta: '/settings',
            icono: 'settings' as const,
          },
        ]),
  ];

  return (
    <Tarjeta relleno={0} data-testid="lista-mas">
      {entradas.map((e, i) => (
        <View
          key={e.ruta}
          style={{ borderTop: i === 0 ? 0 : `1px solid ${color.line}` }}
        >
          <Tarjeta
            relleno={0}
            onPress={() => void navigate(e.ruta)}
            style={{
              borderRadius: 0,
              boxShadow: 'none',
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.icono,
              minHeight: 56,
              padding: '0 14px',
            }}
          >
            <IconoCaja icono={e.icono} size={36} />
            <Text style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
              {e.nombre}
            </Text>
            <Icono nombre="cr" size={18} style={{ color: color.fg3 }} />
          </Tarjeta>
        </View>
      ))}
    </Tarjeta>
  );
}

/**
 * «Más»: lo que no cabe en la barra de pestañas (Pagos programados,
 * Beneficiarios, Reglas, Sincronización bancaria y Ajustes). Se llega desde la
 * cabecera de Cuentas y desde Ajustes.
 */
export function MasPage() {
  const { t } = useTranslation();
  return (
    <Page
      header={<Cabecera titulo={t('More')} style={{ paddingBottom: 10 }} />}
      padding={0}
    >
      <View
        data-testid="mas"
        style={{
          padding: espacio.margen,
          paddingBottom: MOBILE_NAV_HEIGHT + espacio.margen,
        }}
      >
        <ListaMas />
      </View>
    </Page>
  );
}
