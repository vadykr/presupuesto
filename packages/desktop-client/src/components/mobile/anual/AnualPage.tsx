import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { rutaFicha } from '#components/mobile/budget/useFichaCategoria';
import { ModalLocal } from '#components/mobile/informes/ModalLocal';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import { BotonRedondo, TituloSeccion } from '#components/mobile/ui/Cabecera';
import { Cargando } from '#components/mobile/ui/Cargando';
import { separarEmoji } from '#components/mobile/ui/emoji';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Importe } from '#components/mobile/ui/Importe';
import { Tarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  densidad,
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

import {
  agruparPorMes,
  conmutarCategoria,
  conmutarGrupo,
  estadoGrupo,
  incluida,
  seleccionInicial,
} from './anual';
import type { EstadoAnual, FilaAnual } from './anual';
import {
  useAnual,
  useGruposAnuales,
  useOcultarEnPlan,
  useSeleccionAnual,
} from './useAnual';

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

  // Segunda línea: estado en su color y, en gris, cuándo vence, lo ahorrado
  // y la cuota (o el grupo si aún no tiene objetivo anual).
  const detalle =
    fila.importe != null
      ? [
          fila.vence != null
            ? monthUtils.format(fila.vence, 'd MMM', locale)
            : null,
          t('Saved {{amount}}', {
            amount: format(fila.ahorrado, 'financial'),
          }),
          fila.estado !== 'cubierta' && fila.cuota > 0
            ? t('{{amount}} a month', {
                amount: format(fila.cuota, 'financial'),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('{{group}} · set a yearly target', { group: fila.grupoNombre });

  return (
    <Button
      variant="bare"
      onPress={() =>
        void navigate(rutaFicha(fila.id, monthUtils.currentMonth(), true))
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
        minHeight: densidad.altoFilaBarra,
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 4,
        padding: `8px ${densidad.margen}px`,
        borderRadius: 0,
        boxShadow: primera ? undefined : `inset 0 1px 0 ${color.line}`,
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
            gap: 6,
          }}
        >
          {emoji && (
            <Text aria-hidden style={{ ...densidad.emoji, flexShrink: 0 }}>
              {emoji}
            </Text>
          )}
          <Text
            data-testid="anual-nombre"
            style={{
              ...styles.lineClamp(2),
              ...densidad.nombre,
              flex: 1,
              color: color.fg,
            }}
          >
            {emoji ? resto : fila.nombre}
          </Text>
        </View>
        {fila.importe != null && (
          <Text
            data-testid="anual-importe"
            style={{ ...densidad.cifra, color: color.fg, flexShrink: 0 }}
          >
            {format(fila.importe, 'financial')}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            ...densidad.pequeno,
            ...num,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: color.fg3,
          }}
        >
          <Text
            data-testid="anual-estado"
            style={{ ...densidad.pequeno, color: COLOR_BARRA[fila.estado] }}
          >
            {textoEstado(fila)}
          </Text>
          {' · '}
          {detalle}
        </Text>
        {fila.importe != null && (
          <BarraProgreso
            valor={fila.progreso}
            color={COLOR_BARRA[fila.estado]}
            alto={5}
            style={{ width: densidad.colAsignado - 20 }}
            aria-label={t('Saved for {{categoryName}}', {
              categoryName: fila.nombre,
            })}
          />
        )}
      </View>
    </Button>
  );
}

type Marca = 'todas' | 'algunas' | 'ninguna';

/** Casilla de tres estados (marcada, intermedia, vacía). */
function Casilla({
  estado,
  onPress,
  etiqueta,
}: {
  estado: Marca;
  onPress: () => void;
  etiqueta: string;
}) {
  const activa = estado !== 'ninguna';
  return (
    <Button
      onPress={onPress}
      aria-label={etiqueta}
      aria-pressed={
        estado === 'todas' ? true : estado === 'algunas' ? 'mixed' : false
      }
      style={{
        width: 18,
        height: 18,
        minWidth: 18,
        padding: 0,
        borderRadius: radio.sm,
        border: `1.5px solid ${activa ? color.accent : color.fg3}`,
        backgroundColor: activa ? color.accent : 'transparent',
        color: color.accentInk,
        fontSize: 12,
        lineHeight: '14px',
        fontWeight: 700,
        justifyContent: 'center',
      }}
    >
      {estado === 'todas' ? '✓' : estado === 'algunas' ? '–' : ''}
    </Button>
  );
}

/** Hoja para elegir qué grupos o categorías cuentan como «gasto anual». */
function SelectorGrupos({
  abierto,
  onClose,
}: {
  abierto: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: { grouped } = { grouped: [] } } = useCategories();
  const { grupos } = useGruposAnuales();
  const { seleccion: guardada, guardar } = useSeleccionAnual();
  const { todas } = useAnual(abierto);
  const [plegados, setPlegados] = useState<Set<string>>(new Set());

  // Primera vez: precarga lo que hoy sale, para que solo haya que desmarcar.
  useEffect(() => {
    if (abierto && !guardada && todas.length > 0) {
      guardar(
        seleccionInicial(
          grupos,
          todas
            .filter(c => c.automatica)
            .map(c => ({ id: c.categoria.id, grupoId: c.categoria.group })),
        ),
      );
    }
  }, [abierto, guardada, todas, grupos, guardar]);

  const seleccion = guardada ?? { grupos: [], categorias: [], excluidas: [] };

  function plegar(id: string) {
    const nuevos = new Set(plegados);
    if (!nuevos.delete(id)) {
      nuevos.add(id);
    }
    setPlegados(nuevos);
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
          ...densidad.pequeno,
          color: color.fg3,
          padding: `0 ${densidad.margen}px 8px`,
        }}
      >
        <Trans>
          Only what you check shows up here. Check a whole group or single
          categories.
        </Trans>
      </Text>
      {grouped
        .filter(g => !g.is_income && !g.hidden)
        .map(grupo => {
          const cats = (grupo.categories ?? []).filter(c => !c.hidden);
          const sel = { id: grupo.id, categorias: cats };
          const estado = estadoGrupo(seleccion, sel);
          const plegado = plegados.has(grupo.id);
          const marcadas = cats.filter(c =>
            incluida(seleccion, c.id, grupo.id),
          ).length;
          return (
            <View
              key={grupo.id}
              data-testid="selector-grupo"
              style={{ borderTop: `1px solid ${color.line}` }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: densidad.altoGrupo - 6,
                  padding: `0 ${densidad.margen}px`,
                }}
              >
                <Casilla
                  estado={estado}
                  etiqueta={t('Select group {{group}}', { group: grupo.name })}
                  onPress={() => guardar(conmutarGrupo(seleccion, sel))}
                />
                <Button
                  onPress={() => plegar(grupo.id)}
                  aria-expanded={!plegado}
                  aria-label={t('Expand or collapse {{group}}', {
                    group: grupo.name,
                  })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: 0,
                    minHeight: densidad.altoGrupo - 6,
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text
                    style={{ ...densidad.grupo, flex: 1, textAlign: 'left' }}
                  >
                    {grupo.name}
                  </Text>
                  <Text style={{ ...densidad.grupoCifra, color: color.fg3 }}>
                    {t('{{selected}} of {{count}}', {
                      selected: marcadas,
                      count: cats.length,
                    })}
                  </Text>
                  <Text style={{ color: color.fg3 }}>
                    {plegado ? '▸' : '▾'}
                  </Text>
                </Button>
              </View>
              {!plegado &&
                cats.map(c => (
                  <View
                    key={c.id}
                    data-testid="selector-categoria"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 36,
                      padding: `0 ${densidad.margen}px 0 ${
                        densidad.margen + densidad.sangria + 18
                      }px`,
                    }}
                  >
                    <Casilla
                      estado={
                        incluida(seleccion, c.id, grupo.id)
                          ? 'todas'
                          : 'ninguna'
                      }
                      etiqueta={c.name}
                      onPress={() =>
                        guardar(conmutarCategoria(seleccion, c.id, grupo.id))
                      }
                    />
                    <Text style={{ ...densidad.nombre, flex: 1, minWidth: 0 }}>
                      {c.name}
                    </Text>
                  </View>
                ))}
            </View>
          );
        })}
    </ModalLocal>
  );
}
