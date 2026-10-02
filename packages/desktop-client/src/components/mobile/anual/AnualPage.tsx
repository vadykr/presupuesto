import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { Checkbox } from '#components/forms';
import { ModalLocal } from '#components/mobile/informes/ModalLocal';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import { BotonRedondo, TituloSeccion } from '#components/mobile/ui/Cabecera';
import { Cargando } from '#components/mobile/ui/Cargando';
import { separarEmoji } from '#components/mobile/ui/emoji';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Importe } from '#components/mobile/ui/Importe';
import { Pildora } from '#components/mobile/ui/Pildora';
import type { EstadoPildora } from '#components/mobile/ui/Pildora';
import { Tarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  espacio,
  num,
  radio,
  sombra,
  texto,
} from '#components/mobile/ui/tokens';
import { Page } from '#components/Page';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

import { agruparPorMes } from './anual';
import type { EstadoAnual, FilaAnual } from './anual';
import { useAnual, useGruposAnuales, useOcultarEnPlan } from './useAnual';

const PILDORA: Record<EstadoAnual, EstadoPildora> = {
  'al-dia': 'ok',
  faltan: 'aviso',
  atrasada: 'rojo',
  cubierta: 'neutro',
  'sin-objetivo': 'neutro',
};

const COLOR_BARRA: Record<EstadoAnual, string> = {
  'al-dia': color.ok,
  faltan: color.warn,
  atrasada: color.bad,
  cubierta: color.fg3,
  'sin-objetivo': color.fg3,
};

/** Texto del estado de una fila («Al día», «Faltan 20 € este mes»…). */
export function useTextoEstadoAnual() {
  const { t } = useTranslation();
  const format = useFormat();
  return (fila: FilaAnual): string => {
    switch (fila.estado) {
      case 'al-dia':
        return t('On track');
      case 'faltan':
        return t('{{amount}} short this month', {
          amount: format(fila.faltaEsteMes, 'financial'),
        });
      case 'atrasada':
        return t('Behind: {{amount}} short', {
          amount: format(fila.faltaTotal, 'financial'),
        });
      case 'cubierta':
        return t('Covered');
      default:
        return t('No target');
    }
  };
}

/**
 * «Gasto anual» (`/anual`): lo que se paga una vez al año (IBI, seguro,
 * ITV…) apartado del presupuesto mensual. Cada categoría enseña su importe y
 * fecha, lo ahorrado, la cuota mensual y si va al día; agrupadas por mes de
 * vencimiento. Desde aquí se eligen los grupos «anuales» y si el Plan
 * pliega lo que ya está cubierto.
 */
export function AnualPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { filas, resumen, cargando } = useAnual();
  const [selectorAbierto, setSelectorAbierto] = useState(false);

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
              <Trans>Annual spending</Trans>
            </Text>
            <Text style={{ fontSize: 13, fontWeight: 700, color: color.fg3 }}>
              <Trans>Apart from the monthly budget</Trans>
            </Text>
          </View>
          <BotonRedondo
            icono="sliders"
            aria-label={t('Choose annual groups')}
            onPress={() => setSelectorAbierto(true)}
          />
        </View>
      }
    >
      <View
        data-testid="anual"
        style={{
          gap: espacio.tarjetas,
          paddingBottom: MOBILE_NAV_HEIGHT + espacio.margen,
          flexShrink: 0,
        }}
      >
        {cargando ? (
          <Cargando />
        ) : (
          <>
            <Cabecera
              ahorrado={resumen.ahorrado}
              objetivo={resumen.objetivo}
              esteMes={resumen.esteMes}
            />
            <AjusteOcultar />
            {filas.length === 0 ? (
              <View style={{ padding: `0 ${espacio.margen}px` }}>
                <EstadoVacio
                  ilustracion="barquito"
                  titulo={t('Nothing annual yet')}
                  texto={t(
                    'Give a category a yearly target (Target → Every year) or pick a group like "Annual bills" with the button above.',
                  )}
                  accion={
                    <Boton
                      variante="primario"
                      onPress={() => setSelectorAbierto(true)}
                    >
                      <Trans>Choose groups</Trans>
                    </Boton>
                  }
                />
              </View>
            ) : (
              <Meses filas={filas} />
            )}
          </>
        )}
      </View>
      <SelectorGrupos
        abierto={selectorAbierto}
        onClose={() => setSelectorAbierto(false)}
      />
    </Page>
  );
}

function Cabecera({
  ahorrado,
  objetivo,
  esteMes,
}: {
  ahorrado: number;
  objetivo: number;
  esteMes: number;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <View
      data-testid="anual-cabecera"
      style={{
        flexShrink: 0,
        margin: `4px ${espacio.margen}px 0`,
        padding: '18px 18px 18px',
        borderRadius: radio.heroe,
        gap: 4,
        boxShadow: sombra.tarjeta,
        background: `linear-gradient(150deg, ${color.heroA}, ${color.heroB})`,
        color: color.heroFg,
      }}
    >
      <Text
        style={{
          ...texto.etiqueta,
          color: 'inherit',
          opacity: 0.85,
        }}
      >
        <Trans>Saved / this year&apos;s total</Trans>
      </Text>
      <Text
        style={{
          ...num,
          ...texto.cifra,
          lineHeight: 1.1,
          color: 'inherit',
        }}
        data-testid="anual-total"
      >
        <Importe valor={ahorrado} style={{ color: 'inherit' }} />
        <Text style={{ opacity: 0.7, color: 'inherit', fontWeight: 700 }}>
          {' / '}
        </Text>
        <Importe
          valor={objetivo}
          style={{ color: 'inherit', fontSize: 20, opacity: 0.85 }}
        />
      </Text>
      <BarraProgreso
        valor={objetivo > 0 ? ahorrado / objetivo : 0}
        color={color.heroFg}
        style={{
          marginTop: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
        aria-label={t('Saved of the yearly total')}
      />
      <Text
        style={{
          ...num,
          marginTop: 8,
          alignSelf: 'flex-start',
          fontSize: 13.5,
          fontWeight: 700,
          color: 'inherit',
          backgroundColor: 'rgba(0, 0, 0, 0.18)',
          borderRadius: radio.pildora,
          padding: '6px 12px',
        }}
        data-testid="anual-este-mes"
      >
        {esteMes > 0
          ? t('This month: {{amount}} to set aside', {
              amount: format(esteMes, 'financial'),
            })
          : t('Nothing to set aside this month')}
      </Text>
    </View>
  );
}

function AjusteOcultar() {
  const { ocultar, guardar } = useOcultarEnPlan();
  const { t } = useTranslation();
  return (
    <Tarjeta
      style={{
        margin: `0 ${espacio.margen}px`,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.icono,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...texto.fila, color: color.fg }}>
          <Trans>Fold in the Plan when on track</Trans>
        </Text>
        <Text style={{ fontSize: 12.5, color: color.fg3, fontWeight: 600 }}>
          <Trans>
            While it&apos;s covered, the Plan shows it as a single line.
          </Trans>
        </Text>
      </View>
      <Toggle
        id="anual-ocultar-en-plan"
        isOn={ocultar}
        onToggle={guardar}
        aria-label={t('Fold annual spending that is on track in the Plan')}
      />
    </Tarjeta>
  );
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Meses({ filas }: { filas: FilaAnual[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const grupos = agruparPorMes(filas);
  const anioActual = monthUtils.currentMonth().slice(0, 4);
  return (
    <>
      {grupos.map(({ mes, filas: lista }) => (
        <View key={mes ?? 'sin-fecha'} style={{ gap: 6, flexShrink: 0 }}>
          <TituloSeccion>
            <Text data-testid="anual-mes">
              {mes == null
                ? t('No date')
                : mayuscula(
                    monthUtils.format(
                      mes,
                      mes.startsWith(anioActual) ? 'MMMM' : 'MMMM yyyy',
                      locale,
                    ),
                  )}
            </Text>
          </TituloSeccion>
          <Tarjeta
            relleno={0}
            style={{ margin: `0 ${espacio.margen}px` }}
            data-testid="anual-tarjeta"
          >
            {lista.map((fila, i) => (
              <FilaCategoria key={fila.id} fila={fila} primera={i === 0} />
            ))}
          </Tarjeta>
        </View>
      ))}
    </>
  );
}

function FilaCategoria({
  fila,
  primera,
}: {
  fila: FilaAnual;
  primera: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const navigate = useNavigate();
  const textoEstado = useTextoEstadoAnual();
  const { emoji, resto } = separarEmoji(fila.nombre);

  const detalle =
    fila.importe != null && fila.vence != null
      ? t('{{amount}} on {{date}}', {
          amount: format(fila.importe, 'financial'),
          date: monthUtils.format(fila.vence, 'd MMM', locale),
        })
      : t('{{group}} · set a yearly target', { group: fila.grupoNombre });

  return (
    <Button
      variant="bare"
      onPress={() =>
        void navigate(
          `/categories/${fila.id}/objetivo?month=${monthUtils.currentMonth()}`,
        )
      }
      aria-label={t('Target of {{categoryName}}', {
        categoryName: fila.nombre,
      })}
      data-testid="anual-fila"
      data-estado={fila.estado}
      style={{
        display: 'flex',
        flexShrink: 0,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 0,
        borderTop: primera ? undefined : `1px solid ${color.line}`,
        textAlign: 'left',
        color: color.fg,
        backgroundColor: 'transparent',
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
            gap: 8,
          }}
        >
          {emoji && (
            <Text
              aria-hidden
              style={{ fontSize: 18, width: 24, textAlign: 'center' }}
            >
              {emoji}
            </Text>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                ...styles.lineClamp(2),
                fontSize: 14.5,
                fontWeight: 700,
                color: color.fg,
              }}
            >
              {emoji ? resto : fila.nombre}
            </Text>
            <Text
              style={{
                ...num,
                fontSize: 12.5,
                fontWeight: 600,
                color: color.fg3,
              }}
            >
              {detalle}
            </Text>
          </View>
        </View>
        <Pildora estado={PILDORA[fila.estado]} data-testid="anual-estado">
          {textoEstado(fila)}
        </Pildora>
      </View>
      {fila.importe != null && (
        <>
          <BarraProgreso
            valor={fila.progreso}
            color={COLOR_BARRA[fila.estado]}
            aria-label={t('Saved for {{categoryName}}', {
              categoryName: fila.nombre,
            })}
          />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 8,
              ...num,
              fontSize: 12.5,
              fontWeight: 700,
              color: color.fg2,
            }}
          >
            <Text>
              {t('Saved {{amount}}', {
                amount: format(fila.ahorrado, 'financial'),
              })}
            </Text>
            {fila.estado !== 'cubierta' && fila.cuota > 0 && (
              <Text>
                {t('{{amount}} a month', {
                  amount: format(fila.cuota, 'financial'),
                })}
              </Text>
            )}
          </View>
        </>
      )}
    </Button>
  );
}

/** Hoja para marcar qué grupos cuentan como «gasto anual». */
function SelectorGrupos({
  abierto,
  onClose,
}: {
  abierto: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: { grouped } = { grouped: [] } } = useCategories();
  const { grupos, guardar } = useGruposAnuales();
  const marcados = new Set(grupos);

  function alternar(id: string) {
    const nuevos = new Set(marcados);
    if (nuevos.has(id)) {
      nuevos.delete(id);
    } else {
      nuevos.add(id);
    }
    guardar(nuevos);
  }

  return (
    <ModalLocal
      titulo={t('Annual groups')}
      abierto={abierto}
      onClose={onClose}
      data-testid="modal-grupos-anuales"
      pie={
        <Button variant="primary" onPress={onClose}>
          <Trans>Done</Trans>
        </Button>
      }
    >
      <Text
        style={{
          ...styles.smallText,
          color: theme.pageTextSubdued,
          padding: '0 16px 8px',
        }}
      >
        <Trans>
          Every category in a checked group shows up here. Categories with a
          yearly target appear anyway.
        </Trans>
      </Text>
      {grouped
        .filter(g => !g.is_income && !g.hidden)
        .map(grupo => (
          <label
            key={grupo.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 48,
              padding: '0 16px',
              borderTop: `1px solid ${theme.tableBorder}`,
            }}
          >
            <Checkbox
              checked={marcados.has(grupo.id)}
              onChange={() => alternar(grupo.id)}
            />
            <Text style={{ ...styles.mediumText, fontWeight: 600, flex: 1 }}>
              {grupo.name}
            </Text>
            <Text style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
              {t('{{count}} categories', {
                count: grupo.categories?.length ?? 0,
              })}
            </Text>
          </label>
        ))}
    </ModalLocal>
  );
}
