import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { escribirDatosPrestamo } from '@actual-app/core/shared/prestamos';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import { currencyToInteger } from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';

import { FieldLabel, InputField } from '#components/mobile/MobileForms';
import { useFormat } from '#hooks/useFormat';

const TIPOS = [
  'mortgage',
  'autoLoan',
  'personalLoan',
  'studentLoan',
  'otherDebt',
] as const;

function parsearPorcentaje(texto: string): number | null {
  const n = parseFloat(texto.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Formulario de los datos de deuda de una cuenta. Escribe la línea
 * `#prestamo {...}` en la nota de la cuenta y conserva el resto de la nota.
 */
export function FormularioPrestamo({
  account,
  nota,
  datos,
  onGuardado,
  onCancelar,
}: {
  readonly account: AccountEntity;
  readonly nota: string | null;
  readonly datos: DatosPrestamo | null;
  readonly onGuardado: () => void;
  readonly onCancelar: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const [tipo, setTipo] = useState(datos?.tipo ?? 'mortgage');
  const [interes, setInteres] = useState(
    datos?.interes_anual != null ? String(datos.interes_anual) : '',
  );
  const [cuota, setCuota] = useState(
    datos?.cuota_minima != null
      ? format.forEdit(Math.round(datos.cuota_minima * 100))
      : '',
  );
  const [desde, setDesde] = useState(datos?.desde ?? '');
  const [inicial, setInicial] = useState(
    datos?.saldo_inicial
      ? format.forEdit(Math.round(datos.saldo_inicial * 100))
      : '',
  );
  const [error, setError] = useState<string | null>(null);

  const tiposTexto: Record<(typeof TIPOS)[number], string> = {
    mortgage: t('Mortgage'),
    autoLoan: t('Car loan'),
    personalLoan: t('Personal loan'),
    studentLoan: t('Student loan'),
    otherDebt: t('Other debt'),
  };

  async function guardar() {
    const interesNum = parsearPorcentaje(interes);
    const cuotaCent = currencyToInteger(cuota);
    if (interesNum == null) {
      setError(t('Enter the annual interest rate, for example 8.72'));
      return;
    }
    if (cuotaCent == null || cuotaCent <= 0) {
      setError(t('Enter the monthly payment'));
      return;
    }
    const inicialCent = inicial.trim() ? currencyToInteger(inicial) : null;
    const nuevos: DatosPrestamo = {
      tipo,
      interes_anual: interesNum,
      cuota_minima: cuotaCent / 100,
      desde: desde || null,
    };
    if (datos?.escrow) {
      nuevos.escrow = datos.escrow;
    }
    if (inicialCent && inicialCent > 0) {
      nuevos.saldo_inicial = Math.abs(inicialCent) / 100;
    }
    await send('notes-save', {
      id: `account-${account.id}`,
      note: escribirDatosPrestamo(nota, nuevos),
    });
    onGuardado();
  }

  return (
    <View
      style={{ padding: `0 ${styles.mobileEditingPadding}px 30px` }}
      data-testid="formulario-prestamo"
    >
      <Text style={{ marginTop: 16, color: theme.pageTextSubdued }}>
        {t(
          'These details are saved in the account note, in a line that starts with #prestamo.',
        )}
      </Text>

      <FieldLabel title={t('Loan type')} style={{ padding: 0 }} />
      <Select
        value={tipo}
        onChange={setTipo}
        options={TIPOS.map(k => [k, tiposTexto[k]] as [string, string])}
        style={{ height: styles.mobileMinHeight }}
      />

      <FieldLabel title={t('Annual interest (%)')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('Annual interest (%)')}
        inputMode="decimal"
        value={interes}
        placeholder="8,72"
        onChangeValue={setInteres}
        data-testid="prestamo-interes"
        style={{ margin: 0 }}
      />

      <FieldLabel title={t('Monthly payment')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('Monthly payment')}
        inputMode="decimal"
        value={cuota}
        placeholder={format(0, 'financial')}
        onChangeValue={setCuota}
        data-testid="prestamo-cuota"
        style={{ margin: 0 }}
      />

      <FieldLabel title={t('In force since')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('In force since')}
        type="date"
        value={desde}
        onChangeValue={setDesde}
        data-testid="prestamo-desde"
        style={{ margin: 0 }}
      />

      <FieldLabel title={t('Initial debt (optional)')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('Initial debt (optional)')}
        inputMode="decimal"
        value={inicial}
        placeholder={t('Taken from the first movement')}
        onChangeValue={setInicial}
        data-testid="prestamo-inicial"
        style={{ margin: 0 }}
      />

      {error && (
        <Text style={{ color: theme.errorText, marginTop: 14 }}>{error}</Text>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        <Button
          style={{ flex: 1, height: styles.mobileMinHeight }}
          onPress={onCancelar}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          style={{ flex: 1, height: styles.mobileMinHeight }}
          onPress={guardar}
          data-testid="prestamo-guardar"
        >
          <Trans>Save</Trans>
        </Button>
      </View>
    </View>
  );
}
