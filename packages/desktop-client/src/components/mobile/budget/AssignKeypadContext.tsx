import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import {
  EMPTY_EXPRESSION,
  evaluate,
  isDirty,
  pressBackspace,
  pressDigit,
  pressEquals,
  pressOperator,
} from './assignExpression';
import type { AssignExpression, Operator } from './assignExpression';

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | Operator
  | '='
  | 'backspace';

export type AssignKeypadContextValue = {
  month: string;
  /** Categoría seleccionada (con el panel abierto) o `null`. */
  selectedCategory: CategoryEntity | null;
  expression: AssignExpression;
  /** Importe asignado vivo (hoja) de la categoría seleccionada. */
  liveBudgeted: IntegerAmount;
  /** Abre el panel para esta categoría; aplica lo pendiente de la anterior. */
  select: (category: CategoryEntity) => void;
  press: (key: KeypadKey) => void;
  /** Aplica la expresión (budget-amount) y cierra. */
  done: () => void;
  /** Descarta lo tecleado y cierra. */
  cancel: () => void;
  /** Vuelve a la expresión vacía sin cerrar (tras un auto-asignar). */
  reset: () => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  /** Alto del panel en px, para dejar sitio al final de la lista. */
  panelHeight: number;
  setPanelHeight: (height: number) => void;
};

const AssignKeypadContext = createContext<AssignKeypadContextValue | null>(
  null,
);

/** `null` fuera del proveedor (escritorio, tests): la celda usa el modal. */
export function useAssignKeypad() {
  return useContext(AssignKeypadContext);
}

type AssignKeypadProviderProps = {
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  children: ReactNode;
};

export function AssignKeypadProvider({
  month,
  onBudgetAction,
  children,
}: AssignKeypadProviderProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryEntity | null>(null);
  const [expression, setExpression] =
    useState<AssignExpression>(EMPTY_EXPRESSION);
  const [panelHeight, setPanelHeight] = useState(0);

  const selectedId = selectedCategory?.id ?? '';
  const liveBudgeted =
    useSheetValue<'envelope-budget' | 'tracking-budget', 'budget'>(
      budgetType === 'tracking'
        ? trackingBudget.catBudgeted(selectedId)
        : envelopeBudget.catBudgeted(selectedId),
    ) ?? 0;

  // Referencias para que `select` pueda aplicar lo pendiente de la categoría
  // anterior sin cambiar de identidad en cada tecla.
  const stateRef = useRef({ selectedCategory, expression, liveBudgeted });
  stateRef.current = { selectedCategory, expression, liveBudgeted };

  const apply = useCallback(
    (category: CategoryEntity, expr: AssignExpression, live: IntegerAmount) => {
      if (!isDirty(expr)) {
        return;
      }
      const amount = evaluate(expr, live);
      if (amount === live) {
        return;
      }
      onBudgetAction(month, 'budget-amount', {
        category: category.id,
        amount,
      });
      showUndoNotification({
        message: t('{{categoryName}} budget has been updated to {{amount}}.', {
          categoryName: category.name,
          amount: format(amount, 'financial'),
        }),
      });
    },
    [format, month, onBudgetAction, showUndoNotification, t],
  );

  const select = useCallback(
    (category: CategoryEntity) => {
      const current = stateRef.current;
      if (
        current.selectedCategory &&
        current.selectedCategory.id !== category.id
      ) {
        apply(
          current.selectedCategory,
          current.expression,
          current.liveBudgeted,
        );
      }
      if (current.selectedCategory?.id !== category.id) {
        setExpression(EMPTY_EXPRESSION);
      }
      setSelectedCategory(category);
    },
    [apply],
  );

  const press = useCallback((key: KeypadKey) => {
    const live = stateRef.current.liveBudgeted;
    setExpression(expr => {
      switch (key) {
        case '+':
        case '-':
          return pressOperator(expr, key, live);
        case '=':
          return pressEquals(expr, live);
        case 'backspace':
          return pressBackspace(expr);
        default:
          return pressDigit(expr, key);
      }
    });
  }, []);

  const done = useCallback(() => {
    const current = stateRef.current;
    if (current.selectedCategory) {
      apply(current.selectedCategory, current.expression, current.liveBudgeted);
    }
    setSelectedCategory(null);
    setExpression(EMPTY_EXPRESSION);
  }, [apply]);

  const cancel = useCallback(() => {
    setSelectedCategory(null);
    setExpression(EMPTY_EXPRESSION);
  }, []);

  const reset = useCallback(() => {
    setExpression(EMPTY_EXPRESSION);
  }, []);

  // Al cambiar de mes se cierra el panel: la expresión era de otro mes.
  useEffect(() => {
    setSelectedCategory(null);
    setExpression(EMPTY_EXPRESSION);
  }, [month]);

  const value = useMemo<AssignKeypadContextValue>(
    () => ({
      month,
      selectedCategory,
      expression,
      liveBudgeted,
      select,
      press,
      done,
      cancel,
      reset,
      onBudgetAction,
      panelHeight,
      setPanelHeight,
    }),
    [
      month,
      selectedCategory,
      expression,
      liveBudgeted,
      select,
      press,
      done,
      cancel,
      reset,
      onBudgetAction,
      panelHeight,
    ],
  );

  return (
    <AssignKeypadContext.Provider value={value}>
      {children}
    </AssignKeypadContext.Provider>
  );
}
