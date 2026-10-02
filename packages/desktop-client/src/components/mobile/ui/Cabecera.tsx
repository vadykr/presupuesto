import type { CSSProperties, ReactNode } from 'react';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Icono } from './Icono';
import type { NombreIcono } from './Icono';
import { color, espacio, movimiento, sombra, texto } from './tokens';

type CabeceraProps = {
  titulo: ReactNode;
  /** Línea pequeña encima del título («Octubre 2026», «2 cuentas»…). */
  subtitulo?: ReactNode;
  /** Botones a la derecha (normalmente `BotonRedondo`). */
  derecha?: ReactNode;
  style?: CSSProperties;
};

/** Cabecera grande tipo iOS: subtítulo 12/700 y título 34/800. */
export function Cabecera({ titulo, subtitulo, derecha, style }: CabeceraProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: espacio.fila,
        paddingTop: 6,
        paddingLeft: espacio.margen,
        paddingRight: espacio.margen,
        paddingBottom: 4,
        flexShrink: 0,
        ...style,
      }}
    >
      <View style={{ minWidth: 0, flex: 1 }}>
        {subtitulo != null && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: color.fg3,
              display: 'block',
              '&::first-letter': { textTransform: 'uppercase' },
            }}
          >
            {subtitulo}
          </Text>
        )}
        <Text
          role="heading"
          aria-level={1}
          style={{
            ...texto.display,
            lineHeight: 1.05,
            color: color.fg,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titulo}
        </Text>
      </View>
      {derecha && (
        <View
          style={{ flexDirection: 'row', gap: espacio.fila, flexShrink: 0 }}
        >
          {derecha}
        </View>
      )}
    </View>
  );
}

type BotonRedondoProps = {
  icono: NombreIcono;
  'aria-label': string;
  onPress?: () => void;
  isDisabled?: boolean;
  style?: CSSProperties;
};

/** Botón circular de 44 px con relieve (navegación de mes, añadir, más…). */
export function BotonRedondo({
  icono,
  'aria-label': ariaLabel,
  onPress,
  isDisabled,
  style,
}: BotonRedondoProps) {
  return (
    <Button
      variant="bare"
      aria-label={ariaLabel}
      onPress={onPress}
      isDisabled={isDisabled}
      style={({ isPressed, isHovered }) => ({
        width: 44,
        height: 44,
        minWidth: 44,
        borderRadius: '50%',
        backgroundColor:
          isPressed || isHovered ? color.surface2 : color.surface,
        boxShadow: sombra.tarjeta,
        color: color.fg,
        padding: 0,
        opacity: isDisabled ? 0.35 : 1,
        transform: isPressed ? 'scale(0.92)' : undefined,
        transition: `transform ${movimiento.pulsar}ms ${movimiento.muelle}`,
        ...style,
      })}
    >
      <Icono nombre={icono} size={22} />
    </Button>
  );
}

type TituloSeccionProps = {
  children: ReactNode;
  accion?: ReactNode;
  style?: CSSProperties;
};

/** Título de sección 13/800 sobre un grupo de tarjetas. */
export function TituloSeccion({ children, accion, style }: TituloSeccionProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 32,
        paddingLeft: espacio.margen + 4,
        paddingRight: espacio.margen + 4,
        ...style,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: 800, color: color.fg2 }}>
        {children}
      </Text>
      {accion}
    </View>
  );
}
