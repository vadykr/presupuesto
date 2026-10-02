import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';

import { textoMes } from '#components/mobile/deudas/textos';
import { useDeuda } from '#components/mobile/deudas/useDeuda';
import {
  Anillo,
  BarraProgreso,
  EstadoVacio,
  Pildora,
  Tarjeta,
} from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { colores, estilos } from '#components/mobile/inicio/inicio.estilos';
import { useCuentasEspeciales } from '#components/mobile/inicio/widgets/useCuentasEspeciales';
import type { Prestamo } from '#components/mobile/inicio/widgets/useCuentasEspeciales';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useLanguage } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

/**
 * Deudas: cada préstamo (cuenta con `#prestamo` en la nota) con el % pagado
 * y la fecha prevista de fin, calculados como en la pantalla de deuda.
 *
 * Tamaños: compacto = anillo y %; normal = barra, pendiente y fin;
 * grande = + cuota e interés.
 */
export function Deudas({ tamano }: PropsWidget) {
  const { t } = useTranslation();
  const { prestamos, cargando } = useCuentasEspeciales();

  return (
    <Tarjeta titulo={t('Debts')} data-testid="inicio-deudas">
      {prestamos.length === 0 ? (
        cargando ? null : (
          <EstadoVacio
            texto={t('No loans. Mark an account as a loan from its menu.')}
          />
        )
      ) : (
        prestamos.map((p, i) => (
          <FilaDeuda
            key={p.account.id}
            prestamo={p}
            tamano={tamano}
            separada={i > 0}
          />
        ))
      )}
    </Tarjeta>
  );
}

function FilaDeuda({
  prestamo: { account, datos },
  tamano,
  separada,
}: {
  prestamo: Prestamo;
  tamano: PropsWidget['tamano'];
  separada: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const language = useLanguage();
  const navigate = useNavigate();
  const deuda = useDeuda(account, datos);
  const porcentaje = Math.round(deuda.porcentajePagado * 100);
  const fin = deuda.amortizacion?.fechaFin;

  return (
    <Button
      variant="bare"
      onPress={() => void navigate(`/accounts/${account.id}`)}
      aria-label={account.name}
      style={{
        ...estilos.fila,
        ...(separada ? estilos.filaSeparada : null),
        justifyContent: 'flex-start',
        textAlign: 'left',
        padding: '8px 0',
        borderRadius: 0,
        width: '100%',
      }}
    >
      <Anillo
        fraccion={deuda.porcentajePagado}
        estado="bien"
        tamano={tamano === 'compacto' ? 40 : 48}
        grosor={5}
        etiqueta={t('{{percent}} paid', { percent: `${porcentaje} %` })}
      >
        <Text style={{ fontSize: 12, fontWeight: 800 }}>{porcentaje}%</Text>
      </Anillo>
      <View style={{ ...estilos.filaTexto, gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TextOneLine style={estilos.filaTitulo}>{account.name}</TextOneLine>
          <PrivacyFilter>
            <Pildora estado="neutro">
              {format(-deuda.saldo, 'financial')}
            </Pildora>
          </PrivacyFilter>
        </View>
        {tamano !== 'compacto' && (
          <>
            <BarraProgreso
              partes={[
                { fraccion: deuda.porcentajePagado, color: colores.acento },
              ]}
            />
            <Text style={estilos.filaSub}>
              {fin
                ? t('{{percent}} paid · ends {{date}}', {
                    percent: `${porcentaje} %`,
                    date: textoMes(fin, language),
                  })
                : t('{{percent}} paid', { percent: `${porcentaje} %` })}
            </Text>
          </>
        )}
        {tamano === 'grande' && deuda.cuota != null && (
          <PrivacyFilter>
            <Text style={estilos.filaSub}>
              {t('Payment {{amount}} · interest {{rate}}', {
                amount: format(deuda.cuota, 'financial'),
                rate:
                  deuda.interesAnual != null
                    ? `${deuda.interesAnual.toLocaleString(language)} %`
                    : '—',
              })}
            </Text>
          </PrivacyFilter>
        )}
      </View>
    </Button>
  );
}
