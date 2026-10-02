import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgLightBulb } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { CajaIcono, Fila, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
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
        <Button
          variant="bare"
          onPress={() => void navigate(RUTA_ANALISIS)}
          style={estilos.botonCabecera}
        >
          <Trans>See all</Trans>
        </Button>
      }
    >
      <Fila>
        <CajaIcono estado={total > 0 ? 'aviso' : 'bien'}>
          <SvgLightBulb width={18} height={18} />
        </CajaIcono>
        <View style={estilos.filaTexto}>
          <Text style={estilos.filaTitulo}>
            {cargando
              ? '…'
              : t('{{count}} piece of advice this month', { count: total })}
          </Text>
          {tamano !== 'compacto' && primero && !cargando && (
            <Text style={{ ...estilos.filaSub, lineHeight: 1.45 }}>
              {primero}
            </Text>
          )}
        </View>
      </Fila>
    </Tarjeta>
  );
}
