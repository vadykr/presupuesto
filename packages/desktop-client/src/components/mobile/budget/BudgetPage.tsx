// @ts-strict-ignore
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgArrowButtonDown1 } from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { groupById } from '@actual-app/core/shared/util';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { sync } from '#app/appSlice';
import {
  useBudgetActions,
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
  useDeleteCategoryGroupMutation,
  useSaveCategoryGroupMutation,
  useSortCategoriesMutation,
} from '#budget';
import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import { prewarmMonth } from '#components/budget/util';
import { FinancialText } from '#components/FinancialText';
import { BotonRedondo } from '#components/mobile/ui/Cabecera';
import { Cargando } from '#components/mobile/ui/Cargando';
import { SelectorMes } from '#components/mobile/ui/SelectorMes';
import { color, espacio, radio } from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
import { SyncRefresh } from '#components/SyncRefresh';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useLocalPref } from '#hooks/useLocalPref';
import { useNavigate } from '#hooks/useNavigate';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useTransactions } from '#hooks/useTransactions';
import { useUndo } from '#hooks/useUndo';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { uncategorizedTransactions } from '#queries';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

import { BudgetTable } from './BudgetTable';
import { useRefrescarObjetivos } from './useDatosObjetivos';
import { useFichaCategoria } from './useFichaCategoria';

function isBudgetType(input?: string): input is 'envelope' | 'tracking' {
  return ['envelope', 'tracking'].includes(input);
}

export function BudgetPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const {
    data: { grouped: categoryGroups } = {
      list: [],
      grouped: [],
    },
  } = useCategories();
  const [budgetTypePref] = useSyncedPref('budgetType');
  const budgetType = isBudgetType(budgetTypePref) ? budgetTypePref : 'envelope';
  const spreadsheet = useSpreadsheet();

  const currMonth = monthUtils.currentMonth();
  const [startMonth = currMonth, setStartMonthPref] =
    useLocalPref('budget.startMonth');
  // Objetivo del mes al día (lo guardado puede ser viejo; ver el hook).
  useRefrescarObjetivos(startMonth);
  const [monthBounds, setMonthBounds] = useState({
    start: startMonth,
    end: startMonth,
  });
  // const [editMode, setEditMode] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [_numberFormat] = useSyncedPref('numberFormat');
  const numberFormat = _numberFormat || 'comma-dot';
  const [hideFraction] = useSyncedPref('hideFraction');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const applyBudgetAction = useBudgetActions();
  const createCategory = useCreateCategoryMutation();
  const createCategoryGroup = useCreateCategoryGroupMutation();
  const saveCategoryGroup = useSaveCategoryGroupMutation();
  const deleteCategoryGroup = useDeleteCategoryGroupMutation();
  const sortCategories = useSortCategoriesMutation();

  useEffect(() => {
    async function init() {
      const { start, end } = await send('get-budget-bounds');
      setMonthBounds({ start, end });

      await prewarmMonth(budgetType, spreadsheet, startMonth);

      setInitialized(true);
    }

    void init();
  }, [budgetType, startMonth, dispatch, spreadsheet]);

  const onBudgetAction = useCallback(
    async (month, type, args) => {
      applyBudgetAction.mutate({ month, type, args });
    },
    [applyBudgetAction],
  );

  const onShowBudgetSummary = useCallback(() => {
    if (budgetType === 'tracking') {
      dispatch(
        pushModal({
          modal: {
            name: 'tracking-budget-summary',
            options: {
              month: startMonth,
            },
          },
        }),
      );
    } else {
      // «Listo para asignar» abre la pantalla «Asignar el mes» (el resumen
      // del mes sigue disponible desde su menú «⋯»).
      void navigate(`/asignar?month=${startMonth}`);
    }
  }, [budgetType, dispatch, navigate, startMonth]);

  const onOpenNewCategoryGroupModal = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'new-category-group',
          options: {
            onValidate: name => (!name ? 'Name is required.' : null),
            onSubmit: async name => {
              createCategoryGroup.mutate(
                { name },
                {
                  onSettled: () => {
                    dispatch(
                      collapseModals({ rootModalName: 'budget-page-menu' }),
                    );
                  },
                },
              );
            },
          },
        },
      }),
    );
  }, [dispatch, createCategoryGroup]);

  const onOpenNewCategoryModal = useCallback(
    (groupId, isIncome) => {
      dispatch(
        pushModal({
          modal: {
            name: 'new-category',
            options: {
              onValidate: name => (!name ? 'Name is required.' : null),
              onSubmit: async name => {
                createCategory.mutate(
                  {
                    name,
                    groupId,
                    isIncome,
                    isHidden: false,
                  },
                  {
                    onSettled: () => {
                      dispatch(
                        collapseModals({
                          rootModalName: 'category-group-menu',
                        }),
                      );
                    },
                  },
                );
              },
            },
          },
        }),
      );
    },
    [dispatch, createCategory],
  );

  const onSaveGroup = useCallback(
    group => {
      saveCategoryGroup.mutate({ group });
    },
    [saveCategoryGroup],
  );

  const onApplyBudgetTemplatesInGroup = useCallback(
    async categories => {
      applyBudgetAction.mutate({
        month: startMonth,
        type: 'apply-multiple-templates',
        args: {
          categories,
        },
      });
    },
    [applyBudgetAction, startMonth],
  );

  const onDeleteGroup = useCallback(
    groupId => {
      dispatch(collapseModals({ rootModalName: 'category-group-menu' }));
      deleteCategoryGroup.mutate({ id: groupId });
    },
    [deleteCategoryGroup, dispatch],
  );

  const onToggleGroupVisibility = useCallback(
    groupId => {
      const group = categoryGroups.find(g => g.id === groupId);
      onSaveGroup({
        ...group,
        hidden: group.hidden ? false : true,
      });
      dispatch(collapseModals({ rootModalName: 'category-group-menu' }));
    },
    [categoryGroups, dispatch, onSaveGroup],
  );

  const onChangeMonth = useCallback(
    async (month: string) => {
      await prewarmMonth(budgetType, spreadsheet, month);
      setStartMonthPref(month);
      setInitialized(true);
    },
    [budgetType, setStartMonthPref, spreadsheet],
  );

  // const onOpenMonthActionMenu = () => {
  //   const options = [
  //     'Copy last month's budget',
  //     'Set budgets to zero',
  //     'Set budgets to 3 month average',
  //     budgetType === 'tracking' && 'Apply to all future budgets',
  //   ].filter(Boolean);

  //   props.showActionSheetWithOptions(
  //     {
  //       options,
  //       cancelButtonIndex: options.length - 1,
  //       title: 'Actions',
  //     },
  //     idx => {
  //       switch (idx) {
  //         case 0:
  //           setEditMode(true);
  //           break;
  //         case 1:
  //           onBudgetAction('copy-last');
  //           break;
  //         case 2:
  //           onBudgetAction('set-zero');
  //           break;
  //         case 3:
  //           onBudgetAction('set-3-avg');
  //           break;
  //         case 4:
  //           if (budgetType === 'tracking') {
  //             onBudgetAction('set-all-future');
  //           }
  //           break;
  //         default:
  //       }
  //     },
  //   );
  // };

  const onSaveNotes = useCallback(async (id, notes) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onOpenCategoryGroupNotesModal = useCallback(
    id => {
      const group = categoryGroups.find(g => g.id === id);
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id,
              name: group.name,
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [categoryGroups, dispatch, onSaveNotes],
  );

  const onOpenCategoryGroupMenuModal = useCallback(
    id => {
      const group = categoryGroups.find(g => g.id === id);
      dispatch(
        pushModal({
          modal: {
            name: 'category-group-menu',
            options: {
              groupId: group.id,
              onSave: onSaveGroup,
              onAddCategory: onOpenNewCategoryModal,
              onEditNotes: onOpenCategoryGroupNotesModal,
              onDelete: onDeleteGroup,
              onToggleVisibility: onToggleGroupVisibility,
              onApplyBudgetTemplatesInGroup,
              onSortCategories: (groupId, direction) => {
                sortCategories.mutate({ groupId, direction });
              },
            },
          },
        }),
      );
    },
    [
      categoryGroups,
      dispatch,
      onDeleteGroup,
      onOpenCategoryGroupNotesModal,
      onOpenNewCategoryModal,
      onSaveGroup,
      onToggleGroupVisibility,
      onApplyBudgetTemplatesInGroup,
      sortCategories,
    ],
  );

  // Mantener pulsado el nombre o «Detalles» del teclado: la ficha única.
  const onOpenCategoryMenuModal = useFichaCategoria(startMonth);

  const [showHiddenCategories, setShowHiddenCategoriesPref] = useLocalPref(
    'budget.showHiddenCategories',
  );

  const onToggleHiddenCategories = useCallback(() => {
    setShowHiddenCategoriesPref(!showHiddenCategories);
    dispatch(collapseModals({ rootModalName: 'budget-page-menu' }));
  }, [dispatch, setShowHiddenCategoriesPref, showHiddenCategories]);

  const onOpenBudgetMonthNotesModal = useCallback(
    month => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id: `budget-${month}`,
              name: monthUtils.format(month, "MMMM ''yy", locale),
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [dispatch, onSaveNotes, locale],
  );

  const onSwitchBudgetFile = useCallback(() => {
    void dispatch(closeBudget());
  }, [dispatch]);

  const onOpenBudgetMonthMenu = useCallback(
    month => {
      dispatch(
        pushModal({
          modal: {
            name: `${budgetType}-budget-month-menu`,
            options: {
              month,
              onBudgetAction,
              onEditNotes: onOpenBudgetMonthNotesModal,
            },
          },
        }),
      );
    },
    [budgetType, dispatch, onBudgetAction, onOpenBudgetMonthNotesModal],
  );

  const onOpenBudgetPageMenu = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'budget-page-menu',
          options: {
            onAddCategoryGroup: onOpenNewCategoryGroupModal,
            onToggleHiddenCategories,
            onSwitchBudgetFile,
          },
        },
      }),
    );
  }, [
    dispatch,
    onOpenNewCategoryGroupModal,
    onSwitchBudgetFile,
    onToggleHiddenCategories,
  ]);

  if (!categoryGroups || !initialized) {
    return <Cargando pantalla />;
  }

  return (
    <Page
      padding={0}
      header={
        <View
          data-testid="navegador-mes"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.fila,
            padding: `6px ${espacio.margen}px`,
            minHeight: 56,
          }}
        >
          <BotonRedondo
            icono="more"
            aria-label={t('Budget page menu')}
            onPress={onOpenBudgetPageMenu}
          />
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <SelectorMes
              variante="titulo"
              brujula
              mes={startMonth}
              minimo={monthBounds.start}
              maximo={monthUtils.subMonths(monthBounds.end, 1)}
              onChange={m => void onChangeMonth(m)}
              accion={{
                texto: t('Month options…'),
                onPress: () => onOpenBudgetMonthMenu(startMonth),
              }}
            />
          </View>
          <BotonRedondo
            icono="cal"
            aria-label={t('Annual')}
            onPress={() => void navigate('/anual')}
          />
        </View>
      }
    >
      <SheetNameProvider name={monthUtils.sheetForMonth(startMonth)}>
        <SyncRefresh
          onSync={async () => {
            void dispatch(sync());
          }}
        >
          {({ onRefresh }) => (
            <BudgetTable
              banners={
                <Banners month={startMonth} onBudgetAction={onBudgetAction} />
              }
              // This key forces the whole table rerender when the number
              // format changes
              key={`${numberFormat}${hideFraction}`}
              categoryGroups={categoryGroups}
              month={startMonth}
              onShowBudgetSummary={onShowBudgetSummary}
              onBudgetAction={onBudgetAction}
              onRefresh={onRefresh}
              onEditCategoryGroup={onOpenCategoryGroupMenuModal}
              onEditCategory={onOpenCategoryMenuModal}
            />
          )}
        </SyncRefresh>
      </SheetNameProvider>
    </Page>
  );
}

function Banners({ month, onBudgetAction }) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  return (
    <GridList aria-label={t('Banners')} style={{ backgroundColor: color.bg }}>
      <UncategorizedTransactionsBanner />
      <OverspendingBanner
        month={month}
        onBudgetAction={onBudgetAction}
        budgetType={budgetType}
      />
      {budgetType === 'envelope' && (
        <OverbudgetedBanner month={month} onBudgetAction={onBudgetAction} />
      )}
    </GridList>
  );
}

function Banner({ type = 'info', children }) {
  const fondo =
    type === 'critical'
      ? color.badSoft
      : type === 'warning'
        ? color.warnSoft
        : color.okSoft;
  const tinta =
    type === 'critical'
      ? color.bad
      : type === 'warning'
        ? color.warn
        : color.ok;
  return (
    <View
      data-testid="banner"
      style={{
        minHeight: 48,
        margin: 0,
        padding: '6px 6px 6px 14px',
        borderRadius: radio.boton,
        justifyContent: 'center',
        backgroundColor: fondo,
        color: tinta,
        fontWeight: 600,
        fontSize: 13,
        '& button': {
          minHeight: 36,
          borderRadius: radio.sm,
          padding: '0 12px',
          fontWeight: 700,
          fontSize: 13,
          backgroundColor: tinta,
          color: color.bg,
        },
      }}
    >
      {children}
    </View>
  );
}

function UncategorizedTransactionsBanner(props) {
  const navigate = useNavigate();
  const format = useFormat();

  const transactionsQuery = useMemo(
    () => uncategorizedTransactions().select('*'),
    [],
  );

  const { transactions, isPending: isTransactionsLoading } = useTransactions({
    query: transactionsQuery,
    options: {
      pageSize: 1000,
    },
  });

  if (isTransactionsLoading || transactions.length === 0) {
    return null;
  }

  const totalUncategorizedAmount = transactions.reduce(
    (sum, t) => sum + (t.amount ?? 0),
    0,
  );

  return (
    <GridListItem textValue="Uncategorized transactions banner" {...props}>
      <Banner type="warning">
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text>
            <Trans count={transactions.length}>
              You have {{ count: transactions.length }} uncategorized
              transactions (
              <FinancialText>
                {
                  {
                    amount: format(totalUncategorizedAmount, 'financial'),
                  } as TransObjectLiteral
                }
              </FinancialText>
              )
            </Trans>
          </Text>
          <Button onPress={() => navigate('/categories/uncategorized')}>
            <Text>
              <Trans>Categorize</Trans>
            </Text>
          </Button>
        </View>
      </Banner>
    </GridListItem>
  );
}

function OverbudgetedBanner({ month, onBudgetAction, ...props }) {
  const { t } = useTranslation();
  const format = useFormat();
  const toBudgetAmount = useSheetValue<
    'envelope-budget',
    typeof envelopeBudget.toBudget
  >(envelopeBudget.toBudget);
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();
  const { data: { list: categories } = { list: [] } } = useCategories();
  const categoriesById = useMemo(() => groupById(categories), [categories]);

  const openCoverOverbudgetedModal = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'cover',
          options: {
            title: t('Cover overbudgeted'),
            month,
            amount: toBudgetAmount,
            showToBeBudgeted: false,
            onSubmit: (amount, categoryId) => {
              onBudgetAction(month, 'cover-overbudgeted', {
                category: categoryId,
                amount,
                currencyCode: format.currency.code,
              });
              showUndoNotification({
                message: t('Covered overbudgeted from {{categoryName}}', {
                  categoryName: categoriesById[categoryId].name,
                }),
              });
            },
          },
        },
      }),
    );
  }, [
    categoriesById,
    dispatch,
    month,
    onBudgetAction,
    showUndoNotification,
    t,
    toBudgetAmount,
    format.currency.code,
  ]);

  if (!toBudgetAmount || toBudgetAmount >= 0) {
    return null;
  }

  return (
    <GridListItem textValue="Overbudgeted banner" {...props}>
      <Banner type="critical">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <SvgArrowButtonDown1 style={{ width: 15, height: 15 }} />
              <Text>
                <Trans>You have budgeted more than your available funds</Trans>
              </Text>
            </View>
          </View>
          <Button onPress={openCoverOverbudgetedModal}>
            <Trans>Cover</Trans>
          </Button>
        </View>
      </Banner>
    </GridListItem>
  );
}

function OverspendingBanner({ month, onBudgetAction, budgetType, ...props }) {
  const { t } = useTranslation();

  const {
    data: { list: categories, grouped: categoryGroups } = {
      list: [],
      grouped: [],
    },
  } = useCategories();
  const categoriesById = useMemo(() => groupById(categories), [categories]);

  const dispatch = useDispatch();
  const format = useFormat();

  const {
    categories: overspentCategories,
    amountsByCategory,
    totalAmount: totalOverspending,
  } = useOverspentCategories({ month });

  const amountsByCategoryRef = useRef(amountsByCategory);
  amountsByCategoryRef.current = amountsByCategory;

  const categoryGroupsToShow = useMemo(
    () =>
      categoryGroups
        .filter(g => overspentCategories.some(c => c.group === g.id))
        .map(g => ({
          ...g,
          categories: overspentCategories.filter(c => c.group === g.id),
        })),
    [categoryGroups, overspentCategories],
  );

  const { showUndoNotification } = useUndo();

  const onOpenCoverCategoryModal = useCallback(
    categoryId => {
      const category = categoriesById[categoryId];
      dispatch(
        pushModal({
          modal: {
            name: 'cover',
            options: {
              title: category.name,
              month,
              amount: amountsByCategoryRef.current.get(category.id),
              categoryId: category.id,
              onSubmit: (amount, fromCategoryId) => {
                onBudgetAction(month, 'cover-overspending', {
                  to: category.id,
                  from: fromCategoryId,
                  amount,
                  currencyCode: format.currency.code,
                });
                showUndoNotification({
                  message: t(
                    `Covered {{toCategoryName}} overspending from {{fromCategoryName}}.`,
                    {
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
    },
    [
      categoriesById,
      dispatch,
      month,
      onBudgetAction,
      showUndoNotification,
      t,
      format.currency.code,
    ],
  );

  const onOpenCategorySelectionModal = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'category-autocomplete',
          options: {
            title:
              budgetType === 'envelope'
                ? t('Cover overspending')
                : t('Overspent categories'),
            month,
            categoryGroups: categoryGroupsToShow,
            showHiddenCategories: true,
            onSelect:
              budgetType === 'envelope' ? onOpenCoverCategoryModal : null,
            clearOnSelect: true,
            closeOnSelect: false,
          },
        },
      }),
    );
  }, [
    categoryGroupsToShow,
    dispatch,
    month,
    onOpenCoverCategoryModal,
    t,
    budgetType,
  ]);

  const numberOfOverspentCategories = overspentCategories.length;
  if (numberOfOverspentCategories === 0) {
    return null;
  }

  return (
    <GridListItem textValue="Overspent banner" {...props}>
      <Banner type="critical">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text>
            <Trans count={numberOfOverspentCategories}>
              You have {{ count: numberOfOverspentCategories }} overspent
              categories (
              <FinancialText>
                {
                  {
                    amount: format(totalOverspending, 'financial'),
                  } as TransObjectLiteral
                }
              </FinancialText>
              )
            </Trans>
          </Text>
          <Button onPress={onOpenCategorySelectionModal}>
            {budgetType === 'envelope' && <Trans>Cover</Trans>}
            {budgetType === 'tracking' && <Trans>View</Trans>}
          </Button>
        </View>
      </Banner>
    </GridListItem>
  );
}
