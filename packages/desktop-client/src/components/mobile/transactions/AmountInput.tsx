import { memo, useEffect, useState } from 'react';
import type { FocusEvent } from 'react';

import * as Platform from '@actual-app/core/shared/platform';

import { useFeatureFlag } from '#hooks/useFeatureFlag';

import { CalculatorAmountInput } from './CalculatorAmountInput';
import type { CalculatorAmountInputProps } from './CalculatorAmountInput';
import { FocusableAmountInput } from './FocusableAmountInput';

export type AmountInputProps = Omit<CalculatorAmountInputProps, 'onFocus'> & {
  disableNativeAutoFocusOnIOS?: boolean;
  onFocus?: (event?: FocusEvent<HTMLInputElement>) => void;
  /**
   * Variante `large` más contenida (px). Sin él, la cifra grande de siempre
   * (46 px) de los modales de presupuesto.
   */
  tamanoGrande?: number;
};

export const AmountInput = memo(function AmountInput({
  autoFocus = false,
  disableNativeAutoFocusOnIOS = false,
  disabled,
  inputRef,
  negate = false,
  onBlur,
  onChange,
  onEnter,
  onFocus,
  value,
  variant = 'normal',
  tamanoGrande,
  ...props
}: AmountInputProps) {
  const mobileCalculatorEnabled = useFeatureFlag('mobileCalculator');
  const fallbackAutoFocus =
    autoFocus && !(disableNativeAutoFocusOnIOS && Platform.isIOSAgent);
  const [focused, setFocused] = useState(fallbackAutoFocus);

  useEffect(() => {
    if (fallbackAutoFocus) {
      setFocused(true);
    }
  }, [fallbackAutoFocus]);

  if (mobileCalculatorEnabled) {
    return (
      <CalculatorAmountInput
        {...props}
        autoFocus={autoFocus}
        autoFocusIndirect={disableNativeAutoFocusOnIOS}
        disabled={disabled}
        inputRef={inputRef}
        negate={negate}
        onBlur={onBlur}
        onChange={onChange}
        onEnter={onEnter}
        onFocus={onFocus}
        value={value}
        variant={variant}
        style={
          tamanoGrande
            ? { fontSize: tamanoGrande, ...props.style }
            : props.style
        }
      />
    );
  }

  return (
    <FocusableAmountInput
      {...props}
      disabled={disabled}
      focused={focused}
      inputRef={inputRef}
      onBlur={event => {
        setFocused(false);
        onBlur?.(event);
      }}
      onEnter={() => onEnter?.()}
      onFocus={event => {
        setFocused(true);
        onFocus?.(event);
      }}
      onUpdateAmount={onChange}
      sign={value === 0 ? undefined : value < 0 ? '-' : '+'}
      focusedStyle={
        variant === 'large' && tamanoGrande
          ? {
              width: 'auto',
              minWidth: 120,
              padding: '2px 8px',
            }
          : variant === 'large'
            ? {
                width: 'auto',
                padding: '5px',
                paddingLeft: '20px',
                paddingRight: '20px',
                minWidth: '100%',
              }
            : undefined
      }
      style={props.style}
      textStyle={
        variant === 'large'
          ? {
              fontSize: tamanoGrande ?? 46,
              fontWeight: 800,
              letterSpacing: tamanoGrande ? '-0.02em' : '-0.035em',
              lineHeight: 1.15,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }
          : undefined
      }
      value={value}
      zeroSign={negate ? '-' : '+'}
      hideSignButton={variant === 'large'}
    />
  );
});
