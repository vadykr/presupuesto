import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AllAccountTransactions } from '#components/mobile/accounts/AllAccountTransactions';
import { BotonRedondo, Cabecera } from '#components/mobile/ui/Cabecera';
import { Page } from '#components/Page';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';

/**
 * Pestaña «Gastos»: los movimientos de todas las cuentas (la vista «Todas las
 * cuentas» de Actual) con cabecera grande y «+» para apuntar uno nuevo.
 */
export function GastosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [numberFormat] = useSyncedPref('numberFormat');
  const [hideFraction] = useSyncedPref('hideFraction');

  return (
    <Page
      header={
        <Cabecera
          titulo={t('Spending')}
          subtitulo={t('All accounts')}
          derecha={
            <BotonRedondo
              icono="plus"
              aria-label={t('Add transaction')}
              onPress={() => void navigate('/transactions/new')}
            />
          }
          style={{ paddingBottom: 10 }}
        />
      }
      padding={0}
    >
      {/* La clave fuerza a repintar la lista si cambia el formato numérico. */}
      <Fragment key={`${numberFormat}${hideFraction}`}>
        <AllAccountTransactions />
      </Fragment>
    </Page>
  );
}
