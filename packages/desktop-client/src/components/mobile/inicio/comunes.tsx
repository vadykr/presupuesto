import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Card } from '@actual-app/components/card';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { css, keyframes } from '@emotion/css';

import type { EstadoAvance } from './avance';
import {
  colores,
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

/** Tarjeta de widget: título en versalitas, acción opcional a la derecha. */
export function Tarjeta({
  titulo,
  accion,
  children,
  'data-testid': testId,
}: {
  titulo: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <Card style={estilos.tarjeta} data-testid={testId}>
      <View style={estilos.tarjetaCabecera}>
        <Text style={estilos.tarjetaTitulo}>{titulo}</Text>
        {accion}
      </View>
      <View style={estilos.tarjetaCuerpo}>{children}</View>
    </Card>
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

/** Icono dentro de un cuadro de color suave (pieza física de la tarjeta). */
export function CajaIcono({
  estado = 'neutro',
  children,
}: {
  estado?: EstadoAvance;
  children: ReactNode;
}) {
  const { color, fondo } = coloresEstado[estado];
  return (
    <View style={{ ...estilos.cajaIcono, color, backgroundColor: fondo }}>
      {children}
    </View>
  );
}

export function Pildora({
  estado,
  children,
  style,
}: {
  estado: EstadoAvance;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { color, fondo } = coloresEstado[estado];
  return (
    <Text
      style={{
        ...estilos.pildora,
        color,
        backgroundColor: fondo,
        transition: 'color 180ms, background-color 180ms',
        ...style,
      }}
    >
      {children}
    </Text>
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

/** Barra de progreso gruesa y redonda, con pista visible. */
export function BarraProgreso({
  partes,
  alto,
  etiqueta,
}: {
  /** Fracciones 0..1 (se recortan) con su color, de izquierda a derecha. */
  partes: { fraccion: number; color: string }[];
  alto?: number;
  etiqueta?: string;
}) {
  const llenado = useLlenado(1);
  return (
    <View
      role="img"
      aria-label={etiqueta}
      style={{
        ...estilos.barraPista,
        ...(alto ? { height: alto, borderRadius: alto / 2 } : null),
      }}
    >
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
 * Anillo de avance con el emoji (o la inicial) dentro. El color va por
 * estado y el trazo se llena al aparecer.
 */
export function Anillo({
  fraccion,
  estado,
  tamano = 56,
  grosor = 6,
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
  const { color, fondo } = coloresEstado[estado];
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
          stroke={colores.pista}
          strokeWidth={grosor}
        />
        <circle
          className={claseTransicion}
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke={color}
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
          fontSize: tamano * 0.38,
          lineHeight: 1,
          fontWeight: 800,
          color,
        }}
      >
        {children}
      </View>
    </View>
  );
}

const mecer = keyframes({
  '0%, 100%': { transform: 'rotate(-3deg)' },
  '50%': { transform: 'rotate(3deg)' },
});

/**
 * Ilustración sutil para «Todo en orden» y los estados vacíos: un barquito
 * de vela sobre dos olas (guiño discreto, nunca en los números).
 */
export function Barquito({ tamano = 64 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano * 0.75}
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={css({
        animation: `${mecer} 2.4s ease-in-out infinite`,
        transformOrigin: '50% 80%',
        [sinMovimiento]: { animation: 'none' },
      })}
    >
      <path d="M32 6v24" />
      <path d="M32 9c7 3 11 9 12 17H32" />
      <path d="M32 13c-5 3-8 8-9 13h9" />
      <path d="M18 31h28l-4 6H22z" />
      <path d="M6 42c4 0 4-2 8-2s4 2 8 2 4-2 8-2 4 2 8 2 4-2 8-2 4 2 8 2" />
    </svg>
  );
}

export function EstadoVacio({
  texto,
  children,
}: {
  texto: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.vacio}>
      <View style={{ color: colores.textoSuave, opacity: 0.7 }}>
        <Barquito />
      </View>
      <Text style={estilos.vacioTexto}>{texto}</Text>
      {children}
    </View>
  );
}
