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
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type {
  CategoryEntity,
  CategoryGroupEntity,
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
import {
  color,
  colorCategoria,
  densidad,
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
  ChipsFiltros,
  EditorFiltro,
  useFiltrosCategorias,
} from './FiltrosCategorias';
import {
  asignarGastadoMesPasado,
  asignarInfrafinanciadas,
  estadoFila,
  faltante,
  mediaPorCategoria,
  reducirSobrefinanciacion,
  sobrefinanciado,
  totalInfrafinanciado,
} from './objetivos';
import type {
  DatosCategoriaMes,
  EstadoFila,
  ImporteCategoria,
} from './objetivos';
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

  // Filtros: chips de estado y filtros propios (pref sincronizada).
  const cancelarTeclado = useCallback(() => keypad?.cancel(), [keypad]);
  const {
    filtro: filtroValido,
    setFiltro,
    propios,
    conteos,
    gruposFiltrados,
    editando,
    setEditando,
    onGuardar: onGuardarFiltro,
    onBorrar: onBorrarFiltro,
  } = useFiltrosCategorias({
    grupos,
    datos,
    onCambio: cancelarTeclado,
  });

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
        // flexShrink 0: si la lista se encoge al alto del contenedor con
        // scroll, el relleno inferior queda dentro y no deja subir la última
        // fila por encima del teclado.
        flexShrink: 0,
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
      <ChipsFiltros
        activo={filtroValido}
        onChange={setFiltro}
        conteos={conteos}
        propios={propios}
        onNuevo={() => setEditando('nuevo')}
        onEditar={f => setEditando(f)}
      />
      {gruposFiltrados.map(grupo => {
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
              flexShrink: 0,
              borderBottom: `1px solid ${color.line}`,
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
      {grupos.length > 0 && gruposFiltrados.length === 0 && (
        <EstadoVacio
          style={{ margin: espacio.margen }}
          titulo={<Trans>No categories in this filter.</Trans>}
        />
      )}
      {editando && (
        <EditorFiltro
          filtro={editando === 'nuevo' ? null : editando}
          grupos={grupos}
          onGuardar={onGuardarFiltro}
          onBorrar={onBorrarFiltro}
          onCerrar={() => setEditando(null)}
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
              ...texto.heroe,
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

/** Valores `<campo>-<id>` de la hoja de un mes (`envelope-budget-month`). */
async function leerMes(
  month: string,
  campo: 'budget' | 'sum-amount',
): Promise<Map<string, number | null>> {
  const valores = await send('envelope-budget-month', { month });
  const mapa = new Map<string, number | null>();
  const marca = `!${campo}-`;
  for (const { name, value } of valores) {
    const i = name.indexOf(marca);
    if (i >= 0) {
      mapa.set(
        name.slice(i + marca.length),
        typeof value === 'number' ? value : null,
      );
    }
  }
  return mapa;
}

/** Historia de los 3 meses anteriores: asignado y gastado (positivo). */
type Historia = {
  asignado: Map<string, number | null>[];
  gastado: Map<string, number | null>[];
};

const MESES_PROMEDIO = 3;

function useHistoria(month: string, activo: boolean): Historia | null {
  const [historia, setHistoria] = useState<{
    month: string;
    datos: Historia;
  } | null>(null);
  useEffect(() => {
    if (!activo) {
      return;
    }
    let cancelado = false;
    void (async () => {
      const meses = Array.from({ length: MESES_PROMEDIO }, (_, i) =>
        monthUtils.subMonths(month, i + 1),
      );
      try {
        const asignado = await Promise.all(
          meses.map(m => leerMes(m, 'budget')),
        );
        const gastado = (
          await Promise.all(meses.map(m => leerMes(m, 'sum-amount')))
        ).map(
          m =>
            new Map(
              [...m].map(([id, v]) => [id, v == null ? null : Math.max(0, -v)]),
            ),
        );
        if (!cancelado) {
          setHistoria({ month, datos: { asignado, gastado } });
        }
      } catch {
        // Meses fuera del presupuesto: sin importes.
        if (!cancelado) {
          setHistoria({ month, datos: { asignado: [], gastado: [] } });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [activo, month]);
  return historia?.month === month ? historia.datos : null;
}

type OpcionAuto =
  | 'underfunded'
  | 'reduce-overfunding'
  | 'last-month'
  | 'spent-last'
  | 'avg-assigned'
  | 'avg-spent';

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
  const historia = useHistoria(month, open);

  const ids = useMemo(
    () => grupos.flatMap(g => g.categories.map(c => c.id)),
    [grupos],
  );
  const filas = useMemo(
    () =>
      ids.map(id => ({
        id,
        datos: datos.get(id) ?? {
          goal: null,
          longGoal: false,
          budgeted: 0,
          balance: 0,
          spent: 0,
        },
      })),
    [datos, ids],
  );

  // Importe de cada opción (lo que se asignaría en total), como YNAB.
  const propuestas = useMemo(() => {
    const porCategoria = (
      valores: Map<string, number | null> | Map<string, number> | undefined,
    ): ImporteCategoria[] | null =>
      valores
        ? ids.map(id => ({ category: id, amount: valores.get(id) ?? 0 }))
        : null;
    return {
      'last-month': porCategoria(historia?.asignado[0]),
      'spent-last': historia?.gastado[0]
        ? asignarGastadoMesPasado(
            ids.map(id => ({
              id,
              gastadoMesPasado: -(historia.gastado[0].get(id) ?? 0),
            })),
          )
        : null,
      'avg-assigned': historia
        ? porCategoria(mediaPorCategoria(ids, historia.asignado))
        : null,
      'avg-spent': historia
        ? porCategoria(mediaPorCategoria(ids, historia.gastado))
        : null,
    };
  }, [historia, ids]);

  const suma = (lista: ImporteCategoria[] | null) =>
    lista ? lista.reduce((s, a) => s + a.amount, 0) : null;
  const importes: Record<OpcionAuto, IntegerAmount | null> = {
    underfunded: totalInfrafinanciado(datos.values()),
    'reduce-overfunding': filas.reduce(
      (s, f) => s + sobrefinanciado(f.datos),
      0,
    ),
    'last-month': suma(propuestas['last-month']),
    'spent-last': suma(propuestas['spent-last']),
    'avg-assigned': suma(propuestas['avg-assigned']),
    'avg-spent': suma(propuestas['avg-spent']),
  };
  const conEuro = (valor: IntegerAmount | null) => {
    if (valor == null) {
      return '…';
    }
    const texto = format(valor, 'financial');
    return /€/.test(texto) ? texto : `${texto} €`;
  };

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

  const aplicar = (amounts: ImporteCategoria[], message: string) => {
    onBudgetAction(month, 'budget-amounts', { amounts });
    showUndoNotification({ message });
  };

  const onSelect = (name: OpcionAuto) => {
    setOpen(false);
    // Lo tecleado en el panel deja de valer: la hoja pone los importes.
    keypad?.cancel();
    switch (name) {
      case 'underfunded': {
        const amounts = asignarInfrafinanciadas(filas, toBudget);
        if (amounts.length === 0) {
          avisar(
            toBudget <= 0
              ? t('Nothing ready to assign.')
              : t('No underfunded categories.'),
          );
          return;
        }
        const asignadoAntes = new Map(filas.map(f => [f.id, f.datos.budgeted]));
        const total = amounts.reduce(
          (s, a) => s + a.amount - (asignadoAntes.get(a.category) ?? 0),
          0,
        );
        aplicar(
          amounts,
          t('Assigned {{amount}} to {{count}} underfunded categories.', {
            amount: format(total, 'financial'),
            count: amounts.length,
          }),
        );
        return;
      }
      case 'reduce-overfunding': {
        const amounts = reducirSobrefinanciacion(filas);
        if (amounts.length === 0) {
          avisar(t('No overfunded categories.'));
          return;
        }
        aplicar(
          amounts,
          t('Returned {{amount}} from {{count}} overfunded categories.', {
            amount: format(importes['reduce-overfunding'] ?? 0, 'financial'),
            count: amounts.length,
          }),
        );
        return;
      }
      case 'last-month':
      case 'spent-last':
      case 'avg-assigned':
      case 'avg-spent': {
        const amounts = propuestas[name];
        if (!amounts || amounts.length === 0) {
          avisar(t('Nothing to assign from previous months.'));
          return;
        }
        const mensajes: Record<typeof name, string> = {
          'last-month': t("Budget set to last month's assigned amounts."),
          'spent-last': t("Budget set to last month's spending."),
          'avg-assigned': t('Budget set to the average assigned.'),
          'avg-spent': t('Budget set to the average spent.'),
        };
        aplicar(amounts, mensajes[name]);
        return;
      }
      default:
        return;
    }
  };

  const opciones: { name: OpcionAuto; text: string }[] = [
    { name: 'underfunded', text: t('Underfunded') },
    { name: 'reduce-overfunding', text: t('Reduce overfunding') },
    { name: 'last-month', text: t('Assigned last month') },
    { name: 'spent-last', text: t('Spent last month') },
    { name: 'avg-assigned', text: t('Average assigned') },
    { name: 'avg-spent', text: t('Average spent') },
  ];

  return (
    <View
      style={{
        flexShrink: 0,
        margin: `0 ${espacio.margen}px 8px`,
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
        style={{ minWidth: 280 }}
      >
        <Text
          style={{
            ...texto.etiqueta,
            color: color.fg3,
            padding: '10px 14px 2px',
          }}
        >
          <Trans>Auto-assign to all categories</Trans>
        </Text>
        <Menu
          getItemStyle={() => ({
            ...styles.mobileMenuItem,
            color: theme.menuItemText,
          })}
          onMenuSelect={name => onSelect(name as OpcionAuto)}
          items={opciones.map(o => ({
            name: o.name,
            text: `${o.text}: ${conEuro(importes[o.name])}`,
          }))}
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
        height: densidad.altoGrupo,
        padding: `0 ${densidad.margen}px`,
        backgroundColor: color.surface2,
      }}
    >
      <RowName
        name={grupo.name}
        width="55vw"
        onPress={onToggle}
        lineas={1}
        minHeight={densidad.altoGrupo - 2}
        textStyle={{ ...densidad.grupo, color: color.fg }}
        data-testid="asignar-grupo-nombre"
        leading={
          <Icono
            nombre="cd"
            size={14}
            style={{
              flexShrink: 0,
              marginRight: 8,
              color: color.fg3,
              transition: `transform ${movimiento.pildora}ms ${movimiento.muelle}`,
              transform: plegado ? 'rotate(-90deg)' : '',
            }}
          />
        }
      />
      <PrivacyFilter>
        <Text
          style={{ ...densidad.grupoCifra, color: color.fg3, flexShrink: 0 }}
        >
          {format(asignado, 'financial')}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

export function colorDeEstado(estado: EstadoFila): string {
  switch (estado.tipo) {
    case 'gastado-de-mas':
      return color.bad;
    case 'falta':
      return color.warn;
    case 'financiada':
      return color.ok;
    case 'sobrefinanciada':
      return colorCategoria(0);
    default:
      return color.fg3;
  }
}

/** Texto corto de estado de una fila, en castellano vía i18n. */
export function useTextoEstado() {
  const { t } = useTranslation();
  const format = useFormat();
  return useCallback(
    (estado: EstadoFila): string => {
      switch (estado.tipo) {
        case 'gastado-de-mas':
          return t('−{{amount}} overspent', {
            amount: format(estado.importe, 'financial'),
          });
        case 'falta':
          return t('{{amount}} needed', {
            amount: format(estado.importe, 'financial'),
          });
        case 'sobrefinanciada':
          return t('{{amount}} extra', {
            amount: format(estado.importe, 'financial'),
          });
        case 'financiada':
          return t('Funded');
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
  primera?: boolean;
};

function FilaCategoria({
  category,
  datos,
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
        minHeight: densidad.altoFilaBarra,
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 4,
        padding: `8px ${densidad.margen}px 8px ${densidad.margen + densidad.sangria}px`,
        borderRadius: 0,
        boxShadow: primera ? undefined : `inset 0 1px 0 ${color.line}`,
        textAlign: 'left',
        color: color.fg,
        opacity: estado.tipo === 'ignorada' ? 0.62 : 1,
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {emoji && (
            <Text aria-hidden style={{ ...densidad.emoji, flexShrink: 0 }}>
              {emoji}
            </Text>
          )}
          <Text
            style={{
              ...styles.lineClamp(2),
              ...densidad.nombre,
              flex: 1,
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
              outline: `2px solid ${color.accent}`,
              outlineOffset: 2,
              borderRadius: 6,
            }),
          }}
        >
          <PrivacyFilter>
            <Text
              style={{
                ...densidad.cifra,
                color:
                  estado.tipo === 'gastado-de-mas' && !display
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
                  ...densidad.pequeno,
                  ...num,
                  lineHeight: '14px',
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
      {/* Estado a la izquierda y barra a la derecha, bajo la cifra: una sola
          línea para que la fila quede en 56 px. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {estado.tipo === 'ignorada' && <IconoZz color={colorEstado} />}
          <Text
            style={{
              ...densidad.pequeno,
              color: colorEstado,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
            data-testid="asignar-estado"
            data-estado={estado.tipo}
            data-ignorada={estado.tipo === 'ignorada' || undefined}
          >
            {textoEstado(estado)}
          </Text>
        </View>
        <BarraProgreso
          valor={estado.progreso}
          color={colorEstado}
          alto={5}
          style={{ width: densidad.colAsignado - 20 }}
        />
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
              : datos?.goal == null
                ? t('No target')
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
