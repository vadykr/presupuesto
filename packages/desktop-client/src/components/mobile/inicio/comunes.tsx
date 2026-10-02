import { useEffect, useState } from 'react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { TituloSeccion } from '#components/mobile/ui/Cabecera';
import { Tarjeta as TarjetaUi } from '#components/mobile/ui/Tarjeta';
import { color } from '#components/mobile/ui/tokens';

import type { EstadoAvance } from './avance';
import {
  coloresEstado,
  estilos,
  sinMovimiento,
  TRANSICION_LLENADO,
} from './inicio.estilos';
import type { Tamano } from './modeloWidgets';

/** Props comunes a todos los widgets del inicio. */
export type PropsWidget = {
  tamano: Tamano;
  month: string;
};

/**
 * Bloque de un widget del sistema A: título de sección (13/800) con acción
 * opcional encima de una tarjeta elevada. Con `cabecera="tarjeta"` el título
 * va dentro de la tarjeta (Cuenta común, Resumen). `sinTarjeta` deja el
 * contenido suelto bajo el título (las baldosas de Fijadas ya son tarjetas).
 */
export function Tarjeta({
  titulo,
  accion,
  children,
  cabecera = 'seccion',
  sinTarjeta = false,
  relleno,
  onPress,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: {
  titulo?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  cabecera?: 'seccion' | 'tarjeta';
  sinTarjeta?: boolean;
  relleno?: number;
  onPress?: () => void;
  'aria-label'?: string;
  'data-testid'?: string;
}) {
  const fuera = cabecera === 'seccion' && (titulo != null || accion != null);
  const dentro = cabecera === 'tarjeta' && (titulo != null || accion != null);
  return (
    <View style={estilos.widget} data-testid={testId}>
      {fuera && (
        <TituloSeccion accion={accion} style={estilos.tituloSeccion}>
          {titulo}
        </TituloSeccion>
      )}
      {sinTarjeta ? (
        children
      ) : (
        <TarjetaUi
          relleno={relleno}
          onPress={onPress}
          aria-label={ariaLabel}
          style={estilos.tarjetaCuerpo}
        >
          {dentro && (
            <View style={estilos.tarjetaCabecera}>
              <Text style={estilos.tarjetaTitulo}>{titulo}</Text>
              {accion}
            </View>
          )}
          {children}
        </TarjetaUi>
      )}
    </View>
  );
}

/** Acción de texto en color de acento («Editar», «Ver», «Categorías»). */
export function AccionTexto({
  children,
  style,
  ...props
}: { children: ReactNode; style?: CSSProperties } & Omit<
  ComponentProps<typeof Button>,
  'variant' | 'style' | 'children'
>) {
  return (
    <Button
      variant="bare"
      {...props}
      style={({ isPressed }) => ({
        ...estilos.accionTexto,
        opacity: isPressed ? 0.6 : 1,
        ...style,
      })}
    >
      {children}
    </Button>
  );
}

export function Fila({
  children,
  separada = false,
  style,
}: {
  children: ReactNode;
  separada?: boolean;
  style?: CSSProperties;
}) {
  return (
    <View
      style={{
        ...estilos.fila,
        ...(separada ? estilos.filaSeparada : null),
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Devuelve 0 en el primer pintado y el valor real en el siguiente, para que
 * la barra o el anillo «se llenen» al aparecer con una transición CSS.
 */
export function useLlenado(valor: number): number {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return montado ? valor : 0;
}

const claseTransicion = css({
  [sinMovimiento]: { transition: 'none !important' },
});

/**
 * Barra de 8 px con varias partes seguidas (Resumen: gastado + asignado).
 * Para un solo valor, `BarraProgreso` de `ui`.
 */
export function BarraPartes({
  partes,
  etiqueta,
}: {
  /** Fracciones 0..1 (se recortan) con su color, de izquierda a derecha. */
  partes: { fraccion: number; color: string }[];
  etiqueta?: string;
}) {
  const llenado = useLlenado(1);
  return (
    <View role="img" aria-label={etiqueta} style={estilos.barraPista}>
      {partes.map((p, i) => (
        <View
          key={i}
          className={claseTransicion}
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(1, p.fraccion)) * 100 * llenado}%`,
            backgroundColor: p.color,
            transition: `width ${TRANSICION_LLENADO}`,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Anillo de avance con el emoji (o la inicial, o el %) dentro: pista
 * `surface-3`, trazo del color de estado, centro en su color suave. El trazo
 * se llena al aparecer.
 */
export function Anillo({
  fraccion,
  estado,
  tamano = 48,
  grosor = 5,
  children,
  etiqueta,
}: {
  fraccion: number;
  estado: EstadoAvance;
  tamano?: number;
  grosor?: number;
  children?: ReactNode;
  etiqueta?: string;
}) {
  const valor = useLlenado(Math.max(0, Math.min(1, fraccion)));
  const r = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * r;
  const { color: trazo, fondo } = coloresEstado[estado];
  return (
    <View
      role="img"
      aria-label={etiqueta}
      style={{
        position: 'relative',
        width: tamano,
        height: tamano,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill={fondo}
          stroke={color.surface3}
          strokeWidth={grosor}
        />
        <circle
          className={claseTransicion}
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke={trazo}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - valor)}
          style={{
            transition: `stroke-dashoffset ${TRANSICION_LLENADO}, stroke 180ms`,
            // Sin avance no se dibuja el punto redondo del extremo.
            opacity: valor > 0 ? 1 : 0,
          }}
        />
      </svg>
      <View
        style={{
          position: 'relative',
          fontSize: Math.round(tamano * 0.4),
          lineHeight: 1,
          fontWeight: 800,
          color: trazo,
        }}
      >
        {children}
      </View>
    </View>
  );
}
