import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { sync } from '#app/appSlice';
import { prewarmMonth } from '#components/budget/util';
import { MobilePageHeader, Page } from '#components/Page';
import { SyncRefresh } from '#components/SyncRefresh';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useDispatch } from '#redux';

import { EstadoVacio } from './comunes';
import { EditarInicio } from './EditarInicio';
import { estilos } from './inicio.estilos';
import type { IdWidget } from './modeloWidgets';
import { useInicioWidgets } from './useInicioWidgets';
import { useModuloConsejos } from './widgets/Consejos';
import { COMPONENTES_WIDGET, SOLO_SOBRES } from './widgets/registro';

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

  return (
    <Page
      header={
        <MobilePageHeader
          title={
            <TextOneLine>
              <Trans>Home</Trans>
            </TextOneLine>
          }
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
            <View style={estilos.pagina}>
              <Cabecera
                month={month}
                locale={locale}
                editando={editando}
                onEditar={() => setEditando(e => !e)}
              />
              {editando ? (
                <EditarInicio
                  widgets={widgets}
                  onChange={guardar}
                  onRestablecer={restablecer}
                  noDisponibles={noDisponibles}
                />
              ) : (
                initialized && (
                  <View style={estilos.lista} data-testid="inicio-widgets">
                    {visibles.length === 0 ? (
                      <EstadoVacio
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
                )
              )}
            </View>
          )}
        </SyncRefresh>
      </SheetNameProvider>
    </Page>
  );
}

/** «Octubre» en grande, «día 2 de 31» y el botón «Editar» / «Listo». */
function Cabecera({
  month,
  locale,
  editando,
  onEditar,
}: {
  month: string;
  locale: ReturnType<typeof useLocale>;
  editando: boolean;
  onEditar: () => void;
}) {
  const { t } = useTranslation();
  const hoy = new Date();
  const dia = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return (
    <View style={estilos.cabecera}>
      <View style={{ minWidth: 0 }}>
        <Text style={estilos.cabeceraDia}>
          {t('day {{day}} of {{days}}', { day: dia, days: diasMes })}
        </Text>
        <Text style={estilos.cabeceraMes} data-testid="inicio-mes">
          {monthUtils.format(month, 'MMMM', locale)}
        </Text>
      </View>
      <Button
        variant={editando ? 'primary' : 'bare'}
        onPress={onEditar}
        style={estilos.botonCabecera}
        aria-label={editando ? t('Done editing home') : t('Edit home')}
      >
        {editando ? <Trans>Done</Trans> : <Trans>Edit</Trans>}
      </Button>
    </View>
  );
}
