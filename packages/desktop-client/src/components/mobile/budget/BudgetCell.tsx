import { useCallback } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { AutoTextSize } from 'auto-text-size';

import { makeAmountGrey } from '#components/budget/util';
import { color, num, radio } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNotes } from '#hooks/useNotes';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import type { Binding, SheetFields } from '#spreadsheet';

import { describe as describeExpression } from './assignExpression';
import { useAssignKeypad } from './AssignKeypadContext';
import { getColumnWidth } from './BudgetTable';

type BudgetCellProps<
  SheetFieldName extends SheetFields<'envelope-budget' | 'tracking-budget'>,
> = ComponentPropsWithoutRef<
  typeof CellValue<'envelope-budget' | 'tracking-budget', SheetFieldName>
> & {
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  /** Gasto del mes: se pinta en pequeño y en rojo bajo lo asignado. */
  spentBinding?: Binding<'envelope-budget' | 'tracking-budget', 'sum-amount'>;
};

export function BudgetCell<
  SheetFieldName extends SheetFields<'envelope-budget' | 'tracking-budget'>,
>({
  binding,
  category,
  month,
  onBudgetAction,
  spentBinding,
  children,
  ...props
}: BudgetCellProps<SheetFieldName>) {
  const { t } = useTranslation();
  const locale = useLocale();
  const columnWidth = getColumnWidth();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const categoryNotes = useNotes(category.id);
  const { isNarrowWidth } = useResponsive();
  const keypad = useAssignKeypad();
  // En el móvil la celda abre el teclado inline (panel inferior); el modal
  // antiguo queda para pantallas anchas o cuando no hay proveedor.
  const useKeypad = isNarrowWidth && keypad != null;
  const isSelected = keypad?.selectedCategory?.id === category.id;

  const onSaveNotes = useCallback(async (id: string, notes: string) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onEditNotes = useCallback(
    (id: string, month: string) => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id,
              name:
                category.name +
                ' - ' +
                monthUtils.format(month, "MMMM ''yy", locale),
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [category.name, locale, dispatch, onSaveNotes],
  );

  const onOpenCategoryBudgetMenu = useCallback(() => {
    if (useKeypad) {
      keypad.select(category);
      return;
    }
    const sharedOptions = {
      categoryId: category.id,
      month,
      onEditNotes,
      onUpdateBudget: (amount: number) => {
        onBudgetAction(month, 'budget-amount', {
          category: category.id,
          amount,
        });
        showUndoNotification({
          message: `${category.name} budget has been updated to ${format(amount, 'financial')}.`,
        });
      },
      onCopyLastMonthAverage: () => {
        onBudgetAction(month, 'copy-single-last', {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget has been set to last month's budgeted amount.`,
        });
      },
      onSetMonthsAverage: (numberOfMonths: number) => {
        if (
          numberOfMonths !== 3 &&
          numberOfMonths !== 6 &&
          numberOfMonths !== 12
        ) {
          return;
        }
        onBudgetAction(month, `set-single-${numberOfMonths}-avg`, {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget has been set to ${numberOfMonths === 12 ? 'yearly' : `${numberOfMonths} month`} average.`,
        });
      },
      onApplyBudgetTemplate: () => {
        onBudgetAction(month, 'apply-single-category-template', {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget templates have been applied.`,
          pre: categoryNotes ?? undefined,
        });
      },
    };

    if (budgetType === 'envelope') {
      dispatch(
        pushModal({
          modal: {
            name: 'envelope-budget-menu',
            options: sharedOptions,
          },
        }),
      );
    } else {
      dispatch(
        pushModal({
          modal: {
            name: 'tracking-budget-menu',
            options: {
              ...sharedOptions,
              onCopyUntilYearEnd: () => {
                onBudgetAction(month, 'copy-until-year-end', {
                  category: category.id,
                });
                showUndoNotification({
                  message: t('{{categoryName}} budget copied until year end.', {
                    categoryName: category.name,
                  }),
                });
              },
            },
          },
        }),
      );
    }
  }, [
    budgetType,
    category,
    categoryNotes,
    dispatch,
    keypad,
    month,
    onBudgetAction,
    showUndoNotification,
    onEditNotes,
    format,
    t,
    useKeypad,
  ]);

  // Mientras se teclea, la celda enseña la expresión: «246,72 €» y debajo,
  // en color, «+13,00 €».
  const display =
    isSelected && keypad
      ? describeExpression(keypad.expression, keypad.liveBudgeted)
      : null;

  return (
    <CellValue
      binding={binding}
      type="financial"
      aria-label={t('Budgeted amount for {{categoryName}} category', {
        categoryName: category.name,
      })}
      {...props}
    >
      {({ type, name, value }) =>
        children?.({
          type,
          name,
          value,
        }) || (
          <Button
            variant="bare"
            style={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              minHeight: 44,
              maxWidth: columnWidth,
              padding: isSelected ? '4px 7px' : '4px 2px',
              borderRadius: radio.sm,
              color: color.fg,
              ...(isSelected && {
                border: `2px solid ${color.accent}`,
                backgroundColor: color.bg,
              }),
            }}
            onPress={onOpenCategoryBudgetMenu}
            aria-label={t('Open budget menu for {{categoryName}} category', {
              categoryName: category.name,
            })}
            data-testid={isSelected ? 'budget-cell-selected' : undefined}
          >
            <PrivacyFilter>
              {display ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      ...num,
                      maxWidth: columnWidth,
                      textAlign: 'right',
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {format(display.primary, type)}
                  </Text>
                  {display.secondary && (
                    <Text
                      style={{
                        ...num,
                        maxWidth: columnWidth,
                        textAlign: 'right',
                        fontSize: 11.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        color:
                          display.secondary.op === '-'
                            ? color.bad
                            : color.accent,
                      }}
                      data-testid="budget-cell-expression"
                    >
                      {display.secondary.op === '-' ? '−' : '+'}
                      {format(display.secondary.amount, type)}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ alignItems: 'flex-end' }}>
                  <AutoTextSize
                    key={value}
                    as={Text}
                    minFontSizePx={9}
                    maxFontSizePx={14}
                    mode="oneline"
                    style={{
                      ...num,
                      maxWidth: columnWidth,
                      textAlign: 'right',
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      ...makeAmountGrey(value),
                    }}
                  >
                    {format(value, type)}
                  </AutoTextSize>
                  {spentBinding && <GastoDelMes binding={spentBinding} />}
                </View>
              )}
            </PrivacyFilter>
          </Button>
        )
      }
    </CellValue>
  );
}

/** «−13,00 €» en rojo bajo lo asignado: lo gastado este mes (nada si es 0). */
function GastoDelMes({
  binding,
}: {
  binding: Binding<'envelope-budget' | 'tracking-budget', 'sum-amount'>;
}) {
  const format = useFormat();
  const spent = useSheetValue(binding) ?? 0;
  if (spent === 0) {
    return null;
  }
  return (
    <Text
      data-testid="budget-cell-spent"
      style={{
        ...num,
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        color: spent < 0 ? color.bad : color.ok,
      }}
    >
      {spent < 0 ? '−' : '+'}
      {format(Math.abs(spent), 'financial')}
    </Text>
  );
}
