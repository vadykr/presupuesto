import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';

import { gastoPorCategoria } from '#components/mobile/informes/calculos';
import { BarraApilada } from '#components/mobile/informes/comunes';
import { useCategoriasExcluidas } from '#components/mobile/informes/useCategoriasExcluidas';
import { useColoresCategorias } from '#components/mobile/informes/useColoresCategorias';
import { useTotalesMensuales } from '#components/mobile/informes/useTotalesMensuales';
import { EstadoVacio, Fila, Tarjeta } from '#components/mobile/inicio/comunes';
import type { PropsWidget } from '#components/mobile/inicio/comunes';
import { estilos } from '#components/mobile/inicio/inicio.estilos';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';

/**
 * Gasto del mes: total y barra apilada por categoría (mismos datos, colores
 * y filtro «qué cuenta» que Informes → Este mes).
 *
 * Tamaños: compacto = total; normal = + barra; grande = + las 5 primeras.
 */
export function GastoMes({ tamano, month }: PropsWidget) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const { excluidas } = useCategoriasExcluidas();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: 1,
    hasta: month,
    categoriasExcluidas: excluidas,
  });
  const { colorDe } = useColoresCategorias();
  const desglose = gastoPorCategoria(movimientos, meses, categorias);
  const nombreDe = (id: string | null) =>
    id == null
      ? t('Uncategorized')
      : (categorias.get(id)?.nombre ?? t('Unknown'));

  return (
    <Tarjeta
      titulo={t('Spending this month')}
      data-testid="inicio-gasto-mes"
      accion={
        <Button
          variant="bare"
          onPress={() => void navigate(`/reports/gasto?mes=${month}`)}
          style={estilos.botonCabecera}
        >
          <Trans>See</Trans>
        </Button>
      }
    >
      {!isLoading && desglose.total === 0 ? (
        <EstadoVacio texto={t('No spending yet this month.')} />
      ) : (
        <>
          <PrivacyFilter>
            <Text style={estilos.cifra}>
              {isLoading ? '…' : format(desglose.total, 'financial')}
            </Text>
          </PrivacyFilter>
          {tamano !== 'compacto' && (
            <BarraApilada
              total={desglose.total}
              alto={10}
              segmentos={desglose.filas.map(f => ({
                clave: f.categoria ?? 'sin-categoria',
                valor: f.importe,
                color: colorDe(f.categoria),
                nombre: nombreDe(f.categoria),
              }))}
            />
          )}
          {tamano === 'grande' && (
            <View>
              {desglose.filas.slice(0, 5).map(f => (
                <Fila
                  key={f.categoria ?? 'sin'}
                  separada
                  style={{ minHeight: 38 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colorDe(f.categoria),
                      flexShrink: 0,
                    }}
                  />
                  <TextOneLine
                    style={{ ...estilos.filaTitulo, flex: 1, fontWeight: 600 }}
                  >
                    {nombreDe(f.categoria)}
                  </TextOneLine>
                  <PrivacyFilter>
                    <Text style={estilos.resumenValor}>
                      {format(f.importe, 'financial')}
                    </Text>
                  </PrivacyFilter>
                </Fila>
              ))}
            </View>
          )}
        </>
      )}
    </Tarjeta>
  );
}
