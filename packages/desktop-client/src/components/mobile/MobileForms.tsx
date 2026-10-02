import React from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
} from 'react';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties as EstiloAnidado } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import { css, cx } from '@emotion/css';

import { color } from './ui/tokens';

type FieldLabelProps = {
  title: string;
  flush?: boolean;
  style?: CSSProperties;
};

export function FieldLabel({ title, flush, style }: FieldLabelProps) {
  return (
    <Text
      style={{
        marginBottom: 5,
        marginTop: flush ? 0 : 25,
        fontSize: 14,
        color: theme.tableRowHeaderText,
        padding: `0 ${styles.mobileEditingPadding}px`,
        userSelect: 'none',
        ...style,
      }}
    >
      {title}
    </Text>
  );
}

const valueStyle = {
  borderWidth: 1,
  borderColor: theme.formInputBorder,
  borderRadius: 14,
  marginLeft: 8,
  marginRight: 8,
  height: styles.mobileMinHeight,
};

export const hideNativeDateIconClassName = css({
  '&::-webkit-calendar-picker-indicator': {
    display: 'none',
  },
  '&::-webkit-date-and-time-value': {
    textAlign: 'left',
  },
});

const iconFieldWrapperClassName = css({
  ...valueStyle,
  flexDirection: 'row',
  alignItems: 'center',
  paddingLeft: 8,
  paddingRight: 8,
  gap: 8,
  '&:focus-within': {
    borderColor: theme.formInputBorderSelected,
  },
});

type InputFieldProps = ComponentPropsWithRef<typeof Input> & {
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  /** Concepto A: fila de formulario con etiqueta (ver `TapField`). */
  etiqueta?: string;
};

const iconStyle: CSSProperties = {
  color: theme.pageTextSubdued,
  flexShrink: 0,
  alignSelf: 'stretch',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0,
};

export function InputField({
  disabled,
  style,
  onUpdate,
  iconStart,
  iconEnd,
  className,
  etiqueta,
  ref,
  ...props
}: InputFieldProps) {
  if (etiqueta) {
    return (
      <View
        className={cx(
          filaFormularioClassName,
          css({ '&:focus-within': { backgroundColor: color.surface2 } }),
        )}
        style={{ display: 'flex' }}
      >
        {iconStart && <CajaIconoFila>{iconStart}</CajaIconoFila>}
        <EtiquetaFila>{etiqueta}</EtiquetaFila>
        <Input
          ref={ref}
          autoCorrect="false"
          autoCapitalize="none"
          disabled={disabled}
          onUpdate={onUpdate}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            backgroundColor: 'transparent',
            height: 52,
            padding: 0,
            textAlign: 'right',
            fontSize: 14.5,
            fontWeight: 700,
            color: disabled ? color.fg3 : color.fg,
            ...style,
            borderRadius: 0,
            boxShadow: 'none',
          }}
          {...props}
          className={renderProps =>
            cx(
              hideNativeDateIconClassName,
              css({ '&::-webkit-date-and-time-value': { textAlign: 'right' } }),
              typeof className === 'function'
                ? className(renderProps)
                : className,
            )
          }
        />
        {iconEnd && <View style={iconStyle}>{iconEnd}</View>}
      </View>
    );
  }
  if (iconStart || iconEnd) {
    return (
      <View
        className={iconFieldWrapperClassName}
        nativeStyle={{
          backgroundColor: disabled
            ? theme.formInputTextReadOnlySelection
            : theme.tableBackground,
        }}
      >
        {iconStart && <View style={iconStyle}>{iconStart}</View>}
        <Input
          ref={ref}
          autoCorrect="false"
          autoCapitalize="none"
          disabled={disabled}
          onUpdate={onUpdate}
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            height: '100%',
            padding: 0,
            textAlign: 'left',
            color: disabled ? theme.tableTextInactive : theme.tableText,
            ...style,
            borderRadius: 0,
            boxShadow: 'none',
          }}
          {...props}
          className={renderProps =>
            cx(
              hideNativeDateIconClassName,
              typeof className === 'function'
                ? className(renderProps)
                : className,
            )
          }
        />
        {iconEnd && <View style={iconStyle}>{iconEnd}</View>}
      </View>
    );
  }

  return (
    <Input
      ref={ref}
      autoCorrect="false"
      autoCapitalize="none"
      disabled={disabled}
      onUpdate={onUpdate}
      className={className}
      style={{
        ...valueStyle,
        ...style,
        color: disabled ? theme.tableTextInactive : theme.tableText,
        backgroundColor: disabled
          ? theme.formInputTextReadOnlySelection
          : theme.tableBackground,
      }}
      {...props}
    />
  );
}

InputField.displayName = 'InputField';

type TapFieldProps = ComponentPropsWithRef<typeof Button> & {
  icon?: ReactNode;
  placeholder?: string;
  rightContent?: ReactNode;
  alwaysShowRightContent?: boolean;
  textStyle?: CSSProperties;
  /**
   * Concepto A: fila de formulario dentro de una tarjeta, con el icono en su
   * cajita, la etiqueta a la izquierda y el valor a la derecha.
   */
  etiqueta?: string;
  /** Valor como nodo (p. ej. la píldora de categoría) en el modo `etiqueta`. */
  valorNodo?: ReactNode;
};

/**
 * Fila de formulario del sistema A (sin borde, 54 px). Los separadores los
 * pone la tarjeta que las agrupa (`tarjetaFormularioStyle`).
 */
export const filaFormularioClassName = css({
  minHeight: 54,
  margin: 0,
  padding: '0 14px',
  gap: 12,
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
  '&[data-disabled]': { backgroundColor: 'transparent', opacity: 0.6 },
  '&[data-pressed]': { backgroundColor: color.surface2, boxShadow: 'none' },
  '&[data-hovered]': { backgroundColor: color.surface2, boxShadow: 'none' },
});

/** Tarjeta que agrupa filas de formulario con una línea entre ellas. */
export const tarjetaFormularioStyle: EstiloAnidado = {
  backgroundColor: color.surface,
  borderRadius: 20,
  boxShadow: 'var(--p-shadow, none)',
  overflow: 'hidden',
  margin: '0 16px',
  '& > * + *': { borderTop: `1px solid ${color.line}` },
};

function CajaIconoFila({ children }: { children: ReactNode }) {
  return (
    <View
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: color.surface2,
        color: color.fg2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </View>
  );
}

function EtiquetaFila({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: color.fg3,
        width: 86,
        flexShrink: 0,
        textAlign: 'left',
        userSelect: 'none',
      }}
    >
      {children}
    </Text>
  );
}

const defaultTapFieldClassName = () =>
  css({
    ...valueStyle,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tableBackground,
    '&[data-disabled]': {
      backgroundColor: theme.formInputTextReadOnlySelection,
    },
    '&[data-pressed]': {
      opacity: 0.5,
      boxShadow: 'none',
    },
    '&[data-hovered]': {
      boxShadow: 'none',
    },
  });

export function TapField({
  value,
  children,
  className,
  icon,
  placeholder,
  rightContent,
  alwaysShowRightContent,
  textStyle,
  etiqueta,
  valorNodo,
  ref,
  ...props
}: TapFieldProps) {
  const showPlaceholder = !value && !!placeholder;
  if (etiqueta) {
    return (
      <Button
        ref={ref}
        bounce={false}
        variant="bare"
        className={renderProps =>
          cx(
            filaFormularioClassName,
            typeof className === 'function'
              ? className(renderProps)
              : className,
          )
        }
        {...props}
      >
        {icon && <CajaIconoFila>{icon}</CajaIconoFila>}
        <EtiquetaFila>{etiqueta}</EtiquetaFila>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {!showPlaceholder && valorNodo ? (
            valorNodo
          ) : (
            <Text
              style={{
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                textAlign: 'right',
                fontSize: 14.5,
                fontWeight: 700,
                color: showPlaceholder ? color.fg3 : color.fg,
                ...textStyle,
              }}
            >
              {showPlaceholder ? placeholder : value}
            </Text>
          )}
        </View>
        {(!props.isDisabled || alwaysShowRightContent) && rightContent}
      </Button>
    );
  }
  return (
    <Button
      ref={ref}
      bounce={false}
      className={renderProps =>
        cx(
          defaultTapFieldClassName(),
          typeof className === 'function' ? className(renderProps) : className,
        )
      }
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          {icon && (
            <View
              style={{
                color: theme.pageTextSubdued,
                marginRight: 8,
                flexShrink: 0,
              }}
            >
              {icon}
            </View>
          )}
          <Text
            style={{
              flex: 1,
              userSelect: 'none',
              textAlign: 'left',
              color: showPlaceholder
                ? theme.formInputTextPlaceholder
                : undefined,
              ...textStyle,
            }}
          >
            {showPlaceholder ? placeholder : value}
          </Text>
        </>
      )}
      {(!props.isDisabled || alwaysShowRightContent) && rightContent}
    </Button>
  );
}

TapField.displayName = 'TapField';

type ToggleFieldProps = ComponentPropsWithoutRef<typeof Toggle>;

export function ToggleField({
  id,
  isOn,
  onToggle,
  style,
  className,
  isDisabled = false,
}: ToggleFieldProps) {
  return (
    <Toggle
      id={id}
      isOn={isOn}
      isDisabled={isDisabled}
      onToggle={onToggle}
      style={style}
      className={String(
        css([
          {
            '& [data-toggle-container]': {
              width: 50,
              height: 24,
            },
            '& [data-toggle]': {
              width: 20,
              height: 20,
            },
          },
          className,
        ]),
      )}
    />
  );
}
