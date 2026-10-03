import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { Icono } from '#components/mobile/ui/Icono';
import {
  color,
  densidad,
  espacio,
  movimiento,
  texto,
} from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { getColumnWidth } from './BudgetTable';
import { IncomeCategoryList } from './IncomeCategoryList';
import { RowName } from './RowName';

type IncomeGroupProps = {
  categoryGroup: CategoryGroupEntity;
  month: string;
  showHiddenCategories: boolean;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: string) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
};

export function IncomeGroup({
  categoryGroup,
  month,
  showHiddenCategories,
  onEditCategoryGroup,
  onEditCategory,
  onBudgetAction,
  isCollapsed,
  onToggleCollapse,
}: IncomeGroupProps) {
  const columnWidth = getColumnWidth();
  const anchoDisponible = getColumnWidth({ disponible: true });
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const categories = useMemo(
    () =>
      isCollapsed(categoryGroup.id)
        ? []
        : (categoryGroup.categories?.filter(
            category => !category.hidden || showHiddenCategories,
          ) ?? []),
    [
      categoryGroup.categories,
      categoryGroup.id,
      isCollapsed,
      showHiddenCategories,
    ],
  );

  return (
    <View>
      <View
        aria-hidden
        style={{
          ...texto.etiqueta,
          fontWeight: 700,
          color: color.fg3,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: espacio.seccion,
          marginBottom: 6,
          padding: `0 ${densidad.margen}px`,
        }}
      >
        {budgetType === 'tracking' && (
          <Text style={{ width: columnWidth, textAlign: 'right' }}>
            <Trans>Budgeted</Trans>
          </Text>
        )}
        <Text style={{ width: anchoDisponible, textAlign: 'right' }}>
          <Trans>Received</Trans>
        </Text>
      </View>

      <View style={{ borderBottom: `1px solid ${color.line}` }}>
        <IncomeGroupHeader
          group={categoryGroup}
          month={month}
          onEdit={onEditCategoryGroup}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
        <IncomeCategoryList
          categories={categories}
          month={month}
          onEditCategory={onEditCategory}
          onBudgetAction={onBudgetAction}
        />
      </View>
    </View>
  );
}

type IncomeGroupHeaderProps = {
  group: CategoryGroupEntity;
  month: string;
  onEdit: (id: CategoryGroupEntity['id']) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
  style?: CSSProperties;
};

function IncomeGroupHeader({
  group,
  month,
  onEdit,
  isCollapsed,
  onToggleCollapse,
  style,
}: IncomeGroupHeaderProps) {
  return (
    <View
      data-testid="category-group-row"
      data-month={month}
      onClick={() => onToggleCollapse(group.id)}
      style={{
        cursor: 'pointer',
        height: densidad.altoGrupo,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: `0 ${densidad.margen}px`,
        opacity: group.hidden ? 0.5 : undefined,
        backgroundColor: color.surface2,
        ...style,
      }}
    >
      <IncomeGroupName
        group={group}
        onEdit={onEdit}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <IncomeGroupCells group={group} />
    </View>
  );
}

type IncomeGroupNameProps = {
  group: CategoryGroupEntity;
  onEdit: (id: CategoryGroupEntity['id']) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
};

function IncomeGroupName({
  group,
  onEdit,
  isCollapsed,
  onToggleCollapse,
}: IncomeGroupNameProps) {
  const { t } = useTranslation();
  const sidebarColumnWidth = getColumnWidth({
    isSidebar: true,
    offset: -13.5,
  });
  return (
    <RowName
      name={group.name}
      width={sidebarColumnWidth}
      lineas={2}
      menuIconSize={18}
      minHeight={densidad.altoGrupo - 2}
      textStyle={{ ...densidad.grupo, lineHeight: '18px', color: color.fg }}
      data-testid="category-group-name"
      onPress={() => onToggleCollapse(group.id)}
      menuLabel={t('Open menu for {{groupName}} group', {
        groupName: group.name,
      })}
      leading={
        <Icono
          nombre="cd"
          size={14}
          style={{
            flexShrink: 0,
            marginRight: 8,
            color: color.fg3,
            transition: `transform ${movimiento.pildora}ms ${movimiento.muelle}`,
            transform: isCollapsed(group.id) ? 'rotate(-90deg)' : '',
          }}
        />
      }
    />
  );
}

type IncomeGroupCellsProps = {
  group: CategoryGroupEntity;
};

function IncomeGroupCells({ group }: IncomeGroupCellsProps) {
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const format = useFormat();

  const budgeted =
    budgetType === 'tracking' ? trackingBudget.groupBudgeted(group.id) : null;

  const balance =
    budgetType === 'tracking'
      ? trackingBudget.groupSumAmount(group.id)
      : envelopeBudget.groupSumAmount(group.id);

  const columnWidth = getColumnWidth();
  const anchoDisponible = getColumnWidth({ disponible: true });
  const amountStyle: CSSProperties = {
    ...densidad.grupoCifra,
    color: color.fg3,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {budgeted && (
        <CellValue<'envelope-budget' | 'tracking-budget', 'group-budget'>
          binding={budgeted}
          type="financial"
        >
          {({ type, value }) => (
            <View>
              <PrivacyFilter>
                <Text
                  data-testid="group-amount"
                  style={{ ...amountStyle, width: columnWidth }}
                >
                  {format(value, type)}
                </Text>
              </PrivacyFilter>
            </View>
          )}
        </CellValue>
      )}
      <CellValue<'envelope-budget' | 'tracking-budget', 'group-sum-amount'>
        binding={balance}
        type="financial"
      >
        {({ type, value }) => (
          <View>
            <PrivacyFilter>
              <Text
                data-testid="group-amount"
                style={{ ...amountStyle, width: anchoDisponible }}
              >
                {format(value, type)}
              </Text>
            </PrivacyFilter>
          </View>
        )}
      </CellValue>
    </View>
  );
}
