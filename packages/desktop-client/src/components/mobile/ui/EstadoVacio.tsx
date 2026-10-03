import type { CSSProperties, ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Ancla, Barquito } from './Barquito';
import { estiloTarjeta } from './Tarjeta';
import { color, texto as tipografia } from './tokens';

type EstadoVacioProps = {
  titulo: ReactNode;
  texto?: ReactNode;
  /** «ancla» (nada pendiente) o «barquito» (aún no hay nada). */
  ilustracion?: 'ancla' | 'barquito';
  accion?: ReactNode;
  /** Ancho de la ilustración (150 por defecto; menos dentro de un widget). */
  anchoIlustracion?: number;
  style?: CSSProperties;
  'data-testid'?: string;
};

/** Estado vacío: tarjeta con ilustración de línea de un color, título y frase. */
export function EstadoVacio({
  titulo,
  texto,
  ilustracion = 'ancla',
  accion,
  anchoIlustracion = 150,
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
        {ilustracion === 'ancla' ? (
          <Ancla width={anchoIlustracion} />
        ) : (
          <Barquito width={anchoIlustracion} />
        )}
      </View>
      <Text style={{ marginTop: 6, ...tipografia.titulo, color: color.fg }}>
        {titulo}
      </Text>
      {texto && (
        <Text
          style={{
            ...tipografia.cuerpo,
            color: color.fg2,
            maxWidth: '42ch',
            textWrap: 'balance',
          }}
        >
          {texto}
        </Text>
      )}
      {accion && <View style={{ marginTop: 8 }}>{accion}</View>}
    </View>
  );
}
