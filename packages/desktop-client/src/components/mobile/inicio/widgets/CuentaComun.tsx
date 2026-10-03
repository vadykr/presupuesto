import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import { AccionTexto, Fila, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import {
  alternarCategoriaComun,
  cobertura,
  cuentasDelTraspaso,
  gastoPrevisto,
  importeCuentaComun,
  leerCategoriasComunes,
  leerTraspasados,
  marcarTraspasado,
  MESES_PREVISTO,
  sugerirTraspaso,
} from '#components/mobile/inicio/cuentaComun';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { useDatosCuentaComun } from '#components/mobile/inicio/widgets/useDatosCuentaComun';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Pildora } from '#components/mobile/ui/Pildora';
import { color, espacio, radio, TACTIL } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { accountBalance } from '#spreadsheet/bindings';

/**
 * «Cuenta común»: tres cifras. A ingresar este mes (lo asignado en las
 * categorías de `cuenta-comun-categorias`), saldo de la cuenta y gasto previsto
 * (mediana robusta de los últimos 12 meses completos), con una barra de
 * cobertura. El conmutador «Traspasado» lo marca Vadym a mano por mes
 * (`cuenta-comun-traspasado`).
 *
 * Tamaños: compacto = cifras y barra; normal = + «Llevas X de Y»; grande = +
 * desglose por categoría.
 */
export function CuentaComun({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const dispatch = useDispatch();
  const [raw, setRaw] = useSyncedPref('cuenta-comun-categorias');
  const ids = useMemo(() => leerCategoriasComunes(raw), [raw]);
  const [configurando, setConfigurando] = useState(false);

  const { data: { list: categorias } = { list: [] as CategoryEntity[] } } =
    useCategories();
  const elegidas = useMemo(() => {
    const porId = new Map(categorias.map(c => [c.id, c]));
    return ids
      .map(id => porId.get(id))
      .filter((c): c is CategoryEntity => Boolean(c));
  }, [categorias, ids]);

  const datos = useDatosObjetivos(month, elegidas);
  const importe = importeCuentaComun(
    elegidas.map(c => c.id),
    id => datos.get(id)?.budgeted,
  );

  const { data: cuentas = [] } = useAccounts();

  const guardar = (nuevos: string[]) => setRaw(JSON.stringify(nuevos));

  const anadirCategoria = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'category-autocomplete',
          options: {
            title: t('Joint account categories'),
            month,
            showHiddenCategories: true,
            closeOnSelect: true,
            onSelect: id => {
              if (id && !ids.includes(id)) {
                guardar([...ids, id]);
              }
            },
          },
        },
      }),
    );
  };

  const destino = useMemo(() => cuentasDelTraspaso(cuentas).destino, [cuentas]);
  const saldo = useSheetValue<'account', 'balance'>(
    accountBalance(destino?.id ?? ''),
  );
  const [rawTraspasado, setTraspasado] = useSyncedPref(
    'cuenta-comun-traspasado',
  );
  const traspasado = leerTraspasados(rawTraspasado)[month] === true;

  const { data: movimientos } = useDatosCuentaComun(
    destino?.id,
    month,
    MESES_PREVISTO,
  );
  const { previsto } = useMemo(
    () =>
      gastoPrevisto(
        movimientos?.salidas ?? {},
        monthUtils.rangeInclusive(
          monthUtils.subMonths(month, MESES_PREVISTO),
          monthUtils.subMonths(month, 1),
        ),
      ),
    [movimientos, month],
  );
  const gastado = movimientos?.salidas[month] ?? 0;
  const { fraccion, cubre } = cobertura(saldo ?? 0, previsto);
  const sugerido = useMemo(
    () =>
      traspasado || !movimientos
        ? null
        : sugerirTraspaso(
            movimientos.entradas,
            importe,
            monthUtils.currentDay(),
            monthUtils.subMonths(month, 1),
          ),
    [traspasado, movimientos, importe, month],
  );

  const accion = (
    <AccionTexto onPress={() => setConfigurando(c => !c)}>
      {configurando ? <Trans>Done</Trans> : <Trans>Categories</Trans>}
    </AccionTexto>
  );

  if (elegidas.length === 0 && !configurando) {
    return (
      <Tarjeta
        titulo={t('Joint account')}
        accion={accion}
        sinTarjeta
        data-testid="inicio-cuenta-comun"
      >
        <EstadoVacio
          anchoIlustracion={96}
          titulo={t('How much to deposit?')}
          texto={t(
            'Choose the categories paid from the joint account to see how much to deposit each month.',
          )}
          accion={
            <Boton variante="primario" onPress={anadirCategoria}>
              <Trans>Choose categories</Trans>
            </Boton>
          }
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo={t('Joint account')}
      accion={accion}
      data-testid="inicio-cuenta-comun"
    >
      <Fila style={{ minHeight: 0 }}>
        <View
          style={{
            ...estilos.filaTexto,
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.icono,
            opacity: traspasado ? 0.55 : 1,
          }}
        >
          <IconoCaja icono="users" tono="acento" size={36} />
          <View style={estilos.filaTexto}>
            <Text style={estilos.etiquetaPequena}>
              <Trans>Deposit this month</Trans>
            </Text>
            <PrivacyFilter>
              <Text style={estilos.cifra} data-testid="cuenta-comun-importe">
                {format(importe, 'financial')}
              </Text>
            </PrivacyFilter>
          </View>
        </View>
        <Button
          variant="bare"
          aria-pressed={traspasado}
          aria-label={t('Transferred')}
          data-testid="cuenta-comun-traspasado"
          onPress={() =>
            setTraspasado(marcarTraspasado(rawTraspasado, month, !traspasado))
          }
          style={{
            minHeight: TACTIL,
            padding: '0 12px',
            borderRadius: radio.pildora,
            gap: 6,
            fontSize: 13,
            fontWeight: 800,
            backgroundColor: traspasado ? color.okSoft : color.surface2,
            color: traspasado ? color.ok : color.fg2,
          }}
        >
          {traspasado ? (
            <Icono nombre="check" size={16} />
          ) : (
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                border: `2px solid ${color.line2}`,
              }}
            />
          )}
          {traspasado ? t('✓ Transferred') : t('Transferred')}
        </Button>
      </Fila>

      {sugerido && (
        <Text style={estilos.filaSub} data-testid="cuenta-comun-sugerencia">
          {t('Looks like you already did it on {{date}} ({{amount}})', {
            date: monthUtils.format(sugerido.date, 'd MMM', locale),
            amount: format(sugerido.amount, 'financial'),
          })}
        </Text>
      )}

      <View
        style={{ gap: espacio.fila, opacity: traspasado ? 0.55 : 1 }}
        data-testid="cuenta-comun-cobertura"
      >
        <View style={{ flexDirection: 'row', gap: espacio.icono }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={estilos.resumenEtiqueta}>
              <Trans>Expected spending</Trans>
            </Text>
            <PrivacyFilter>
              <Text
                style={estilos.resumenValor}
                data-testid="cuenta-comun-previsto"
              >
                {format(previsto, 'financial')}
              </Text>
            </PrivacyFilter>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={estilos.resumenEtiqueta}>
              <Trans>Balance</Trans>
            </Text>
            <PrivacyFilter>
              <Text
                style={estilos.resumenValor}
                data-testid="cuenta-comun-saldo"
              >
                {format(saldo ?? 0, 'financial')}
              </Text>
            </PrivacyFilter>
          </View>
        </View>
        {previsto > 0 && (
          <BarraProgreso
            valor={fraccion}
            color={cubre ? color.ok : color.warn}
            aria-label={t('Balance covers expected spending')}
          />
        )}
        {tamano !== 'compacto' && previsto > 0 && (
          <Text style={estilos.filaSub} data-testid="cuenta-comun-llevas">
            {t('So far {{spent}} of {{expected}}', {
              spent: format(gastado, 'financial'),
              expected: format(previsto, 'financial'),
            })}
          </Text>
        )}
      </View>

      {(tamano === 'grande' || configurando) && (
        <View>
          {elegidas.map(c => (
            <Fila key={c.id} separada style={{ minHeight: 48 }}>
              <TextOneLine
                style={{ ...estilos.filaTitulo, flex: 1, fontWeight: 700 }}
              >
                {c.name}
              </TextOneLine>
              <PrivacyFilter>
                <Pildora estado="neutro">
                  {format(datos.get(c.id)?.budgeted ?? 0, 'financial')}
                </Pildora>
              </PrivacyFilter>
              {configurando && (
                <Button
                  variant="bare"
                  aria-label={t('Remove {{name}}', { name: c.name })}
                  onPress={() => guardar(alternarCategoriaComun(ids, c.id))}
                  style={estilos.botonIcono}
                >
                  <Icono nombre="x" size={18} />
                </Button>
              )}
            </Fila>
          ))}
        </View>
      )}

      {configurando && (
        <Boton variante="fantasma" onPress={anadirCategoria}>
          <Icono nombre="plus" size={18} />
          <Trans>Add a category</Trans>
        </Boton>
      )}
    </Tarjeta>
  );
}
