import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { useLocale } from '#hooks/useLocale';

import { Icono } from './Icono';
import {
  color,
  espacio,
  movimiento,
  radio,
  sombra,
  TACTIL,
  texto,
} from './tokens';

type Locale = ReturnType<typeof useLocale>;

/** «Ene», «Feb»… (abreviatura del idioma, sin punto y con mayúscula). */
export function mesCorto(mes: string, locale: Locale): string {
  const corto = monthUtils.format(mes, 'MMM', locale).replace('.', '');
  return corto.charAt(0).toUpperCase() + corto.slice(1);
}

/** «Octubre 2026». */
export function mesLargo(mes: string, locale: Locale): string {
  const largo = monthUtils.format(mes, 'MMMM yyyy', locale);
  return largo.charAt(0).toUpperCase() + largo.slice(1);
}

type HojaSelectorMesProps = {
  abierto: boolean;
  onClose: () => void;
  mes: string;
  onChange: (mes: string) => void;
  /** Primer y último mes elegibles ('yyyy-MM'); fuera de ellos, desactivados. */
  minimo?: string;
  maximo?: string;
  /** Acción extra al pie («Opciones del mes…»). */
  accion?: { texto: ReactNode; onPress: () => void };
};

/**
 * Selector de mes al estilo YNAB: ‹ año › arriba y rejilla 4×3 de meses.
 * El mes elegido va en el acento; los posteriores al actual, atenuados (se
 * pueden elegir para presupuestar por adelantado si `maximo` lo permite).
 */
export function HojaSelectorMes({
  abierto,
  onClose,
  mes,
  onChange,
  minimo,
  maximo,
  accion,
}: HojaSelectorMesProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const actual = monthUtils.currentMonth();
  const [anio, setAnio] = useState(() => Number(mes.slice(0, 4)));

  useEffect(() => {
    if (abierto) {
      setAnio(Number(mes.slice(0, 4)));
    }
  }, [abierto, mes]);

  const meses = Array.from(
    { length: 12 },
    (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`,
  );
  const fuera = (m: string) =>
    (minimo != null && m < minimo) || (maximo != null && m > maximo);
  const puedeAtras = minimo == null || `${anio - 1}-12` >= minimo;
  const puedeAdelante = maximo == null || `${anio + 1}-01` <= maximo;

  const elegir = (m: string) => {
    onChange(m);
    onClose();
  };

  return (
    <ModalOverlay
      isOpen={abierto}
      isDismissable
      onOpenChange={isOpen => !isOpen && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: `72px ${espacio.margen}px 0`,
      }}
    >
      <Modal style={{ width: '100%', maxWidth: 340, outline: 'none' }}>
        <Dialog
          aria-label={t('Choose month')}
          data-testid="selector-mes-hoja"
          style={{
            outline: 'none',
            backgroundColor: color.surface,
            color: color.fg,
            borderRadius: radio.heroe,
            boxShadow: sombra.hoja,
            padding: 12,
            animation: `selector-mes-entra ${movimiento.hoja}ms ${movimiento.muelle}`,
          }}
        >
          <style>{`@keyframes selector-mes-entra { from { opacity: 0; transform: translateY(-8px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { [data-testid="selector-mes-hoja"] { animation: none !important; } }`}</style>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <BotonAnio
              icono="cl"
              aria-label={t('Previous year')}
              isDisabled={!puedeAtras}
              onPress={() => setAnio(a => a - 1)}
            />
            <Text
              style={{ ...texto.titulo, color: color.fg }}
              data-testid="selector-mes-anio"
            >
              {anio}
            </Text>
            <BotonAnio
              icono="cr"
              aria-label={t('Next year')}
              isDisabled={!puedeAdelante}
              onPress={() => setAnio(a => a + 1)}
            />
          </View>
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 6,
            }}
          >
            {meses.map(m => {
              const elegido = m === mes;
              const futuro = m > actual;
              const esHoy = m === actual;
              const desactivado = fuera(m);
              return (
                <Button
                  key={m}
                  variant="bare"
                  data-month={m}
                  data-selected={elegido || undefined}
                  aria-label={mesLargo(m, locale)}
                  aria-current={esHoy ? 'date' : undefined}
                  isDisabled={desactivado}
                  onPress={() => elegir(m)}
                  style={{
                    minHeight: TACTIL,
                    borderRadius: radio.boton,
                    fontSize: 14,
                    fontWeight: elegido || esHoy ? 800 : 600,
                    backgroundColor: elegido ? color.accent : 'transparent',
                    color: elegido
                      ? color.accentInk
                      : esHoy
                        ? color.accent
                        : color.fg,
                    boxShadow:
                      esHoy && !elegido
                        ? `inset 0 0 0 1.5px ${color.accent}`
                        : undefined,
                    opacity: desactivado ? 0.25 : futuro && !elegido ? 0.5 : 1,
                    transition: `background-color ${movimiento.pildora}ms`,
                  }}
                >
                  {mesCorto(m, locale)}
                </Button>
              );
            })}
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: accion ? 'space-between' : 'center',
              alignItems: 'center',
              marginTop: 8,
              borderTop: `1px solid ${color.line}`,
              paddingTop: 4,
            }}
          >
            <BotonTexto
              isDisabled={mes === actual || fuera(actual)}
              onPress={() => elegir(actual)}
            >
              <Trans>Today</Trans>
            </BotonTexto>
            {accion && (
              <BotonTexto
                onPress={() => {
                  onClose();
                  accion.onPress();
                }}
              >
                {accion.texto}
              </BotonTexto>
            )}
          </View>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function BotonAnio({
  icono,
  'aria-label': ariaLabel,
  isDisabled,
  onPress,
}: {
  icono: 'cl' | 'cr';
  'aria-label': string;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant="bare"
      aria-label={ariaLabel}
      isDisabled={isDisabled}
      onPress={onPress}
      style={{
        width: TACTIL,
        height: TACTIL,
        padding: 0,
        borderRadius: '50%',
        color: color.fg2,
        opacity: isDisabled ? 0.3 : 1,
      }}
    >
      <Icono nombre={icono} size={20} />
    </Button>
  );
}

function BotonTexto({
  children,
  onPress,
  isDisabled,
}: {
  children: ReactNode;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Button
      variant="bare"
      onPress={onPress}
      isDisabled={isDisabled}
      style={{
        minHeight: TACTIL,
        padding: '0 12px',
        borderRadius: radio.boton,
        fontSize: 14,
        fontWeight: 800,
        color: color.accent,
        opacity: isDisabled ? 0.4 : 1,
      }}
    >
      {children}
    </Button>
  );
}

type SelectorMesProps = Omit<HojaSelectorMesProps, 'abierto' | 'onClose'> & {
  /**
   * `titulo`: nombre grande con el año debajo (cabecera del Plan).
   * `compacto`: «Octubre 2026 ▾» en una línea.
   */
  variante?: 'titulo' | 'compacto';
  /** Brújula «Log Pose» decorativa junto al mes. */
  logPose?: boolean;
  style?: CSSProperties;
};

/** Botón con el nombre del mes que abre `HojaSelectorMes`. */
export function SelectorMes({
  variante = 'compacto',
  logPose = false,
  style,
  ...hoja
}: SelectorMesProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [abierto, setAbierto] = useState(false);
  const { mes } = hoja;
  const nombre = monthUtils.format(mes, 'MMMM', locale);
  const anio = monthUtils.format(mes, 'yyyy', locale);
  const giro = (Number(mes.slice(5, 7)) - 1) * 30 + 18;

  return (
    <>
      <Button
        variant="bare"
        aria-label={t('Choose month: {{month}}', {
          month: mesLargo(mes, locale),
        })}
        aria-haspopup="dialog"
        data-testid="selector-mes"
        data-month={mes}
        onPress={() => setAbierto(true)}
        style={{
          minHeight: TACTIL,
          minWidth: 0,
          padding: '0 6px',
          gap: 6,
          borderRadius: radio.sm,
          flexDirection: 'row',
          alignItems: 'center',
          color: color.fg,
          ...style,
        }}
      >
        {logPose && (
          <LogPose giro={giro} activo={!monthUtils.isCurrentMonth(mes)} />
        )}
        {variante === 'titulo' ? (
          <View style={{ alignItems: 'flex-start', minWidth: 0 }}>
            <Text
              data-testid="selector-mes-nombre"
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
              }}
            >
              {nombre}
            </Text>
            <Text
              data-testid="selector-mes-anio"
              style={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: '14px',
                color: color.fg3,
              }}
            >
              {anio}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {mesLargo(mes, locale)}
          </Text>
        )}
        <Icono
          nombre="cd"
          size={variante === 'titulo' ? 18 : 16}
          style={{ color: color.fg3, flexShrink: 0 }}
        />
      </Button>
      <HojaSelectorMes
        {...hoja}
        abierto={abierto}
        onClose={() => setAbierto(false)}
      />
    </>
  );
}

/** Brújula de cristal minimalista (Log Pose), solo decorativa. */
export function LogPose({ giro, activo }: { giro: number; activo: boolean }) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={30}
      height={30}
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
