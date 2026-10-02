import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { sync } from '#app/appSlice';
import { prewarmMonth } from '#components/budget/util';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Boton } from '#components/mobile/ui/Boton';
import { BotonRedondo, Cabecera } from '#components/mobile/ui/Cabecera';
import { Cargando } from '#components/mobile/ui/Cargando';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { color, espacio, radio, sombra } from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
import { SyncRefresh } from '#components/SyncRefresh';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useDispatch } from '#redux';

import { EditarInicio } from './EditarInicio';
import { entradaEscalonada, estilos } from './inicio.estilos';
import type { IdWidget } from './modeloWidgets';
import { useInicioWidgets } from './useInicioWidgets';
import { useModuloConsejos } from './widgets/Consejos';
import { COMPONENTES_WIDGET, SOLO_SOBRES } from './widgets/registro';

const claseLista = css(entradaEscalonada);

/**
 * Pantalla de inicio de «Presupuesto» (solo móvil), personalizable: una lista
 * de widgets (Por hacer, Fijadas, Cuenta común, Consejos, Resumen, Deudas,
 * Gasto del mes, Huchas) con su orden y tamaño en la preferencia sincronizada
 * `inicio-widgets`. «Editar» abre el modo para reordenar, añadir y quitar.
 */
export function InicioPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const spreadsheet = useSpreadsheet();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const { widgets, guardar, restablecer } = useInicioWidgets();
  const [editando, setEditando] = useState(false);

  const month = monthUtils.currentMonth();
  const sheetName = monthUtils.sheetForMonth(month);

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void prewarmMonth(budgetType, spreadsheet, month).then(() => {
      if (!cancelled) {
        setInitialized(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [budgetType, spreadsheet, month]);

  // Widgets que no se pintan aquí: los de sobres si el presupuesto es de
  // seguimiento, y «Consejos» si el módulo de análisis no está.
  const moduloConsejos = useModuloConsejos();
  const noDisponibles = useMemo(() => {
    const set = new Set<IdWidget>();
    if (budgetType !== 'envelope') {
      SOLO_SOBRES.forEach(id => set.add(id));
    }
    if (moduloConsejos === null) {
      set.add('consejos');
    }
    return set;
  }, [budgetType, moduloConsejos]);

  const visibles = widgets.filter(w => !noDisponibles.has(w.id));

  const hoy = new Date();
  const dia = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

  return (
    <Page
      header={
        <Cabecera
          titulo={
            <span
              data-testid="inicio-mes"
              style={{ textTransform: 'capitalize' }}
            >
              {monthUtils.format(month, 'MMMM', locale)}
            </span>
          }
          subtitulo={t('day {{day}} of {{days}}', { day: dia, days: diasMes })}
          derecha={
            <>
              <Boton
                variante={editando ? 'primario' : 'fantasma'}
                onPress={() => setEditando(e => !e)}
                aria-label={editando ? t('Done editing home') : t('Edit home')}
                style={
                  editando
                    ? { borderRadius: radio.pildora }
                    : {
                        borderRadius: radio.pildora,
                        backgroundColor: color.surface,
                        color: color.accent,
                        boxShadow: sombra.tarjeta,
                      }
                }
              >
                {editando ? <Trans>Done</Trans> : <Trans>Edit</Trans>}
              </Boton>
              <BotonRedondo
                icono="more"
                aria-label={t('More')}
                onPress={() => void navigate('/mas')}
              />
            </>
          }
          style={{ paddingBottom: 10 }}
        />
      }
      padding={0}
    >
      <SheetNameProvider name={sheetName}>
        <SyncRefresh
          onSync={async () => {
            await dispatch(sync());
          }}
        >
          {() => (
            <View
              style={{
                paddingBottom: MOBILE_NAV_HEIGHT + espacio.margen,
                flexShrink: 0,
              }}
            >
              {editando ? (
                <EditarInicio
                  widgets={widgets}
                  onChange={guardar}
                  onRestablecer={restablecer}
                  noDisponibles={noDisponibles}
                />
              ) : !initialized ? (
                <Cargando />
              ) : (
                <View
                  style={estilos.lista}
                  className={claseLista}
                  data-testid="inicio-widgets"
                >
                  {visibles.length === 0 ? (
                    <EstadoVacio
                      ilustracion="barquito"
                      titulo={t('Your home is empty')}
                      texto={t(
                        'Nothing on your home. Tap «Edit» to add widgets.',
                      )}
                    />
                  ) : (
                    visibles.map(w => {
                      const Widget = COMPONENTES_WIDGET[w.id];
                      return (
                        <Widget key={w.id} tamano={w.tamano} month={month} />
                      );
                    })
                  )}
                </View>
              )}
            </View>
          )}
        </SyncRefresh>
      </SheetNameProvider>
    </Page>
  );
}
