import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgClose, SvgUserGroup } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import {
  CajaIcono,
  EstadoVacio,
  Fila,
  Pildora,
  Tarjeta,
} from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import {
  alternarCategoriaComun,
  cuentasDelTraspaso,
  enlaceTraspaso,
  importeCuentaComun,
  leerCategoriasComunes,
} from '#components/mobile/inicio/cuentaComun';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

/**
 * «Cuenta común · ingresar X»: lo asignado este mes en las categorías de la
 * cuenta común (preferencia `cuenta-comun-categorias`), con un botón que abre
 * el traspaso Cuenta Personal → Conte conjunt ya rellenado.
 *
 * Tamaños: compacto = importe y botón; normal = + explicación; grande = +
 * desglose por categoría.
 */
export function CuentaComun({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const navigate = useNavigate();
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

  const nombreMes = monthUtils.format(month, 'MMMM', locale);
  const irAlTraspaso = (origen: string, destino: string) =>
    void navigate(
      enlaceTraspaso({
        origen,
        destino,
        importe,
        nota: t('Joint account · {{month}}', { month: nombreMes }),
      }),
    );

  const elegirCuenta = (siguiente: (nombre: string) => void) =>
    dispatch(
      pushModal({
        modal: {
          name: 'account-autocomplete',
          options: { onSelect: (_id, nombre) => siguiente(nombre) },
        },
      }),
    );

  const registrarTraspaso = () => {
    const { origen, destino } = cuentasDelTraspaso(cuentas);
    if (origen && destino) {
      irAlTraspaso(origen.name, destino.name);
    } else if (origen) {
      elegirCuenta(d => irAlTraspaso(origen.name, d));
    } else if (destino) {
      elegirCuenta(o => irAlTraspaso(o, destino.name));
    } else {
      elegirCuenta(o => elegirCuenta(d => irAlTraspaso(o, d)));
    }
  };

  const accion = (
    <Button
      variant="bare"
      onPress={() => setConfigurando(c => !c)}
      style={estilos.botonCabecera}
    >
      {configurando ? <Trans>Done</Trans> : <Trans>Categories</Trans>}
    </Button>
  );

  if (elegidas.length === 0 && !configurando) {
    return (
      <Tarjeta
        titulo={t('Joint account')}
        accion={accion}
        data-testid="inicio-cuenta-comun"
      >
        <EstadoVacio
          texto={t(
            'Choose the categories paid from the joint account to see how much to deposit each month.',
          )}
        >
          <Button
            variant="primary"
            onPress={anadirCategoria}
            style={estilos.boton}
          >
            <Trans>Choose categories</Trans>
          </Button>
        </EstadoVacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo={t('Joint account')}
      accion={accion}
      data-testid="inicio-cuenta-comun"
    >
      <Fila>
        {tamano !== 'compacto' && (
          <CajaIcono>
            <SvgUserGroup width={18} height={18} />
          </CajaIcono>
        )}
        <View style={estilos.filaTexto}>
          <Text style={estilos.filaSub}>
            <Trans>Deposit this month</Trans>
          </Text>
          <PrivacyFilter>
            <Text style={estilos.cifra} data-testid="cuenta-comun-importe">
              {format(importe, 'financial')}
            </Text>
          </PrivacyFilter>
        </View>
        {tamano === 'compacto' && (
          <Button
            variant="primary"
            onPress={registrarTraspaso}
            style={estilos.boton}
          >
            <Trans>Transfer now</Trans>
          </Button>
        )}
      </Fila>

      {tamano !== 'compacto' && (
        <Text style={estilos.filaSub}>
          {t('Assigned this month in {{count}} joint account category', {
            count: elegidas.length,
          })}
        </Text>
      )}

      {(tamano === 'grande' || configurando) && (
        <View>
          {elegidas.map(c => (
            <Fila key={c.id} separada style={{ minHeight: 40 }}>
              <TextOneLine
                style={{ ...estilos.filaTitulo, flex: 1, fontWeight: 600 }}
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
                  <SvgClose width={10} height={10} />
                </Button>
              )}
            </Fila>
          ))}
        </View>
      )}

      {configurando ? (
        <Button
          variant="normal"
          onPress={anadirCategoria}
          style={estilos.boton}
        >
          <Trans>Add a category</Trans>
        </Button>
      ) : (
        tamano !== 'compacto' && (
          <Button
            variant="primary"
            onPress={registrarTraspaso}
            style={estilos.boton}
          >
            <Trans>Record transfer</Trans>
          </Button>
        )
      )}
    </Tarjeta>
  );
}
