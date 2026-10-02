import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Card } from '@actual-app/components/card';
import { SvgCheveronRight } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { groupById } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { sync } from '#app/appSlice';
import { useBudgetActions } from '#budget';
import type { ApplyBudgetActionPayload } from '#budget';
import {
  BalanceWithCarryover,
  CarryoverIndicator,
} from '#components/budget/BalanceWithCarryover';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { prewarmMonth } from '#components/budget/util';
import { MobilePageHeader, Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValueText } from '#components/spreadsheet/CellValue';
import { SyncRefresh } from '#components/SyncRefresh';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useNavigate } from '#hooks/useNavigate';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

type OnBudgetAction = (
  month: string,
  type: string,
  args?: unknown,
) => Promise<void>;

/**
 * Pantalla de inicio de «Presupuesto» (solo móvil), al estilo de YNAB:
 * qué hay por hacer este mes (categorías en rojo, dinero listo para
 * asignar), las categorías fijadas con su disponible y el resumen del mes.
 */
export function InicioPage() {
  const locale = useLocale();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const spreadsheet = useSpreadsheet();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const [budgetName] = useMetadataPref('budgetName');

  const month = monthUtils.currentMonth();
  const monthName = monthUtils.format(month, 'MMMM yyyy', locale);
  const sheetName = monthUtils.sheetForMonth(month);

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void prewarmMonth(budgetType, spreadsheet, month).then(() => {
      if (!cancelled) {
        setInitialized(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [budgetType, spreadsheet, month]);

  const applyBudgetAction = useBudgetActions();
  const onBudgetAction = useCallback<OnBudgetAction>(
    async (month, type, args) => {
      applyBudgetAction.mutate({
        month,
        type,
        args,
      } as ApplyBudgetActionPayload);
    },
    [applyBudgetAction],
  );

  return (
    <Page
      header={
        <MobilePageHeader
          title={
            <View>
              <TextOneLine>
                <Trans>Home</Trans>
              </TextOneLine>
              <TextOneLine
                style={{ ...styles.smallText, textTransform: 'capitalize' }}
              >
                {monthName}
              </TextOneLine>
            </View>
          }
        />
      }
      padding={0}
    >
      <SheetNameProvider name={sheetName}>
        <SyncRefresh
          onSync={async () => {
            await dispatch(sync());
          }}
        >
          {() => (
            <View style={{ paddingBottom: 20 }}>
              <Cabecera monthName={monthName} budgetName={budgetName} />
              {initialized && (
                <>
                  {budgetType === 'envelope' && (
                    <PorHacer month={month} onBudgetAction={onBudgetAction} />
                  )}
                  <Fijadas
                    month={month}
                    onOpenCategory={id =>
                      void navigate(`/categories/${id}?month=${month}`)
                    }
                    onEdit={() => void navigate('/budget')}
                  />
                  {budgetType === 'envelope' && (
                    <ResumenDelMes monthName={monthName} />
                  )}
                </>
              )}
            </View>
          )}
        </SyncRefresh>
      </SheetNameProvider>
    </Page>
  );
}

function Cabecera({
  monthName,
  budgetName,
}: {
  monthName: string;
  budgetName?: string;
}) {
  return (
    <View
      style={{
        paddingTop: 16,
        paddingLeft: 15,
        paddingRight: 15,
        gap: 2,
      }}
    >
      <Text
        style={{
          ...styles.veryLargeText,
          fontWeight: 700,
          textTransform: 'capitalize',
          color: theme.pageText,
        }}
      >
        {monthName}
      </Text>
      {budgetName && (
        <Text style={{ ...styles.mediumText, color: theme.pageTextSubdued }}>
          {budgetName}
        </Text>
      )}
    </View>
  );
}

function Tarjeta({
  title,
  action,
  children,
  'data-testid': testId,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <Card
      style={{ marginLeft: 10, marginRight: 10, marginTop: 15 }}
      data-testid={testId}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 15,
          paddingRight: action ? 5 : 15,
          paddingTop: 10,
          paddingBottom: 4,
        }}
      >
        <Text
          style={{
            ...styles.mediumText,
            fontWeight: 600,
            color: theme.pageTextSubdued,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: 13,
          }}
        >
          {title}
        </Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

function Fila({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 50,
        paddingLeft: 15,
        paddingRight: 10,
        borderTop: `1px solid ${theme.tableBorder}`,
        gap: 10,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Por hacer: categorías en rojo + listo para asignar
// ---------------------------------------------------------------------------

function PorHacer({
  month,
  onBudgetAction,
}: {
  month: string;
  onBudgetAction: OnBudgetAction;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();

  const {
    data: { list: categories, grouped: categoryGroups } = {
      list: [],
      grouped: [],
    },
  } = useCategories();
  const categoriesById = useMemo(() => groupById(categories), [categories]);

  const {
    categories: overspentCategories,
    amountsByCategory,
    totalAmount: totalOverspending,
  } = useOverspentCategories({ month });
  const amountsByCategoryRef = useRef(amountsByCategory);
  amountsByCategoryRef.current = amountsByCategory;

  const toBudget = useEnvelopeSheetValue(envelopeBudget.toBudget) ?? 0;

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

  // Mismo flujo que el aviso de sobregasto de la pestaña Presupuesto:
  // elegir la categoría en rojo → modal «Cubrir» → cover-overspending.
  const onOpenCoverCategoryModal = useCallback(
    (categoryId: string | null) => {
      if (!categoryId) {
        return;
      }
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
                void onBudgetAction(month, 'cover-overspending', {
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

  const onCover = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'category-autocomplete',
          options: {
            title: t('Cover overspending'),
            month,
            categoryGroups: categoryGroupsToShow,
            showHiddenCategories: true,
            onSelect: onOpenCoverCategoryModal,
            clearOnSelect: true,
            closeOnSelect: false,
          },
        },
      }),
    );
  }, [categoryGroupsToShow, dispatch, month, onOpenCoverCategoryModal, t]);

  // «Asignar»: la pantalla «Asignar el mes» (calcada de YNAB).
  const navigate = useNavigate();
  const onAssign = useCallback(() => {
    void navigate(`/asignar?month=${month}`);
  }, [month, navigate]);

  // «Corregir» (sobreasignado): el resumen del mes de Actual trae la opción
  // de cubrir lo sobreasignado desde otra categoría.
  const onFixOverbudgeted = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'envelope-budget-summary',
          options: { month, onBudgetAction },
        },
      }),
    );
  }, [dispatch, month, onBudgetAction]);

  const numberOfOverspent = overspentCategories.length;
  const nothingToDo = numberOfOverspent === 0 && toBudget === 0;

  return (
    <Tarjeta title={t('To do')} data-testid="inicio-por-hacer">
      {nothingToDo && (
        <Fila>
          <Text style={{ color: theme.noticeText, fontWeight: 600 }}>
            <Trans>All in order</Trans>
          </Text>
        </Fila>
      )}

      {numberOfOverspent > 0 && (
        <Fila>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.errorText, fontWeight: 600 }}>
              {t('{{count}} category in the red', {
                count: numberOfOverspent,
              })}
            </Text>
            <PrivacyFilter>
              <Text
                style={{
                  ...styles.smallText,
                  ...styles.tnum,
                  color: theme.pageTextSubdued,
                }}
              >
                {format(totalOverspending, 'financial')}
              </Text>
            </PrivacyFilter>
          </View>
          <Button
            variant="primary"
            onPress={onCover}
            style={{ height: 36, paddingLeft: 16, paddingRight: 16 }}
          >
            <Trans>Cover</Trans>
          </Button>
        </Fila>
      )}

      {toBudget > 0 && (
        <Fila>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.toBudgetPositive,
                fontWeight: 600,
                ...styles.tnum,
              }}
            >
              <PrivacyFilter>
                {t('{{amount}} ready to assign', {
                  amount: format(toBudget, 'financial'),
                })}
              </PrivacyFilter>
            </Text>
          </View>
          <Button
            variant="primary"
            onPress={onAssign}
            style={{ height: 36, paddingLeft: 16, paddingRight: 16 }}
          >
            <Trans>Assign</Trans>
          </Button>
        </Fila>
      )}

      {toBudget < 0 && (
        <Fila>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.toBudgetNegative,
                fontWeight: 600,
                ...styles.tnum,
              }}
            >
              <PrivacyFilter>
                {t('Overbudgeted by {{amount}}', {
                  amount: format(-toBudget, 'financial'),
                })}
              </PrivacyFilter>
            </Text>
          </View>
          <Button
            variant="primary"
            onPress={onFixOverbudgeted}
            style={{ height: 36, paddingLeft: 16, paddingRight: 16 }}
          >
            <Trans>Fix</Trans>
          </Button>
        </Fila>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Fijadas
// ---------------------------------------------------------------------------

function Fijadas({
  month: _month,
  onOpenCategory,
  onEdit,
}: {
  month: string;
  onOpenCategory: (id: CategoryEntity['id']) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { pinnedIds } = usePinnedCategories();
  const { data: { list: categories } = { list: [] as CategoryEntity[] } } =
    useCategories();

  const pinnedCategories = useMemo(() => {
    const byId = groupById<CategoryEntity>(categories);
    return pinnedIds
      .map(id => byId[id])
      .filter((c): c is CategoryEntity => Boolean(c));
  }, [categories, pinnedIds]);

  return (
    <Tarjeta
      title={t('Pinned')}
      data-testid="inicio-fijadas"
      action={
        <Button variant="bare" onPress={onEdit} style={{ fontWeight: 600 }}>
          <Trans>Edit</Trans>
        </Button>
      }
    >
      {pinnedCategories.length === 0 ? (
        <Fila>
          <Text style={{ color: theme.pageTextSubdued, ...styles.smallText }}>
            {t(
              'No pinned categories yet. Open a category menu in the Budget tab and choose "Pin to home".',
            )}
          </Text>
        </Fila>
      ) : (
        pinnedCategories.map(category => (
          <Button
            key={category.id}
            variant="bare"
            onPress={() => onOpenCategory(category.id)}
            style={{
              display: 'flex',
              width: '100%',
              padding: 0,
              borderRadius: 0,
              textAlign: 'left',
              justifyContent: 'stretch',
            }}
            aria-label={t('Open {{categoryName}} category', {
              categoryName: category.name,
            })}
          >
            <Fila style={{ flex: 1, paddingRight: 5 }}>
              <TextOneLine style={{ flex: 1, color: theme.pageText }}>
                {category.name}
              </TextOneLine>
              <SaldoDisponible category={category} />
              <SvgCheveronRight
                width={14}
                height={14}
                style={{ color: theme.pageTextSubdued, flexShrink: 0 }}
              />
            </Fila>
          </Button>
        ))
      )}
    </Tarjeta>
  );
}

function SaldoDisponible({ category }: { category: CategoryEntity }) {
  return (
    <BalanceWithCarryover
      isDisabled
      carryover={envelopeBudget.catCarryover(category.id)}
      balance={envelopeBudget.catBalance(category.id)}
      goal={envelopeBudget.catGoal(category.id)}
      budgeted={envelopeBudget.catBudgeted(category.id)}
      longGoal={envelopeBudget.catLongGoal(category.id)}
      CarryoverIndicator={({ style }) => (
        <CarryoverIndicator
          style={{
            width: 13,
            height: 13,
            display: 'inline-flex',
            position: 'relative',
            ...style,
          }}
        />
      )}
    >
      {props => (
        <CellValueText
          {...props}
          style={{
            ...styles.tnum,
            fontWeight: 600,
            textAlign: 'right',
          }}
        />
      )}
    </BalanceWithCarryover>
  );
}

// ---------------------------------------------------------------------------
// Resumen del mes
// ---------------------------------------------------------------------------

function ResumenDelMes({ monthName }: { monthName: string }) {
  const { t } = useTranslation();
  const format = useFormat();

  const totalBudgeted =
    useEnvelopeSheetValue(envelopeBudget.totalBudgeted) ?? 0;
  const totalSpent = useEnvelopeSheetValue(envelopeBudget.totalSpent) ?? 0;
  const totalIncome = useEnvelopeSheetValue(envelopeBudget.totalIncome) ?? 0;

  const rows: { label: string; value: number; testId: string }[] = [
    // La hoja guarda lo presupuestado en gastos con signo negativo; se
    // muestra en positivo, igual que la cabecera de la pestaña Presupuesto.
    { label: t('Assigned'), value: -totalBudgeted, testId: 'resumen-asignado' },
    { label: t('Spent'), value: totalSpent, testId: 'resumen-gastado' },
    { label: t('Income'), value: totalIncome, testId: 'resumen-ingresos' },
  ];

  return (
    <Tarjeta
      title={t('Summary of {{month}}', { month: monthName })}
      data-testid="inicio-resumen"
    >
      {rows.map(row => (
        <Fila key={row.testId} style={{ minHeight: 44, paddingRight: 15 }}>
          <Text style={{ color: theme.pageText }}>{row.label}</Text>
          <PrivacyFilter>
            <Text
              data-testid={row.testId}
              style={{
                ...styles.tnum,
                fontWeight: 600,
                color: theme.pageText,
              }}
            >
              {format(row.value, 'financial')}
            </Text>
          </PrivacyFilter>
        </Fila>
      ))}
    </Tarjeta>
  );
}
