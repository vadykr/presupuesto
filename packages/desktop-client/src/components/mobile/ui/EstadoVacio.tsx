import type { CSSProperties, ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Barquito, Sombrero } from './Barquito';
import { estiloTarjeta } from './Tarjeta';
import { color } from './tokens';

type EstadoVacioProps = {
  titulo: ReactNode;
  texto?: ReactNode;
  /** «sombrero» (nada pendiente) o «barquito» (aún no hay nada). */
  ilustracion?: 'sombrero' | 'barquito';
  accion?: ReactNode;
  style?: CSSProperties;
  'data-testid'?: string;
};

/** Estado vacío: tarjeta con ilustración de línea de un color, título y frase. */
export function EstadoVacio({
  titulo,
  texto,
  ilustracion = 'sombrero',
  accion,
  style,
  'data-testid': testId = 'estado-vacio',
}: EstadoVacioProps) {
  return (
    <View
      data-testid={testId}
      style={{
        ...estiloTarjeta('normal', 0),
        padding: '28px 20px',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <View style={{ color: color.fg2 }}>
        {ilustracion === 'sombrero' ? (
          <Sombrero width={150} />
        ) : (
          <Barquito width={150} />
        )}
      </View>
      <Text
        style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: color.fg }}
      >
        {titulo}
      </Text>
      {texto && (
        <Text
          style={{
            fontSize: 14,
            color: color.fg2,
            maxWidth: '30ch',
            lineHeight: 1.45,
          }}
        >
          {texto}
        </Text>
      )}
      {accion && <View style={{ marginTop: 8 }}>{accion}</View>}
    </View>
  );
}
