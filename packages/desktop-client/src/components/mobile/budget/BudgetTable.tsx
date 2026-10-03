import React, { useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { esPlegable } from '#components/mobile/anual/anual';
import type { FilaAnual } from '#components/mobile/anual/anual';
import { AnualPlegado } from '#components/mobile/anual/AnualPlegado';
import { useAnual, useOcultarEnPlan } from '#components/mobile/anual/useAnual';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { PullToRefresh } from '#components/mobile/PullToRefresh';
import { Icono } from '#components/mobile/ui/Icono';
import {
  color,
  densidad,
  espacio,
  movimiento,
  num,
  radio,
  texto,
} from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { SchedulesProvider } from '#hooks/useCachedSchedules';
import { useFormat } from '#hooks/useFormat';
import { useLocalPref } from '#hooks/useLocalPref';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { AssignKeypad } from './AssignKeypad';
import { AssignKeypadProvider, useAssignKeypad } from './AssignKeypadContext';
import { ExpenseGroupList } from './ExpenseGroupList';
import { IncomeGroup } from './IncomeGroup';

export const ROW_HEIGHT = 50;

export const PILL_STYLE: CSSProperties = {
  borderRadius: 16,
  color: theme.pillText,
  backgroundColor: theme.pillBackgroundLight,
};

/** Ancho de la columna Asignado (densidad, medida contra YNAB). */
export const ANCHO_COLUMNA = densidad.colAsignado;
/** Ancho de la columna Disponible (cabe la píldora con 4 cifras). */
export const ANCHO_DISPONIBLE = densidad.colDisponible;
/** Relleno lateral de la fila + sangría + hueco entre nombre y cifras. */
const RESTO_FILA = 2 * densidad.margen + densidad.sangria + 8;

export function getColumnWidth({
  show3Columns = false,
  isSidebar = false,
  offset = 0,
  disponible = false,
}: {
  show3Columns?: boolean;
  isSidebar?: boolean;
  offset?: number;
  /** Columna Disponible (96 px) en lugar de Asignado (92 px). */
  disponible?: boolean;
} = {}) {
  // Presupuesto (concepto A): dos columnas de ancho fijo, Asignado y
  // Disponible; el gasto del mes va en pequeño bajo lo asignado. El nombre
  // ocupa el resto (`flex: 1`). Se conserva la firma de Actual por si alguna
  // vista ancha la sigue usando con 3.
  if (show3Columns) {
    return isSidebar ? `${35 + offset}vw` : `${20 + offset}vw`;
  }
  if (!isSidebar) {
    return `${disponible ? ANCHO_DISPONIBLE : ANCHO_COLUMNA}px`;
  }
  return `calc(100vw - ${RESTO_FILA + ANCHO_COLUMNA + ANCHO_DISPONIBLE}px)`;
}

type PildoraListoProps = {
  tono: 'ok' | 'rojo' | 'neutro';
  onPress: () => void;
  children: ReactNode;
  'data-testid'?: string;
};

/** Píldora ancha y rellena de «Listo para asignar» (concepto A, pantalla Plan). */
function PildoraListo({
  tono,
  onPress,
  children,
  'data-testid': testId,
}: PildoraListoProps) {
  const fondo =
    tono === 'ok' ? color.accent : tono === 'rojo' ? color.bad : color.surface2;
  const tinta =
    tono === 'ok' ? color.accentInk : tono === 'rojo' ? '#fff' : color.fg;
  return (
    <Button
      variant="bare"
      onPress={onPress}
      data-testid={testId}
      style={({ isPressed }) => ({
        height: 44,
        minHeight: 44,
        width: '100%',
        borderRadius: radio.pildora,
        padding: '0 7px 0 16px',
        justifyContent: 'space-between',
        gap: 8,
        backgroundColor: fondo,
        color: tinta,
        fontWeight: 700,
        fontSize: 16,
        transform: isPressed ? 'scale(0.98)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
      })}
    >
      <Text
        data-testid="to-budget-texto"
        style={{
          ...num,
          textAlign: 'left',
          minWidth: 0,
          fontSize: 16,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {children}
      </Text>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.14)',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icono nombre="cr" size={16} />
      </View>
    </Button>
  );
}

type ToBudgetProps = {
  toBudget: Binding<'envelope-budget', 'to-budget'>;
  onPress: () => void;
  show3Columns: boolean;
};

function ToBudget({ toBudget, onPress }: ToBudgetProps) {
  const { t } = useTranslation();
  const amount = useSheetValue(toBudget) ?? 0;
  const format = useFormat();
  const importe = format(Math.abs(amount), 'financial');

  return (
    <PildoraListo
      tono={amount > 0 ? 'ok' : amount < 0 ? 'rojo' : 'neutro'}
      onPress={onPress}
      data-testid="to-budget"
    >
      <PrivacyFilter>
        {amount < 0
          ? t('{{amount}} assigned too much', { amount: importe })
          : amount > 0
            ? t('{{amount}} ready to assign', { amount: importe })
            : t('All money assigned')}
      </PrivacyFilter>
    </PildoraListo>
  );
}

type SavedProps = {
  projected: boolean;
  onPress: () => void;
  show3Columns: boolean;
};

function Saved({ projected, onPress }: SavedProps) {
  const { t } = useTranslation();
  const binding = projected
    ? trackingBudget.totalBudgetedSaved
    : trackingBudget.totalSaved;

  const saved = useSheetValue<'tracking-budget', typeof binding>(binding) || 0;
  const format = useFormat();
  const isNegative = saved < 0;
  const etiqueta = projected
    ? t('Projected savings')
    : isNegative
      ? t('Overspent')
      : t('Saved');

  return (
    <PildoraListo tono={isNegative ? 'rojo' : 'neutro'} onPress={onPress}>
      <PrivacyFilter>
        {etiqueta}: {format(saved, 'financial')}
      </PrivacyFilter>
    </PildoraListo>
  );
}

type BudgetGroupsProps = {
  type: string;
  categoryGroups: CategoryGroupEntity[];
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: CategoryEntity['id']) => void;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  showBudgetedColumn: boolean;
  show3Columns: boolean;
  showHiddenCategories: boolean;
  /** Categorías anuales «al día» que el Plan pliega en un bloque resumen. */
  anualPlegadas: readonly FilaAnual[];
};

function BudgetGroups({
  categoryGroups,
  onEditCategoryGroup,
  onEditCategory,
  month,
  onBudgetAction,
  showBudgetedColumn,
  show3Columns,
  showHiddenCategories,
  anualPlegadas,
}: BudgetGroupsProps) {
  const { incomeGroup, expenseGroups } = useMemo(() => {
    const plegadas = new Set(anualPlegadas.map(f => f.id));
    const categoryGroupsToDisplay = categoryGroups
      .filter(group => !group.hidden || showHiddenCategories)
      .flatMap(group => {
        // Se filtran por id las categorías plegadas; un grupo que se queda
        // sin categorías por eso desaparece (están en el bloque resumen).
        if (!group.categories?.some(c => plegadas.has(c.id))) {
          return [group];
        }
        const categories = group.categories.filter(c => !plegadas.has(c.id));
        return categories.length > 0 ? [{ ...group, categories }] : [];
      });
    return {
      incomeGroup: categoryGroupsToDisplay.find(group => group.is_income),
      expenseGroups: categoryGroupsToDisplay.filter(group => !group.is_income),
    };
  }, [categoryGroups, showHiddenCategories, anualPlegadas]);

  const [collapsedGroupIds = [], setCollapsedGroupIdsPref] =
    useLocalPref('budget.collapsed');

  const onToggleCollapse = useCallback(
    (id: CategoryGroupEntity['id']) => {
      setCollapsedGroupIdsPref(
        collapsedGroupIds.includes(id)
          ? collapsedGroupIds.filter(collapsedId => collapsedId !== id)
          : [...collapsedGroupIds, id],
      );
    },
    [collapsedGroupIds, setCollapsedGroupIdsPref],
  );

  const isCollapsed = useCallback(
    (id: CategoryGroupEntity['id']) => {
      return collapsedGroupIds.includes(id);
    },
    [collapsedGroupIds],
  );

  return (
    <View
      data-testid="budget-groups"
      style={{ flex: '1 0 auto', overflowY: 'auto', paddingBottom: 15 }}
    >
      <ExpenseGroupList
        categoryGroups={expenseGroups}
        showBudgetedColumn={showBudgetedColumn}
        month={month}
        onEditCategoryGroup={onEditCategoryGroup}
        onEditCategory={onEditCategory}
        onBudgetAction={onBudgetAction}
        show3Columns={show3Columns}
        showHiddenCategories={showHiddenCategories}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />

      {incomeGroup && (
        <IncomeGroup
          categoryGroup={incomeGroup}
          month={month}
          showHiddenCategories={showHiddenCategories}
          onEditCategoryGroup={onEditCategoryGroup}
          onEditCategory={onEditCategory}
          onBudgetAction={onBudgetAction}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      )}

      <AnualPlegado filas={anualPlegadas} />
    </View>
  );
}

type BudgetTableProps = {
  categoryGroups: CategoryGroupEntity[];
  month: string;
  onShowBudgetSummary: () => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  onRefresh: () => Promise<void>;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: CategoryEntity['id']) => void;
};

export function BudgetTable({
  categoryGroups,
  month,
  onShowBudgetSummary,
  onBudgetAction,
  onRefresh,
  onEditCategoryGroup,
  onEditCategory,
}: BudgetTableProps) {
  // Dos columnas (Asignado · Disponible) como YNAB; el gasto del mes va en
  // pequeño y en rojo bajo lo asignado (NOTAS.md, «Pestaña Presupuesto»).
  const show3Columns = false;

  const [showHiddenCategories = false] = useLocalPref(
    'budget.showHiddenCategories',
  );

  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const schedulesQuery = useMemo(() => q('schedules').select('*'), []);

  // «Gasto anual»: con la preferencia activada, lo anual que está al día o
  // cubierto se pliega en un bloque al final (las atrasadas siguen en su sitio).
  const { ocultar: ocultarAnual } = useOcultarEnPlan();
  const anual = useAnual(ocultarAnual);
  const anualPlegadas = useMemo(
    () =>
      ocultarAnual && !anual.cargando ? anual.filas.filter(esPlegable) : [],
    [ocultarAnual, anual.cargando, anual.filas],
  );

  return (
    <AssignKeypadProvider month={month} onBudgetAction={onBudgetAction}>
      <BudgetTableHeader
        month={month}
        onShowBudgetSummary={onShowBudgetSummary}
      />
      <PullToRefresh onRefresh={onRefresh}>
        <BudgetTableBody>
          <SchedulesProvider query={schedulesQuery}>
            <BudgetGroups
              type={budgetType}
              categoryGroups={categoryGroups}
              showBudgetedColumn
              show3Columns={show3Columns}
              showHiddenCategories={showHiddenCategories}
              anualPlegadas={anualPlegadas}
              month={month}
              onEditCategoryGroup={onEditCategoryGroup}
              onEditCategory={onEditCategory}
              onBudgetAction={onBudgetAction}
            />
          </SchedulesProvider>
        </BudgetTableBody>
      </PullToRefresh>
      <AssignKeypad onEditCategory={onEditCategory} />
    </AssignKeypadProvider>
  );
}

/**
 * Cuerpo de la tabla: deja sitio al final para la barra de pestañas o, con
 * el teclado de asignación abierto, para el panel inferior, de modo que la
 * última fila también se pueda seleccionar y ver.
 */
function BudgetTableBody({ children }: { children: ReactNode }) {
  const keypad = useAssignKeypad();
  const panelHeight = keypad?.panelHeight ?? 0;
  return (
    <View
      data-testid="budget-table"
      style={{
        backgroundColor: color.bg,
        minHeight: '100vh',
        flexShrink: 0,
        paddingBottom: Math.max(MOBILE_NAV_HEIGHT + 10, panelHeight + 10),
      }}
    >
      {children}
    </View>
  );
}

type BudgetTableHeaderProps = {
  month: string;
  onShowBudgetSummary: () => void;
};

/**
 * Cabecera de la lista: píldora verde «143,90 € listos para asignar» (roja si
 * se ha asignado de más; «ahorrado» en presupuestos de seguimiento) y la fila
 * de títulos de columna CATEGORÍA · ASIGNADO · DISPONIBLE.
 */
function BudgetTableHeader({
  month,
  onShowBudgetSummary,
}: BudgetTableHeaderProps) {
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  return (
    <View
      data-testid="budget-table-header"
      style={{
        flexShrink: 0,
        gap: 10,
        padding: `4px ${espacio.margen}px 6px`,
        backgroundColor: color.bg,
      }}
    >
      {budgetType === 'tracking' ? (
        <Saved
          projected={month >= monthUtils.currentMonth()}
          onPress={onShowBudgetSummary}
          show3Columns={false}
        />
      ) : (
        <ToBudget
          toBudget={envelopeBudget.toBudget}
          onPress={onShowBudgetSummary}
          show3Columns={false}
        />
      )}
      <View
        aria-hidden
        data-testid="cabecera-columnas"
        style={{
          ...texto.etiqueta,
          fontWeight: 700,
          color: color.fg3,
          flexDirection: 'row',
        }}
      >
        <Text style={{ flex: 1, marginRight: 8 }}>
          <Trans>Category</Trans>
        </Text>
        <Text style={{ width: ANCHO_COLUMNA, textAlign: 'right' }}>
          <Trans>Budgeted</Trans>
        </Text>
        <Text style={{ width: ANCHO_DISPONIBLE, textAlign: 'right' }}>
          <Trans>Available</Trans>
        </Text>
      </View>
    </View>
  );
}
