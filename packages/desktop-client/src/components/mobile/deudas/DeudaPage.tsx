import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { PAYEE_INTERESES } from '@actual-app/core/shared/prestamos';
import type { DatosPrestamo } from '@actual-app/core/shared/prestamos';
import type { AccountEntity } from '@actual-app/core/types/models';
import { v4 as uuidv4 } from 'uuid';

import { AccountTransactions } from '#components/mobile/accounts/AccountTransactions';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLanguage } from '#hooks/useLocale';
import { usePayees } from '#hooks/usePayees';

import { FormularioPrestamo } from './FormularioPrestamo';
import { interesDelMesARegistrar } from './movimientosDeuda';
import { SimuladorPage } from './SimuladorPage';
import { textoDuracion, textoMes } from './textos';
import { useDeuda } from './useDeuda';

type Pestana = 'deuda' | 'movimientos';

/**
 * Pantalla de una cuenta de deuda: cabecera con saldo, % pagado y fecha de fin,
 * simulador de amortización y, en otra pestaña, los movimientos de siempre.
 */
export function DeudaPage({
  account,
  nota,
  datos,
}: {
  readonly account: AccountEntity;
  readonly nota: string | null;
  readonly datos: DatosPrestamo | null;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>('deuda');

  const editando = searchParams.get('prestamo') === '1';
  const simulando = searchParams.get('vista') === 'simulador';

  const cambiarParametros = (cambios: Record<string, string | null>) =>
    setSearchParams(
      prev => {
        for (const [k, v] of Object.entries(cambios)) {
          if (v == null) {
            prev.delete(k);
          } else {
            prev.set(k, v);
          }
        }
        return prev;
      },
      { replace: false },
    );

  if (editando || !datos) {
    return (
      <FormularioPrestamo
        account={account}
        nota={nota}
        datos={datos}
        onGuardado={() => cambiarParametros({ prestamo: null })}
        onCancelar={() => cambiarParametros({ prestamo: null })}
      />
    );
  }

  if (simulando) {
    return <SimuladorPage account={account} datos={datos} />;
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          margin: '8px 16px',
          borderRadius: 8,
          border: `1px solid ${theme.tableBorder}`,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {(['deuda', 'movimientos'] as const).map(p => (
          <Button
            key={p}
            variant="bare"
            onPress={() => setPestana(p)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 0,
              fontWeight: 600,
              backgroundColor:
                pestana === p ? theme.buttonPrimaryBackground : 'transparent',
              color:
                pestana === p ? theme.buttonPrimaryText : theme.pageTextSubdued,
            }}
          >
            {p === 'deuda' ? t('Debt') : t('Transactions')}
          </Button>
        ))}
      </View>
      {pestana === 'deuda' ? (
        <ResumenDeuda
          account={account}
          datos={datos}
          onSimular={() => cambiarParametros({ vista: 'simulador' })}
          onEditar={() => cambiarParametros({ prestamo: '1' })}
        />
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          <AccountTransactions account={account} />
        </View>
      )}
    </View>
  );
}

function ResumenDeuda({
  account,
  datos,
  onSimular,
  onEditar,
}: {
  readonly account: AccountEntity;
  readonly datos: DatosPrestamo;
  readonly onSimular: () => void;
  readonly onEditar: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const idioma = useLanguage();
  const deuda = useDeuda(account, datos);
  const { data: payees = [] } = usePayees();
  const [registrando, setRegistrando] = useState(false);

  const amort = deuda.amortizacion;
  const faltanDatos = deuda.interesAnual == null || deuda.cuota == null;
  const interesMes =
    deuda.interesAnual != null
      ? interesDelMesARegistrar(-deuda.saldo, deuda.interesAnual)
      : 0;

  async function registrarIntereses() {
    if (interesMes <= 0 || deuda.hayInteresEsteMes) {
      return;
    }
    setRegistrando(true);
    try {
      const existente = payees.find(p => p.name === PAYEE_INTERESES);
      const payee =
        existente?.id ??
        (await send('payee-create', { name: PAYEE_INTERESES }));
      await send('transactions-batch-update', {
        added: [
          {
            id: uuidv4(),
            account: account.id,
            date: monthUtils.currentDay(),
            amount: -interesMes,
            payee,
            notes: t('Interest for {{month}}', {
              month: textoMes(monthUtils.currentMonth(), idioma),
            }),
          },
        ],
      });
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '4px 16px 32px',
      }}
      data-testid="resumen-deuda"
    >
      {/* El View de Actual no fija flexShrink: 0 y, dentro de una columna con
          scroll, sus hijos se comprimen y se solapan. Un único envoltorio con
          flexShrink: 0 hace que el contenido crezca a su altura natural. */}
      <View style={{ flexShrink: 0 }}>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
            <Trans>Balance</Trans>
          </Text>
          <PrivacyFilter>
            <Text
              data-testid="deuda-saldo"
              style={{
                ...styles.tnum,
                fontSize: 28,
                fontWeight: 700,
                color:
                  deuda.saldo > 0 ? theme.numberNegative : theme.numberPositive,
              }}
            >
              {format(-deuda.saldo, 'financial')}
            </Text>
          </PrivacyFilter>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
            marginTop: 14,
          }}
        >
          <Donut porcentaje={deuda.porcentajePagado} />
          <View style={{ flex: 1, gap: 10 }}>
            <Dato
              titulo={t('Paid so far')}
              valor={format(deuda.pagado, 'financial')}
              sub={t('of {{amount}}', {
                amount: format(deuda.saldoInicial, 'financial'),
              })}
            />
            <Dato
              titulo={t('Paid this month')}
              valor={format(deuda.pagadoEsteMes, 'financial')}
              testId="deuda-pagado-mes"
            />
          </View>
        </View>

        <Tarjeta>
          {deuda.saldo === 0 ? (
            <Text style={{ fontWeight: 600, color: theme.numberPositive }}>
              <Trans>Debt paid off!</Trans>
            </Text>
          ) : amort?.noAmortiza ? (
            <Text style={{ color: theme.errorText }} data-testid="deuda-aviso">
              {t(
                'The payment does not even cover the monthly interest, so the debt never goes down. Raise the payment.',
              )}
            </Text>
          ) : amort && amort.mesesRestantes != null && amort.fechaFin ? (
            <Text style={{ lineHeight: '1.4em' }} data-testid="deuda-frase">
              {t(
                'You will pay it off in {{time}} if you pay the monthly payment',
                {
                  time: textoDuracion(t, amort.mesesRestantes),
                },
              )}{' '}
              <Text style={{ fontWeight: 600 }}>
                ({textoMes(amort.fechaFin, idioma)})
              </Text>
            </Text>
          ) : (
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>
                Add the interest and the monthly payment to see the end date.
              </Trans>
            </Text>
          )}
        </Tarjeta>

        {!faltanDatos && (
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginTop: 12,
            }}
          >
            <Celda
              titulo={t('Monthly payment')}
              valor={format(deuda.cuota ?? 0, 'financial')}
            />
            <Celda
              titulo={t('Annual interest')}
              valor={`${(deuda.interesAnual ?? 0).toLocaleString(idioma, { maximumFractionDigits: 3 })} %`}
            />
            <Celda
              titulo={t('Interest still to pay')}
              valor={
                amort && !amort.noAmortiza
                  ? format(amort.interesTotal, 'financial')
                  : '—'
              }
              testId="deuda-interes-total"
            />
            <Celda
              titulo={t('Debt-free date')}
              valor={amort?.fechaFin ? textoMes(amort.fechaFin, idioma) : '—'}
            />
          </View>
        )}

        <View style={{ gap: 10, marginTop: 18 }}>
          <Button
            variant="primary"
            onPress={onSimular}
            isDisabled={faltanDatos || deuda.saldo === 0}
            style={{ height: styles.mobileMinHeight }}
            data-testid="deuda-simular"
          >
            <Trans>Simulate early repayment</Trans>
          </Button>
          <Button
            onPress={registrarIntereses}
            isDisabled={
              registrando ||
              faltanDatos ||
              deuda.hayInteresEsteMes ||
              interesMes <= 0
            }
            style={{ height: styles.mobileMinHeight }}
            data-testid="deuda-registrar-intereses"
          >
            {deuda.hayInteresEsteMes
              ? t('Interest for this month already recorded')
              : t('Record interest for this month ({{amount}})', {
                  amount: format(interesMes, 'financial'),
                })}
          </Button>
          <Button
            variant="bare"
            onPress={onEditar}
            style={{ height: 40 }}
            data-testid="deuda-editar"
          >
            <Trans>Edit loan details</Trans>
          </Button>
        </View>

        {deuda.letras.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              {t('Payments: interest and principal')}
            </Text>
            {deuda.letras.slice(0, 12).map(l => (
              <View
                key={l.id}
                data-testid="deuda-letra"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: `1px solid ${theme.tableBorder}`,
                }}
              >
                <View>
                  <Text style={{ fontSize: 14 }}>
                    {new Date(l.date + 'T00:00:00').toLocaleDateString(idioma, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                    {t('Interest {{interest}} · Principal {{principal}}', {
                      interest: format(l.interes, 'financial'),
                      principal: format(l.capital, 'financial'),
                    })}
                  </Text>
                </View>
                <Text style={{ ...styles.tnum, fontWeight: 600 }}>
                  {format(l.amount, 'financial')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Tarjeta({ children }: { readonly children: ReactNode }) {
  return (
    <View
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 10,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      {children}
    </View>
  );
}

function Dato({
  titulo,
  valor,
  sub,
  testId,
}: {
  readonly titulo: string;
  readonly valor: string;
  readonly sub?: string;
  readonly testId?: string;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {titulo}
      </Text>
      <PrivacyFilter>
        <Text
          data-testid={testId}
          style={{ ...styles.tnum, fontSize: 18, fontWeight: 600 }}
        >
          {valor}
        </Text>
      </PrivacyFilter>
      {sub && (
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function Celda({
  titulo,
  valor,
  testId,
}: {
  readonly titulo: string;
  readonly valor: string;
  readonly testId?: string;
}) {
  return (
    <View
      style={{
        padding: 12,
        minHeight: 64,
        flexShrink: 0,
        borderRadius: 10,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
        {titulo}
      </Text>
      <PrivacyFilter>
        <Text
          data-testid={testId}
          style={{ ...styles.tnum, fontSize: 16, fontWeight: 600 }}
        >
          {valor}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

/** Donut del % pagado, en SVG (hereda los colores del tema). */
function Donut({ porcentaje }: { readonly porcentaje: number }) {
  const radio = 46;
  const grosor = 14;
  const longitud = 2 * Math.PI * radio;
  const pct = Math.round(porcentaje * 100);
  return (
    <View
      style={{ width: 120, height: 120, flexShrink: 0 }}
      data-testid="deuda-donut"
    >
      <svg width="120" height="120" viewBox="0 0 120 120" role="img">
        <circle
          cx="60"
          cy="60"
          r={radio}
          fill="none"
          stroke={theme.tableBorder}
          strokeWidth={grosor}
        />
        <circle
          cx="60"
          cy="60"
          r={radio}
          fill="none"
          stroke={theme.numberPositive}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={`${longitud * porcentaje} ${longitud}`}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="66"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill={theme.pageText}
        >
          {pct} %
        </text>
      </svg>
    </View>
  );
}
