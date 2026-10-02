import React, { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import { currencyToInteger } from '@actual-app/core/shared/util';
import type { AccountEntity } from '@actual-app/core/types/models';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

import { FieldLabel, InputField } from '#components/mobile/MobileForms';
import { useFormat } from '#hooks/useFormat';
import { useLanguage } from '#hooks/useLocale';

import { simularExtra } from './amortizacion';
import type { ModoExtra } from './amortizacion';
import { textoDuracion, textoMes } from './textos';
import { useDeuda } from './useDeuda';

/** Simulador de pago extra: nueva fecha de fin o nueva cuota e interés ahorrado. */
export function SimuladorPage({
  account,
  datos,
}: {
  readonly account: AccountEntity;
  readonly datos: DatosPrestamo;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const idioma = useLanguage();
  const deuda = useDeuda(account, datos);

  const [unicoTexto, setUnicoTexto] = useState('');
  const [mensualTexto, setMensualTexto] = useState('');
  const [modo, setModo] = useState<ModoExtra>('reducir-plazo');

  const unico = Math.max(0, currencyToInteger(unicoTexto) ?? 0);
  const mensual = Math.max(0, currencyToInteger(mensualTexto) ?? 0);

  const resultado = useMemo(
    () =>
      deuda.interesAnual != null && deuda.cuota != null && deuda.saldo > 0
        ? simularExtra(
            deuda.saldo,
            deuda.interesAnual,
            deuda.cuota,
            unico,
            mensual,
            modo,
            deuda.mesProximoPago,
          )
        : null,
    [
      deuda.interesAnual,
      deuda.cuota,
      deuda.saldo,
      deuda.mesProximoPago,
      unico,
      mensual,
      modo,
    ],
  );

  const datosGrafica = useMemo(() => {
    if (!resultado || resultado.simulada.noAmortiza) {
      return [];
    }
    const largo = Math.max(
      resultado.actual.filas.length,
      resultado.simulada.filas.length,
    );
    const puntos = [
      {
        mes: deuda.mesProximoPago,
        actual: resultado.actual.noAmortiza ? undefined : deuda.saldo / 100,
        simulada: Math.max(0, deuda.saldo - unico) / 100,
      },
    ];
    for (let i = 0; i < largo; i++) {
      const a = resultado.actual.filas[i];
      const s = resultado.simulada.filas[i];
      puntos.push({
        mes: (a ?? s).mes,
        actual: resultado.actual.noAmortiza ? undefined : (a?.saldo ?? 0) / 100,
        simulada: (s?.saldo ?? 0) / 100,
      });
    }
    return puntos;
  }, [resultado, deuda.saldo, deuda.mesProximoPago, unico]);

  const hayExtra = unico > 0 || mensual > 0;

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '0 16px 32px',
      }}
      data-testid="simulador"
    >
      <Text style={{ marginTop: 14, color: theme.pageTextSubdued }}>
        {t('Current balance: {{amount}} · payment {{payment}}', {
          amount: format(deuda.saldo, 'financial'),
          payment: format(deuda.cuota ?? 0, 'financial'),
        })}
      </Text>

      <FieldLabel title={t('One-off extra payment')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('One-off extra payment')}
        inputMode="decimal"
        value={unicoTexto}
        placeholder={format(0, 'financial')}
        onChangeValue={setUnicoTexto}
        data-testid="simulador-unico"
        style={{ margin: 0 }}
      />

      <FieldLabel title={t('Extra payment per month')} style={{ padding: 0 }} />
      <InputField
        aria-label={t('Extra payment per month')}
        inputMode="decimal"
        value={mensualTexto}
        placeholder={format(0, 'financial')}
        onChangeValue={setMensualTexto}
        disabled={modo === 'reducir-cuota'}
        data-testid="simulador-mensual"
        style={{ margin: 0, opacity: modo === 'reducir-cuota' ? 0.5 : 1 }}
      />

      <FieldLabel title={t('Use the extra to')} style={{ padding: 0 }} />
      <Select
        value={modo}
        onChange={setModo}
        options={[
          ['reducir-plazo', t('Shorten the term')],
          ['reducir-cuota', t('Lower the monthly payment')],
        ]}
        style={{ height: styles.mobileMinHeight }}
      />
      {modo === 'reducir-cuota' && (
        <Text
          style={{ fontSize: 12, color: theme.pageTextSubdued, marginTop: 6 }}
        >
          {t('Lowering the payment only uses the one-off extra.')}
        </Text>
      )}

      {resultado && resultado.simulada.noAmortiza && !resultado.saldada && (
        <Text
          style={{ marginTop: 18, color: theme.errorText }}
          data-testid="simulador-aviso"
        >
          {t(
            'With this payment the debt never goes down because it does not cover the monthly interest. Add a monthly extra to see a result.',
          )}
        </Text>
      )}

      {resultado && (!resultado.simulada.noAmortiza || resultado.saldada) && (
        <View
          data-testid="simulador-resultado"
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 10,
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.tableBorder}`,
            gap: 10,
          }}
        >
          {resultado.saldada ? (
            <Text style={{ fontWeight: 600, color: theme.numberPositive }}>
              <Trans>That payment would clear the whole debt.</Trans>
            </Text>
          ) : (
            <Fila
              titulo={t('New end date')}
              valor={
                resultado.nuevaFechaFin
                  ? textoMes(resultado.nuevaFechaFin, idioma)
                  : '—'
              }
              sub={
                resultado.simulada.mesesRestantes != null
                  ? hayExtra && resultado.mesesAhorrados > 0
                    ? t('{{time}} sooner', {
                        time: textoDuracion(t, resultado.mesesAhorrados),
                      })
                    : textoDuracion(t, resultado.simulada.mesesRestantes)
                  : undefined
              }
              testId="simulador-fecha"
            />
          )}
          <Fila
            titulo={t('Monthly payment')}
            valor={format(resultado.nuevaCuota, 'financial')}
            testId="simulador-cuota"
          />
          <Fila
            titulo={t('Interest saved')}
            valor={format(resultado.interesAhorrado, 'financial')}
            color={
              resultado.interesAhorrado > 0 ? theme.numberPositive : undefined
            }
            testId="simulador-ahorro"
          />
        </View>
      )}

      {datosGrafica.length > 1 && (
        <View style={{ marginTop: 20 }} data-testid="simulador-grafica">
          <Text style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            <Trans>Remaining balance</Trans>
          </Text>
          <View style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={datosGrafica}
                margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={theme.tableBorder} />
                <XAxis
                  dataKey="mes"
                  interval="preserveStartEnd"
                  minTickGap={40}
                  tickFormatter={(m: string) =>
                    `${m.slice(5)}/${m.slice(2, 4)}`
                  }
                  tick={{ fill: theme.reportsLabel, fontSize: 11 }}
                  stroke={theme.tableBorder}
                />
                <YAxis
                  width={44}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                  tick={{ fill: theme.reportsLabel, fontSize: 11 }}
                  stroke={theme.tableBorder}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={theme.reportsGray}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="simulada"
                  stroke={theme.reportsGreen}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <Leyenda color={theme.reportsGray} texto={t('Current')} />
            <Leyenda color={theme.reportsGreen} texto={t('With the extra')} />
          </View>
        </View>
      )}
    </View>
  );
}

function Fila({
  titulo,
  valor,
  sub,
  color,
  testId,
}: {
  readonly titulo: string;
  readonly valor: string;
  readonly sub?: string;
  readonly color?: string;
  readonly testId?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: theme.pageTextSubdued }}>{titulo}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          data-testid={testId}
          style={{ ...styles.tnum, fontWeight: 700, fontSize: 16, color }}
        >
          {valor}
        </Text>
        {sub && (
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

function Leyenda({
  color,
  texto,
}: {
  readonly color: string;
  readonly texto: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {texto}
      </Text>
    </View>
  );
}
