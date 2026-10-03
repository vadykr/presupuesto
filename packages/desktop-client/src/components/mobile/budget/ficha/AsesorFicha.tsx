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
import {
  caracterizarSerie,
  redondearA5,
} from '#components/mobile/analisis/motor';
import { useAnalisis } from '#components/mobile/analisis/useAnalisis';
import { Icono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { color, radio, TACTIL, texto } from '#components/mobile/ui/tokens';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget } from '#spreadsheet/bindings';

import { consejoAsigna, consejoNoSeguidos } from './fichaCalculos';

type Item = {
  id: string;
  gravedad: Gravedad;
  titulo: string;
  texto: string;
  accion?: { etiqueta: string; accion: Accion };
};

const COLOR_PUNTO: Record<Gravedad, string> = {
  accion: color.accent,
  aviso: color.warn,
  info: color.fg3,
};

/**
 * «Lo que opina el Asesor» en la ficha: los consejos del motor de
 * `mobile/analisis` para esta categoría y dos reglas propias sencillas
 * (`fichaCalculos.ts`): (a) cuánto asignar frente a lo que se gasta y (b)
 * «no la gastas dos meses seguidos». Enseña uno y «Ver más».
 */
export function AsesorFicha({
  categoryId,
  month,
  meses,
  gasto,
  cuotaObjetivo,
  mesesHistoria,
}: {
  categoryId: string;
  month: string;
  /** Últimos 12 meses completos y su gasto. */
  meses: readonly string[];
  gasto: readonly IntegerAmount[];
  /** Cuota mensual del objetivo (null sin objetivo). */
  cuotaObjetivo: IntegerAmount | null;
  mesesHistoria: number;
}) {
  const siguiente = monthUtils.nextMonth(month);
  return (
    <SheetNameProvider name={monthUtils.sheetForMonth(siguiente)}>
      <ListaAsesor
        categoryId={categoryId}
        siguiente={siguiente}
        meses={meses}
        gasto={gasto}
        cuotaObjetivo={cuotaObjetivo}
        mesesHistoria={mesesHistoria}
      />
    </SheetNameProvider>
  );
}

function ListaAsesor({
  categoryId,
  siguiente,
  meses,
  gasto,
  cuotaObjetivo,
  mesesHistoria,
}: {
  categoryId: string;
  siguiente: string;
  meses: readonly string[];
  gasto: readonly IntegerAmount[];
  cuotaObjetivo: IntegerAmount | null;
  mesesHistoria: number;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const redactor = useRedactor();
  const { visibles } = useAnalisis();
  const { ejecutar } = useAccionesAnalisis();
  const [verMas, setVerMas] = useState(false);
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const asignadoSiguiente =
    useSheetValue<'envelope-budget', 'budget'>(
      envelopeBudget.catBudgeted(categoryId),
    ) ?? 0;

  const items = useMemo(() => {
    const fmt = (v: number) => format(v, 'financial');
    const nombreMes = (mes: string) => monthUtils.format(mes, 'MMMM', locale);
    const lista: Item[] = [];

    // (a) Asigna X; gastas mínimo Y y máximo Z (media W).
    const importe =
      cuotaObjetivo ?? redondearA5(caracterizarSerie(gasto).vigente, 'ceil');
    const a = consejoAsigna(
      gasto,
      importe,
      cuotaObjetivo != null ? 'objetivo' : 'habitual',
    );
    if (a) {
      const origen =
        a.origen === 'objetivo'
          ? t('It is what the target asks for.')
          : t('It is your usual spending.');
      const rango =
        a.minimo != null && a.maximo != null
          ? t(
              'When you spend here, you spend at least {{min}} and at most {{max}}; on average, {{avg}}/month.',
              { min: fmt(a.minimo), max: fmt(a.maximo), avg: fmt(a.media) },
            )
          : t('No spending in the last {{count}} months.', {
              count: gasto.length,
            });
      lista.push({
        id: 'ficha-asigna',
        gravedad: 'accion',
        titulo: t('Assign {{amount}} a month', { amount: fmt(a.importe) }),
        texto: `${origen} ${rango}`,
        accion:
          asignadoSiguiente !== a.importe
            ? {
                etiqueta: t('Budget {{amount}} for {{month}}', {
                  amount: fmt(a.importe),
                  month: nombreMes(siguiente),
                }),
                accion: {
                  tipo: 'ajustar-presupuesto',
                  categoria: categoryId,
                  importe: a.importe,
                  mes: siguiente,
                },
              }
            : undefined,
      });
    }

    // Consejos del motor para esta categoría (estacionalidad, tendencia…).
    for (const consejo of visibles) {
      if (consejo.categoria !== categoryId) {
        continue;
      }
      const { titulo, texto: cuerpo } = redactar(consejo, redactor);
      const etiqueta = textoAccion(consejo, redactor);
      lista.push({
        id: consejo.id,
        gravedad: consejo.gravedad,
        titulo,
        texto: cuerpo,
        accion:
          consejo.accion && etiqueta
            ? { etiqueta, accion: consejo.accion }
            : undefined,
      });
    }

    // (b) No la gastas dos meses seguidos.
    const b = consejoNoSeguidos(gasto);
    if (b) {
      const base = t('Only in {{count}} of {{total}} months', {
        count: b.conGasto,
        total: b.meses,
      });
      const salvo = b.excepcion
        ? t('and, except {{from}}–{{to}}, never two in a row', {
            from: nombreMes(meses[b.excepcion.desde]),
            to: nombreMes(meses[b.excepcion.hasta]),
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
    asignadoSiguiente,
    categoryId,
    cuotaObjetivo,
    format,
    gasto,
    locale,
    meses,
    redactor,
    siguiente,
    t,
    visibles,
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
