import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { SvgExpandArrow } from '@actual-app/components/icons/v0';
import {
  SvgArrowThinLeft,
  SvgArrowThinRight,
  SvgBolt,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type {
  CategoryEntity,
  CategoryGroupEntity,
  NoteEntity,
} from '@actual-app/core/types/models';

import { useBudgetActions } from '#budget';
import type { ApplyBudgetActionPayload } from '#budget';
import { prewarmMonth } from '#components/budget/util';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { MobilePageHeader, Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useLocalPref } from '#hooks/useLocalPref';
import { useNavigate } from '#hooks/useNavigate';
import { useQuery } from '#hooks/useQuery';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

import { describe as describeExpression } from './assignExpression';
import {
  AssignKeypad,
  KEYPAD_Z_INDEX,
  useMoveMoneyModal,
} from './AssignKeypad';
import { AssignKeypadProvider, useAssignKeypad } from './AssignKeypadContext';
import {
  asignarGastadoMesPasado,
  asignarInfrafinanciadas,
  estadoFila,
  faltante,
  marcaDeNota,
  totalInfrafinanciado,
} from './objetivos';
import type { DatosCategoriaMes, EstadoFila } from './objetivos';
import { RowName } from './RowName';
import { useDatosObjetivos } from './useDatosObjetivos';
import { useFichaCategoria } from './useFichaCategoria';

type OnBudgetAction = (month: string, type: string, args?: unknown) => void;

const ALTO_BOTON = 44;

const flechaMes: CSSProperties = {
  minWidth: ALTO_BOTON,
  minHeight: ALTO_BOTON,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 0,
};

/**
 * «Asignar el mes» (solo móvil), calcada de «Assign Money» de YNAB: cuánto
 * hay listo para asignar, cuánto falta en las categorías con objetivo,
 * auto-asignar y la lista de categorías con su barra de progreso. Tocar una
 * fila abre el teclado inline con «Asignar lo que falta».
 */
export function AsignarMesPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dispatch = useDispatch();
  const spreadsheet = useSpreadsheet();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const [searchParams, setSearchParams] = useSearchParams();

  const currMonth = monthUtils.currentMonth();
  const monthParam = searchParams.get('month');
  const month =
    monthParam && monthUtils.isValidYearMonth(monthParam)
      ? monthParam
      : currMonth;

  const [monthBounds, setMonthBounds] = useState({
    start: month,
    end: month,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { start, end } = await send('get-budget-bounds');
      await prewarmMonth(budgetType, spreadsheet, month);
      // El objetivo de cada categoría se recalcula para este mes sin tocar
      // lo asignado: así «infrafinanciado» está al día aunque no se hayan
      // aplicado las plantillas.
      try {
        await send('budget/refresh-goals', { month });
      } catch {
        // Sin plantillas no hay nada que refrescar.
      }
      if (!cancelled) {
        setMonthBounds({ start, end });
        setInitialized(true);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [budgetType, month, spreadsheet]);

  const applyBudgetAction = useBudgetActions();
  const onBudgetAction = useCallback<OnBudgetAction>(
    (month, type, args) => {
      applyBudgetAction.mutate({
        month,
        type,
        args,
      } as ApplyBudgetActionPayload);
    },
    [applyBudgetAction],
  );

  const setMonth = useCallback(
    (newMonth: string) => {
      setSearchParams({ month: newMonth }, { replace: true });
    },
    [setSearchParams],
  );

  const prevEnabled = month > monthBounds.start;
  const nextEnabled = month < monthUtils.subMonths(monthBounds.end, 1);

  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onOpenSummary = useCallback(() => {
    setMenuOpen(false);
    dispatch(
      pushModal({
        modal: {
          name: 'envelope-budget-summary',
          options: {
            month,
            onBudgetAction: async (m, type, args) =>
              onBudgetAction(m, type, args),
          },
        },
      }),
    );
  }, [dispatch, month, onBudgetAction]);

  return (
    <Page
      padding={0}
      header={
        <MobilePageHeader
          title={
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Button
                variant="bare"
                aria-label={t('Previous month')}
                isDisabled={!prevEnabled}
                onPress={() => setMonth(monthUtils.subMonths(month, 1))}
                style={{ ...flechaMes, opacity: prevEnabled ? 1 : 0.5 }}
              >
                <SvgArrowThinLeft width={15} height={15} />
              </Button>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
                data-month={month}
              >
                {monthUtils.format(month, "MMMM ''yy", locale)}
              </Text>
              <Button
                variant="bare"
                aria-label={t('Next month')}
                isDisabled={!nextEnabled}
                onPress={() => setMonth(monthUtils.addMonths(month, 1))}
                style={{ ...flechaMes, opacity: nextEnabled ? 1 : 0.5 }}
              >
                <SvgArrowThinRight width={15} height={15} />
              </Button>
            </View>
          }
          leftContent={<MobileBackButton />}
          rightContent={
            <>
              <Button
                ref={menuRef}
                variant="bare"
                aria-label={t('More')}
                onPress={() => setMenuOpen(true)}
                style={{
                  margin: 10,
                  minWidth: ALTO_BOTON,
                  minHeight: ALTO_BOTON,
                }}
              >
                <SvgDotsHorizontalTriple width={18} height={18} />
              </Button>
              <Popover
                triggerRef={menuRef}
                isOpen={menuOpen}
                placement="bottom end"
                onOpenChange={() => setMenuOpen(false)}
              >
                <Menu
                  getItemStyle={() => ({
                    ...styles.mobileMenuItem,
                    color: theme.menuItemText,
                  })}
                  items={[{ name: 'summary', text: t('Month summary') }]}
                  onMenuSelect={name => {
                    if (name === 'summary') {
                      onOpenSummary();
                    }
                  }}
                />
              </Popover>
            </>
          }
        />
      }
    >
      {initialized ? (
        <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
          <AssignKeypadProvider month={month} onBudgetAction={onBudgetAction}>
            <Contenido month={month} onBudgetAction={onBudgetAction} />
          </AssignKeypadProvider>
        </SheetNameProvider>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 40,
          }}
        >
          <AnimatedLoading width={25} height={25} />
        </View>
      )}
    </Page>
  );
}

type GrupoVisible = CategoryGroupEntity & { categories: CategoryEntity[] };

type ContenidoProps = {
  month: string;
  onBudgetAction: OnBudgetAction;
};

function Contenido({ month, onBudgetAction }: ContenidoProps) {
  const keypad = useAssignKeypad();
  const {
    data: { grouped: categoryGroups } = {
      grouped: [] as CategoryGroupEntity[],
    },
  } = useCategories();

  // Grupos de gasto visibles con sus categorías visibles.
  const grupos = useMemo<GrupoVisible[]>(
    () =>
      categoryGroups
        .filter(g => !g.is_income && !g.hidden)
        .map(g => ({
          ...g,
          categories: (g.categories ?? []).filter(c => !c.hidden),
        }))
        .filter(g => g.categories.length > 0),
    [categoryGroups],
  );
  const categorias = useMemo(() => grupos.flatMap(g => g.categories), [grupos]);

  const datos = useDatosObjetivos(month, categorias);
  const toBudget =
    useSheetValue<'envelope-budget', typeof envelopeBudget.toBudget>(
      envelopeBudget.toBudget,
    ) ?? 0;
  const infrafinanciado = totalInfrafinanciado(datos.values());

  // Notas de las categorías: solo para la marca «#objetivo día N».
  const { data: notas } = useQuery<NoteEntity>(
    () => q('notes').select('*'),
    [],
  );
  const diaPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const nota of notas ?? []) {
      const { dia } = marcaDeNota(nota.note);
      if (dia) {
        mapa.set(nota.id, dia);
      }
    }
    return mapa;
  }, [notas]);

  const [collapsedGroupIds = [], setCollapsedGroupIdsPref] =
    useLocalPref('budget.collapsed');
  const onToggleCollapse = useCallback(
    (id: string) => {
      setCollapsedGroupIdsPref(
        collapsedGroupIds.includes(id)
          ? collapsedGroupIds.filter(c => c !== id)
          : [...collapsedGroupIds, id],
      );
    },
    [collapsedGroupIds, setCollapsedGroupIdsPref],
  );

  const abrirFicha = useFichaCategoria(month);

  const panelHeight = keypad?.panelHeight ?? 0;

  return (
    <View
      style={{
        paddingBottom: Math.max(MOBILE_NAV_HEIGHT, panelHeight + 10),
      }}
      data-testid="asignar-mes"
    >
      <Cabecera toBudget={toBudget} infrafinanciado={infrafinanciado} />
      <AutoAsignar
        month={month}
        grupos={grupos}
        datos={datos}
        toBudget={toBudget}
        onBudgetAction={onBudgetAction}
      />
      {grupos.map(grupo => {
        const plegado = collapsedGroupIds.includes(grupo.id);
        const asignadoGrupo = grupo.categories.reduce(
          (suma, c) => suma + (datos.get(c.id)?.budgeted ?? 0),
          0,
        );
        return (
          <View
            key={grupo.id}
            data-testid="asignar-grupo"
            style={{ flexShrink: 0 }}
          >
            <CabeceraGrupo
              grupo={grupo}
              asignado={asignadoGrupo}
              plegado={plegado}
              onToggle={() => onToggleCollapse(grupo.id)}
            />
            {!plegado &&
              grupo.categories.map(category => (
                <FilaCategoria
                  key={category.id}
                  category={category}
                  datos={datos.get(category.id)}
                  dia={diaPorCategoria.get(category.id) ?? null}
                />
              ))}
          </View>
        );
      })}
      {grupos.length === 0 && (
        <Text
          style={{
            padding: 20,
            textAlign: 'center',
            color: theme.pageTextSubdued,
          }}
        >
          <Trans>No categories to assign.</Trans>
        </Text>
      )}
      <AssignKeypad
        onEditCategory={abrirFicha}
        renderActions={category => (
          <AccionesInfrafinanciado
            category={category}
            datos={datos.get(category.id)}
            onEditCategory={abrirFicha}
          />
        )}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cabecera verde y auto-asignar
// ---------------------------------------------------------------------------

function Cabecera({
  toBudget,
  infrafinanciado,
}: {
  toBudget: IntegerAmount;
  infrafinanciado: IntegerAmount;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const sobreasignado = toBudget < 0;

  return (
    <View
      data-testid="asignar-cabecera"
      style={{
        flexShrink: 0,
        margin: 10,
        marginBottom: 8,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        gap: 2,
        backgroundColor: sobreasignado
          ? theme.errorBackground
          : theme.noticeBackground,
        color: sobreasignado ? theme.errorText : theme.noticeText,
      }}
    >
      <PrivacyFilter>
        <Text
          style={{
            ...styles.veryLargeText,
            ...styles.tnum,
            fontWeight: 700,
            color: 'inherit',
          }}
          data-testid="asignar-listo"
        >
          {format(Math.abs(toBudget), 'financial')}
        </Text>
      </PrivacyFilter>
      <Text style={{ ...styles.mediumText, color: 'inherit' }}>
        {sobreasignado ? t('Overbudgeted') : t('Ready to assign')}
      </Text>
      <PrivacyFilter>
        <Text
          style={{ ...styles.smallText, ...styles.tnum, color: 'inherit' }}
          data-testid="asignar-infrafinanciado"
        >
          {t('{{amount}} in underfunded categories', {
            amount: format(infrafinanciado, 'financial'),
          })}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

type AutoAsignarProps = {
  month: string;
  grupos: GrupoVisible[];
  datos: Map<string, DatosCategoriaMes>;
  toBudget: IntegerAmount;
  onBudgetAction: OnBudgetAction;
};

function AutoAsignar({
  month,
  grupos,
  datos,
  toBudget,
  onBudgetAction,
}: AutoAsignarProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();
  const keypad = useAssignKeypad();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const avisar = useCallback(
    (message: string) => {
      dispatch(
        addNotification({
          notification: { type: 'message', message, timeout: 5000 },
        }),
      );
    },
    [dispatch],
  );

  const onSelect = useCallback(
    async (name: string) => {
      setOpen(false);
      // Lo tecleado en el panel deja de valer: la hoja pone los importes.
      keypad?.cancel();
      switch (name) {
        case 'underfunded': {
          const filas = grupos.flatMap(g =>
            g.categories.map(c => ({
              id: c.id,
              datos: datos.get(c.id) ?? {
                goal: null,
                longGoal: false,
                budgeted: 0,
                balance: 0,
                spent: 0,
              },
            })),
          );
          const amounts = asignarInfrafinanciadas(filas, toBudget);
          if (amounts.length === 0) {
            avisar(
              toBudget <= 0
                ? t('Nothing ready to assign.')
                : t('No underfunded categories.'),
            );
            return;
          }
          const asignadoAntes = new Map(
            filas.map(f => [f.id, f.datos.budgeted]),
          );
          const total = amounts.reduce(
            (suma, a) => suma + a.amount - (asignadoAntes.get(a.category) ?? 0),
            0,
          );
          onBudgetAction(month, 'budget-amounts', { amounts });
          showUndoNotification({
            message: t(
              'Assigned {{amount}} to {{count}} underfunded categories.',
              { amount: format(total, 'financial'), count: amounts.length },
            ),
          });
          return;
        }
        case 'last-month':
          onBudgetAction(month, 'copy-last');
          showUndoNotification({
            message: t("Budget set to last month's assigned amounts."),
          });
          return;
        case '3-avg':
          onBudgetAction(month, 'set-3-avg');
          showUndoNotification({
            message: t('Budget set to the 3 month average.'),
          });
          return;
        case 'spent-last': {
          const anterior = monthUtils.prevMonth(month);
          const valores = await send('envelope-budget-month', {
            month: anterior,
          });
          const gastado = new Map<string, number | null>();
          for (const { name, value } of valores) {
            const i = name.indexOf('!sum-amount-');
            if (i >= 0) {
              gastado.set(
                name.slice(i + '!sum-amount-'.length),
                typeof value === 'number' ? value : null,
              );
            }
          }
          const amounts = asignarGastadoMesPasado(
            grupos.flatMap(g =>
              g.categories.map(c => ({
                id: c.id,
                gastadoMesPasado: gastado.get(c.id) ?? null,
              })),
            ),
          );
          if (amounts.length === 0) {
            avisar(t('Nothing was spent last month.'));
            return;
          }
          onBudgetAction(month, 'budget-amounts', { amounts });
          showUndoNotification({
            message: t("Budget set to last month's spending."),
          });
          return;
        }
        default:
          return;
      }
    },
    [
      avisar,
      datos,
      format,
      grupos,
      keypad,
      month,
      onBudgetAction,
      showUndoNotification,
      t,
      toBudget,
    ],
  );

  return (
    <View
      style={{
        flexShrink: 0,
        marginLeft: 10,
        marginRight: 10,
        marginBottom: 6,
      }}
    >
      <Button
        ref={triggerRef}
        variant="primary"
        onPress={() => setOpen(true)}
        data-testid="auto-asignar"
        style={{
          height: ALTO_BOTON,
          minHeight: ALTO_BOTON,
          borderRadius: ALTO_BOTON / 2,
          fontSize: 15,
          fontWeight: 600,
          gap: 8,
        }}
      >
        <SvgBolt width={14} height={14} />
        <Trans>Auto-assign by…</Trans>
      </Button>
      <Popover
        triggerRef={triggerRef}
        isOpen={open}
        placement="bottom"
        onOpenChange={() => setOpen(false)}
        style={{ minWidth: 260 }}
      >
        <Menu
          getItemStyle={() => ({
            ...styles.mobileMenuItem,
            color: theme.menuItemText,
          })}
          onMenuSelect={name => void onSelect(name)}
          items={[
            { name: 'underfunded', text: t('Underfunded') },
            { name: 'last-month', text: t('Assigned last month') },
            { name: '3-avg', text: t('3 month average') },
            { name: 'spent-last', text: t('Spent last month') },
          ]}
        />
      </Popover>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grupos y filas
// ---------------------------------------------------------------------------

function CabeceraGrupo({
  grupo,
  asignado,
  plegado,
  onToggle,
}: {
  grupo: GrupoVisible;
  asignado: IntegerAmount;
  plegado: boolean;
  onToggle: () => void;
}) {
  const format = useFormat();
  return (
    <View
      data-testid="asignar-grupo-cabecera"
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingLeft: 12,
        paddingRight: 12,
        marginTop: 6,
        backgroundColor: theme.tableHeaderBackground,
        borderBottomWidth: 1,
        borderColor: theme.tableBorder,
      }}
    >
      <RowName
        name={grupo.name}
        width="55vw"
        onPress={onToggle}
        textStyle={{ ...styles.mediumText, fontWeight: 600 }}
        data-testid="asignar-grupo-nombre"
        leading={
          <SvgExpandArrow
            width={8}
            height={8}
            style={{
              flexShrink: 0,
              marginRight: 6,
              color: theme.pageTextSubdued,
              transition: 'transform .1s',
              transform: plegado ? 'rotate(-90deg)' : '',
            }}
          />
        }
      />
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ ...styles.tinyText, color: theme.pageTextSubdued }}>
          <Trans>Assigned</Trans>
        </Text>
        <PrivacyFilter>
          <Text style={{ ...styles.tnum, fontWeight: 600 }}>
            {format(asignado, 'financial')}
          </Text>
        </PrivacyFilter>
      </View>
    </View>
  );
}

function colorDeEstado(estado: EstadoFila): string {
  switch (estado.tipo) {
    case 'sobregastada':
      return theme.errorText;
    case 'faltan':
      return theme.warningText;
    case 'financiada':
      return theme.noticeText;
    case 'gastado-parcial':
      return estado.financiada ? theme.noticeText : theme.pageTextSubdued;
    default:
      return theme.pageTextSubdued;
  }
}

/** Texto de estado de una fila, en castellano vía i18n. */
export function useTextoEstado() {
  const { t } = useTranslation();
  const format = useFormat();
  return useCallback(
    (estado: EstadoFila, dia: number | null): string => {
      switch (estado.tipo) {
        case 'sobregastada':
          return t('Overspent by {{amount}}', {
            amount: format(estado.importe, 'financial'),
          });
        case 'faltan':
          return dia
            ? t('{{amount}} more needed by day {{day}}', {
                amount: format(estado.importe, 'financial'),
                day: dia,
              })
            : t('{{amount}} more needed this month', {
                amount: format(estado.importe, 'financial'),
              });
        case 'financiada':
          return t('Funded');
        case 'gastada':
          return t('Fully spent');
        case 'gastado-parcial':
          return estado.financiada
            ? t('Funded. Spent {{spent}} of {{assigned}}', {
                spent: format(estado.gastado, 'financial'),
                assigned: format(estado.asignado, 'financial'),
              })
            : t('Spent {{spent}} of {{assigned}}', {
                spent: format(estado.gastado, 'financial'),
                assigned: format(estado.asignado, 'financial'),
              });
        default:
          return t('No target');
      }
    },
    [format, t],
  );
}

type FilaCategoriaProps = {
  category: CategoryEntity;
  datos: DatosCategoriaMes | undefined;
  dia: number | null;
};

function FilaCategoria({ category, datos, dia }: FilaCategoriaProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const keypad = useAssignKeypad();
  const textoEstado = useTextoEstado();
  const isSelected = keypad?.selectedCategory?.id === category.id;

  const estado = estadoFila(
    datos ?? { goal: null, longGoal: false, budgeted: 0, balance: 0, spent: 0 },
  );
  const color = colorDeEstado(estado);

  // Mientras se teclea, la celda enseña la expresión («246,72 € +13,00 €»).
  const display =
    isSelected && keypad
      ? describeExpression(keypad.expression, keypad.liveBudgeted)
      : null;
  const asignado = display ? display.primary : (datos?.budgeted ?? 0);

  return (
    <Button
      variant="bare"
      onPress={() => keypad?.select(category)}
      aria-label={t('Assign to {{categoryName}}', {
        categoryName: category.name,
      })}
      data-testid="asignar-fila"
      data-category-id={category.id}
      data-selected={isSelected || undefined}
      style={{
        display: 'flex',
        flexShrink: 0,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 0,
        borderBottom: `1px solid ${theme.tableBorder}`,
        textAlign: 'left',
        backgroundColor: isSelected
          ? theme.tableRowBackgroundHighlight
          : theme.tableBackground,
        ...(isSelected && {
          boxShadow: `inset 4px 0 0 ${theme.pillBorderSelected}`,
        }),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Text
          style={{
            ...styles.lineClamp(2),
            flex: 1,
            fontSize: 15,
            color: theme.pageText,
          }}
          data-testid="asignar-nombre"
        >
          {category.name}
        </Text>
        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <PrivacyFilter>
            <Text
              style={{
                ...styles.tnum,
                fontSize: 15,
                fontWeight: 600,
                color:
                  estado.tipo === 'sobregastada' && !display
                    ? theme.errorText
                    : theme.pageText,
              }}
              data-testid="asignar-asignado"
            >
              {format(asignado, 'financial')}
            </Text>
          </PrivacyFilter>
          {display?.secondary && (
            <PrivacyFilter>
              <Text
                style={{
                  ...styles.tnum,
                  ...styles.smallText,
                  color: theme.pageTextPositive,
                }}
              >
                {display.secondary.op === '-' ? '−' : '+'}
                {format(display.secondary.amount, 'financial')}
              </Text>
            </PrivacyFilter>
          )}
        </View>
      </View>
      <Barra progreso={estado.progreso} color={color} />
      <Text style={{ ...styles.smallText, color }} data-testid="asignar-estado">
        {textoEstado(estado, dia)}
      </Text>
    </Button>
  );
}

function Barra({ progreso, color }: { progreso: number; color: string }) {
  return (
    <View
      aria-hidden
      style={{
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: theme.tableBorder,
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.round(progreso * 100)}%`,
          borderRadius: 3,
          backgroundColor: color,
          transition: 'width .15s',
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Acciones del teclado: «Asignar X € — Importe infrafinanciado» y «… Más»
// ---------------------------------------------------------------------------

type AccionesInfrafinanciadoProps = {
  category: CategoryEntity;
  datos: DatosCategoriaMes | undefined;
  onEditCategory: (id: CategoryEntity['id']) => void;
};

function AccionesInfrafinanciado({
  category,
  datos,
  onEditCategory,
}: AccionesInfrafinanciadoProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const keypad = useAssignKeypad();
  const { showUndoNotification } = useUndo();
  const onMoveMoney = useMoveMoneyModal(category);
  const masRef = useRef<HTMLButtonElement>(null);
  const [masOpen, setMasOpen] = useState(false);

  const falta = datos ? faltante(datos) : 0;
  const month = keypad?.month ?? '';

  const onAsignarFaltante = () => {
    if (!keypad || !datos || falta <= 0) {
      return;
    }
    keypad.reset();
    const amount = datos.budgeted + falta;
    keypad.onBudgetAction(month, 'budget-amount', {
      category: category.id,
      amount,
    });
    showUndoNotification({
      message: t('{{categoryName}} budget has been updated to {{amount}}.', {
        categoryName: category.name,
        amount: format(amount, 'financial'),
      }),
    });
  };

  const onMas = (name: string) => {
    setMasOpen(false);
    switch (name) {
      case 'move':
        onMoveMoney();
        break;
      case 'target':
        void navigate(`/categories/${category.id}/objetivo?month=${month}`);
        break;
      case 'details':
        onEditCategory(category.id);
        break;
      default:
        break;
    }
  };

  const etiqueta: CSSProperties = {
    ...styles.tinyText,
    textAlign: 'center',
    color: theme.pageTextSubdued,
    marginTop: 2,
  };

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Button
          onPress={onAsignarFaltante}
          isDisabled={falta <= 0}
          data-testid="keypad-asignar-faltante"
          style={{
            height: ALTO_BOTON,
            minHeight: ALTO_BOTON,
            borderRadius: ALTO_BOTON / 2,
            fontSize: 15,
            fontWeight: 600,
            color: theme.pageTextPositive,
            ...styles.tnum,
          }}
        >
          {falta > 0
            ? t('Assign {{amount}}', { amount: format(falta, 'financial') })
            : t('Funded')}
        </Button>
        <Text style={etiqueta}>
          <Trans>Underfunded amount</Trans>
        </Text>
      </View>
      <View style={{ width: 84 }}>
        <Button
          ref={masRef}
          onPress={() => setMasOpen(true)}
          aria-label={t('More')}
          data-testid="keypad-mas"
          style={{
            height: ALTO_BOTON,
            minHeight: ALTO_BOTON,
            borderRadius: ALTO_BOTON / 2,
            color: theme.pageTextPositive,
          }}
        >
          <SvgDotsHorizontalTriple width={18} height={18} />
        </Button>
        <Text style={etiqueta}>
          <Trans>More</Trans>
        </Text>
        <Popover
          triggerRef={masRef}
          isOpen={masOpen}
          placement="top end"
          onOpenChange={() => setMasOpen(false)}
          style={{ zIndex: KEYPAD_Z_INDEX + 1 }}
        >
          <Menu
            getItemStyle={() => ({
              ...styles.mobileMenuItem,
              color: theme.menuItemText,
            })}
            onMenuSelect={onMas}
            items={[
              { name: 'move', text: t('Move money') },
              { name: 'target', text: t('Target') },
              { name: 'details', text: t('Details') },
            ]}
          />
        </Popover>
      </View>
    </View>
  );
}
