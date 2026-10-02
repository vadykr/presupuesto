import type { DragItem } from 'react-aria';
import {
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgAddOutline,
  SvgCheveronDown,
  SvgCheveronUp,
  SvgClose,
  SvgMenu,
} from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { EstadoVacio } from './comunes';
import { colores, estilos } from './inicio.estilos';
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
            marginBottom: 8,
            backgroundColor: colores.acento,
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
    <View style={{ padding: '4px 10px 0' }} data-testid="inicio-editar">
      <Text style={estilos.seccion}>
        <Trans>On your home</Trans>
      </Text>
      {widgets.length === 0 ? (
        <EstadoVacio texto={t('Your home is empty. Add a widget below.')} />
      ) : (
        <GridList
          aria-label={t('Home widgets')}
          items={widgets}
          dragAndDropHooks={dragAndDropHooks}
          dependencies={[widgets, noDisponibles]}
          className={css({ display: 'flex', flexDirection: 'column' })}
        >
          {w => {
            const i = widgets.findIndex(x => x.id === w.id);
            const nombre = nombreWidget(t, w.id);
            return (
              <GridListItem
                id={w.id}
                textValue={nombre}
                className={css({
                  ...estilos.editarItem,
                  outline: 'none',
                  '&[data-dragging]': { opacity: 0.5 },
                  '&[data-focus-visible]': {
                    boxShadow: `0 0 0 2px ${colores.acento}`,
                  },
                })}
              >
                <Button
                  slot="drag"
                  variant="bare"
                  aria-label={t('Drag {{name}}', { name: nombre })}
                  style={{ ...estilos.botonIcono, cursor: 'grab' }}
                >
                  <SvgMenu width={14} height={14} />
                </Button>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
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
                          color: colores.textoSuave,
                          ...(w.tamano === tam ? estilos.segmentoActivo : null),
                        }}
                      >
                        {nombreTamano(t, tam)}
                      </Button>
                    ))}
                  </View>
                </View>
                <View style={{ gap: 2 }}>
                  <Button
                    variant="bare"
                    aria-label={t('Move {{name}} up', { name: nombre })}
                    isDisabled={i <= 0}
                    onPress={() => onChange(moverWidget(widgets, w.id, -1))}
                    style={estilos.botonIcono}
                  >
                    <SvgCheveronUp width={14} height={14} />
                  </Button>
                  <Button
                    variant="bare"
                    aria-label={t('Move {{name}} down', { name: nombre })}
                    isDisabled={i >= widgets.length - 1}
                    onPress={() => onChange(moverWidget(widgets, w.id, 1))}
                    style={estilos.botonIcono}
                  >
                    <SvgCheveronDown width={14} height={14} />
                  </Button>
                </View>
                <Button
                  variant="bare"
                  aria-label={t('Remove {{name}}', { name: nombre })}
                  onPress={() => onChange(quitarWidget(widgets, w.id))}
                  style={estilos.botonIcono}
                >
                  <SvgClose width={10} height={10} />
                </Button>
              </GridListItem>
            );
          }}
        </GridList>
      )}

      {disponibles.length > 0 && (
        <>
          <Text style={estilos.seccion}>
            <Trans>Add widgets</Trans>
          </Text>
          {disponibles.map(id => (
            <View key={id} style={estilos.editarItem}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={estilos.editarNombre}>{nombreWidget(t, id)}</Text>
                <Text style={estilos.filaSub}>{descripcionWidget(t, id)}</Text>
              </View>
              <Button
                variant="bare"
                aria-label={t('Add {{name}}', { name: nombreWidget(t, id) })}
                onPress={() => onChange(anadirWidget(widgets, id))}
                style={{ ...estilos.botonIcono, color: colores.acento }}
              >
                <SvgAddOutline width={20} height={20} />
              </Button>
            </View>
          ))}
        </>
      )}

      <Button
        variant="bare"
        onPress={onRestablecer}
        style={{ ...estilos.botonCabecera, alignSelf: 'center', marginTop: 8 }}
      >
        <Trans>Restore default home</Trans>
      </Button>
    </View>
  );
}
