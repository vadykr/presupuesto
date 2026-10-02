import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { groupById } from '@actual-app/core/shared/util';
import type { CategoryEntity, NoteEntity } from '@actual-app/core/types/models';

import { plantillasDe } from '#components/mobile/anual/useAnual';
import type { DatosCategoriaMes } from '#components/mobile/budget/objetivos';
import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import {
  avanceFijada,
  iconoDeNombre,
  metaConFecha,
  porcentajeAvance,
} from '#components/mobile/inicio/avance';
import type { Avance, MetaFecha } from '#components/mobile/inicio/avance';
import {
  AccionTexto,
  Anillo,
  Tarjeta,
} from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import {
  coloresEstado,
  estilos,
  pildoraDeEstado,
} from '#components/mobile/inicio/inicio.estilos';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Pildora } from '#components/mobile/ui/Pildora';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import { color, movimiento } from '#components/mobile/ui/tokens';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import { useQuery } from '#hooks/useQuery';

const SIN_DATOS: DatosCategoriaMes = {
  goal: null,
  longGoal: false,
  budgeted: 0,
  balance: 0,
  spent: 0,
};

/**
 * Categorías fijadas, rediseñadas: si se fija es porque importa, así que se
 * ve el avance (anillo con el emoji dentro, color por estado, se llena al
 * entrar) y el disponible como píldora.
 *
 * Tamaños: compacto = anillos pequeños; grande = lista con barra y «X de Y»;
 * normal = depende de cuántas haya: una = tarjeta héroe a ancho completo
 * (anillo grande con el porcentaje), dos = dos tarjetas con anillo mediano,
 * tres o más = baldosas de tres en fila (anillo con el porcentaje dentro).
 */
export function Fijadas({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pinnedIds } = usePinnedCategories();
  const { data: { list: categories } = { list: [] as CategoryEntity[] } } =
    useCategories();

  const fijadas = useMemo(() => {
    const byId = groupById<CategoryEntity>(categories);
    return pinnedIds
      .map(id => byId[id])
      .filter((c): c is CategoryEntity => Boolean(c));
  }, [categories, pinnedIds]);

  const datos = useDatosObjetivos(month, fijadas);

  // Metas con fecha (plantilla `by …`): se miden sobre el saldo.
  const { data: notas } = useQuery<NoteEntity>(
    () => q('notes').select('*'),
    [],
  );
  const metas = useMemo(() => {
    const notaDe = new Map((notas ?? []).map(n => [n.id, n.note]));
    return new Map<string, MetaFecha | null>(
      fijadas.map(c => [
        c.id,
        metaConFecha(plantillasDe(c.goal_def), notaDe.get(c.id)),
      ]),
    );
  }, [fijadas, notas]);

  const abrir = (id: CategoryEntity['id']) =>
    void navigate(`/categories/${id}?month=${month}`);

  return (
    <Tarjeta
      titulo={t('Pinned')}
      data-testid="inicio-fijadas"
      // Las baldosas ya son tarjetas; la lista grande va en una sola.
      sinTarjeta={fijadas.length === 0 || tamano !== 'grande'}
      relleno={0}
      accion={
        <AccionTexto onPress={() => void navigate('/budget')}>
          <Trans>Edit</Trans>
        </AccionTexto>
      }
    >
      {fijadas.length === 0 ? (
        <EstadoVacio
          anchoIlustracion={96}
          titulo={t('Nothing pinned yet')}
          texto={t(
            'No pinned categories yet. Open a category menu in the Budget tab and choose "Pin to home".',
          )}
        />
      ) : tamano === 'grande' ? (
        <View style={{ padding: '4px 14px' }}>
          {fijadas.map((c, i) => (
            <FilaFijada
              key={c.id}
              category={c}
              datos={datos.get(c.id) ?? SIN_DATOS}
              meta={metas.get(c.id)}
              separada={i > 0}
              onPress={() => abrir(c.id)}
            />
          ))}
        </View>
      ) : tamano === 'normal' && fijadas.length === 1 ? (
        <HeroeFijada
          category={fijadas[0]}
          datos={datos.get(fijadas[0].id) ?? SIN_DATOS}
          meta={metas.get(fijadas[0].id)}
          onPress={() => abrir(fijadas[0].id)}
        />
      ) : (
        <View
          data-testid="fijadas-rejilla"
          data-columnas={tamano === 'normal' && fijadas.length === 2 ? 2 : 3}
          style={
            tamano === 'normal' && fijadas.length === 2
              ? estilos.fijadasMitades
              : estilos.fijadasRejilla
          }
        >
          {fijadas.map(c => (
            <BaldosaFijada
              key={c.id}
              category={c}
              datos={datos.get(c.id) ?? SIN_DATOS}
              meta={metas.get(c.id)}
              compacta={tamano === 'compacto'}
              mediana={tamano === 'normal' && fijadas.length === 2}
              onPress={() => abrir(c.id)}
            />
          ))}
        </View>
      )}
    </Tarjeta>
  );
}

function useTextoAvance(avance: Avance): string {
  const { t } = useTranslation();
  const format = useFormat();
  switch (avance.modo) {
    case 'objetivo':
      return avance.falta > 0
        ? t('{{done}} of {{total}} · {{missing}} to go', {
            done: format(avance.hecho, 'financial'),
            total: format(avance.total, 'financial'),
            missing: format(avance.falta, 'financial'),
          })
        : t('{{done}} of {{total}} · funded', {
            done: format(avance.hecho, 'financial'),
            total: format(avance.total, 'financial'),
          });
    case 'gastado':
      return t('Spent {{spent}} of {{assigned}}', {
        spent: format(avance.hecho, 'financial'),
        assigned: format(avance.total, 'financial'),
      });
    default:
      return t('Nothing assigned this month');
  }
}

function useTextoPorcentaje(avance: Avance): string {
  const { t } = useTranslation();
  return t('{{percent}}%', { percent: porcentajeAvance(avance) });
}

/** Emoji pequeño delante del nombre (sin emoji, la inicial). */
function NombreConEmoji({ nombre: completo }: { nombre: string }) {
  const { nombre } = iconoDeNombre(completo);
  return (
    <TextOneLine style={estilos.fijadaNombre}>
      <IconoCategoria nombre={completo} /> {nombre}
    </TextOneLine>
  );
}

function IconoCategoria({ nombre }: { nombre: string }) {
  const { emoji, inicial } = iconoDeNombre(nombre);
  return <span aria-hidden>{emoji ?? inicial}</span>;
}

function BaldosaFijada({
  category,
  datos,
  meta,
  compacta,
  mediana = false,
  onPress,
}: {
  category: CategoryEntity;
  datos: DatosCategoriaMes;
  meta?: MetaFecha | null;
  compacta: boolean;
  mediana?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const avance = avanceFijada(datos, meta);
  const textoAvance = useTextoAvance(avance);
  const { nombre } = iconoDeNombre(category.name);
  const porcentaje = useTextoPorcentaje(avance);

  return (
    <Button
      variant="bare"
      onPress={onPress}
      aria-label={t('Open {{categoryName}} category', {
        categoryName: category.name,
      })}
      style={({ isPressed }) => ({
        ...estiloTarjeta('normal', 0),
        ...estilos.fijadaBaldosa,
        ...(compacta && { minHeight: 0, padding: '10px 8px', gap: 6 }),
        color: color.fg,
        transform: isPressed ? 'scale(0.97)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
      })}
    >
      <Anillo
        fraccion={avance.fraccion}
        estado={avance.estado}
        tamano={compacta ? 36 : mediana ? 96 : 56}
        grosor={compacta ? 3.5 : mediana ? 9 : 5}
        etiqueta={textoAvance}
      >
        {compacta ? (
          <IconoCategoria nombre={category.name} />
        ) : (
          <span
            data-testid="fijada-porcentaje"
            style={{
              ...estilos.fijadaPorcentaje,
              fontSize: mediana ? 22 : 13,
            }}
          >
            {porcentaje}
          </span>
        )}
      </Anillo>
      {compacta ? (
        <TextOneLine style={estilos.fijadaNombre}>{nombre}</TextOneLine>
      ) : (
        <NombreConEmoji nombre={category.name} />
      )}
      <PrivacyFilter>
        <Pildora
          estado={pildoraDeEstado[avance.estado]}
          style={compacta ? { minHeight: 24, fontSize: 12 } : undefined}
        >
          {format(datos.balance, 'financial')}
        </Pildora>
      </PrivacyFilter>
    </Button>
  );
}

function FilaFijada({
  category,
  datos,
  meta,
  separada,
  onPress,
}: {
  category: CategoryEntity;
  datos: DatosCategoriaMes;
  meta?: MetaFecha | null;
  separada: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const avance = avanceFijada(datos, meta);
  const textoAvance = useTextoAvance(avance);
  const { nombre } = iconoDeNombre(category.name);

  return (
    <Button
      variant="bare"
      onPress={onPress}
      aria-label={t('Open {{categoryName}} category', {
        categoryName: category.name,
      })}
      style={{
        ...estilos.fila,
        ...(separada ? estilos.filaSeparada : null),
        ...estilos.filaBoton,
        padding: '10px 0',
      }}
    >
      <Anillo
        fraccion={avance.fraccion}
        estado={avance.estado}
        tamano={44}
        grosor={4.5}
        etiqueta={textoAvance}
      >
        <IconoCategoria nombre={category.name} />
      </Anillo>
      <View style={{ ...estilos.filaTexto, gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <TextOneLine style={estilos.filaTitulo}>{nombre}</TextOneLine>
          <PrivacyFilter>
            <Pildora estado={pildoraDeEstado[avance.estado]}>
              {format(datos.balance, 'financial')}
            </Pildora>
          </PrivacyFilter>
        </View>
        <BarraProgreso
          valor={avance.fraccion}
          color={coloresEstado[avance.estado].color}
        />
        <PrivacyFilter>
          <Text style={estilos.filaSub}>{textoAvance}</Text>
        </PrivacyFilter>
      </View>
    </Button>
  );
}

function HeroeFijada({
  category,
  datos,
  meta,
  onPress,
}: {
  category: CategoryEntity;
  datos: DatosCategoriaMes;
  meta?: MetaFecha | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const avance = avanceFijada(datos, meta);
  const textoAvance = useTextoAvance(avance);
  const porcentaje = useTextoPorcentaje(avance);
  const { nombre } = iconoDeNombre(category.name);
  const { color: colorEstado } = coloresEstado[avance.estado];

  const fecha = meta
    ? monthUtils.format(meta.fecha, 'd MMM yyyy', locale)
    : null;

  const conObjetivo = avance.modo === 'objetivo';
  const cifras = conObjetivo
    ? [
        { etiqueta: t('So far'), valor: avance.hecho, color: colorEstado },
        {
          etiqueta: t('To go'),
          valor: avance.falta,
          color: color.fg,
        },
      ]
    : [
        {
          etiqueta: t('Spent'),
          valor: avance.hecho,
          color: color.fg,
          sub: t('of {{total}}', { total: format(avance.total, 'financial') }),
        },
        {
          etiqueta: t('Available'),
          valor: datos.balance,
          color: colorEstado,
        },
      ];

  return (
    <Button
      variant="bare"
      onPress={onPress}
      data-testid="fijada-heroe"
      aria-label={t('Open {{categoryName}} category', {
        categoryName: category.name,
      })}
      style={({ isPressed }) => ({
        ...estiloTarjeta('normal', 0),
        ...estilos.fijadaHeroe,
        color: color.fg,
        transform: isPressed ? 'scale(0.98)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
      })}
    >
      <View style={{ gap: 2, alignItems: 'center', width: '100%' }}>
        <TextOneLine style={{ fontSize: 18, fontWeight: 800 }}>
          <IconoCategoria nombre={category.name} /> {nombre}
        </TextOneLine>
        {fecha && (
          <Text style={estilos.filaSub} data-testid="fijada-fecha">
            {t('by {{date}}', { date: fecha })}
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'center' }}>
        <Anillo
          fraccion={avance.fraccion}
          estado={avance.estado}
          tamano={150}
          grosor={12}
          etiqueta={textoAvance}
        >
          <View style={{ alignItems: 'center', gap: 4 }}>
            <span
              data-testid="fijada-porcentaje"
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {porcentaje}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: color.fg3 }}>
              {t('completed')}
            </span>
          </View>
        </Anillo>
      </View>
      <View style={estilos.fijadaHeroeCifras}>
        {cifras.map(c => (
          <View key={c.etiqueta} style={{ gap: 2, alignItems: 'center' }}>
            <Text style={estilos.resumenEtiqueta}>{c.etiqueta}</Text>
            <PrivacyFilter>
              <Text style={{ ...estilos.cifra, fontSize: 20, color: c.color }}>
                {format(c.valor, 'financial')}
              </Text>
            </PrivacyFilter>
            {'sub' in c && c.sub && (
              <PrivacyFilter>
                <Text style={estilos.filaSub}>{c.sub}</Text>
              </PrivacyFilter>
            )}
          </View>
        ))}
      </View>
    </Button>
  );
}
