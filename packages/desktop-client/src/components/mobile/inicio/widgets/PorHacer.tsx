import { useCallback, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { groupById } from '@actual-app/core/shared/util';

import { useBudgetActions } from '#budget';
import type { ApplyBudgetActionPayload } from '#budget';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { Fila, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { Barquito } from '#components/mobile/ui/Barquito';
import { Boton } from '#components/mobile/ui/Boton';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Pildora } from '#components/mobile/ui/Pildora';
import { color } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

/**
 * «Por hacer»: categorías en rojo (Cubrir), dinero listo para asignar
 * (Asignar → «Asignar el mes») y sobreasignado (Corregir). Si no hay nada,
 * «Todo en orden».
 *
 * Tamaños: compacto = solo píldoras con los botones; normal = filas;
 * grande = además los nombres de las categorías en rojo.
 */
export function PorHacer({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const format = useFormat();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showUndoNotification } = useUndo();

  const applyBudgetAction = useBudgetActions();
  const onBudgetAction = useCallback(
    async (month: string, type: string, args?: unknown) => {
      applyBudgetAction.mutate({
        month,
        type,
        args,
      } as ApplyBudgetActionPayload);
    },
    [applyBudgetAction],
  );

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
  const pendientes = numberOfOverspent + (toBudget !== 0 ? 1 : 0);
  const nothingToDo = pendientes === 0;
  const compacto = tamano === 'compacto';
  const caja = compacto ? 36 : 44;

  const titulo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Trans>To do</Trans>
      {pendientes > 0 && (
        <Pildora
          estado="neutro"
          style={{ minHeight: 22, padding: '0 8px', fontSize: 12 }}
        >
          {pendientes}
        </Pildora>
      )}
    </View>
  );

  const nombresEnRojo = overspentCategories.map(c => c.name).join(', ');

  return (
    <Tarjeta titulo={titulo} data-testid="inicio-por-hacer" relleno={0}>
      <View style={{ padding: '6px 14px' }}>
        {nothingToDo && (
          <Fila>
            <View style={{ color: color.ok, flexShrink: 0 }}>
              <Barquito width={compacto ? 44 : 64} />
            </View>
            <View style={estilos.filaTexto}>
              <Text style={{ ...estilos.filaTitulo, color: color.ok }}>
                <Trans>All in order</Trans>
              </Text>
              {!compacto && (
                <Text style={estilos.filaSub}>
                  <Trans>Nothing pending this month.</Trans>
                </Text>
              )}
            </View>
          </Fila>
        )}

        {numberOfOverspent > 0 && (
          <Fila>
            <IconoCaja icono="alert" tono="rojo" size={caja} />
            <View style={estilos.filaTexto}>
              <Text style={estilos.filaTitulo}>
                {t('{{count}} category in the red', {
                  count: numberOfOverspent,
                })}
              </Text>
              <PrivacyFilter>
                <Text style={estilos.filaSub}>
                  {tamano === 'grande' && nombresEnRojo
                    ? `${nombresEnRojo} · ${format(totalOverspending, 'financial')}`
                    : format(totalOverspending, 'financial')}
                </Text>
              </PrivacyFilter>
            </View>
            <Boton variante="primario" onPress={onCover}>
              <Trans>Cover</Trans>
            </Boton>
          </Fila>
        )}

        {toBudget > 0 && (
          <Fila separada={numberOfOverspent > 0}>
            <IconoCaja icono="coins" tono="ok" size={caja} />
            <View style={estilos.filaTexto}>
              <PrivacyFilter>
                <Text style={estilos.filaTitulo}>
                  {t('{{amount}} ready to assign', {
                    amount: format(toBudget, 'financial'),
                  })}
                </Text>
              </PrivacyFilter>
              {!compacto && (
                <Text style={estilos.filaSub}>
                  <Trans>Give it a job this month</Trans>
                </Text>
              )}
            </View>
            <Boton variante="primario" onPress={onAssign}>
              <Trans>Assign</Trans>
            </Boton>
          </Fila>
        )}

        {toBudget < 0 && (
          <Fila separada={numberOfOverspent > 0}>
            <IconoCaja icono="alert" tono="rojo" size={caja} />
            <View style={estilos.filaTexto}>
              <PrivacyFilter>
                <Text style={{ ...estilos.filaTitulo, color: color.bad }}>
                  {t('Overbudgeted by {{amount}}', {
                    amount: format(-toBudget, 'financial'),
                  })}
                </Text>
              </PrivacyFilter>
            </View>
            <Boton variante="primario" onPress={onFixOverbudgeted}>
              <Trans>Fix</Trans>
            </Boton>
          </Fila>
        )}
      </View>
    </Tarjeta>
  );
}
