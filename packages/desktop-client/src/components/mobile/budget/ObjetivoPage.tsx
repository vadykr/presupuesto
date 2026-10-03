import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { currencyToInteger } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';

import { color, movimiento, radio } from '#components/mobile/ui/tokens';
import { useCategory } from '#hooks/useCategory';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNotes } from '#hooks/useNotes';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { notaConObjetivo } from './objetivos';
import type { CadenciaMeses, Objetivo, TipoObjetivo } from './objetivos';

const ALTO_BOTON = 44;

/** Formulario: igual que `Objetivo` pero con todos los campos a la vez. */
export type Formulario = {
  tipo: TipoObjetivo;
  importeTexto: string;
  dia: number | null;
  modo: 'apartar' | 'rellenar';
  fecha: string;
  cadaMeses: CadenciaMeses;
};

export function formularioDesde(
  objetivo: Objetivo | null,
  month: string,
  forEdit: (value: IntegerAmount) => string,
): Formulario {
  const base: Formulario = {
    tipo: 'mensual',
    importeTexto: '',
    dia: null,
    modo: 'apartar',
    fecha: `${monthUtils.addMonths(month, 12)}-01`,
    cadaMeses: 12,
  };
  if (!objetivo) {
    return base;
  }
  const importeTexto = forEdit(objetivo.importe);
  switch (objetivo.tipo) {
    case 'mensual':
      return {
        ...base,
        tipo: 'mensual',
        importeTexto,
        dia: objetivo.dia,
        modo: objetivo.modo,
      };
    case 'semanal':
      return { ...base, tipo: 'semanal', importeTexto, modo: objetivo.modo };
    case 'anual':
      return {
        ...base,
        tipo: 'anual',
        importeTexto,
        fecha: objetivo.fecha,
        cadaMeses: objetivo.cadaMeses,
      };
    case 'una-vez':
      return { ...base, tipo: 'una-vez', importeTexto, fecha: objetivo.fecha };
    default:
      return base;
  }
}

export function objetivoDesde(f: Formulario): Objetivo | null {
  const importe = currencyToInteger(f.importeTexto);
  if (importe == null || importe <= 0) {
    return null;
  }
  switch (f.tipo) {
    case 'mensual':
      return { tipo: 'mensual', importe, dia: f.dia, modo: f.modo };
    case 'semanal':
      return { tipo: 'semanal', importe, modo: f.modo };
    case 'anual':
      if (!monthUtils.isValidYearMonthDay(f.fecha)) {
        return null;
      }
      return { tipo: 'anual', importe, fecha: f.fecha, cadaMeses: f.cadaMeses };
    case 'una-vez':
      if (!monthUtils.isValidYearMonthDay(f.fecha)) {
        return null;
      }
      return { tipo: 'una-vez', importe, fecha: f.fecha };
    default:
      return null;
  }
}

/** Texto corto del objetivo («50,52 € al mes», «300 € antes del 15 jul 2027, cada año»). */
export function useResumenObjetivo() {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  return useCallback(
    (objetivo: Objetivo | null | 'otro'): string => {
      if (objetivo === null) {
        return t('No target');
      }
      if (objetivo === 'otro') {
        return t('Advanced automation');
      }
      const importe = format(objetivo.importe, 'financial');
      switch (objetivo.tipo) {
        case 'mensual': {
          const base =
            objetivo.modo === 'rellenar'
              ? t('Refill up to {{amount}} each month', { amount: importe })
              : t('{{amount}} each month', { amount: importe });
          return objetivo.dia
            ? t('{{text}}, by day {{day}}', { text: base, day: objetivo.dia })
            : base;
        }
        case 'semanal':
          return objetivo.modo === 'rellenar'
            ? t('Refill up to {{amount}} each week', { amount: importe })
            : t('{{amount}} each week', { amount: importe });
        case 'anual': {
          const fecha = monthUtils.format(objetivo.fecha, 'd MMM yyyy', locale);
          const cada =
            objetivo.cadaMeses === 12
              ? t('every year')
              : objetivo.cadaMeses === 24
                ? t('every 2 years')
                : t('every {{count}} months', { count: objetivo.cadaMeses });
          return t('{{amount}} by {{date}}, {{repeat}}', {
            amount: importe,
            date: fecha,
            repeat: cada,
          });
        }
        case 'una-vez':
          return t('{{amount}} by {{date}}', {
            amount: importe,
            date: monthUtils.format(objetivo.fecha, 'd MMM yyyy', locale),
          });
        default:
          return '';
      }
    },
    [format, locale, t],
  );
}

/**
 * Guarda un objetivo en la nota de la categoría (la nota manda): sustituye las
 * líneas `#template`/`#goal`/`#objetivo`, vuelve al modo notas si estaba en la
 * UI de automatizaciones, parsea la nota a `goal_def` y recalcula el objetivo
 * del mes. Lo usan la ficha de categoría y los consejos.
 */
export function useGuardarObjetivo(categoryId: string, month: string) {
  const dispatch = useDispatch();
  const { data: category } = useCategory(categoryId);
  const nota = useNotes(categoryId);
  const source =
    category != null && category.template_settings?.source === 'ui'
      ? 'ui'
      : 'notes';
  const [guardando, setGuardando] = useState(false);

  const guardar = useCallback(
    async (lineas: string[], mensaje: string): Promise<boolean> => {
      if (guardando) {
        return false;
      }
      setGuardando(true);
      try {
        await send('notes-save', {
          id: categoryId,
          note: notaConObjetivo(nota, lineas),
        });
        if (source === 'ui') {
          await send('budget/set-category-automations', {
            categoriesWithTemplates: [{ id: categoryId, templates: [] }],
            source: 'notes',
          });
        }
        await send('budget/store-note-templates', [categoryId]);
        await send('budget/refresh-goals', { month });
        if (month !== monthUtils.currentMonth()) {
          await send('budget/refresh-goals', {
            month: monthUtils.currentMonth(),
          });
        }
        dispatch(
          addNotification({
            notification: { type: 'message', message: mensaje, timeout: 4000 },
          }),
        );
        return true;
      } finally {
        setGuardando(false);
      }
    },
    [categoryId, dispatch, guardando, month, nota, source],
  );

  return { guardar, guardando };
}

/**
 * Ruta antigua `/categories/:id/objetivo`: ahora el objetivo se edita en la
 * ficha de la categoría, que se abre con el editor desplegado.
 */
export function ObjetivoPage() {
  const { id: categoryId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const month =
    monthParam && monthUtils.isValidYearMonth(monthParam)
      ? monthParam
      : monthUtils.currentMonth();
  return (
    <Navigate
      replace
      to={`/categories/${categoryId}/ficha?month=${month}&editar=1`}
    />
  );
}

export function Pestanas({
  tipo,
  onChange,
}: {
  tipo: TipoObjetivo;
  onChange: (tipo: TipoObjetivo) => void;
}) {
  const { t } = useTranslation();
  const opciones: [TipoObjetivo, string][] = [
    ['mensual', t('Every month')],
    ['semanal', t('Week')],
    ['anual', t('Year')],
    ['una-vez', t('Once')],
  ];
  return (
    <View
      role="group"
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: radio.boton,
        overflow: 'hidden',
        backgroundColor: color.surface2,
      }}
    >
      {opciones.map(([valor, texto]) => {
        const activa = valor === tipo;
        return (
          <Button
            key={valor}
            variant="bare"
            aria-pressed={activa}
            onPress={() => onChange(valor)}
            data-testid={`objetivo-tipo-${valor}`}
            style={{
              flex: 1,
              height: ALTO_BOTON,
              minHeight: ALTO_BOTON,
              borderRadius: 11,
              padding: 0,
              fontSize: 13,
              whiteSpace: 'nowrap',
              fontWeight: 800,
              color: activa ? color.accent : color.fg3,
              backgroundColor: activa ? color.accentSoft : 'transparent',
              transition: `background-color ${movimiento.pildora}ms, color ${movimiento.pildora}ms`,
            }}
          >
            {texto}
          </Button>
        );
      })}
    </View>
  );
}
