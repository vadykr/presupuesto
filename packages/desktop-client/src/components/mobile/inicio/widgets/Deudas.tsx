import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';

import { textoMes } from '#components/mobile/deudas/textos';
import { useDeuda } from '#components/mobile/deudas/useDeuda';
import { Anillo, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { useCuentasEspeciales } from '#components/mobile/inicio/widgets/useCuentasEspeciales';
import type { Prestamo } from '#components/mobile/inicio/widgets/useCuentasEspeciales';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { EstadoVacio } from '#components/mobile/ui/EstadoVacio';
import { Pildora } from '#components/mobile/ui/Pildora';
import { color } from '#components/mobile/ui/tokens';
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
    <Tarjeta
      titulo={t('Debts')}
      data-testid="inicio-deudas"
      sinTarjeta={prestamos.length === 0}
      relleno={0}
    >
      {prestamos.length === 0 ? (
        cargando ? null : (
          <EstadoVacio
            anchoIlustracion={96}
            ilustracion="barquito"
            titulo={t('No loans')}
            texto={t('No loans. Mark an account as a loan from its menu.')}
          />
        )
      ) : (
        <View style={{ padding: '4px 14px' }}>
          {prestamos.map((p, i) => (
            <FilaDeuda
              key={p.account.id}
              prestamo={p}
              tamano={tamano}
              separada={i > 0}
            />
          ))}
        </View>
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
        ...estilos.filaBoton,
        padding: '10px 0',
      }}
    >
      <Anillo
        fraccion={deuda.porcentajePagado}
        estado="bien"
        tamano={tamano === 'compacto' ? 40 : 48}
        grosor={4.5}
        etiqueta={t('{{percent}} paid', { percent: `${porcentaje} %` })}
      >
        <Text style={{ fontSize: 12, fontWeight: 800, color: color.ok }}>
          {porcentaje}%
        </Text>
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
            <BarraProgreso valor={deuda.porcentajePagado} color={color.ok} />
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
