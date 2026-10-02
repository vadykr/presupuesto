import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useLocale } from '#hooks/useLocale';

import { BotonRedondo } from './Cabecera';
import { color, espacio, movimiento } from './tokens';

type NavegadorMesProps = {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
  /** Tocar el nombre del mes (abre el menú del mes). */
  onPressMonth?: () => void;
  /** Volver al mes actual: la aguja del Log Pose apunta a casa. */
  onToday?: () => void;
  /** Botón extra a la izquierda (p. ej. el menú de la página). */
  izquierda?: ReactNode;
};

/**
 * Navegador de meses del sistema A con el «Log Pose» de B: una brújula de
 * línea cuya aguja gira un poco cada mes (detalle sutil de One Piece). Si no
 * es el mes actual, la brújula es un botón que vuelve a hoy.
 */
export function NavegadorMes({
  month,
  onPrev,
  onNext,
  prevEnabled = true,
  nextEnabled = true,
  onPressMonth,
  onToday,
  izquierda,
}: NavegadorMesProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const esActual = monthUtils.isCurrentMonth(month);
  const nombre = monthUtils.format(month, 'MMMM', locale);
  const anio = monthUtils.format(month, 'yyyy', locale);
  // 30° por mes: la aguja da la vuelta entera en un año.
  const giro = (Number(month.slice(5, 7)) - 1) * 30 + 18;

  const brujula = <LogPose giro={giro} activo={!esActual} />;

  return (
    <View
      data-testid="navegador-mes"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.fila,
        padding: `6px ${espacio.margen}px`,
        minHeight: 56,
      }}
    >
      {izquierda}
      <BotonRedondo
        icono="cl"
        aria-label={t('Previous month')}
        onPress={onPrev}
        isDisabled={!prevEnabled}
      />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {!esActual && onToday ? (
          <Button
            variant="bare"
            aria-label={t('Today')}
            onPress={onToday}
            style={{ width: 44, height: 44, padding: 0, borderRadius: '50%' }}
          >
            {brujula}
          </Button>
        ) : (
          brujula
        )}
        <Button
          variant="bare"
          onPress={onPressMonth}
          isDisabled={!onPressMonth}
          data-month={month}
          style={{
            minHeight: 44,
            minWidth: 0,
            padding: '0 4px',
            borderRadius: 12,
            flexDirection: 'column',
            alignItems: 'flex-start',
            color: color.fg,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {nombre}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: 700, color: color.fg3 }}>
            {anio}
          </Text>
        </Button>
      </View>
      <BotonRedondo
        icono="cr"
        aria-label={t('Next month')}
        onPress={onNext}
        isDisabled={!nextEnabled}
      />
    </View>
  );
}

/** Brújula de cristal minimalista (Log Pose). */
function LogPose({ giro, activo }: { giro: number; activo: boolean }) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={34}
      height={34}
      aria-hidden
      style={{ color: activo ? color.accent : color.fg3, flexShrink: 0 }}
    >
      <circle
        cx="22"
        cy="22"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle
        cx="22"
        cy="22"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
        strokeDasharray="1.5 3.2"
        opacity=".7"
      />
      <path
        d="M14 38.5h16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M17 37v-1.5M27 37v-1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <g
        style={{
          transformOrigin: '22px 22px',
          transform: `rotate(${giro}deg)`,
          transition: `transform ${movimiento.tarjeta}ms ${movimiento.muelle}`,
        }}
      >
        <path d="M22 10l2.2 12h-4.4z" fill={color.accent} />
        <path d="M22 34l-2.2-12h4.4z" fill={color.fg3} />
      </g>
      <circle
        cx="22"
        cy="22"
        r="1.6"
        fill={color.bg}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
