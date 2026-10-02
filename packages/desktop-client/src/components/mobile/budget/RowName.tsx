import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { usePress } from 'react-aria';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

/** Tiempo (ms) que hay que mantener pulsado para que cuente como «mantener». */
export const HOLD_DELAY_MS = 500;

type UseTapAndHoldOptions = {
  onTap: () => void;
  onHold?: () => void;
  delay?: number;
};

/**
 * Un solo `usePress` que distingue entre tocar y mantener pulsado: si el dedo
 * sigue apretando pasados `delay` ms se dispara `onHold` y se anula el toque;
 * si se suelta antes, se dispara `onTap`. Al desplazar la lista, react-aria
 * cancela la pulsación y con ella el temporizador.
 */
export function useTapAndHold({
  onTap,
  onHold,
  delay = HOLD_DELAY_MS,
}: UseTapAndHoldOptions) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const { pressProps } = usePress({
    onPressStart: () => {
      held.current = false;
      clear();
      if (onHold) {
        timer.current = window.setTimeout(() => {
          timer.current = null;
          held.current = true;
          onHold();
        }, delay);
      }
    },
    onPressEnd: clear,
    onPress: () => {
      if (!held.current) {
        onTap();
      }
    },
  });

  return pressProps;
}

type RowNameProps = {
  name: string;
  /** Ancho de la columna del nombre (p. ej. «35vw»). */
  width: string;
  /** Tocar el nombre. */
  onPress: () => void;
  /** Mantener pulsado el nombre (abre el menú). */
  onHold?: () => void;
  /** Si se indica, se muestra el icono ⋮ a la derecha del nombre. */
  onOpenMenu?: () => void;
  menuLabel?: string;
  textStyle?: CSSProperties;
  /** Elemento opcional delante del nombre (p. ej. la flecha de plegar). */
  leading?: ReactNode;
  'data-testid'?: string;
};

/**
 * Nombre de una fila del presupuesto móvil: tocar hace una cosa (plegar el
 * grupo, abrir la categoría), mantener pulsado o el icono ⋮ abren el menú.
 * Así un toque no abre ventanas que el usuario no ha pedido.
 */
export function RowName({
  name,
  width,
  onPress,
  onHold,
  onOpenMenu,
  menuLabel,
  textStyle,
  leading,
  'data-testid': testId,
}: RowNameProps) {
  const pressProps = useTapAndHold({ onTap: onPress, onHold });

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width,
        minHeight: styles.mobileMinHeight,
      }}
    >
      {leading}
      <View
        {...pressProps}
        role="button"
        tabIndex={0}
        onContextMenu={e => e.preventDefault()}
        style={{
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          borderRadius: 4,
          '&[data-pressed]': {
            backgroundColor: theme.buttonBareBackgroundActive,
          },
        }}
      >
        <Text
          style={{
            ...styles.lineClamp(2),
            textAlign: 'left',
            ...styles.smallText,
            ...textStyle,
          }}
          data-testid={testId}
        >
          {name}
        </Text>
      </View>
      {onOpenMenu && (
        <Button
          variant="bare"
          aria-label={menuLabel}
          onPress={onOpenMenu}
          style={{
            flexShrink: 0,
            minWidth: styles.mobileMinHeight,
            minHeight: styles.mobileMinHeight,
            justifyContent: 'center',
            alignItems: 'center',
            color: theme.tableTextSubdued,
          }}
        >
          <SvgDotsHorizontalTriple width={16} height={16} />
        </Button>
      )}
    </View>
  );
}
