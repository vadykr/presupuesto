import type { CSSProperties } from 'react';
import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Barquito } from './Barquito';
import { color } from './tokens';

type CargandoProps = {
  /** Ocupa toda la pantalla (al abrir) o solo un hueco (dentro de una lista). */
  pantalla?: boolean;
  style?: CSSProperties;
};

/** «Zarpando…» con el barquito meciéndose (quieto con «reducir movimiento»). */
export function Cargando({ pantalla = false, style }: CargandoProps) {
  return (
    <View
      role="status"
      aria-live="polite"
      data-testid="cargando"
      style={{
        flex: pantalla ? 1 : undefined,
        minHeight: pantalla ? 420 : 160,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: color.fg3,
        flexShrink: 0,
        ...style,
      }}
    >
      <Barquito meciendose width={pantalla ? 140 : 110} />
      <Text style={{ fontWeight: 700, color: color.fg3 }}>
        <Trans>Setting sail…</Trans>
      </Text>
    </View>
  );
}
