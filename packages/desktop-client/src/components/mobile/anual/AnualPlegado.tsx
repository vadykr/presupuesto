import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Importe } from '#components/mobile/ui/Importe';
import { color, densidad, num } from '#components/mobile/ui/tokens';
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
    <Button
      variant="bare"
      onPress={() => void navigate('/anual')}
      aria-label={t('Annual · on track ({{count}})', { count: filas.length })}
      data-testid="anual-plegado"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 10,
        minHeight: densidad.altoFilaBarra,
        padding: `0 ${densidad.margen}px`,
        borderRadius: 0,
        boxShadow: `inset 0 -1px 0 ${color.line}`,
        backgroundColor: color.surface2,
        color: color.fg,
        textAlign: 'left',
      }}
    >
      <IconoCaja icono="cal" size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...densidad.grupo, color: color.fg }}>
          {t('Annual · on track ({{count}})', { count: filas.length })}
        </Text>
        <Text style={{ ...num, ...densidad.pequeno, color: color.fg3 }}>
          <Trans>Saved</Trans>{' '}
          <Importe valor={ahorrado} style={{ color: color.fg3 }} />
        </Text>
      </View>
      <Icono nombre="cr" size={16} style={{ color: color.fg3 }} />
    </Button>
  );
}
