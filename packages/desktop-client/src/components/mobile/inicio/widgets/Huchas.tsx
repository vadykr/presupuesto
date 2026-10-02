import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { useCuentasEspeciales } from '#components/mobile/inicio/widgets/useCuentasEspeciales';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useQuery } from '#hooks/useQuery';
import { useSheetValue } from '#hooks/useSheetValue';
import * as bindings from '#spreadsheet/bindings';

/**
 * Huchas (Kiara…): cuentas fuera de presupuesto que no son préstamo, con su
 * saldo y, en tamaño normal o grande, el último traspaso.
 */
export function Huchas({ tamano }: PropsWidget) {
  const { t } = useTranslation();
  const { huchas, cargando } = useCuentasEspeciales();

  return (
    <Tarjeta
      titulo={t('Piggy banks')}
      data-testid="inicio-huchas"
      sinTarjeta={huchas.length === 0}
      relleno={0}
    >
      {huchas.length === 0 ? (
        !cargando && (
          <EstadoVacio
            anchoIlustracion={96}
            ilustracion="barquito"
            titulo={t('No piggy banks')}
            texto={t('No off-budget accounts to show.')}
          />
        )
      ) : (
        <View style={{ padding: '4px 14px' }}>
          {huchas.map((h, i) => (
            <FilaHucha
              key={h.id}
              account={h}
              tamano={tamano}
              separada={i > 0}
            />
          ))}
        </View>
      )}
    </Tarjeta>
  );
}

function FilaHucha({
  account,
  tamano,
  separada,
}: {
  account: AccountEntity;
  tamano: PropsWidget['tamano'];
  separada: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const saldo =
    useSheetValue<'account', 'balance'>(bindings.accountBalance(account.id)) ??
    0;

  const { data: ultimos } = useQuery<
    Pick<TransactionEntity, 'id' | 'date' | 'amount'>
  >(
    () =>
      tamano === 'compacto'
        ? null
        : q('transactions')
            .filter({
              account: account.id,
              'payee.transfer_acct': { $ne: null },
            })
            .options({ splits: 'none' })
            .orderBy({ date: 'desc' })
            .limit(1)
            .select(['id', 'date', 'amount']),
    [account.id, tamano],
  );
  const ultimo = ultimos?.[0];

  // Saldo negativo: es una deuda sin marcar como préstamo, no una hucha.
  if (saldo < 0) {
    return null;
  }

  return (
    <Button
      variant="bare"
      onPress={() => void navigate(`/accounts/${account.id}`)}
      aria-label={account.name}
      style={{
        ...estilos.fila,
        ...(separada ? estilos.filaSeparada : null),
        ...estilos.filaBoton,
        padding: '8px 0',
      }}
    >
      <IconoCaja
        icono="piggy"
        tono="ok"
        size={tamano === 'compacto' ? 36 : 44}
      />
      <View style={estilos.filaTexto}>
        <TextOneLine style={estilos.filaTitulo}>{account.name}</TextOneLine>
        {tamano !== 'compacto' && ultimo && (
          <PrivacyFilter>
            <Text style={estilos.filaSub}>
              {t('Last transfer {{amount}} on {{date}}', {
                amount: format(ultimo.amount, 'financial'),
                date: monthUtils.format(ultimo.date, dateFormat),
              })}
            </Text>
          </PrivacyFilter>
        )}
      </View>
      <PrivacyFilter>
        <Text style={estilos.resumenValor}>{format(saldo, 'financial')}</Text>
      </PrivacyFilter>
    </Button>
  );
}
