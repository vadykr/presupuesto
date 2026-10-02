import React, { useState } from 'react';
import type { ComponentProps } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { SvgFilter } from '@actual-app/components/icons/v1';
import { Label } from '@actual-app/components/label';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { Search } from '#components/common/Search';
import { PullToRefresh } from '#components/mobile/PullToRefresh';
import {
  color,
  espacio,
  num,
  radio,
  sombra,
} from '#components/mobile/ui/tokens';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { DisplayPayeeProvider } from '#hooks/useDisplayPayee';
import { SelectedProvider, useSelected } from '#hooks/useSelected';
import { useSheetValue } from '#hooks/useSheetValue';
import type { Binding, SheetFields, SheetNames } from '#spreadsheet';

import { TransactionList } from './TransactionList';

type TransactionSearchInputProps = {
  placeholder: string;
  onSearch: TransactionListWithBalancesProps['onSearch'];
};

function TransactionSearchInput({
  placeholder,
  onSearch,
}: TransactionSearchInputProps) {
  const [text, setText] = useState('');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color.bg,
        padding: `8px ${espacio.margen}px 4px`,
        width: '100%',
      }}
    >
      <Search
        value={text}
        onChange={text => {
          setText(text);
          onSearch(text);
        }}
        placeholder={placeholder}
        width="100%"
        height={styles.mobileMinHeight}
        style={{
          backgroundColor: color.surface,
          borderColor: 'transparent',
          borderRadius: radio.boton,
          boxShadow: sombra.tarjeta,
          fontSize: 15,
        }}
      />
    </View>
  );
}

type TransactionListWithBalancesProps = {
  isLoading: boolean;
  transactions: readonly TransactionEntity[];
  balance:
    | Binding<'account', 'onbudget-accounts-balance'>
    | Binding<'account', 'offbudget-accounts-balance'>
    | Binding<'account', 'closed-accounts-balance'>
    | Binding<SheetNames, 'uncategorized-balance'>
    | Binding<'category', 'balance'>
    | Binding<'account', 'balance'>
    | Binding<'account', 'accounts-balance'>;
  balanceCleared?:
    | Binding<'category', 'balanceCleared'>
    | Binding<'account', 'balanceCleared'>;
  balanceUncleared?:
    | Binding<'category', 'balanceUncleared'>
    | Binding<'account', 'balanceUncleared'>;
  showRunningBalances?: boolean;
  runningBalances?: Map<TransactionEntity['id'], IntegerAmount>;
  searchPlaceholder: string;
  onSearch: (searchText: string) => void;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onOpenTransaction: (transaction: TransactionEntity) => void;
  onRefresh?: () => void;
  showMakeTransfer?: boolean;
  isReconciling?: boolean;
  onToggleTransactionCleared?: (transaction: TransactionEntity) => void;
  filtered?: boolean;
};

export function TransactionListWithBalances({
  isLoading,
  transactions,
  balance,
  balanceCleared,
  balanceUncleared,
  showRunningBalances,
  runningBalances,
  searchPlaceholder = 'Search...',
  onSearch,
  isLoadingMore,
  onLoadMore,
  onOpenTransaction,
  onRefresh,
  showMakeTransfer = false,
  isReconciling = false,
  onToggleTransactionCleared,
  filtered = false,
}: TransactionListWithBalancesProps) {
  const selectedInst = useSelected('transactions', [...transactions], []);

  return (
    <DisplayPayeeProvider transactions={transactions}>
      <SelectedProvider instance={selectedInst}>
        <View
          style={{
            flexShrink: 0,
            marginTop: 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-evenly',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            {balanceCleared && balanceUncleared ? (
              <BalanceWithCleared
                balance={balance}
                balanceCleared={balanceCleared}
                balanceUncleared={balanceUncleared}
                alwaysShowCleared={isReconciling}
              />
            ) : (
              <>
                <Balance balance={balance} />
                {filtered && (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <AppliedFiltersChip />
                  </View>
                )}
              </>
            )}
          </View>
          <TransactionSearchInput
            placeholder={searchPlaceholder}
            onSearch={onSearch}
          />
        </View>
        <PullToRefresh
          isPullable={!isLoading && !!onRefresh}
          onRefresh={async () => onRefresh?.()}
          style={{
            '& .ptr__children': {
              display: 'flex',
            },
          }}
        >
          <TransactionList
            isLoading={isLoading}
            transactions={transactions}
            showRunningBalances={showRunningBalances}
            runningBalances={runningBalances}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
            onOpenTransaction={onOpenTransaction}
            showMakeTransfer={showMakeTransfer}
            isReconciling={isReconciling}
            onToggleTransactionCleared={onToggleTransactionCleared}
          />
        </PullToRefresh>
      </SelectedProvider>
    </DisplayPayeeProvider>
  );
}

function AppliedFiltersChip() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: color.accentSoft,
        color: color.accent,
        borderRadius: radio.pildora,
        padding: '4px 10px',
        fontWeight: 800,
      }}
    >
      <SvgFilter width={12} height={12} style={{ flexShrink: 0 }} />
      <Text style={{ fontSize: 12, fontWeight: 500 }}>
        <Trans>Filters applied</Trans>
      </Text>
    </View>
  );
}

const TransactionListBalanceCellValue = <
  FieldName extends SheetFields<'account'> | SheetFields<'category'>,
>(
  props: ComponentProps<
    typeof CellValue<
      FieldName extends SheetFields<'account'> ? 'account' : 'category',
      FieldName
    >
  >,
) => {
  return <CellValue {...props} />;
};

type BalanceWithClearedProps = {
  balanceUncleared: NonNullable<
    TransactionListWithBalancesProps['balanceUncleared']
  >;
  balanceCleared: NonNullable<
    TransactionListWithBalancesProps['balanceCleared']
  >;
  balance: TransactionListWithBalancesProps['balance'];
  alwaysShowCleared?: boolean;
};

function BalanceWithCleared({
  balanceUncleared,
  balanceCleared,
  balance,
  alwaysShowCleared = false,
}: BalanceWithClearedProps) {
  const unclearedAmount = useSheetValue<
    'account' | 'category',
    'balanceUncleared'
  >(balanceUncleared);
  const showCleared = !!unclearedAmount || alwaysShowCleared;

  // Saldo grande centrado en su línea; debajo, una línea pequeña con
  // «Confirmado X · Pendiente Y» que puede partirse sin pisar nada.
  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 2 }}>
      <Balance balance={balance} />
      <View
        style={{
          display: !showCleared ? 'none' : 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 6,
          padding: `0 ${espacio.margen}px`,
          fontSize: 13,
          fontWeight: 600,
          color: color.fg3,
          ...num,
        }}
      >
        <Text>
          <Trans>Cleared</Trans>{' '}
          <TransactionListBalanceCellValue
            binding={balanceCleared}
            type="financial"
          >
            {props => (
              <CellValueText
                {...props}
                style={{ ...num, fontSize: 13, fontWeight: 700 }}
                data-testid="transactions-balance-cleared"
              />
            )}
          </TransactionListBalanceCellValue>
        </Text>
        <Text aria-hidden>·</Text>
        <Text>
          <Trans>Uncleared</Trans>{' '}
          <TransactionListBalanceCellValue
            binding={balanceUncleared}
            type="financial"
          >
            {props => (
              <CellValueText
                {...props}
                style={{ ...num, fontSize: 13, fontWeight: 700 }}
                data-testid="transactions-balance-uncleared"
              />
            )}
          </TransactionListBalanceCellValue>
        </Text>
      </View>
    </View>
  );
}

type BalanceProps = {
  balance: TransactionListWithBalancesProps['balance'];
};

function Balance({ balance }: BalanceProps) {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', maxWidth: '100%' }}>
      <Label
        title={t('Balance')}
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: color.fg3,
        }}
      />
      <TransactionListBalanceCellValue binding={balance} type="financial">
        {props => (
          <CellValueText
            {...props}
            style={{
              ...num,
              fontSize: 28,
              lineHeight: 1.15,
              textAlign: 'center',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color:
                props.value < 0
                  ? color.bad
                  : props.value > 0
                    ? color.fg
                    : color.fg3,
            }}
            data-testid="transactions-balance"
          />
        )}
      </TransactionListBalanceCellValue>
    </View>
  );
}
