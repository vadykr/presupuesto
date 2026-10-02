import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Importe } from '#components/mobile/ui/Importe';
import { Tarjeta } from '#components/mobile/ui/Tarjeta';
import { color, espacio, num } from '#components/mobile/ui/tokens';
import { useNavigate } from '#hooks/useNavigate';

import type { FilaAnual } from './anual';

/**
 * Bloque compacto del Plan: «Anual · al día (N)». Sustituye en la lista a las
 * categorías anuales que están al día o cubiertas (preferencia
 * `anual-ocultar-en-plan`); tocarlo abre «Gasto anual».
 */
export function AnualPlegado({ filas }: { filas: readonly FilaAnual[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (filas.length === 0) {
    return null;
  }
  const ahorrado = filas.reduce((suma, f) => suma + f.ahorrado, 0);
  return (
    <Tarjeta
      onPress={() => void navigate('/anual')}
      aria-label={t('Annual · on track ({{count}})', { count: filas.length })}
      data-testid="anual-plegado"
      relleno={0}
      style={{
        margin: `0 ${espacio.margen}px ${espacio.tarjetas}px`,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.icono,
        minHeight: 56,
        padding: '0 14px',
      }}
    >
      <IconoCaja icono="cal" size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: 800, color: color.fg }}>
          {t('Annual · on track ({{count}})', { count: filas.length })}
        </Text>
        <Text
          style={{ ...num, fontSize: 12.5, fontWeight: 600, color: color.fg3 }}
        >
          <Trans>Saved</Trans>{' '}
          <Importe valor={ahorrado} style={{ color: color.fg3 }} />
        </Text>
      </View>
      <Icono nombre="cr" size={18} style={{ color: color.fg3 }} />
    </Tarjeta>
  );
}
