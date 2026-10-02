import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { useQuery } from '@tanstack/react-query';

import { Icono } from '#components/mobile/ui/Icono';
import { HojaSelectorMes, mesLargo } from '#components/mobile/ui/SelectorMes';
import { color, radio, sombra, TACTIL } from '#components/mobile/ui/tokens';
import { useLocale } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { aqlQuery } from '#queries/aqlQuery';

import { GUTTER } from './comunes';
import {
  clavePeriodo,
  parsePeriodo,
  rangoDePeriodo,
  serializarPeriodo,
} from './periodo';
import type { ClavePeriodo, Periodo } from './periodo';

/** Primer mes con movimientos en cuentas del presupuesto (para «Todo»). */
function usePrimerMes(activo: boolean): string | null {
  const { data } = useQuery({
    queryKey: ['informes', 'primer-mes'],
    enabled: activo,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: filas } = await aqlQuery(
        q('transactions')
          .filter({ 'account.offbudget': false })
          .orderBy({ date: 'asc' })
          .limit(1)
          .select(['date']),
      );
      const fecha = (filas as Array<{ date: string }>)[0]?.date;
      return fecha ? fecha.slice(0, 7) : null;
    },
  });
  return data ?? null;
}

/**
 * Periodo de los informes, recordado en la preferencia sincronizada
 * `informes-periodo`. `mesInicial` (p. ej. el `?mes=` del Inicio) manda sobre
 * la preferencia sin sobrescribirla hasta que se elija otro periodo.
 */
export function usePeriodoInformes(mesInicial?: string | null) {
  const [raw, setRaw] = useSyncedPref('informes-periodo');
  const [local, setLocal] = useState<Periodo | null>(
    mesInicial ? { tipo: 'mes', mes: mesInicial } : null,
  );
  const periodo = local ?? parsePeriodo(raw);
  const primerMes = usePrimerMes(periodo.tipo === 'todo');
  const rango = rangoDePeriodo(periodo, primerMes);

  const setPeriodo = useCallback(
    (nuevo: Periodo) => {
      setLocal(null);
      setRaw(serializarPeriodo(nuevo));
    },
    [setRaw],
  );

  return { periodo, setPeriodo, rango };
}

/** «Octubre 2026», «Últimos 3 meses», «Año en curso»… */
export function useEtiquetaPeriodo() {
  const { t } = useTranslation();
  const locale = useLocale();
  return useCallback(
    (periodo: Periodo): string => {
      switch (periodo.tipo) {
        case 'mes':
          return mesLargo(periodo.mes ?? monthUtils.currentMonth(), locale);
        case 'ultimos':
          return t('Last {{count}} months', { count: periodo.meses });
        case 'ano':
          return t('Year to date');
        case 'ano-pasado':
          return t('Last year');
        default:
          return t('All time');
      }
    },
    [locale, t],
  );
}

type SelectorPeriodoProps = {
  periodo: Periodo;
  onChange: (periodo: Periodo) => void;
};

/**
 * Botón de periodo de los informes (estilo YNAB): enseña el periodo elegido
 * y abre un menú con «Mes…» (rejilla de meses) y los periodos habituales.
 */
export function SelectorPeriodo({ periodo, onChange }: SelectorPeriodoProps) {
  const { t } = useTranslation();
  const etiqueta = useEtiquetaPeriodo();
  const ref = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mesAbierto, setMesAbierto] = useState(false);
  const actual = monthUtils.currentMonth();
  const clave = clavePeriodo(periodo);

  const opciones = useMemo<
    Array<{ clave: ClavePeriodo; texto: string; periodo?: Periodo }>
  >(
    () => [
      { clave: 'mes', texto: t('Month…') },
      {
        clave: '3',
        texto: t('Last {{count}} months', { count: 3 }),
        periodo: { tipo: 'ultimos', meses: 3 },
      },
      {
        clave: '6',
        texto: t('Last {{count}} months', { count: 6 }),
        periodo: { tipo: 'ultimos', meses: 6 },
      },
      {
        clave: '12',
        texto: t('Last {{count}} months', { count: 12 }),
        periodo: { tipo: 'ultimos', meses: 12 },
      },
      { clave: 'ano', texto: t('Year to date'), periodo: { tipo: 'ano' } },
      {
        clave: 'ano-pasado',
        texto: t('Last year'),
        periodo: { tipo: 'ano-pasado' },
      },
      { clave: 'todo', texto: t('All time'), periodo: { tipo: 'todo' } },
    ],
    [t],
  );

  return (
    <View
      ref={ref}
      style={{ paddingLeft: GUTTER, paddingRight: GUTTER, flexShrink: 0 }}
    >
      <Button
        variant="bare"
        data-testid="selector-periodo"
        aria-haspopup="dialog"
        aria-label={t('Period: {{period}}', { period: etiqueta(periodo) })}
        onPress={() => setMenuAbierto(true)}
        style={{
          alignSelf: 'flex-start',
          minHeight: 40,
          padding: '0 12px 0 14px',
          gap: 6,
          borderRadius: radio.pildora,
          backgroundColor: color.surface,
          boxShadow: sombra.tarjeta,
          color: color.fg,
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        <Icono nombre="cal" size={16} style={{ color: color.fg3 }} />
        <Text style={{ color: 'inherit', whiteSpace: 'nowrap' }}>
          {etiqueta(periodo)}
        </Text>
        <Icono nombre="cd" size={16} style={{ color: color.fg3 }} />
      </Button>
      <Popover
        triggerRef={ref}
        isOpen={menuAbierto}
        placement="bottom start"
        offset={6}
        onOpenChange={() => setMenuAbierto(false)}
        style={{
          backgroundColor: color.surface,
          borderRadius: radio.tarjeta,
          boxShadow: sombra.hoja,
          padding: 6,
          minWidth: 220,
          marginLeft: GUTTER,
        }}
      >
        <View role="group" data-testid="menu-periodo" aria-label={t('Period')}>
          {opciones.map(o => {
            const elegida = o.clave === clave;
            return (
              <Button
                key={o.clave}
                variant="bare"
                data-selected={elegida || undefined}
                onPress={() => {
                  setMenuAbierto(false);
                  if (o.periodo) {
                    onChange(o.periodo);
                  } else {
                    setMesAbierto(true);
                  }
                }}
                style={{
                  minHeight: TACTIL,
                  padding: '0 12px',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderRadius: radio.boton,
                  fontSize: 14,
                  fontWeight: elegida ? 800 : 600,
                  color: elegida ? color.accent : color.fg,
                }}
              >
                <Text style={{ color: 'inherit' }}>{o.texto}</Text>
                {elegida && <Icono nombre="check" size={16} />}
              </Button>
            );
          })}
        </View>
      </Popover>
      <HojaSelectorMes
        abierto={mesAbierto}
        onClose={() => setMesAbierto(false)}
        mes={periodo.tipo === 'mes' ? (periodo.mes ?? actual) : actual}
        maximo={actual}
        onChange={mes => onChange({ tipo: 'mes', mes })}
      />
    </View>
  );
}
