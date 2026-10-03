import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { useAccionesAnalisis } from '#components/mobile/analisis/acciones';
import { useRedactor } from '#components/mobile/analisis/AnalisisPage';
import { redactar, textoAccion } from '#components/mobile/analisis/frases';
import type { Accion, Gravedad } from '#components/mobile/analisis/motor';
import { useAnalisis } from '#components/mobile/analisis/useAnalisis';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { color, radio, TACTIL, texto } from '#components/mobile/ui/tokens';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget } from '#spreadsheet/bindings';

import {
  consejoAsigna,
  consejoNoSeguidos,
  consejoSobrante,
  mesDeAccion,
  nivelActual,
  sugerenciaDormir,
} from './fichaCalculos';
import type { ResumenObjetivoFicha } from './fichaCalculos';

type Item = {
  id: string;
  gravedad: Gravedad;
  titulo: string;
  texto: string;
  accion?: { etiqueta: string; accion: Accion };
  /** Botón propio de la ficha (p. ej. «Dormir N meses»). */
  boton?: { etiqueta: string; alPulsar: () => void };
};

const COLOR_PUNTO: Record<Gravedad, string> = {
  accion: color.accent,
  aviso: color.warn,
  info: color.fg3,
};

/**
 * «Lo que opina el Asesor» en la ficha: los consejos del motor de
 * `mobile/analisis` para esta categoría y reglas propias sencillas
 * (`fichaCalculos.ts`): (a) cuánto asignar (cuota del objetivo o nivel
 * actual robusto; no sale si el motor ya propone una cifra: una sola
 * recomendación por categoría y manda el motor), sobrante sobre la meta,
 * adelanto sobre el calendario y (b) «no la gastas dos meses seguidos».
 * Enseña uno y «Ver más».
 */
export function AsesorFicha({
  categoryId,
  month,
  meses,
  gasto,
  asignado,
  tieneObjetivo,
  resumen,
  mesesHistoria,
  onDormir,
}: {
  categoryId: string;
  month: string;
  /** Meses completos (hasta 36) y su gasto. */
  meses: readonly string[];
  gasto: readonly IntegerAmount[];
  /** Asignado en el mes visto (decide el mes de los botones). */
  asignado: IntegerAmount;
  tieneObjetivo: boolean;
  resumen: ResumenObjetivoFicha | null;
  mesesHistoria: number;
  /** «Dormir N meses» desde el consejo de adelanto. */
  onDormir?: (meses: number) => void;
}) {
  const destino = mesDeAccion(month, monthUtils.currentMonth(), asignado);
  return (
    <SheetNameProvider name={monthUtils.sheetForMonth(destino)}>
      <ListaAsesor
        categoryId={categoryId}
        destino={destino}
        meses={meses}
        gasto={gasto}
        tieneObjetivo={tieneObjetivo}
        resumen={resumen}
        mesesHistoria={mesesHistoria}
        onDormir={onDormir}
      />
    </SheetNameProvider>
  );
}

function ListaAsesor({
  categoryId,
  destino,
  meses,
  gasto,
  tieneObjetivo,
  resumen,
  mesesHistoria,
  onDormir,
}: {
  categoryId: string;
  destino: string;
  meses: readonly string[];
  gasto: readonly IntegerAmount[];
  tieneObjetivo: boolean;
  resumen: ResumenObjetivoFicha | null;
  mesesHistoria: number;
  /** «Dormir N meses» desde el consejo de adelanto. */
  onDormir?: (meses: number) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const redactor = useRedactor();
  const { visibles } = useAnalisis();
  const { ejecutar } = useAccionesAnalisis();
  const [verMas, setVerMas] = useState(false);
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const asignadoDestino =
    useSheetValue<'envelope-budget', 'budget'>(
      envelopeBudget.catBudgeted(categoryId),
    ) ?? 0;

  const items = useMemo(() => {
    const fmt = (v: number) => format(v, 'financial');
    const nombreMes = (mes: string) => monthUtils.format(mes, 'MMMM', locale);
    const lista: Item[] = [];
    const gasto12 = gasto.slice(-12);
    const meses12 = meses.slice(-12);
    const delMotor = visibles.filter(c => c.categoria === categoryId);
    const motorPropone = delMotor.some(c => c.accion != null);

    const botonPresupuestar = (importe: IntegerAmount) =>
      asignadoDestino !== importe
        ? {
            etiqueta: t('Budget {{amount}} for {{month}}', {
              amount: fmt(importe),
              month: nombreMes(destino),
            }),
            accion: {
              tipo: 'ajustar-presupuesto' as const,
              categoria: categoryId,
              importe,
              mes: destino,
            },
          }
        : undefined;

    // Objetivo por fecha: lo que sobra sobre la meta y el adelanto.
    const sobrante = consejoSobrante(resumen?.sobrante ?? 0);
    if (sobrante) {
      lista.push({
        id: 'ficha-sobrante',
        gravedad: 'accion',
        titulo: t('{{amount}} over the goal', {
          amount: fmt(sobrante.importe),
        }),
        texto: t(
          'You can return it to Ready to Assign or use it: the goal is already covered.',
        ),
      });
    }
    // Ir por delante ya baja la cuota; si sobra margen, se puede dormir N
    // meses y la cuota de después sigue siendo razonable.
    const dormirN =
      resumen && resumen.falta > 0
        ? sugerenciaDormir({
            falta: resumen.falta,
            meses: resumen.meses,
            cuotaNormal: resumen.cuotaNormal,
          })
        : null;
    if (dormirN) {
      lista.push({
        id: 'ficha-dormir',
        gravedad: 'info',
        titulo: t('You can let it sleep {{count}} months', {
          count: dormirN.meses,
        }),
        texto: t(
          'Afterwards the payment would rise to about {{amount}}/month until the date.',
          { amount: fmt(dormirN.cuotaDespues) },
        ),
        boton: onDormir
          ? {
              etiqueta: t('Sleep {{count}} months', { count: dormirN.meses }),
              alPulsar: () => onDormir(dormirN.meses),
            }
          : undefined,
      });
    }

    // (a) Una sola cifra por categoría: si el motor ya propone una (cambio
    // de nivel, estacionalidad, infrapresupuestada…), manda el motor.
    if (!motorPropone && !sobrante && !dormirN) {
      if (tieneObjetivo) {
        const a = consejoAsigna(gasto12, resumen?.cuota ?? null, 'objetivo');
        if (a) {
          const rango =
            a.minimo != null && a.maximo != null
              ? t(
                  'When you spend here, you spend at least {{min}} and at most {{max}}; on average, {{avg}}/month.',
                  { min: fmt(a.minimo), max: fmt(a.maximo), avg: fmt(a.media) },
                )
              : t('No spending in the last {{count}} months.', {
                  count: gasto12.length,
                });
          lista.push({
            id: 'ficha-asigna',
            gravedad: 'accion',
            titulo: t('Assign {{amount}} a month', { amount: fmt(a.importe) }),
            texto: `${t('It is what the target asks for.')} ${rango}`,
            accion: botonPresupuestar(a.importe),
          });
        }
      } else {
        const n = nivelActual(gasto);
        if (n) {
          const partes: string[] = [];
          if (n.puntual != null) {
            partes.push(
              t(
                'In {{month}} you spent {{amount}} (one-off spending, e.g. a large purchase): it does not count towards your usual level.',
                {
                  month: nombreMes(meses[meses.length - 1]),
                  amount: fmt(n.puntual),
                },
              ),
            );
          }
          partes.push(
            n.desde != null
              ? t(
                  'Your spending changed level since {{month}}: between {{min}} and {{max}}.',
                  {
                    month: nombreMes(meses[n.desde]),
                    min: fmt(n.minimo),
                    max: fmt(n.maximo),
                  },
                )
              : t(
                  'It is your usual level: between {{min}} and {{max}} in normal months.',
                  { min: fmt(n.minimo), max: fmt(n.maximo) },
                ),
          );
          if (n.dosMeses) {
            partes.push(
              n.dosMeses === 'sube'
                ? t(
                    'Watch it: two months above. If a third follows, it is a new level.',
                  )
                : t(
                    'Watch it: two months below. If a third follows, it is a new level.',
                  ),
            );
          }
          if (n.puntual != null) {
            partes.push(
              t(
                'If these purchases happen every year, consider a savings goal.',
              ),
            );
          }
          lista.push({
            id: 'ficha-asigna',
            gravedad: 'accion',
            titulo: t('Assign {{amount}} a month', { amount: fmt(n.importe) }),
            texto: partes.join(' '),
            accion: botonPresupuestar(n.importe),
          });
        }
      }
    }

    // Consejos del motor para esta categoría (estacionalidad, tendencia…),
    // con el mismo mes en los botones que la ficha.
    for (const consejo of delMotor) {
      const accion =
        consejo.accion && consejo.datos.tipo !== 'estacionalidad'
          ? { ...consejo.accion, mes: destino }
          : consejo.accion;
      const conMes = accion ? { ...consejo, accion } : consejo;
      const { titulo, texto: cuerpo } = redactar(conMes, redactor);
      const etiqueta = textoAccion(conMes, redactor);
      lista.push({
        id: consejo.id,
        gravedad: consejo.gravedad,
        titulo,
        texto: cuerpo,
        accion: accion && etiqueta ? { etiqueta, accion } : undefined,
      });
    }

    // (b) No la gastas dos meses seguidos.
    const b = consejoNoSeguidos(gasto12);
    if (b) {
      const base = t('Only in {{count}} of {{total}} months', {
        count: b.conGasto,
        total: b.meses,
      });
      const salvo = b.excepcion
        ? t('and, except {{from}}–{{to}}, never two in a row', {
            from: nombreMes(meses12[b.excepcion.desde]),
            to: nombreMes(meses12[b.excepcion.hasta]),
          })
        : t('and never two in a row');
      lista.push({
        id: 'ficha-no-seguidos',
        gravedad: 'info',
        titulo: t("You don't spend it two months in a row"),
        texto: `${base} ${salvo}: ${t("maybe it doesn't need funding every month.")}`,
      });
    }
    return lista;
  }, [
    asignadoDestino,
    categoryId,
    destino,
    format,
    gasto,
    locale,
    meses,
    redactor,
    resumen,
    t,
    tieneObjetivo,
    visibles,
    onDormir,
  ]);

  const mostrados = verMas ? items : items.slice(0, 1);

  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radio.tarjeta,
        padding: 16,
        gap: 10,
      }}
      data-testid="ficha-asesor"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconoCaja icono="sparkle" tono="ok" size={32} />
        <Text style={{ ...texto.titulo, flex: 1 }}>
          {t('What the Advisor thinks')}
        </Text>
      </View>
      {items.length === 0 && (
        <Text style={{ ...texto.secundario, color: color.fg3 }}>
          <Trans>Nothing to say about this category for now.</Trans>
        </Text>
      )}
      {mostrados.map((item, i) => {
        const hecha = hechas.has(item.id);
        return (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingTop: i > 0 ? 10 : 0,
              borderTop: i > 0 ? `1px solid ${color.line}` : undefined,
            }}
            data-testid={`consejo-${item.id}`}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 6,
                flexShrink: 0,
                backgroundColor: COLOR_PUNTO[item.gravedad],
              }}
            />
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: color.fg }}>
                {item.titulo}
              </Text>
              <Text style={{ ...texto.secundario, color: color.fg2 }}>
                {item.texto}
              </Text>
              {item.accion && (
                <Button
                  variant="bare"
                  isDisabled={hecha}
                  onPress={() => {
                    if (item.accion) {
                      void ejecutar(item.accion.accion);
                      setHechas(prev => new Set(prev).add(item.id));
                    }
                  }}
                  data-testid={`consejo-accion-${item.id}`}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: TACTIL,
                    marginTop: 4,
                    padding: '0 14px',
                    borderRadius: radio.boton,
                    backgroundColor: color.okSoft,
                    color: color.ok,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {hecha ? t('Done') : item.accion.etiqueta}
                </Button>
              )}
              {item.boton && (
                <Button
                  variant="bare"
                  isDisabled={hecha}
                  onPress={() => {
                    item.boton?.alPulsar();
                    setHechas(prev => new Set(prev).add(item.id));
                  }}
                  data-testid={`consejo-boton-${item.id}`}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: TACTIL,
                    marginTop: 4,
                    padding: '0 14px',
                    borderRadius: radio.boton,
                    backgroundColor: color.surface2,
                    color: color.fg,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {hecha ? t('Done') : `zZ ${item.boton.etiqueta}`}
                </Button>
              )}
            </View>
          </View>
        );
      })}
      {items.length > 1 && (
        <Button
          variant="bare"
          onPress={() => setVerMas(v => !v)}
          data-testid="asesor-ver-mas"
          style={{
            alignSelf: 'flex-start',
            minHeight: TACTIL,
            padding: '0 4px',
            color: color.accent,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {verMas
            ? t('See less')
            : t('See more ({{count}})', { count: items.length - 1 })}
        </Button>
      )}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingTop: 8,
          borderTop: `1px solid ${color.line}`,
        }}
      >
        <Icono
          nombre="sparkle"
          size={13}
          style={{ color: color.fg3, marginTop: 2 }}
        />
        <Text style={{ fontSize: 12, fontWeight: 500, color: color.fg3 }}>
          {t(
            'Rule-based advice over {{count}} months. Later on, AI will refine it.',
            { count: mesesHistoria },
          )}
        </Text>
      </View>
    </View>
  );
}
