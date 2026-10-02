import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import { groupById } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import type { DatosCategoriaMes } from '#components/mobile/budget/objetivos';
import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import { avanceFijada, iconoDeNombre } from '#components/mobile/inicio/avance';
import type { Avance } from '#components/mobile/inicio/avance';
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
import { useNavigate } from '#hooks/useNavigate';
import { usePinnedCategories } from '#hooks/usePinnedCategories';

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
 * Tamaños: compacto = anillos pequeños; normal = baldosas de tres en fila;
 * grande = lista con barra y «X de Y».
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
              separada={i > 0}
              onPress={() => abrir(c.id)}
            />
          ))}
        </View>
      ) : (
        <View style={estilos.fijadasRejilla}>
          {fijadas.map(c => (
            <BaldosaFijada
              key={c.id}
              category={c}
              datos={datos.get(c.id) ?? SIN_DATOS}
              compacta={tamano === 'compacto'}
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

function IconoCategoria({ nombre }: { nombre: string }) {
  const { emoji, inicial } = iconoDeNombre(nombre);
  return <span aria-hidden>{emoji ?? inicial}</span>;
}

function BaldosaFijada({
  category,
  datos,
  compacta,
  onPress,
}: {
  category: CategoryEntity;
  datos: DatosCategoriaMes;
  compacta: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const avance = avanceFijada(datos);
  const textoAvance = useTextoAvance(avance);
  const { nombre } = iconoDeNombre(category.name);

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
        tamano={compacta ? 36 : 44}
        grosor={compacta ? 3.5 : 4.5}
        etiqueta={textoAvance}
      >
        <IconoCategoria nombre={category.name} />
      </Anillo>
      <TextOneLine style={estilos.fijadaNombre}>{nombre}</TextOneLine>
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
  separada,
  onPress,
}: {
  category: CategoryEntity;
  datos: DatosCategoriaMes;
  separada: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const avance = avanceFijada(datos);
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
