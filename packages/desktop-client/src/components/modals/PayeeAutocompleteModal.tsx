import React, { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { PayeeAutocomplete } from '#components/autocomplete/PayeeAutocomplete';
import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { color, densidad, texto } from '#components/mobile/ui/tokens';
import { useAccounts } from '#hooks/useAccounts';
import { useNavigate } from '#hooks/useNavigate';
import { usePayees } from '#hooks/usePayees';
import type { Modal as ModalType } from '#modals/modalsSlice';

type PayeeAutocompleteModalProps = Extract<
  ModalType,
  { name: 'payee-autocomplete' }
>['options'];

const estiloEtiqueta = {
  ...texto.etiqueta,
  color: color.fg3,
  padding: '10px 16px 6px',
} as const;

/** Fila del sistema A (48 px): icono en cajita, texto y chevron. */
function FilaOpcion({
  icono,
  titulo,
  detalle,
  onPress,
  testId,
}: {
  icono: ReactNode;
  titulo: string;
  detalle?: string;
  onPress: () => void;
  testId?: string;
}) {
  return (
    <Button
      variant="bare"
      onPress={onPress}
      data-testid={testId}
      style={{
        justifyContent: 'flex-start',
        gap: 12,
        minHeight: 48,
        padding: '6px 16px',
        borderRadius: 0,
        textAlign: 'left',
      }}
    >
      {icono}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...densidad.nombre, color: color.fg }}>{titulo}</Text>
        {detalle && (
          <Text style={{ ...densidad.pequeno, color: color.fg3 }}>
            {detalle}
          </Text>
        )}
      </View>
      <Icono nombre="cr" size={16} style={{ color: color.fg3 }} />
    </Button>
  );
}

export function PayeeAutocompleteModal({
  onSelect,
  onClose,
  mostrarTraspasos = false,
  cuentaMovimiento,
  empezarEnTraspaso = false,
}: PayeeAutocompleteModalProps) {
  const { t } = useTranslation();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();
  const [eligiendoCuenta, setEligiendoCuenta] = useState(empezarEnTraspaso);

  const { isNarrowWidth } = useResponsive();
  const conTraspasos = mostrarTraspasos && isNarrowWidth;
  const defaultAutocompleteProps = {
    containerProps: {
      style: {
        height: isNarrowWidth
          ? conTraspasos
            ? 'calc(var(--visual-viewport-height) * 0.85 - 170px)'
            : '90vh'
          : 275,
      },
    },
  };

  // Cuentas a las que se puede traspasar: abiertas y sin la del movimiento,
  // primero las del presupuesto. Cada cuenta tiene su beneficiario de
  // traspaso (`payee.transfer_acct`): es lo que se guarda en el movimiento y
  // con lo que Actual crea el movimiento espejo en la otra cuenta.
  const destinos = useMemo(() => {
    const payeePorCuenta = new Map<string, string>();
    for (const p of payees) {
      if (p.transfer_acct) {
        payeePorCuenta.set(p.transfer_acct, p.id);
      }
    }
    return accounts
      .filter(
        a =>
          !a.closed &&
          !a.tombstone &&
          a.id !== cuentaMovimiento &&
          payeePorCuenta.has(a.id),
      )
      .sort((a, b) => Number(a.offbudget) - Number(b.offbudget))
      .map(a => ({ cuenta: a, payeeId: payeePorCuenta.get(a.id) ?? '' }));
  }, [accounts, payees, cuentaMovimiento]);

  const onManagePayees = () => navigate('/payees');

  return (
    <Modal
      name="payee-autocomplete"
      noAnimation={!isNarrowWidth}
      onClose={onClose}
      containerProps={{
        style: {
          height: isNarrowWidth
            ? 'calc(var(--visual-viewport-height) * 0.85)'
            : 275,
          backgroundColor: theme.menuAutoCompleteBackground,
        },
      }}
    >
      {({ state }) => (
        <>
          {isNarrowWidth && (
            <ModalHeader
              leftContent={
                eligiendoCuenta ? (
                  <Button
                    variant="bare"
                    aria-label={t('Back')}
                    onPress={() => setEligiendoCuenta(false)}
                    style={{ width: 44, height: 44, color: color.fg2 }}
                  >
                    <Icono nombre="cl" size={20} />
                  </Button>
                ) : undefined
              }
              title={
                <ModalTitle
                  title={
                    eligiendoCuenta
                      ? t('Transfer between accounts')
                      : t('Payee')
                  }
                  getStyle={() => ({
                    color: theme.menuAutoCompleteText,
                    fontSize: 17,
                    fontWeight: 800,
                  })}
                />
              }
              rightContent={
                <ModalCloseButton
                  onPress={() => state.close()}
                  style={{ color: theme.menuAutoCompleteText }}
                />
              }
            />
          )}
          {conTraspasos && eligiendoCuenta ? (
            <View
              data-testid="traspaso-cuentas"
              style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}
            >
              <Text style={estiloEtiqueta}>
                <Trans>Choose the other account</Trans>
              </Text>
              {destinos.map(({ cuenta, payeeId }) => (
                <FilaOpcion
                  key={cuenta.id}
                  testId="traspaso-cuenta"
                  icono={
                    <IconoCaja
                      icono={cuenta.offbudget ? 'piggy' : 'wallet'}
                      size={32}
                      tono={cuenta.offbudget ? 'neutro' : 'acento'}
                    />
                  }
                  titulo={cuenta.name}
                  detalle={cuenta.offbudget ? t('Off budget') : undefined}
                  onPress={() => {
                    onSelect(payeeId);
                    state.close();
                  }}
                />
              ))}
              {destinos.length === 0 && (
                <Text style={{ ...estiloEtiqueta, textTransform: 'none' }}>
                  <Trans>No other open accounts.</Trans>
                </Text>
              )}
            </View>
          ) : (
            <>
              {conTraspasos && (
                <View style={{ flex: 'none' }}>
                  <Text style={estiloEtiqueta}>
                    <Trans>Payments and transfers</Trans>
                  </Text>
                  <FilaOpcion
                    testId="opcion-traspaso"
                    icono={<IconoCaja icono="move" size={32} tono="acento" />}
                    titulo={t('Transfer between accounts')}
                    onPress={() => setEligiendoCuenta(true)}
                  />
                </View>
              )}
              <PayeeAutocomplete
                payees={payees}
                accounts={accounts}
                focused
                embedded
                closeOnBlur={false}
                onClose={() => state.close()}
                onManagePayees={onManagePayees}
                showManagePayees={!isNarrowWidth}
                showMakeTransfer={!isNarrowWidth}
                {...defaultAutocompleteProps}
                onSelect={onSelect}
                value={null}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}
