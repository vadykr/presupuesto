import type { DragItem } from 'react-aria';
import {
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { Boton } from '#components/mobile/ui/Boton';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Icono } from '#components/mobile/ui/Icono';
import type { NombreIcono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import { color, espacio, movimiento } from '#components/mobile/ui/tokens';

import { estilos } from './inicio.estilos';
import {
  anadirWidget,
  cambiarTamano,
  esIdWidget,
  moverWidget,
  quitarWidget,
  reordenarWidget,
  TAMANOS,
  widgetsDisponibles,
} from './modeloWidgets';
import type { IdWidget, WidgetInicio } from './modeloWidgets';
import {
  descripcionWidget,
  nombreTamano,
  nombreWidget,
} from './widgets/registro';

/** Icono de cada widget en la lista de «Añadir». */
const ICONO_WIDGET: Record<IdWidget, NombreIcono> = {
  'por-hacer': 'check',
  fijadas: 'target',
  'cuenta-comun': 'users',
  consejos: 'bulb',
  'resumen-mes': 'pie',
  deudas: 'bank',
  'gasto-mes': 'receipt',
  huchas: 'piggy',
};

const claseItem = css({
  ...estiloTarjeta('normal', 0),
  ...estilos.editarItem,
  outline: 'none',
  transition: `opacity ${movimiento.fondo}ms, box-shadow ${movimiento.fondo}ms`,
  '&[data-dragging]': { opacity: 0.5 },
  '&[data-focus-visible]': { boxShadow: `0 0 0 2px ${color.accent}` },
});

const claseLista = css({ display: 'flex', flexDirection: 'column' });

/**
 * Modo «Editar inicio»: reordenar (arrastrar el asa, o ▲▼), cambiar el
 * tamaño (compacto / normal / grande), quitar y añadir widgets. Cada cambio
 * se guarda al momento en la preferencia sincronizada.
 */
export function EditarInicio({
  widgets,
  onChange,
  onRestablecer,
  noDisponibles,
}: {
  widgets: readonly WidgetInicio[];
  onChange: (lista: WidgetInicio[]) => void;
  onRestablecer: () => void;
  /** Widgets que no se pintan en este presupuesto (p. ej. sin análisis). */
  noDisponibles: ReadonlySet<IdWidget>;
}) {
  const { t } = useTranslation();

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => ({ 'text/plain': String(key) }) satisfies DragItem),
    renderDropIndicator: target => (
      <DropIndicator
        target={target}
        className={css({
          '&[data-drop-target]': {
            height: 4,
            marginBottom: 10,
            backgroundColor: color.accent,
            borderRadius: 4,
          },
        })}
      />
    ),
    onReorder: e => {
      const [key] = e.keys;
      const destino = e.target.key;
      if (
        esIdWidget(key) &&
        esIdWidget(destino) &&
        e.target.dropPosition !== 'on'
      ) {
        onChange(reordenarWidget(widgets, key, destino, e.target.dropPosition));
      }
    },
  });

  const disponibles = widgetsDisponibles(widgets);

  return (
    <View
      style={{ padding: `0 ${espacio.margen}px`, flexShrink: 0 }}
      data-testid="inicio-editar"
    >
      <Text style={estilos.editarSeccion}>
        <Trans>On your home</Trans>
      </Text>
      {widgets.length === 0 ? (
        <EstadoVacio
          ilustracion="barquito"
          titulo={t('Your home is empty')}
          texto={t('Your home is empty. Add a widget below.')}
        />
      ) : (
        <GridList
          aria-label={t('Home widgets')}
          items={widgets}
          dragAndDropHooks={dragAndDropHooks}
          dependencies={[widgets, noDisponibles]}
          className={claseLista}
        >
          {w => {
            const i = widgets.findIndex(x => x.id === w.id);
            const nombre = nombreWidget(t, w.id);
            return (
              <GridListItem id={w.id} textValue={nombre} className={claseItem}>
                <Button
                  slot="drag"
                  variant="bare"
                  aria-label={t('Drag {{name}}', { name: nombre })}
                  style={{
                    ...estilos.botonIcono,
                    color: color.fg3,
                    cursor: 'grab',
                  }}
                >
                  <Icono nombre="grip" size={20} />
                </Button>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Text style={estilos.editarNombre}>
                    {nombre}
                    {noDisponibles.has(w.id) && (
                      <Text style={{ ...estilos.filaSub, marginLeft: 6 }}>
                        {t('(not available)')}
                      </Text>
                    )}
                  </Text>
                  <View
                    style={estilos.segmentado}
                    role="group"
                    aria-label={t('Size of {{name}}', { name: nombre })}
                  >
                    {TAMANOS.map(tam => (
                      <Button
                        key={tam}
                        variant="bare"
                        aria-pressed={w.tamano === tam}
                        aria-label={`${nombre}: ${nombreTamano(t, tam)}`}
                        onPress={() =>
                          onChange(cambiarTamano(widgets, w.id, tam))
                        }
                        style={{
                          ...estilos.segmento,
                          flex: 1,
                          ...(w.tamano === tam ? estilos.segmentoActivo : null),
                        }}
                      >
                        {nombreTamano(t, tam)}
                      </Button>
                    ))}
                  </View>
                </View>
                <View>
                  <Button
                    variant="bare"
                    aria-label={t('Move {{name}} up', { name: nombre })}
                    isDisabled={i <= 0}
                    onPress={() => onChange(moverWidget(widgets, w.id, -1))}
                    style={{ ...estilos.botonIcono, opacity: i <= 0 ? 0.3 : 1 }}
                  >
                    <Icono nombre="cu" size={20} />
                  </Button>
                  <Button
                    variant="bare"
                    aria-label={t('Move {{name}} down', { name: nombre })}
                    isDisabled={i >= widgets.length - 1}
                    onPress={() => onChange(moverWidget(widgets, w.id, 1))}
                    style={{
                      ...estilos.botonIcono,
                      opacity: i >= widgets.length - 1 ? 0.3 : 1,
                    }}
                  >
                    <Icono nombre="cd" size={20} />
                  </Button>
                </View>
                <Button
                  variant="bare"
                  aria-label={t('Remove {{name}}', { name: nombre })}
                  onPress={() => onChange(quitarWidget(widgets, w.id))}
                  style={({ isPressed }) => ({
                    ...estilos.botonIcono,
                    color: color.bad,
                    backgroundColor: isPressed ? color.badSoft : undefined,
                  })}
                >
                  <Icono nombre="x" size={20} />
                </Button>
              </GridListItem>
            );
          }}
        </GridList>
      )}

      {disponibles.length > 0 && (
        <>
          <Text style={estilos.editarSeccion}>
            <Trans>Add widgets</Trans>
          </Text>
          {disponibles.map(id => (
            <View
              key={id}
              style={{
                ...estiloTarjeta('normal', 0),
                ...estilos.editarItem,
                padding: '10px 8px 10px 12px',
                gap: espacio.icono,
              }}
            >
              <IconoCaja icono={ICONO_WIDGET[id]} tono="neutro" size={40} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={estilos.editarNombre}>{nombreWidget(t, id)}</Text>
                <Text style={estilos.filaSub}>{descripcionWidget(t, id)}</Text>
              </View>
              <Button
                variant="bare"
                aria-label={t('Add {{name}}', { name: nombreWidget(t, id) })}
                onPress={() => onChange(anadirWidget(widgets, id))}
                style={({ isPressed }) => ({
                  ...estilos.botonIcono,
                  backgroundColor: color.accentSoft,
                  color: color.accent,
                  borderRadius: '50%',
                  transform: isPressed ? 'scale(0.92)' : undefined,
                  transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
                })}
              >
                <Icono nombre="plus" size={22} />
              </Button>
            </View>
          ))}
        </>
      )}

      <Boton
        variante="fantasma"
        onPress={onRestablecer}
        style={{ alignSelf: 'center', marginTop: 8 }}
      >
        <Icono nombre="refresh" size={18} />
        <Trans>Restore default home</Trans>
      </Boton>
    </View>
  );
}
