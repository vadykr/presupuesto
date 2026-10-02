import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { keyframes } from '@emotion/css';

import { Icono } from '#components/mobile/ui/Icono';
import { IconoZz } from '#components/mobile/ui/IconoZz';
import {
  color,
  movimiento,
  num,
  radio,
  sombra,
} from '#components/mobile/ui/tokens';
import { useCategoriesById } from '#hooks/useCategories';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useNotes } from '#hooks/useNotes';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { setNotificationInset } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { useAssignKeypad } from './AssignKeypadContext';
import type { KeypadKey } from './AssignKeypadContext';
import { useIgnorarMes } from './useIgnorarMes';

const entrarDesdeAbajo = keyframes({
  from: { transform: 'translateY(100%)' },
  to: { transform: 'translateY(0)' },
});

/** Por encima de la barra de pestañas (zIndex 100) y debajo de los modales. */
export const KEYPAD_Z_INDEX = 200;
const KEY_HEIGHT = 48;
const PILL_HEIGHT = 44;
const GAP = 6;

type AssignKeypadProps = {
  /** «Detalles»: abre la ficha de la categoría. */
  onEditCategory: (id: CategoryEntity['id']) => void;
  /**
   * Fila de acciones encima de las teclas. Por defecto, las píldoras
   * «Auto-asignar · Mover dinero · Detalles»; «Asignar el mes» pone aquí el
   * botón «Asignar X € — Importe infrafinanciado».
   */
  renderActions?: (category: CategoryEntity) => ReactNode;
};

/**
 * Panel fijo en la parte inferior de la pestaña Presupuesto (móvil), al
 * estilo de la calculadora de YNAB: la lista sigue visible y se puede
 * desplazar; la fila seleccionada enseña la expresión mientras se teclea.
 */
export function AssignKeypad({
  onEditCategory,
  renderActions,
}: AssignKeypadProps) {
  const keypad = useAssignKeypad();
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = keypad?.selectedCategory != null;
  const setPanelHeight = keypad?.setPanelHeight;

  // Mide el panel para que la lista deje sitio al final y la fila
  // seleccionada se pueda ver encima del panel.
  useLayoutEffect(() => {
    if (!setPanelHeight) {
      return;
    }
    if (!isOpen) {
      setPanelHeight(0);
      return;
    }
    const element = panelRef.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setPanelHeight(element.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isOpen, setPanelHeight]);

  const selectedId = keypad?.selectedCategory?.id;
  const panelHeight = keypad?.panelHeight ?? 0;

  // Mientras el panel está abierto, la barra de pestañas flotante se oculta:
  // si no, tapa la última fila del teclado (0, ⌫, ✕, Hecho) en 390×844.
  useEffect(() => {
    if (panelHeight === 0) {
      return;
    }
    document.body.dataset.tecladoAbierto = '1';
    return () => {
      delete document.body.dataset.tecladoAbierto;
    };
  }, [panelHeight]);

  // Los avisos («Deshacer») se muestran encima del panel, no debajo.
  const dispatch = useDispatch();
  useEffect(() => {
    if (panelHeight === 0) {
      return;
    }
    dispatch(setNotificationInset({ inset: { bottom: panelHeight + 10 } }));
    return () => {
      dispatch(setNotificationInset(null));
    };
  }, [dispatch, panelHeight]);

  // Desplaza la lista para que la fila seleccionada quede visible encima del
  // panel (o debajo de la cabecera).
  useEffect(() => {
    if (!selectedId || panelHeight === 0) {
      return;
    }
    const row = document.querySelector<HTMLElement>(
      `[data-category-id="${selectedId}"]`,
    );
    const panel = panelRef.current;
    if (!row || !panel) {
      return;
    }
    const scroller = getScrollParent(row);
    if (!scroller) {
      return;
    }
    const rowRect = row.getBoundingClientRect();
    // Sin `getBoundingClientRect`: el panel puede estar aún entrando (animado).
    const panelTop = window.innerHeight - panelHeight;
    const scrollerTop = scroller.getBoundingClientRect().top;
    const margin = 8;
    if (rowRect.bottom > panelTop - margin) {
      scroller.scrollBy({
        top: rowRect.bottom - (panelTop - margin),
        behavior: 'smooth',
      });
    } else if (rowRect.top < scrollerTop + margin) {
      scroller.scrollBy({
        top: rowRect.top - (scrollerTop + margin),
        behavior: 'smooth',
      });
    }
  }, [selectedId, panelHeight]);

  if (!keypad || !keypad.selectedCategory) {
    return null;
  }

  const { selectedCategory, press, done, cancel } = keypad;

  const key = (
    label: ReactNode,
    value: KeypadKey,
    ariaLabel?: string,
    operador = false,
  ) => (
    <KeypadButton
      key={value}
      aria-label={ariaLabel}
      onPress={() => press(value)}
      data-testid={`keypad-${value}`}
      style={
        operador
          ? { backgroundColor: color.surface3, color: color.fg2 }
          : undefined
      }
    >
      {label}
    </KeypadButton>
  );

  return (
    <View
      innerRef={panelRef}
      role="group"
      aria-label={t('Assign keypad for {{categoryName}}', {
        categoryName: selectedCategory.name,
      })}
      data-testid="assign-keypad"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: KEYPAD_Z_INDEX,
        gap: 8,
        padding: '8px 10px 12px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        backgroundColor: color.surface2,
        borderRadius: '26px 26px 0 0',
        boxShadow: sombra.hoja,
        animation: `${entrarDesdeAbajo} ${movimiento.hoja}ms ${movimiento.muelle} both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <View
        aria-hidden
        style={{
          width: 40,
          height: 5,
          borderRadius: 3,
          backgroundColor: color.line2,
          alignSelf: 'center',
          marginBottom: 2,
        }}
      />
      {renderActions ? (
        renderActions(selectedCategory)
      ) : (
        <ActionPills
          category={selectedCategory}
          onEditCategory={onEditCategory}
        />
      )}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: GAP,
        }}
      >
        {key('7', '7')}
        {key('8', '8')}
        {key('9', '9')}
        {key('−', '-', t('Subtract from assigned'), true)}
        {key('4', '4')}
        {key('5', '5')}
        {key('6', '6')}
        {key('+', '+', t('Add to assigned'), true)}
        {key('1', '1')}
        {key('2', '2')}
        {key('3', '3')}
        {key('=', '=', t('Equals'), true)}
        <KeypadButton
          aria-label={t('Cancel')}
          onPress={cancel}
          data-testid="keypad-cancel"
          style={{ color: color.bad }}
        >
          <Icono nombre="x" size={22} />
        </KeypadButton>
        {key('0', '0')}
        {key(
          <Icono nombre="bksp" size={22} />,
          'backspace',
          t('Delete last digit'),
        )}
        <KeypadButton
          variant="primary"
          onPress={done}
          data-testid="keypad-done"
          style={{ fontSize: 16, fontWeight: 800 }}
        >
          <Trans>Done</Trans>
        </KeypadButton>
      </View>
    </View>
  );
}

type KeypadButtonProps = {
  children: ReactNode;
  onPress: () => void;
  variant?: 'normal' | 'primary';
  style?: CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
};

function KeypadButton({
  children,
  onPress,
  variant = 'normal',
  style,
  ...rest
}: KeypadButtonProps) {
  const primario = variant === 'primary';
  return (
    <Button
      variant="bare"
      bounce={false}
      onPointerDown={() => {
        if ('vibrate' in navigator) {
          navigator.vibrate(3);
        }
      }}
      onPress={onPress}
      style={({ isPressed }) => ({
        height: KEY_HEIGHT,
        minHeight: KEY_HEIGHT,
        padding: 0,
        borderRadius: radio.boton,
        fontSize: 21,
        fontWeight: 600,
        backgroundColor: primario ? color.accent : color.surface,
        color: primario ? color.accentInk : color.fg,
        transform: isPressed ? 'scale(0.95)' : undefined,
        filter: isPressed ? 'brightness(0.92)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
        ...num,
        ...style,
      })}
      {...rest}
    >
      {children}
    </Button>
  );
}

type ActionPillsProps = {
  category: CategoryEntity;
  onEditCategory: (id: CategoryEntity['id']) => void;
};

/** Fila «Auto-asignar · Mover dinero · Detalles». */
function ActionPills({ category, onEditCategory }: ActionPillsProps) {
  const keypad = useAssignKeypad();
  const { t } = useTranslation();
  const { showUndoNotification } = useUndo();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const categoryNotes = useNotes(category.id);

  const autoAssignRef = useRef<HTMLButtonElement>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);

  const month = keypad?.month ?? '';
  const onBudgetAction = keypad?.onBudgetAction;
  const reset = keypad?.reset;

  const runAutoAssign = useCallback(
    (action: string, message: string) => {
      setAutoAssignOpen(false);
      if (!onBudgetAction) {
        return;
      }
      // Lo tecleado deja de valer: la hoja pone el nuevo importe.
      reset?.();
      onBudgetAction(month, action, { category: category.id });
      showUndoNotification({
        message,
        ...(action === 'apply-single-category-template' && {
          pre: categoryNotes ?? undefined,
        }),
      });
    },
    [
      category.id,
      categoryNotes,
      month,
      onBudgetAction,
      reset,
      showUndoNotification,
    ],
  );

  const onAutoAssignSelect = useCallback(
    (name: string) => {
      const categoryName = category.name;
      switch (name) {
        case 'copy-single-last':
          runAutoAssign(
            name,
            t(
              "{{categoryName}} budget has been set to last month's budgeted amount.",
              { categoryName },
            ),
          );
          break;
        case 'set-single-3-avg':
        case 'set-single-6-avg':
        case 'set-single-12-avg':
          runAutoAssign(
            name,
            t(
              '{{categoryName}} budget has been set to {{months}} month average.',
              {
                categoryName,
                months:
                  name === 'set-single-3-avg'
                    ? 3
                    : name === 'set-single-6-avg'
                      ? 6
                      : 12,
              },
            ),
          );
          break;
        case 'apply-single-category-template':
          runAutoAssign(
            name,
            t('{{categoryName}} budget templates have been applied.', {
              categoryName,
            }),
          );
          break;
        case 'copy-until-year-end':
          runAutoAssign(
            name,
            t('{{categoryName}} budget copied until year end.', {
              categoryName,
            }),
          );
          break;
        default:
          throw new Error(`Unrecognized menu item: ${name}`);
      }
    },
    [category.name, runAutoAssign, t],
  );

  const onMoveMoney = useMoveMoneyModal(category);

  const { ignorada, setIgnorada } = useIgnorarMes(category.id, month);

  const pillStyle = ({ isPressed }: { isPressed: boolean }): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    height: PILL_HEIGHT,
    minHeight: PILL_HEIGHT,
    borderRadius: radio.boton,
    padding: '0 4px',
    gap: 5,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    backgroundColor: color.surface,
    color: color.fg,
    transform: isPressed ? 'scale(0.96)' : undefined,
    transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}, background-color ${movimiento.pildora}ms`,
  });
  const icono = { color: color.accent };

  const menuItemStyle: CSSProperties = {
    ...styles.mobileMenuItem,
    color: theme.menuItemText,
  };

  return (
    <View style={{ flexDirection: 'row', gap: GAP }}>
      <Button
        variant="bare"
        ref={autoAssignRef}
        style={pillStyle}
        onPress={() => setAutoAssignOpen(true)}
        data-testid="keypad-auto-assign"
        aria-label={t('Auto-assign')}
      >
        <Icono nombre="zap" size={16} style={icono} />
        <Trans>Auto</Trans>
      </Button>
      <Popover
        triggerRef={autoAssignRef}
        isOpen={autoAssignOpen}
        placement="top start"
        onOpenChange={() => setAutoAssignOpen(false)}
        style={{ zIndex: KEYPAD_Z_INDEX + 1 }}
      >
        <Menu
          getItemStyle={() => menuItemStyle}
          onMenuSelect={onAutoAssignSelect}
          items={[
            { name: 'copy-single-last', text: t("Copy last month's budget") },
            { name: 'set-single-3-avg', text: t('Set to 3 month average') },
            { name: 'set-single-6-avg', text: t('Set to 6 month average') },
            { name: 'set-single-12-avg', text: t('Set to yearly average') },
            ...(budgetType === 'tracking'
              ? [
                  {
                    name: 'copy-until-year-end',
                    text: t('Copy until year end'),
                  },
                ]
              : []),
            ...(isGoalTemplatesEnabled
              ? [
                  {
                    name: 'apply-single-category-template',
                    text: t('Overwrite with template'),
                  },
                ]
              : []),
          ]}
        />
      </Popover>
      {budgetType === 'envelope' && (
        <Button
          variant="bare"
          style={pillStyle}
          onPress={onMoveMoney}
          data-testid="keypad-move-money"
          aria-label={t('Move money')}
        >
          <Icono nombre="move" size={16} style={icono} />
          <Trans>Move</Trans>
        </Button>
      )}
      <Button
        variant="bare"
        style={pillStyle}
        onPress={() => onEditCategory(category.id)}
        data-testid="keypad-details"
      >
        <Icono nombre="info" size={16} style={icono} />
        <Trans>Details</Trans>
      </Button>
      <BotonIgnorar
        ignorada={ignorada}
        onPress={() => void setIgnorada(!ignorada)}
        style={pillStyle}
      />
    </View>
  );
}

/**
 * Píldora «zZ Ignorar» del teclado: un toque marca o desmarca «Ignorar este
 * mes». Rellena (gris fuerte) mientras la categoría está ignorada.
 */
export function BotonIgnorar({
  ignorada,
  onPress,
  style,
}: {
  ignorada: boolean;
  onPress: () => void;
  style: (estado: { isPressed: boolean }) => CSSProperties;
}) {
  const { t } = useTranslation();
  return (
    <Button
      variant="bare"
      aria-pressed={ignorada}
      aria-label={t('Ignore this month')}
      onPress={onPress}
      data-testid="keypad-ignorar"
      data-ignorada={ignorada || undefined}
      style={estado => ({
        ...style(estado),
        ...(ignorada && { backgroundColor: color.fg2, color: color.bg }),
      })}
    >
      <IconoZz color={ignorada ? color.bg : color.accent} />
      <Trans>Ignore</Trans>
    </Button>
  );
}

/**
 * «Mover dinero»: abre el modal de traspaso desde la categoría (o desde
 * «Listo para asignar») y aplica `transfer-category` con aviso de deshacer.
 * Lo usan la fila de píldoras del teclado y «Asignar el mes».
 */
export function useMoveMoneyModal(category: CategoryEntity) {
  const keypad = useAssignKeypad();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const {
    data: { list: categoriesById } = {
      list: {} as Record<string, CategoryEntity>,
    },
  } = useCategoriesById();

  const catBalance =
    useSheetValue<'envelope-budget' | 'tracking-budget', 'leftover'>(
      budgetType === 'tracking'
        ? trackingBudget.catBalance(category.id)
        : envelopeBudget.catBalance(category.id),
    ) ?? 0;

  const month = keypad?.month ?? '';
  const onBudgetAction = keypad?.onBudgetAction;

  return useCallback(() => {
    if (!onBudgetAction) {
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
            amount: catBalance,
            showToBeBudgeted: true,
            onSubmit: (amount, toCategoryId) => {
              onBudgetAction(month, 'transfer-category', {
                amount,
                from: category.id,
                to: toCategoryId,
                currencyCode: format.currency.code,
              });
              showUndoNotification({
                message: t(
                  'Transferred {{amount}} from {{fromCategoryName}} to {{toCategoryName}}.',
                  {
                    amount: format(amount, 'financial'),
                    fromCategoryName: category.name,
                    toCategoryName:
                      toCategoryId === 'to-budget'
                        ? t('To Budget')
                        : categoriesById[toCategoryId]?.name,
                  },
                ),
              });
            },
          },
        },
      }),
    );
  }, [
    catBalance,
    categoriesById,
    category.id,
    category.name,
    dispatch,
    format,
    month,
    onBudgetAction,
    showUndoNotification,
    t,
  ]);
}

function getScrollParent(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}
