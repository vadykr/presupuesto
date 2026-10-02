import { forwardRef, useCallback, useRef } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
import type { DragItem } from 'react-aria';
import {
  DropIndicator,
  ListBox,
  ListBoxItem,
  useDragAndDrop,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronDown,
  SvgCheveronRight,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import { leerDatosPrestamo } from '@actual-app/core/shared/prestamos';
import { q } from '@actual-app/core/shared/query';
import type { AccountEntity, NoteEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { useMoveAccountMutation, useSyncAndDownloadMutation } from '#accounts';
import { isAccountFailedSync } from '#accounts/syncStatus';
import { makeAmountFullStyle } from '#components/budget/util';
import { useDeuda } from '#components/mobile/deudas/useDeuda';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { PullToRefresh } from '#components/mobile/PullToRefresh';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import {
  BotonRedondo,
  Cabecera,
  TituloSeccion,
} from '#components/mobile/ui/Cabecera';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Importe } from '#components/mobile/ui/Importe';
import { Tarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  espacio,
  movimiento,
  num,
  radio,
  sombra,
  texto,
} from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { useLocalPref } from '#hooks/useLocalPref';
import { useNavigate } from '#hooks/useNavigate';
import { useQuery } from '#hooks/useQuery';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { replaceModal } from '#modals/modalsSlice';
import { useDispatch, useSelector } from '#redux';
import type { Binding, SheetFields } from '#spreadsheet';
import * as bindings from '#spreadsheet/bindings';

const ROW_HEIGHT = 60;

// Virtual account id for the all-accounts transaction list (/accounts/all)
export const ALL_ACCOUNTS_ID = 'all';

type AccountHeaderProps<SheetFieldName extends SheetFields<'account'>> = {
  id: string;
  name: string;
  amount: Binding<'account', SheetFieldName>;
  style?: CSSProperties;
  showCheveronDown?: boolean;
  onPress?: () => void;
};

function AccountHeader<SheetFieldName extends SheetFields<'account'>>({
  id,
  name,
  amount,
  style = {},
  showCheveronDown = false,
  onPress,
}: AccountHeaderProps<SheetFieldName>) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const Cheveron = showCheveronDown ? SvgCheveronDown : SvgCheveronRight;

  return (
    <Button
      variant="bare"
      aria-label={t('View {{name}} transactions', { name })}
      onPress={onPress ? onPress : () => navigate(`/accounts/${id}`)}
      style={{
        minHeight: 52,
        width: '100%',
        padding: '0 14px',
        borderRadius: 0,
        color: color.fg2,
        ...style,
      }}
      // to match the feel of the other account buttons
      className={css([
        {
          '&[data-pressed], &[data-hovered]': {
            backgroundColor: 'transparent',
            transform: 'translateY(1px)',
          },
        },
      ])}
    >
      <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row' }}>
        <Text
          style={{ fontSize: 14.5, fontWeight: 700, color: color.fg }}
          data-testid="name"
        >
          {name}
        </Text>
        <Cheveron
          style={{
            flexShrink: 0,
            color: theme.mobileHeaderTextSubdued,
            marginLeft: 5,
          }}
          width={styles.text.fontSize}
          height={styles.text.fontSize}
        />
      </View>
      <CellValue binding={amount} type="financial">
        {props => (
          <CellValueText<'account', SheetFieldName>
            {...props}
            style={{ ...num, fontSize: 14.5, fontWeight: 800 }}
          />
        )}
      </CellValue>
    </Button>
  );
}

type AccountListItemProps = ComponentPropsWithoutRef<
  typeof ListBoxItem<AccountEntity>
> & {
  isUpdated: boolean;
  isConnected: boolean;
  isPending: boolean;
  isFailed: boolean;
  getBalanceQuery: (
    accountId: AccountEntity['id'],
  ) => Binding<'account', 'balance'>;
  onSelect: (account: AccountEntity) => void;
};

function AccountListItem({
  isUpdated,
  isConnected,
  isPending,
  isFailed,
  getBalanceQuery,
  onSelect,
  ...props
}: AccountListItemProps) {
  const { value: account } = props;

  if (!account) {
    return null;
  }

  return (
    <ListBoxItem
      textValue={account.name}
      className={css({
        borderBottom: `1px solid ${color.line}`,
        '&:last-child': {
          borderBottom: 'none',
        },
      })}
      {...props}
    >
      {itemProps => (
        <Button
          {...itemProps}
          style={{
            height: ROW_HEIGHT,
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 0,
            padding: '0 14px',
          }}
          data-testid="account-list-item"
          onPress={() => onSelect(account)}
        >
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              flexDirection: 'row',
            }}
          >
            <View
              style={{
                backgroundColor: isPending
                  ? theme.sidebarItemBackgroundPending
                  : isFailed
                    ? theme.sidebarItemBackgroundFailed
                    : theme.sidebarItemBackgroundPositive,
                marginRight: '6px',
                width: 8,
                flexShrink: 0,
                height: 8,
                borderRadius: 8,
                opacity: isConnected ? 1 : 0,
              }}
            />
            <TextOneLine
              style={{
                fontSize: 15,
                fontWeight: isUpdated ? 800 : 700,
                color: color.fg,
              }}
              data-testid="account-name"
            >
              {account.name}
            </TextOneLine>
          </View>
          <CellValue binding={getBalanceQuery(account.id)} type="financial">
            {props => (
              <CellValueText<'account', 'balance'>
                {...props}
                style={{
                  fontSize: 16,
                  ...makeAmountFullStyle(props.value, {
                    positiveColor: theme.numberPositive,
                    negativeColor: theme.numberNegative,
                    zeroColor: theme.numberNeutral,
                  }),
                }}
                data-testid="account-balance"
              />
            )}
          </CellValue>
        </Button>
      )}
    </ListBoxItem>
  );
}

function EmptyMessage({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <View style={{ padding: espacio.margen }}>
      <EstadoVacio
        ilustracion="barquito"
        titulo={<Trans>Add your first account</Trans>}
        texto={
          <Trans>
            Accounts hold your transactions, like everyday spending, savings,
            credit cards, or cash. Add one to start tracking your money.
          </Trans>
        }
        accion={
          <Boton onPress={onAddAccount}>
            <Icono nombre="plus" size={18} />
            <Trans>Add account</Trans>
          </Boton>
        }
      />
    </View>
  );
}

type AllAccountListProps = {
  accounts: AccountEntity[];
  getAccountBalance: (
    accountId: AccountEntity['id'],
  ) => Binding<'account', 'balance'>;
  getAllAccountsBalance: () => Binding<'account', 'accounts-balance'>;
  getOnBudgetBalance: () => Binding<'account', 'onbudget-accounts-balance'>;
  getOffBudgetBalance: () => Binding<'account', 'offbudget-accounts-balance'>;
  getClosedAccountsBalance: () => Binding<'account', 'closed-accounts-balance'>;
  onAddAccount: () => void;
  onOpenAccount: (account: AccountEntity) => void;
  onSync: () => Promise<void>;
};

function AllAccountList({
  accounts,
  getAccountBalance,
  getAllAccountsBalance,
  getOnBudgetBalance,
  getOffBudgetBalance,
  getClosedAccountsBalance,
  onAddAccount,
  onOpenAccount,
  onSync,
}: AllAccountListProps) {
  const { t } = useTranslation();
  const onBudgetAccounts = accounts.filter(
    account => account.offbudget === 0 && account.closed === 0,
  );
  const offBudgetAccounts = accounts.filter(
    account => account.offbudget === 1 && account.closed === 0,
  );
  const closedAccounts = accounts.filter(account => account.closed === 1);
  const navigate = useNavigate();

  // Préstamos: cuentas con la línea `#prestamo {...}` en su nota. Huchas:
  // el resto de cuentas fuera del presupuesto (p. ej. la de Kiara).
  const { data: notas } = useQuery<NoteEntity>(
    () => q('notes').select('*'),
    [],
  );
  const notaDe = (id: string) =>
    notas?.find(n => n.id === `account-${id}`)?.note ?? null;
  const conDatos = [...onBudgetAccounts, ...offBudgetAccounts].map(cuenta => ({
    cuenta,
    datos: leerDatosPrestamo(notaDe(cuenta.id)),
  }));
  const prestamos = conDatos.filter(c => c.datos != null);
  const corrientes = onBudgetAccounts.filter(
    c => !prestamos.some(p => p.cuenta.id === c.id),
  );
  const huchas = offBudgetAccounts.filter(
    c => !prestamos.some(p => p.cuenta.id === c.id),
  );

  const closedAccountsRef = useRef<HTMLDivElement | null>(null);
  const [showClosedAccounts, setShowClosedAccountsPref] = useLocalPref(
    'ui.showClosedAccounts',
  );

  const onToggleClosedAccounts = () => {
    const toggledState = !showClosedAccounts;
    setShowClosedAccountsPref(toggledState);
    if (toggledState) {
      // Make sure to scroll to the closed accounts when the user presses
      // on the account header, otherwise it's not clear that the accounts are there.
      // Delay the scroll until the component is rendered, otherwise the scroll
      // won't work.
      setTimeout(() => {
        closedAccountsRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  };

  return (
    <Page
      header={
        <Cabecera
          titulo={t('Accounts')}
          subtitulo={t('{{count}} accounts', {
            count: onBudgetAccounts.length + offBudgetAccounts.length,
          })}
          derecha={
            <>
              <BotonRedondo
                icono="more"
                aria-label={t('More')}
                onPress={() => void navigate('/mas')}
              />
              <BotonRedondo
                icono="plus"
                aria-label={t('Add account')}
                onPress={onAddAccount}
              />
            </>
          }
          style={{ paddingBottom: 10 }}
        />
      }
      padding={0}
    >
      {accounts.length === 0 ? (
        <EmptyMessage onAddAccount={onAddAccount} />
      ) : (
        <PullToRefresh onRefresh={onSync}>
          <View
            aria-label={t('Account list')}
            style={{
              gap: espacio.tarjetas,
              padding: `4px ${espacio.margen}px`,
              paddingBottom: MOBILE_NAV_HEIGHT + espacio.margen,
            }}
          >
            <TotalCuentas
              etiqueta={t('In the budget')}
              binding={getOnBudgetBalance()}
              onPress={() => void navigate('/accounts/onbudget')}
            />
            <Cartera
              cuentas={corrientes}
              getAccountBalance={getAccountBalance}
              onOpenAccount={onOpenAccount}
            />
            {prestamos.length > 0 && (
              <>
                <TituloSeccion style={{ padding: '0 4px' }}>
                  <Trans>Loans</Trans>
                </TituloSeccion>
                <Tarjeta relleno={0}>
                  {prestamos.map(({ cuenta, datos }, i) => (
                    <FilaPrestamo
                      key={cuenta.id}
                      cuenta={cuenta}
                      datos={datos}
                      primera={i === 0}
                      onPress={() => onOpenAccount(cuenta)}
                    />
                  ))}
                </Tarjeta>
              </>
            )}
            {huchas.length > 0 && (
              <>
                <TituloSeccion style={{ padding: '0 4px' }}>
                  <Trans>Off budget</Trans>
                </TituloSeccion>
                {huchas.map(cuenta => (
                  <Hucha
                    key={cuenta.id}
                    cuenta={cuenta}
                    binding={getAccountBalance(cuenta.id)}
                    onPress={() => onOpenAccount(cuenta)}
                  />
                ))}
              </>
            )}
            <Tarjeta relleno={0} style={{ marginTop: 8 }}>
              <AccountHeader
                id={ALL_ACCOUNTS_ID}
                name={t('All accounts')}
                amount={getAllAccountsBalance()}
              />
              {offBudgetAccounts.length > 0 && (
                <AccountHeader
                  id="offbudget"
                  name={t('Off budget')}
                  amount={getOffBudgetBalance()}
                  style={{ borderTop: `1px solid ${color.line}` }}
                />
              )}
              {closedAccounts.length > 0 && (
                <AccountHeader
                  id="closed"
                  name={t('Closed accounts')}
                  onPress={onToggleClosedAccounts}
                  amount={getClosedAccountsBalance()}
                  style={{ borderTop: `1px solid ${color.line}` }}
                  showCheveronDown={showClosedAccounts}
                />
              )}
            </Tarjeta>
            {showClosedAccounts && (
              <AccountList
                aria-label={t('Closed accounts')}
                accounts={closedAccounts}
                getAccountBalance={getAccountBalance}
                onOpenAccount={onOpenAccount}
                ref={el => {
                  if (el) closedAccountsRef.current = el;
                }}
              />
            )}
          </View>
        </PullToRefresh>
      )}
    </Page>
  );
}

type AccountListProps = {
  'aria-label': string;
  accounts: AccountEntity[];
  getAccountBalance: (
    accountId: AccountEntity['id'],
  ) => Binding<'account', 'balance'>;
  onOpenAccount: (account: AccountEntity) => void;
};

const AccountList = forwardRef<HTMLDivElement, AccountListProps>(
  (
    {
      'aria-label': ariaLabel,
      accounts,
      getAccountBalance: getBalanceBinding,
      onOpenAccount,
    }: AccountListProps,
    ref,
  ) => {
    const syncingAccountIds = useSelector(
      state => state.account.accountsSyncing,
    );
    const updatedAccounts = useSelector(state => state.account.updatedAccounts);

    const moveAccount = useMoveAccountMutation();

    const { dragAndDropHooks } = useDragAndDrop({
      getItems: keys =>
        [...keys].map(
          key =>
            ({
              'text/plain': key as AccountEntity['id'],
            }) as DragItem,
        ),
      renderDropIndicator: target => {
        return (
          <DropIndicator
            target={target}
            className={css({
              '&[data-drop-target]': {
                height: 4,
                backgroundColor: theme.tableBorderSeparator,
                opacity: 1,
                borderRadius: 4,
              },
            })}
          />
        );
      },
      onReorder: e => {
        const [key] = e.keys;
        const accountIdToMove = key as AccountEntity['id'];
        const targetAccountId = e.target.key as AccountEntity['id'];

        if (e.target.dropPosition === 'before') {
          moveAccount.mutate({
            id: accountIdToMove,
            targetId: targetAccountId,
          });
        } else if (e.target.dropPosition === 'after') {
          const targetAccountIndex = accounts.findIndex(
            account => account.id === e.target.key,
          );
          if (targetAccountIndex === -1) {
            throw new Error(
              `Internal error: account with ID ${targetAccountId} not found.`,
            );
          }

          const nextToTargetAccount = accounts[targetAccountIndex + 1];

          moveAccount.mutate({
            id: accountIdToMove,
            // Due to the way `moveAccount` works, we use the account next to the
            // actual target account here because `moveAccount` always shoves the
            // account *before* the target account.
            // On the other hand, using `null` as `targetId`moves the account
            // to the end of the list.
            targetId: nextToTargetAccount?.id || null,
          });
        }
      },
    });
    return (
      <ListBox
        aria-label={ariaLabel}
        items={accounts}
        dependencies={[syncingAccountIds, updatedAccounts]}
        dragAndDropHooks={dragAndDropHooks}
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: color.surface,
          borderRadius: radio.tarjeta,
          boxShadow: sombra.tarjeta,
          overflow: 'hidden',
        }}
      >
        {account => (
          <AccountListItem
            key={account.id}
            id={account.id}
            value={account}
            isUpdated={updatedAccounts && updatedAccounts.includes(account.id)}
            isConnected={!!account.bank}
            isPending={syncingAccountIds.includes(account.id)}
            isFailed={isAccountFailedSync(account)}
            getBalanceQuery={getBalanceBinding}
            onSelect={onOpenAccount}
          />
        )}
      </ListBox>
    );
  },
);

AccountList.displayName = 'AccountList';

export function AccountsPage() {
  const location = useLocation();
  const dispatch = useDispatch();
  const { data: accounts = [] } = useAccounts();
  const [_numberFormat] = useSyncedPref('numberFormat');
  const numberFormat = _numberFormat || 'comma-dot';
  const [hideFraction] = useSyncedPref('hideFraction');

  const navigate = useNavigate();

  const onOpenAccount = useCallback(
    (account: AccountEntity) => {
      void navigate(`/accounts/${account.id}`);
    },
    [navigate],
  );

  const onAddAccount = useCallback(() => {
    dispatch(replaceModal({ modal: { name: 'add-account', options: {} } }));
  }, [dispatch]);

  const syncAndDownload = useSyncAndDownloadMutation();
  const onSync = useCallback(async () => {
    syncAndDownload.mutate({});
  }, [syncAndDownload]);

  // Drill-downs (e.g. report activity) land on /accounts with filter
  // conditions in the location state; show them as filtered transactions.
  const filterConditions = location?.state?.filterConditions || [];
  if (filterConditions.length > 0) {
    return (
      <Navigate
        to={`/accounts/${ALL_ACCOUNTS_ID}`}
        state={location.state}
        replace
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AllAccountList
        // This key forces the whole table rerender when the number
        // format changes
        key={numberFormat + hideFraction}
        accounts={accounts}
        getAccountBalance={bindings.accountBalance}
        getAllAccountsBalance={bindings.allAccountBalance}
        getOnBudgetBalance={bindings.onBudgetAccountBalance}
        getOffBudgetBalance={bindings.offBudgetAccountBalance}
        getClosedAccountsBalance={bindings.closedAccountBalance}
        onAddAccount={onAddAccount}
        onOpenAccount={onOpenAccount}
        onSync={onSync}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Concepto A · Cartera: total, tarjetas apiladas, préstamos y huchas
// ---------------------------------------------------------------------------

const FONDOS_TARJETA = [
  `linear-gradient(140deg, ${color.cardC}, ${color.cardD})`,
  `linear-gradient(140deg, ${color.heroA}, ${color.heroB})`,
  `linear-gradient(140deg, ${color.cardA}, ${color.cardB})`,
  `linear-gradient(140deg, ${color.cardB}, ${color.cardC})`,
];

function TotalCuentas({
  etiqueta,
  binding,
  onPress,
}: {
  etiqueta: string;
  binding: Binding<'account', 'onbudget-accounts-balance'>;
  onPress: () => void;
}) {
  return (
    <Button
      variant="bare"
      onPress={onPress}
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0 4px',
        minHeight: 44,
        color: color.fg,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: 700, color: color.fg3 }}>
        {etiqueta}
      </Text>
      <CellValue binding={binding} type="financial">
        {props => (
          <CellValueText<'account', 'onbudget-accounts-balance'>
            {...props}
            style={{
              ...num,
              ...texto.cifra,
              lineHeight: 1.1,
            }}
            data-testid="total-presupuesto"
          />
        )}
      </CellValue>
    </Button>
  );
}

/** Cuentas corrientes como tarjetas tipo Wallet, apiladas. */
function Cartera({
  cuentas,
  getAccountBalance,
  onOpenAccount,
}: {
  cuentas: AccountEntity[];
  getAccountBalance: (id: AccountEntity['id']) => Binding<'account', 'balance'>;
  onOpenAccount: (account: AccountEntity) => void;
}) {
  const { t } = useTranslation();
  const syncingAccountIds = useSelector(state => state.account.accountsSyncing);
  if (cuentas.length === 0) {
    return null;
  }
  return (
    <View data-testid="cartera" style={{ paddingBottom: 4 }}>
      {cuentas.map((cuenta, i) => {
        const pendiente = syncingAccountIds.includes(cuenta.id);
        const fallo = isAccountFailedSync(cuenta);
        return (
          <Button
            key={cuenta.id}
            variant="bare"
            data-testid="account-list-item"
            aria-label={t('View {{name}} transactions', { name: cuenta.name })}
            onPress={() => onOpenAccount(cuenta)}
            style={({ isPressed }) => ({
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'space-between',
              minHeight: 178,
              marginTop: i === 0 ? 0 : -120,
              padding: '16px 18px',
              borderRadius: 22,
              color: '#fff',
              textAlign: 'left',
              background: FONDOS_TARJETA[i % FONDOS_TARJETA.length],
              boxShadow:
                '0 -6px 18px rgba(0,0,0,.25), 0 10px 26px rgba(0,0,0,.3)',
              overflow: 'hidden',
              transform: isPressed ? 'translateY(-6px)' : undefined,
              transition: `transform ${movimiento.tarjeta}ms ${movimiento.muelle}`,
            })}
          >
            <View
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,.14), transparent 55%)',
                pointerEvents: 'none',
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TextOneLine
                style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}
                data-testid="account-name"
              >
                {cuenta.name}
              </TextOneLine>
              <CellValue
                binding={getAccountBalance(cuenta.id)}
                type="financial"
              >
                {props => (
                  <CellValueText<'account', 'balance'>
                    {...props}
                    style={{
                      ...num,
                      fontSize: 13,
                      fontWeight: 700,
                      opacity: 0.8,
                      color: '#fff',
                    }}
                  />
                )}
              </CellValue>
            </View>
            <CellValue binding={getAccountBalance(cuenta.id)} type="financial">
              {props => (
                <CellValueText<'account', 'balance'>
                  {...props}
                  style={{
                    ...num,
                    ...texto.cifra,
                    color: '#fff',
                  }}
                  data-testid="account-balance"
                />
              )}
            </CellValue>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                fontSize: 12,
                fontWeight: 700,
                opacity: 0.78,
              }}
            >
              <Text>
                {pendiente
                  ? t('Syncing…')
                  : fallo
                    ? t('Sync failed')
                    : cuenta.bank
                      ? t('Linked to the bank')
                      : t('Manual account')}
              </Text>
              <Text>
                <Trans>On budget</Trans>
              </Text>
            </View>
          </Button>
        );
      })}
    </View>
  );
}

/** Fila de un préstamo: cuota, saldo pendiente y barra de % pagado. */
function FilaPrestamo({
  cuenta,
  datos,
  primera,
  onPress,
}: {
  cuenta: AccountEntity;
  datos: DatosPrestamo | null;
  primera: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const deuda = useDeuda(cuenta, datos);
  const esCoche =
    datos?.tipo === 'autoLoan' || /coche|cotxe|car\b|auto/i.test(cuenta.name);
  const fin = deuda.amortizacion?.fechaFin;
  return (
    <Button
      variant="bare"
      onPress={onPress}
      aria-label={t('View {{name}} transactions', { name: cuenta.name })}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 0,
        borderTop: primera ? undefined : `1px solid ${color.line}`,
        color: color.fg,
        textAlign: 'left',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <IconoCaja icono={esCoche ? 'car' : 'bank'} size={40} />
          <View style={{ minWidth: 0 }}>
            <TextOneLine style={{ fontWeight: 800, fontSize: 15 }}>
              {cuenta.name}
            </TextOneLine>
            {deuda.cuota != null && (
              <Text
                style={{
                  ...num,
                  fontSize: 12,
                  fontWeight: 700,
                  color: color.fg3,
                }}
              >
                {t('Payment {{amount}}', {
                  amount: format(deuda.cuota, 'financial'),
                })}
              </Text>
            )}
          </View>
        </View>
        <Importe
          valor={-deuda.saldo}
          tono="auto"
          style={{ fontWeight: 800, fontSize: 15 }}
        />
      </View>
      <BarraProgreso valor={deuda.porcentajePagado} aria-label={t('Paid')} />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 700,
          color: color.fg3,
        }}
      >
        <Text style={num}>
          {t('{{percent}} % paid', {
            percent: (deuda.porcentajePagado * 100).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }),
          })}
        </Text>
        {fin && (
          <Text>{t('Paid off in {{year}}', { year: fin.slice(0, 4) })}</Text>
        )}
      </View>
    </Button>
  );
}

/** Cuenta fuera del presupuesto sin préstamo: hucha (tarjeta punteada). */
function Hucha({
  cuenta,
  binding,
  onPress,
}: {
  cuenta: AccountEntity;
  binding: Binding<'account', 'balance'>;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Tarjeta
      variante="punteada"
      onPress={onPress}
      aria-label={t('View {{name}} transactions', { name: cuenta.name })}
      relleno={0}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        boxShadow: 'none',
      }}
    >
      <IconoCaja icono="piggy" tono="acento" redonda />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextOneLine
          style={{ fontWeight: 800, fontSize: 15 }}
          data-testid="account-name"
        >
          {cuenta.name}
        </TextOneLine>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color: color.fg3 }}>
          <Trans>Piggy bank · not part of To Budget</Trans>
        </Text>
      </View>
      <CellValue binding={binding} type="financial">
        {props => (
          <CellValueText<'account', 'balance'>
            {...props}
            style={{ ...num, fontWeight: 800, whiteSpace: 'nowrap' }}
            data-testid="account-balance"
          />
        )}
      </CellValue>
    </Tarjeta>
  );
}
