import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
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
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import { BotonRedondo } from '#components/mobile/ui/Cabecera';
import { Cargando } from '#components/mobile/ui/Cargando';
import { separarEmoji } from '#components/mobile/ui/emoji';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoZz } from '#components/mobile/ui/IconoZz';
import { SelectorMes } from '#components/mobile/ui/SelectorMes';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  espacio,
  movimiento,
  num,
  radio,
  sombra,
  texto,
} from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
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
  BotonIgnorar,
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
import { useIgnorarMes } from './useIgnorarMes';

type OnBudgetAction = (month: string, type: string, args?: unknown) => void;

/**
 * «Asignar el mes» (solo móvil), calcada de «Assign Money» de YNAB: cuánto
 * hay listo para asignar, cuánto falta en las categorías con objetivo,
 * auto-asignar y la lista de categorías con su barra de progreso. Tocar una
 * fila abre el teclado inline con «Asignar lo que falta».
 */
export function AsignarMesPage() {
  const { t } = useTranslation();
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

  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.fila,
            padding: `6px ${espacio.margen}px`,
            minHeight: 56,
          }}
        >
          <BotonRedondo
            icono="cl"
            aria-label={t('Back')}
            onPress={() => void navigate(-1)}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              role="heading"
              aria-level={1}
              style={{ ...texto.titulo, color: color.fg, whiteSpace: 'nowrap' }}
            >
              <Trans>Assign the month</Trans>
            </Text>
            <SelectorMes
              mes={month}
              minimo={monthBounds.start}
              maximo={monthUtils.subMonths(monthBounds.end, 1)}
              onChange={setMonth}
              style={{ marginLeft: -6, minHeight: 32, alignSelf: 'flex-start' }}
            />
          </View>
          <BotonRedondo
            icono="more"
            aria-label={t('More')}
            onPress={() => setMenuOpen(true)}
          />
          <View
            ref={menuRef}
            style={{ position: 'absolute', right: 16, bottom: 6 }}
          />
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
        </View>
      }
    >
      {initialized ? (
        <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
          <AssignKeypadProvider month={month} onBudgetAction={onBudgetAction}>
            <Contenido month={month} onBudgetAction={onBudgetAction} />
          </AssignKeypadProvider>
        </SheetNameProvider>
      ) : (
        <Cargando pantalla />
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
        gap: 0,
      }}
      data-testid="asignar-mes"
    >
      <Cabecera
        toBudget={toBudget}
        infrafinanciado={infrafinanciado}
        numInfrafinanciadas={
          [...datos.values()].filter(d => faltante(d) > 0).length
        }
      />
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
            style={{
              ...estiloTarjeta('normal', 0),
              flexShrink: 0,
              overflow: 'hidden',
              margin: `0 ${espacio.margen}px ${espacio.tarjetas}px`,
            }}
          >
            <CabeceraGrupo
              grupo={grupo}
              asignado={asignadoGrupo}
              plegado={plegado}
              onToggle={() => onToggleCollapse(grupo.id)}
            />
            {!plegado &&
              grupo.categories.map((category, i) => (
                <FilaCategoria
                  primera={i === 0}
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
        <EstadoVacio
          style={{ margin: espacio.margen }}
          titulo={<Trans>No categories to assign.</Trans>}
        />
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
  numInfrafinanciadas,
}: {
  toBudget: IntegerAmount;
  infrafinanciado: IntegerAmount;
  numInfrafinanciadas: number;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const sobreasignado = toBudget < 0;
  return (
    <View
      data-testid="asignar-cabecera"
      style={{
        flexShrink: 0,
        margin: `4px ${espacio.margen}px ${espacio.tarjetas}px`,
        padding: '18px 12px 20px',
        borderRadius: radio.heroe,
        alignItems: 'center',
        gap: 4,
        textAlign: 'center',
        boxShadow: sombra.tarjeta,
        background: sobreasignado
          ? `linear-gradient(150deg, ${color.bad}, color-mix(in srgb, ${color.bad} 70%, black))`
          : `linear-gradient(150deg, ${color.heroA}, ${color.heroB})`,
        color: sobreasignado ? '#fff' : color.heroFg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
          gap: 8,
        }}
      >
        <PrivacyFilter>
          <Text
            style={{
              ...num,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              color: 'inherit',
              whiteSpace: 'nowrap',
            }}
            data-testid="asignar-listo"
          >
            {format(Math.abs(toBudget), 'financial')}
          </Text>
        </PrivacyFilter>
      </View>
      <Text style={{ fontWeight: 700, opacity: 0.92, color: 'inherit' }}>
        {sobreasignado ? t('Overbudgeted') : t('ready to assign')}
      </Text>
      <PrivacyFilter>
        <Text
          style={{
            ...num,
            marginTop: 6,
            fontSize: 13.5,
            fontWeight: 600,
            opacity: 0.9,
            color: 'inherit',
            backgroundColor: 'rgba(0, 0, 0, 0.18)',
            borderRadius: radio.pildora,
            padding: '6px 12px',
          }}
          data-testid="asignar-infrafinanciado"
        >
          {numInfrafinanciadas > 0
            ? t('{{amount}} in {{count}} underfunded categories', {
                amount: format(infrafinanciado, 'financial'),
                count: numInfrafinanciadas,
              })
            : t('{{amount}} in underfunded categories', {
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
        margin: `0 ${espacio.margen}px ${espacio.tarjetas}px`,
      }}
    >
      <Boton
        ref={triggerRef}
        variante="fantasma"
        bloque
        onPress={() => setOpen(true)}
        data-testid="auto-asignar"
        style={{ minHeight: 48 }}
      >
        <Icono nombre="zap" size={20} style={{ color: color.accent }} />
        <Trans>Auto-assign by…</Trans>
      </Boton>
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
        gap: 8,
        minHeight: 48,
        padding: '2px 14px',
      }}
    >
      <RowName
        name={grupo.name}
        width="55vw"
        onPress={onToggle}
        textStyle={{ fontSize: 15, fontWeight: 800, color: color.fg }}
        data-testid="asignar-grupo-nombre"
        leading={
          <Icono
            nombre="cd"
            size={18}
            style={{
              marginRight: 6,
              color: color.fg3,
              transition: `transform ${movimiento.pildora}ms ${movimiento.muelle}`,
              transform: plegado ? 'rotate(-90deg)' : '',
            }}
          />
        }
      />
      <PrivacyFilter>
        <Text
          style={{ ...num, fontSize: 13, fontWeight: 800, color: color.fg2 }}
        >
          {format(asignado, 'financial')}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

function colorDeEstado(estado: EstadoFila): string {
  switch (estado.tipo) {
    case 'sobregastada':
      return color.bad;
    case 'faltan':
      return color.warn;
    case 'financiada':
      return color.ok;
    case 'gastado-parcial':
      return estado.financiada ? color.ok : color.fg3;
    default:
      return color.fg3;
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
        case 'ignorada':
          return t('Ignored this month');
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
  primera?: boolean;
};

function FilaCategoria({
  category,
  datos,
  dia,
  primera = false,
}: FilaCategoriaProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const keypad = useAssignKeypad();
  const textoEstado = useTextoEstado();
  const isSelected = keypad?.selectedCategory?.id === category.id;

  const estado = estadoFila(
    datos ?? { goal: null, longGoal: false, budgeted: 0, balance: 0, spent: 0 },
  );
  const colorEstado = colorDeEstado(estado);
  const { emoji, resto } = separarEmoji(category.name);

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
        gap: 8,
        padding: '12px 14px',
        borderRadius: 0,
        borderTop: primera ? undefined : `1px solid ${color.line}`,
        textAlign: 'left',
        color: color.fg,
        opacity: estado.tipo === 'ignorada' ? 0.62 : 1,
        backgroundColor: isSelected ? color.accentSoft : 'transparent',
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {emoji && (
            <Text
              aria-hidden
              style={{ fontSize: 18, width: 24, textAlign: 'center' }}
            >
              {emoji}
            </Text>
          )}
          <Text
            style={{
              ...styles.lineClamp(2),
              flex: 1,
              fontSize: 14.5,
              fontWeight: 700,
              color: color.fg,
            }}
            data-testid="asignar-nombre"
          >
            {emoji ? resto : category.name}
          </Text>
        </View>
        <View
          style={{
            alignItems: 'flex-end',
            flexShrink: 0,
            ...(isSelected && {
              border: `2px solid ${color.accent}`,
              borderRadius: radio.sm,
              padding: '2px 7px',
              backgroundColor: color.bg,
            }),
          }}
        >
          <PrivacyFilter>
            <Text
              style={{
                ...num,
                fontSize: 14.5,
                fontWeight: 800,
                color:
                  estado.tipo === 'sobregastada' && !display
                    ? color.bad
                    : color.fg,
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
                  ...num,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color:
                    display.secondary.op === '-' ? color.bad : color.accent,
                }}
              >
                {display.secondary.op === '-' ? '−' : '+'}
                {format(display.secondary.amount, 'financial')}
              </Text>
            </PrivacyFilter>
          )}
        </View>
      </View>
      <BarraProgreso valor={estado.progreso} color={colorEstado} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {estado.tipo === 'ignorada' && <IconoZz color={colorEstado} />}
        <Text
          style={{ fontSize: 12.5, fontWeight: 700, color: colorEstado }}
          data-testid="asignar-estado"
          data-ignorada={estado.tipo === 'ignorada' || undefined}
        >
          {textoEstado(estado, dia)}
        </Text>
      </View>
    </Button>
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

  const locale = useLocale();
  const falta = datos ? faltante(datos) : 0;
  const month = keypad?.month ?? '';
  const { ignorada, setIgnorada } = useIgnorarMes(category.id, month);
  const nombreMes = month ? monthUtils.format(month, 'MMMM', locale) : '';

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
      case 'ignorar':
        void setIgnorada(!ignorada);
        showUndoNotification({
          message: ignorada
            ? t('{{categoryName}} is no longer ignored in {{month}}.', {
                categoryName: category.name,
                month: nombreMes,
              })
            : t('{{categoryName}} ignored in {{month}}.', {
                categoryName: category.name,
                month: nombreMes,
              }),
        });
        break;
      default:
        break;
    }
  };

  const etiqueta: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    color: color.fg3,
    marginTop: 4,
  };
  const pildora = ({ isPressed }: { isPressed: boolean }): CSSProperties => ({
    width: 72,
    height: 48,
    minHeight: 48,
    borderRadius: radio.boton,
    gap: 4,
    fontSize: 12,
    fontWeight: 800,
    backgroundColor: color.surface,
    color: color.fg,
    transform: isPressed ? 'scale(0.96)' : undefined,
    transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
  });

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Boton
          bloque
          onPress={onAsignarFaltante}
          isDisabled={falta <= 0}
          data-testid="keypad-asignar-faltante"
          style={{ minHeight: 48, fontSize: 15, padding: '0 10px', ...num }}
        >
          {falta > 0
            ? t('Assign {{amount}}', { amount: format(falta, 'financial') })
            : ignorada
              ? t('Ignored this month')
              : t('Funded')}
        </Boton>
        <Text style={etiqueta}>
          <Trans>Underfunded amount</Trans>
        </Text>
      </View>
      <BotonIgnorar
        ignorada={ignorada}
        onPress={() => onMas('ignorar')}
        style={pildora}
      />
      <View>
        <Button
          variant="bare"
          ref={masRef}
          onPress={() => setMasOpen(true)}
          aria-label={t('More')}
          data-testid="keypad-mas"
          style={pildora}
        >
          <Icono nombre="more" size={20} style={{ color: color.accent }} />
        </Button>
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
              Menu.line,
              {
                name: 'ignorar',
                text: t('Ignore this month ({{month}})', { month: nombreMes }),
                toggle: ignorada,
              },
            ]}
          />
        </Popover>
      </View>
    </View>
  );
}
