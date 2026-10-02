import React from 'react';
import type { CSSProperties } from 'react';
import { mergeProps } from 'react-aria';
import type { ListBoxItemRenderProps } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgSplit } from '@actual-app/components/icons/v0';
import {
  SvgArrowsSynchronize,
  SvgCalendar3,
  SvgCheckCircle1,
  SvgLockClosed,
} from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { isPreviewId } from '@actual-app/core/shared/transactions';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import {
  PressResponder,
  useLongPress,
  usePress,
} from '@react-aria/interactions';

import { TransferDirectionIcon } from '#components/common/TransferDirectionIcon';
import { useColoresCategorias } from '#components/mobile/informes/useColoresCategorias';
import { separarEmoji } from '#components/mobile/ui/emoji';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { PildoraCategoria } from '#components/mobile/ui/PildoraCategoria';
import { color, colorCategoria, num } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useAccount } from '#hooks/useAccount';
import { useCachedSchedules } from '#hooks/useCachedSchedules';
import { useCategories } from '#hooks/useCategories';
import { useDisplayPayee } from '#hooks/useDisplayPayee';
import { useFormat } from '#hooks/useFormat';
import { usePayee } from '#hooks/usePayee';
import { NotesTagFormatter } from '#notes/NotesTagFormatter';
import { useSelector } from '#redux';

import { lookupName, Status } from './TransactionEdit';

export const ROW_HEIGHT = 64;

const getTextStyle = ({
  isPreview,
}: {
  isPreview: boolean;
}): CSSProperties => ({
  fontSize: 14,
  color: color.fg,
  ...(isPreview
    ? {
        fontStyle: 'italic',
        color: color.fg2,
      }
    : {}),
});

const getScheduleIconStyle = ({ isPreview }: { isPreview: boolean }) => ({
  width: 12,
  height: 12,
  marginRight: 5,
  color: isPreview ? theme.pageTextLight : theme.menuItemText,
});

type TransactionListItemProps = ListBoxItemRenderProps & {
  transaction?: TransactionEntity;
  showRunningBalance?: boolean;
  runningBalance?: IntegerAmount;
  isReconciling?: boolean;
  onPress: (transaction: TransactionEntity) => void;
  onLongPress: (transaction: TransactionEntity) => void;
  onToggleCleared?: (transaction: TransactionEntity) => void;
};

export function TransactionListItem({
  showRunningBalance,
  runningBalance,
  isReconciling = false,
  onPress,
  onLongPress,
  onToggleCleared,
  transaction,
  ...itemProps
}: TransactionListItemProps) {
  const { t } = useTranslation();
  const { data: { list: categories } = { list: [] } } = useCategories();
  const format = useFormat();
  const { huecoDe } = useColoresCategorias();

  const { data: payee } = usePayee(transaction?.payee);
  const displayPayee = useDisplayPayee({ transaction });

  const account = useAccount(transaction?.account || '');
  const transferAccount = useAccount(payee?.transfer_acct || '');
  const isPreview = isPreviewId(transaction?.id || '');
  const { schedules = [] } = useCachedSchedules();

  const newTransactions = useSelector(
    state => state.transactions.newTransactions,
  );

  const { longPressProps } = useLongPress({
    accessibilityDescription: 'Long press to select multiple transactions',
    onLongPress: () => {
      if (isPreview) {
        return;
      }

      onLongPress(transaction!);
    },
  });

  const { pressProps } = usePress({
    onPress: () => {
      onPress(transaction!);
    },
  });

  if (!transaction) {
    return null;
  }

  const {
    id,
    amount,
    category: categoryId,
    cleared: isCleared,
    reconciled: isReconciled,
    is_parent: isParent,
    is_child: isChild,
    notes,
    forceUpcoming,
    schedule: scheduleId,
  } = transaction;

  const schedule = scheduleId
    ? schedules.find(s => s.id === scheduleId)
    : undefined;
  const displayedNotes = notes || (isPreview ? schedule?.name : undefined);

  const previewStatus = forceUpcoming ? 'upcoming' : categoryId;

  const isAdded = newTransactions.includes(id);
  const categoryName = lookupName(categories, categoryId);
  const specialCategory = account?.offbudget
    ? t('Off budget')
    : transferAccount && !transferAccount.offbudget
      ? t('Transfer')
      : isParent
        ? t('Split')
        : null;

  const prettyCategory = specialCategory || categoryName;
  const textStyle = getTextStyle({ isPreview });

  const { emoji } = categoryName ? separarEmoji(categoryName) : { emoji: null };
  const hueco = categoryId && !specialCategory ? huecoDe(categoryId) : null;
  const colorIcono = hueco != null ? colorCategoria(hueco) : undefined;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        minHeight: ROW_HEIGHT,
        overflow: 'hidden',
        borderTop: `1px solid ${color.line}`,
        backgroundColor: itemProps.isSelected
          ? color.accentSoft
          : isPreview
            ? color.surface2
            : color.surface,
        ...(itemProps.isSelected && {
          boxShadow: `inset 4px 0 0 ${color.accent}`,
        }),
      }}
    >
      <PressResponder {...mergeProps(pressProps, longPressProps)}>
        <Button
          {...itemProps}
          style={{
            userSelect: 'none',
            minHeight: ROW_HEIGHT,
            flex: 1,
            borderRadius: 0,
            borderWidth: 0,
            padding: '8px 14px',
            backgroundColor: 'transparent',
            ...(isReconciling && { paddingRight: 0 }),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              minWidth: 0,
            }}
          >
            <IconoCaja
              size={36}
              icono={
                emoji
                  ? undefined
                  : transferAccount
                    ? 'move'
                    : isParent
                      ? 'arrowupdown'
                      : 'tag'
              }
              colorPropio={colorIcono}
              style={{ fontSize: 16 }}
            >
              {emoji}
            </IconoCaja>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PayeeIcons
                  transaction={transaction}
                  transferAccount={transferAccount}
                />
                <TextOneLine
                  style={{
                    ...textStyle,
                    fontWeight: 800,
                    ...(isAdded && { color: color.accent }),
                    ...(!displayPayee && !isPreview
                      ? {
                          color: color.fg3,
                          fontStyle: 'italic',
                        }
                      : {}),
                  }}
                >
                  {displayPayee || t('(No payee)')}
                </TextOneLine>
              </View>
              {isPreview ? (
                <Status status={previewStatus} isSplit={isParent || isChild} />
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    minWidth: 0,
                  }}
                >
                  {!isReconciling &&
                    (isReconciled ? (
                      <SvgLockClosed
                        style={{
                          width: 11,
                          height: 11,
                          flexShrink: 0,
                          color: color.ok,
                        }}
                      />
                    ) : (
                      <SvgCheckCircle1
                        style={{
                          width: 11,
                          height: 11,
                          flexShrink: 0,
                          color: isCleared ? color.ok : color.fg3,
                        }}
                      />
                    ))}
                  {(isParent || isChild) && (
                    <SvgSplit
                      style={{ width: 12, height: 12, flexShrink: 0 }}
                    />
                  )}
                  {prettyCategory && !specialCategory ? (
                    <PildoraCategoria
                      nombre={prettyCategory}
                      hueco={hueco}
                      tamano="pequena"
                    />
                  ) : (
                    <TextOneLine
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: prettyCategory ? color.fg3 : color.warn,
                        fontStyle: 'italic',
                        textAlign: 'left',
                      }}
                    >
                      {prettyCategory || t('Uncategorized')}
                    </TextOneLine>
                  )}
                </View>
              )}
              {displayedNotes && (
                <TextOneLine
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: color.fg3,
                    textAlign: 'left',
                  }}
                >
                  <NotesTagFormatter notes={displayedNotes} />
                </TextOneLine>
              )}
            </View>
            <View
              style={{
                justifyContent: 'center',
                alignItems: 'flex-end',
                flexShrink: 0,
              }}
            >
              <PrivacyFilter>
                <Text
                  style={{
                    ...num,
                    ...textStyle,
                    fontWeight: 800,
                    color:
                      amount > 0
                        ? color.ok
                        : amount === 0
                          ? color.fg3
                          : color.fg,
                  }}
                >
                  {amount > 0 ? '+' : ''}
                  {format(amount, 'financial')}
                </Text>
              </PrivacyFilter>
              {showRunningBalance && runningBalance !== undefined && (
                <PrivacyFilter>
                  <Text
                    style={{
                      ...num,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: runningBalance < 0 ? color.bad : color.fg3,
                    }}
                  >
                    {format(runningBalance, 'financial')}
                  </Text>
                </PrivacyFilter>
              )}
            </View>
          </View>
        </Button>
      </PressResponder>
      {isReconciling &&
        !isPreview &&
        (isChild ? (
          <View
            style={{
              width: 32,
              flexShrink: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </View>
        ) : (
          <Button
            variant="bare"
            aria-label={
              isReconciled
                ? t('Unlock reconciled transaction')
                : isCleared
                  ? t('Unclear transaction')
                  : t('Clear transaction')
            }
            style={{
              width: 32,
              height: '100%',
              flexShrink: 0,
              borderRadius: 0,
            }}
            onPress={() => onToggleCleared?.(transaction)}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </Button>
        ))}
    </View>
  );
}

type ClearedStatusIconProps = {
  isReconciled?: boolean;
  isCleared?: boolean;
};

function ClearedStatusIcon({
  isReconciled,
  isCleared,
}: ClearedStatusIconProps) {
  return isReconciled ? (
    <SvgLockClosed
      style={{
        width: 13,
        height: 13,
        color: theme.noticeTextLight,
      }}
    />
  ) : (
    <SvgCheckCircle1
      style={{
        width: 13,
        height: 13,
        color: isCleared ? theme.noticeTextLight : theme.pageTextSubdued,
      }}
    />
  );
}

type PayeeIconsProps = {
  transaction: TransactionEntity;
  transferAccount?: AccountEntity;
};

function PayeeIcons({ transaction, transferAccount }: PayeeIconsProps) {
  const { id, schedule: scheduleId } = transaction;
  const { isLoading: isSchedulesLoading, schedules = [] } =
    useCachedSchedules();
  const isPreview = isPreviewId(id);
  const schedule = schedules.find(s => s.id === scheduleId);
  const isScheduleRecurring =
    schedule &&
    schedule._date &&
    typeof schedule._date === 'object' &&
    !!schedule._date.frequency;

  if (isSchedulesLoading) {
    return null;
  }

  return (
    <>
      {schedule &&
        (isScheduleRecurring ? (
          <SvgArrowsSynchronize style={getScheduleIconStyle({ isPreview })} />
        ) : (
          <SvgCalendar3 style={getScheduleIconStyle({ isPreview })} />
        ))}
      {transferAccount && (
        <TransferDirectionIcon
          isDeposit={transaction.amount > 0}
          style={{ width: 12, height: 12, marginRight: 5 }}
        />
      )}
    </>
  );
}
