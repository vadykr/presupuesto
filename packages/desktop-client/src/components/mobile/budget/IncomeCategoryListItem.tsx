import { useCallback } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { separarEmoji } from '#components/mobile/ui/emoji';
import { color, densidad, TACTIL } from '#components/mobile/ui/tokens';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { useAssignKeypad } from './AssignKeypadContext';
import { BalanceCell } from './BalanceCell';
import { BudgetCell } from './BudgetCell';
import { getColumnWidth } from './BudgetTable';

type IncomeCategoryNameProps = {
  category: CategoryEntity;
  onEdit: (id: CategoryEntity['id']) => void;
};

function IncomeCategoryName({ category, onEdit }: IncomeCategoryNameProps) {
  const { emoji, resto } = separarEmoji(category.name);
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        alignItems: 'stretch',
      }}
    >
      {/* Hidden drag button */}
      <Button
        slot="drag"
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          position: 'absolute',
          overflow: 'hidden',
        }}
      />
      <Button
        variant="bare"
        style={{
          justifyContent: 'flex-start',
          minHeight: TACTIL,
          margin: `${-(TACTIL - 32) / 2}px 0`,
          padding: 0,
        }}
        onPress={() => onEdit?.(category.id)}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 6,
            minWidth: 0,
          }}
        >
          {emoji && (
            <Text
              aria-hidden
              data-testid="category-emoji"
              style={{ ...densidad.emoji, flexShrink: 0 }}
            >
              {emoji}
            </Text>
          )}
          <Text
            style={{
              ...styles.lineClamp(2),
              ...densidad.nombre,
              textAlign: 'left',
              color: color.fg,
            }}
            data-testid="category-name"
          >
            {emoji ? resto : category.name}
          </Text>
        </View>
      </Button>
    </View>
  );
}

type IncomeCategoryCellsProps = {
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  onPress: () => void;
};

function IncomeCategoryCells({
  category,
  month,
  onBudgetAction,
  onPress,
}: IncomeCategoryCellsProps) {
  const { t } = useTranslation();
  const columnWidth = getColumnWidth();
  const anchoDisponible = getColumnWidth({ disponible: true });
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const balance =
    budgetType === 'tracking'
      ? trackingBudget.catSumAmount(category.id)
      : envelopeBudget.catSumAmount(category.id);

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {budgetType === 'tracking' && (
        <View
          style={{
            width: columnWidth,
            justifyContent: 'center',
            alignItems: 'flex-end',
          }}
        >
          <BudgetCell
            binding={budgeted}
            type="financial"
            category={category}
            month={month}
            onBudgetAction={onBudgetAction}
          />
        </View>
      )}

      <View
        style={{
          width: anchoDisponible,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <BalanceCell
          binding={balance}
          category={category}
          month={month}
          onPress={onPress}
          aria-label={
            budgetType === 'envelope'
              ? t('Open balance menu for {{categoryName}} category', {
                  categoryName: category.name,
                })
              : t('Show transactions for {{categoryName}} category', {
                  categoryName: category.name,
                })
          }
        />
      </View>
    </View>
  );
}

type IncomeCategoryListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<CategoryEntity>
> & {
  month: string;
  onEdit: (id: CategoryEntity['id']) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
};

export function IncomeCategoryListItem({
  month,
  onEdit,
  onBudgetAction,
  ...props
}: IncomeCategoryListItemProps) {
  const { value: category } = props;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const balanceMenuModalName = `envelope-income-balance-menu`;

  const onShowActivity = useCallback(() => {
    if (!category) {
      return null;
    }

    void navigate(`/categories/${category.id}?month=${month}`);
  }, [category, month, navigate]);

  const onCarryover = useCallback(
    (carryover: boolean) => {
      if (!category) {
        return;
      }
      onBudgetAction(month, 'carryover', {
        category: category.id,
        flag: carryover,
      });
      dispatch(collapseModals({ rootModalName: balanceMenuModalName }));
    },
    [category, onBudgetAction, month, dispatch, balanceMenuModalName],
  );

  const onOpenBalanceMenu = useCallback(() => {
    if (!category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: balanceMenuModalName,
          options: {
            month,
            categoryId: category.id,
            onCarryover,
            onShowActivity,
          },
        },
      }),
    );
  }, [
    category,
    balanceMenuModalName,
    dispatch,
    month,
    onShowActivity,
    onCarryover,
  ]);

  // Fila resaltada mientras el teclado de asignación está abierto para ella.
  const keypad = useAssignKeypad();
  const isSelected = !!category && keypad?.selectedCategory?.id === category.id;

  if (!category) {
    return null;
  }

  return (
    <GridListItem
      textValue={category.name}
      data-testid="category-row"
      {...props}
    >
      <View
        data-category-id={category.id}
        data-selected={isSelected || undefined}
        style={{
          minHeight: densidad.altoFila,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: `${densidad.vertical}px ${densidad.margen}px ${densidad.vertical}px ${densidad.margen + densidad.sangria}px`,
          boxShadow: `inset 0 1px 0 ${color.line}`,
          opacity: category.hidden ? 0.5 : undefined,
          backgroundColor: isSelected ? color.accentSoft : color.surface,
        }}
      >
        <IncomeCategoryName category={category} onEdit={onEdit} />
        <IncomeCategoryCells
          key={`${category.id}`}
          category={category}
          month={month}
          onBudgetAction={onBudgetAction}
          onPress={
            budgetType === 'envelope' ? onOpenBalanceMenu : onShowActivity
          }
        />
      </View>
    </GridListItem>
  );
}
