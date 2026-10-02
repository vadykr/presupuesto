import type { CSSProperties } from 'react';

import { Text } from '@actual-app/components/text';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

import { color, num } from './tokens';

type ImporteProps = {
  /** Céntimos enteros. */
  valor: number;
  /** «auto»: rojo si es negativo; «signo»: verde/rojo según el signo. */
  tono?: 'auto' | 'signo' | 'ninguno';
  /** Antepone «+» a los positivos. */
  conSigno?: boolean;
  style?: CSSProperties;
  'data-testid'?: string;
};

/** Importe con el formato del presupuesto (es-ES: «1.234,56 €»), tabular. */
export function Importe({
  valor,
  tono = 'ninguno',
  conSigno = false,
  style,
  'data-testid': testId,
}: ImporteProps) {
  const format = useFormat();
  const texto = format(valor, 'financial');
  const colorTexto =
    tono === 'ninguno'
      ? undefined
      : valor < 0
        ? color.bad
        : tono === 'signo' && valor > 0
          ? color.ok
          : undefined;
  return (
    <PrivacyFilter>
      <Text
        data-testid={testId}
        style={{
          ...num,
          whiteSpace: 'nowrap',
          ...(colorTexto && { color: colorTexto }),
          ...style,
        }}
      >
        {conSigno && valor > 0 ? '+' : ''}
        {texto}
      </Text>
    </PrivacyFilter>
  );
}
