import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { AccionTexto, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { color, movimiento, radio } from '#components/mobile/ui/tokens';
import { useNavigate } from '#hooks/useNavigate';

/**
 * Lo que se espera de `#components/mobile/analisis/useConsejos` (lo escribe
 * otra rama). Se acepta con holgura: una lista, o un objeto con `consejos` /
 * `visibles` (lista) o `total`, y opcionalmente `primero` (texto u objeto con
 * `titulo`) e `isLoading`.
 */
type ElementoConsejo = string | { titulo?: string; title?: string };
export type ResultadoConsejos =
  | readonly ElementoConsejo[]
  | {
      consejos?: readonly ElementoConsejo[];
      visibles?: readonly ElementoConsejo[];
      total?: number;
      primero?: ElementoConsejo | null;
      isLoading?: boolean;
    };
type UseConsejos = () => ResultadoConsejos;

export const RUTA_ANALISIS = '/reports/analisis';

function textoDe(c: ElementoConsejo | null | undefined): string | null {
  if (c == null) {
    return null;
  }
  if (typeof c === 'string') {
    return c;
  }
  return c.titulo ?? c.title ?? null;
}

/** Normaliza lo que devuelva `useConsejos` a { total, primero, cargando }. */
export function resumirConsejos(r: ResultadoConsejos | null | undefined): {
  total: number;
  primero: string | null;
  cargando: boolean;
} {
  if (r == null) {
    return { total: 0, primero: null, cargando: false };
  }
  if (Array.isArray(r)) {
    const lista = r as readonly ElementoConsejo[];
    return { total: lista.length, primero: textoDe(lista[0]), cargando: false };
  }
  const obj = r as Exclude<ResultadoConsejos, readonly ElementoConsejo[]>;
  const lista = obj.consejos ?? obj.visibles ?? [];
  return {
    total: obj.total ?? lista.length,
    primero: textoDe(obj.primero ?? lista[0]),
    cargando: Boolean(obj.isLoading),
  };
}

// El módulo puede no existir en esta rama: un glob vacío no rompe el build
// (un `import()` de un archivo inexistente sí).
const modulos = import.meta.glob<{ useConsejos?: UseConsejos }>(
  '/src/components/mobile/analisis/useConsejos.{ts,tsx}',
);

const CARGADOR: (() => Promise<{ useConsejos?: UseConsejos }>) | null =
  Object.values(modulos)[0] ?? null;

/** Carga `useConsejos` si existe. `undefined` = cargando; `null` = no hay. */
export function useModuloConsejos(): UseConsejos | null | undefined {
  const [hook, setHook] = useState<UseConsejos | null | undefined>(
    CARGADOR ? undefined : null,
  );
  useEffect(() => {
    if (!CARGADOR) {
      return;
    }
    let cancelado = false;
    CARGADOR()
      .then(m => {
        if (!cancelado) {
          const encontrado =
            typeof m.useConsejos === 'function' ? m.useConsejos : null;
          // Se guarda la función tal cual (no como actualizador de estado).
          setHook(() => encontrado);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setHook(null);
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return hook;
}

/**
 * «Consejos»: número de consejos del mes y el primero, con enlace al análisis.
 * Si el módulo de análisis no está, el widget no se pinta (salvo en el modo
 * edición, que lo lista como no disponible).
 */
export function Consejos({ tamano }: PropsWidget) {
  const useConsejos = useModuloConsejos();
  if (!useConsejos) {
    return null;
  }
  return <ConsejosConDatos useConsejos={useConsejos} tamano={tamano} />;
}

function ConsejosConDatos({
  useConsejos,
  tamano,
}: {
  useConsejos: UseConsejos;
  tamano: PropsWidget['tamano'];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { total, primero, cargando } = resumirConsejos(useConsejos());

  return (
    <Tarjeta
      titulo={t('Advice')}
      data-testid="inicio-consejos"
      accion={
        <AccionTexto onPress={() => void navigate(RUTA_ANALISIS)}>
          <Trans>See all</Trans>
        </AccionTexto>
      }
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
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <IconoCaja
            icono="bulb"
            tono={total > 0 ? 'aviso' : 'ok'}
            size={tamano === 'compacto' ? 32 : 36}
          />
          <Text style={estilos.filaTitulo}>
            {cargando
              ? '…'
              : t('{{count}} piece of advice this month', { count: total })}
          </Text>
        </View>
        {!cargando && total > 1 && <Puntos total={total} />}
      </View>
      {tamano !== 'compacto' && primero && !cargando && (
        <Text style={estilos.consejoTexto}>{primero}</Text>
      )}
    </Tarjeta>
  );
}

/** Puntos de paginación como en la maqueta: el primero, el que se enseña. */
function Puntos({ total }: { total: number }) {
  const puntos = Math.min(total, 5);
  return (
    <View aria-hidden style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
      {Array.from({ length: puntos }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === 0 ? 14 : 6,
            height: 6,
            borderRadius: radio.pildora,
            backgroundColor: i === 0 ? color.accent : color.surface3,
            transition: `width ${movimiento.pildora}ms`,
          }}
        />
      ))}
    </View>
  );
}
