import { useCallback } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { BudgetType } from '@actual-app/core/server/prefs';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { separarEmoji } from '#components/mobile/ui/emoji';
import {
  color,
  densidad,
  movimiento,
  TACTIL,
} from '#components/mobile/ui/tokens';
import { useCategoriesById } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { useAssignKeypad } from './AssignKeypadContext';
import { BalanceCell } from './BalanceCell';
import { BudgetCell } from './BudgetCell';
import { getColumnWidth } from './BudgetTable';
import { useTapAndHold } from './RowName';
import { SuenoFila } from './SuenoFila';
import { useIgnorarMes } from './useIgnorarMes';

type ExpenseCategoryNameProps = {
  category: CategoryEntity;
  /** Tocar: abre el teclado de asignar (o la ficha si no hay teclado). */
  onPress: () => void;
  /** Mantener pulsado: abre la ficha de la categoría. */
  onHold: () => void;
};

/**
 * Nombre de la categoría con su emoji delante, del mismo tamaño (15 px).
 * Ocupa todo el ancho libre (`flex: 1`); con nombres muy largos pasa a dos
 * líneas y solo entonces corta con elipsis.
 */
function ExpenseCategoryName({
  category,
  onPress,
  onHold,
}: ExpenseCategoryNameProps) {
  const { emoji, resto } = separarEmoji(category.name);
  const pressProps = useTapAndHold({ onTap: onPress, onHold });

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
      <View
        {...pressProps}
        role="button"
        tabIndex={0}
        aria-label={category.name}
        onContextMenu={e => e.preventDefault()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          minWidth: 0,
          // Zona táctil de 44 px sin engordar la fila (contenido de 32 px).
          minHeight: TACTIL,
          margin: `${-(TACTIL - 32) / 2}px 0`,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {emoji && (
          <Text
            aria-hidden
            data-testid="category-emoji"
            style={{
              ...densidad.emoji,
              flexShrink: 0,
            }}
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
    </View>
  );
}

type ExpenseCategoryCellsProps = {
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  show3Columns: boolean;
  showBudgetedColumn: boolean;
  onOpenBalanceMenu: () => void;
  onShowActivity: () => void;
};

function ExpenseCategoryCells({
  category,
  month,
  onBudgetAction,
  onOpenBalanceMenu,
}: ExpenseCategoryCellsProps) {
  const { t } = useTranslation();
  const columnWidth = getColumnWidth();
  const anchoDisponible = getColumnWidth({ disponible: true });
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const spent =
    budgetType === 'tracking'
      ? trackingBudget.catSumAmount(category.id)
      : envelopeBudget.catSumAmount(category.id);

  const balance =
    budgetType === 'tracking'
      ? trackingBudget.catBalance(category.id)
      : envelopeBudget.catBalance(category.id);

  return (
    <View
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
      }}
    >
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
          spentBinding={spent}
        />
      </View>
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
          onPress={onOpenBalanceMenu}
          aria-label={t('Open balance menu for {{categoryName}} category', {
            categoryName: category.name,
          })}
        />
      </View>
    </View>
  );
}

type ExpenseCategoryListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<CategoryEntity>
> & {
  month: string;
  isHidden: boolean;
  style?: CSSProperties;
  show3Columns: boolean;
  showBudgetedColumn: boolean;
  onEditCategory: (id: CategoryEntity['id']) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
};

export function ExpenseCategoryListItem({
  month,
  isHidden,
  onEditCategory,
  onBudgetAction,
  show3Columns,
  showBudgetedColumn,
  ...props
}: ExpenseCategoryListItemProps) {
  const { value: category } = props;

  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const format = useFormat();

  const balanceMenuModalName =
    `${budgetType as BudgetType}-balance-menu` as const;
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();
  const {
    data: { list: categoriesById } = {
      list: {} as Record<string, CategoryEntity>,
    },
  } = useCategoriesById();

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

  const catBalance = useSheetValue<
    'envelope-budget' | 'tracking-budget',
    'leftover'
  >(
    budgetType === 'envelope'
      ? envelopeBudget.catBalance(category?.id)
      : trackingBudget.catBalance(category?.id),
  );

  const onTransfer = useCallback(() => {
    if (!category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: 'transfer',
          options: {
            title: category.name,
            categoryId: category.id,
            month,
            amount: catBalance || 0,
            onSubmit: (amount, toCategoryId) => {
              onBudgetAction(month, 'transfer-category', {
                amount,
                from: category.id,
                to: toCategoryId,
                currencyCode: format.currency.code,
              });
              dispatch(collapseModals({ rootModalName: balanceMenuModalName }));
              showUndoNotification({
                message: t(
                  'Transferred {{amount}} from {{fromCategoryName}} to {{toCategoryName}}.',
                  {
                    amount: format(amount, 'financial'),
                    fromCategoryName: category.name,
                    toCategoryName: categoriesById[toCategoryId].name,
                  },
                ),
              });
            },
            showToBeBudgeted: true,
          },
        },
      }),
    );
  }, [
    category,
    dispatch,
    month,
    catBalance,
    onBudgetAction,
    balanceMenuModalName,
    showUndoNotification,
    categoriesById,
    format,
    t,
  ]);

  const onCover = useCallback(() => {
    if (!category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: 'cover',
          options: {
            title: category.name,
            month,
            amount: catBalance,
            categoryId: category.id,
            onSubmit: (amount, fromCategoryId) => {
              onBudgetAction(month, 'cover-overspending', {
                to: category.id,
                from: fromCategoryId,
                amount,
                currencyCode: format.currency.code,
              });
              dispatch(collapseModals({ rootModalName: balanceMenuModalName }));
              showUndoNotification({
                message: t(
                  `Covered {{amount}} {{toCategoryName}} overspending from {{fromCategoryName}}.`,
                  {
                    amount: format(amount, 'financial'),
                    toCategoryName: category.name,
                    fromCategoryName: categoriesById[fromCategoryId].name,
                  },
                ),
              });
            },
          },
        },
      }),
    );
  }, [
    category,
    dispatch,
    month,
    catBalance,
    onBudgetAction,
    balanceMenuModalName,
    showUndoNotification,
    t,
    categoriesById,
    format,
  ]);

  // «Añadir desde…»: traer dinero de otra categoría (o de «Listo para
  // asignar») a esta, sea cual sea su saldo. Reutiliza el modal `cover` con
  // la acción `transfer-category` (origen → esta categoría).
  const onAddFrom = useCallback(() => {
    if (!category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: 'cover',
          options: {
            // Título corto: «Añadir dinero desde…» se corta a 390 px de ancho.
            title: t('Add from…'),
            amountLabel: t('Add this amount:'),
            month,
            amount: 0,
            categoryId: category.id,
            showToBeBudgeted: true,
            onSubmit: (amount, fromCategoryId) => {
              onBudgetAction(month, 'transfer-category', {
                amount,
                from: fromCategoryId,
                to: category.id,
                currencyCode: format.currency.code,
              });
              dispatch(collapseModals({ rootModalName: balanceMenuModalName }));
              showUndoNotification({
                message: t(
                  'Added {{amount}} to {{toCategoryName}} from {{fromCategoryName}}.',
                  {
                    amount: format(amount, 'financial'),
                    toCategoryName: category.name,
                    fromCategoryName:
                      fromCategoryId === 'to-budget'
                        ? t('To Budget')
                        : categoriesById[fromCategoryId].name,
                  },
                ),
              });
            },
          },
        },
      }),
    );
  }, [
    category,
    dispatch,
    month,
    onBudgetAction,
    balanceMenuModalName,
    showUndoNotification,
    t,
    categoriesById,
    format,
  ]);

  const onOpenBalanceMenu = useCallback(() => {
    if (!category) {
      return;
    }
    if (balanceMenuModalName === 'envelope-balance-menu') {
      dispatch(
        pushModal({
          modal: {
            name: balanceMenuModalName,
            options: {
              month,
              categoryId: category.id,
              onCarryover,
              onTransfer,
              onCover,
              onAddFrom,
            },
          },
        }),
      );
    } else {
      dispatch(
        pushModal({
          modal: {
            name: balanceMenuModalName,
            options: {
              month,
              categoryId: category.id,
              onCarryover,
            },
          },
        }),
      );
    }
  }, [
    category,
    balanceMenuModalName,
    dispatch,
    month,
    onCarryover,
    onTransfer,
    onCover,
    onAddFrom,
  ]);

  const navigate = useNavigate();
  const onShowActivity = useCallback(() => {
    if (!category) {
      return;
    }
    void navigate(`/categories/${category.id}?month=${month}`);
  }, [category, month, navigate]);

  // Fila resaltada mientras el teclado de asignación está abierto para ella.
  const keypad = useAssignKeypad();
  const isSelected = !!category && keypad?.selectedCategory?.id === category.id;
  const { ignorada } = useIgnorarMes(category?.id ?? '', month);

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
          justifyContent: 'center',
          padding: `${densidad.vertical}px ${densidad.margen}px ${densidad.vertical}px ${densidad.margen + densidad.sangria}px`,
          // Línea fina sin sumar alto a la fila.
          boxShadow: `inset 0 1px 0 ${color.line}`,
          opacity: isHidden ? 0.5 : ignorada ? 0.62 : undefined,
          backgroundColor: isSelected ? color.accentSoft : color.surface,
          transition: `background-color ${movimiento.pildora}ms`,
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
          <ExpenseCategoryName
            category={category}
            onPress={() =>
              keypad ? keypad.select(category) : onEditCategory(category.id)
            }
            onHold={() => onEditCategory(category.id)}
          />
          <SuenoFila category={category} month={month} />
          <ExpenseCategoryCells
            key={`${category.id}-${show3Columns}-${showBudgetedColumn}`}
            category={category}
            month={month}
            onBudgetAction={onBudgetAction}
            show3Columns={show3Columns}
            showBudgetedColumn={showBudgetedColumn}
            onOpenBalanceMenu={onOpenBalanceMenu}
            onShowActivity={onShowActivity}
          />
        </View>
      </View>
    </GridListItem>
  );
}
