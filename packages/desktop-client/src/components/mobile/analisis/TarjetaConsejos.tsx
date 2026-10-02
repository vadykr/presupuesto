import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Card } from '@actual-app/components/card';
import { SvgCheveronRight } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { TarjetaInforme } from '#components/mobile/informes/comunes';
import { useNavigate } from '#hooks/useNavigate';

import {
  fraseResumenConsejos,
  IconoConsejo,
  useRedactor,
} from './AnalisisPage';
import { redactar } from './frases';
import { useAnalisis } from './useAnalisis';

const RUTA = '/reports/analisis';

/**
 * Tarjeta «Consejos» de la portada de Informes: cuántos hay y el primero.
 */
export function TarjetaConsejosInforme() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const redactor = useRedactor();
  const { visibles, mesesCompletos, isLoading } = useAnalisis();
  const primero = visibles[0];

  return (
    <TarjetaInforme
      data-testid="tarjeta-consejos"
      titulo={t('Advice')}
      valor={isLoading ? '…' : visibles.length}
      frase={
        isLoading
          ? ''
          : fraseResumenConsejos(t, visibles.length, mesesCompletos)
      }
      tono={
        isLoading
          ? 'neutro'
          : visibles.some(c => c.gravedad === 'accion')
            ? 'aviso'
            : visibles.length === 0
              ? 'bien'
              : 'neutro'
      }
      onPress={() => void navigate(RUTA)}
    >
      {primero && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconoConsejo consejo={primero} size={14} />
          <TextOneLine style={{ ...styles.smallText, flex: 1 }}>
            {redactar(primero, redactor).titulo}
          </TextOneLine>
        </View>
      )}
    </TarjetaInforme>
  );
}

/**
 * Tarjeta «Consejos» del Inicio: «N consejos este mes» y una línea con el
 * primero; tocarla abre la página.
 */
export function TarjetaConsejosInicio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const redactor = useRedactor();
  const { visibles, mesesCompletos, isLoading } = useAnalisis();
  const primero = visibles[0];

  if (isLoading || mesesCompletos < 4) {
    return null;
  }

  return (
    <Card
      style={{ marginLeft: 10, marginRight: 10, marginTop: 15 }}
      data-testid="inicio-consejos"
    >
      <Button
        variant="bare"
        onPress={() => void navigate(RUTA)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          textAlign: 'left',
          padding: 0,
          borderRadius: 6,
          color: theme.pageText,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 15,
            paddingRight: 10,
            paddingTop: 10,
            paddingBottom: primero ? 4 : 10,
          }}
        >
          <Text
            style={{
              ...styles.mediumText,
              fontWeight: 600,
              color: theme.pageTextSubdued,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontSize: 13,
            }}
          >
            <Trans>Advice</Trans>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                ...styles.smallText,
                fontWeight: 600,
                color:
                  visibles.length > 0 ? theme.warningText : theme.noticeText,
              }}
            >
              {visibles.length === 0
                ? t('All in order')
                : t('{{count}} tips this month', { count: visibles.length })}
            </Text>
            <SvgCheveronRight
              width={16}
              height={16}
              style={{ color: theme.pageTextSubdued }}
            />
          </View>
        </View>
        {primero && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 15,
              paddingRight: 15,
              paddingBottom: 12,
            }}
          >
            <IconoConsejo consejo={primero} size={14} />
            <TextOneLine style={{ ...styles.mediumText, flex: 1 }}>
              {redactar(primero, redactor).titulo}
            </TextOneLine>
          </View>
        )}
      </Button>
    </Card>
  );
}
