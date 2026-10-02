import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { SvgCalendar, SvgEquals } from '@actual-app/components/icons/v1';
import { SvgArrowsSynchronize } from '@actual-app/components/icons/v2';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { currencyToInteger } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { TransactionEntity } from '@actual-app/core/types/models';
import type { Template } from '@actual-app/core/types/models/templates';

import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { InputField } from '#components/mobile/MobileForms';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import { color, movimiento, radio } from '#components/mobile/ui/tokens';
import { MobilePageHeader, Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useBudgetAutomations } from '#hooks/useBudgetAutomations';
import { useCategory } from '#hooks/useCategory';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useNotes } from '#hooks/useNotes';
import { useQuery } from '#hooks/useQuery';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

import { IconoZz } from './IconoZz';
import {
  CADENCIAS_ANUALES,
  cuotaMensual,
  lineasDeObjetivo,
  notaConObjetivo,
  objetivoDesdePlantillas,
} from './objetivos';
import type { CadenciaMeses, Objetivo, TipoObjetivo } from './objetivos';
import { useIgnorarMes } from './useIgnorarMes';

const ALTO_BOTON = 44;

/** Formulario: igual que `Objetivo` pero con todos los campos a la vez. */
type Formulario = {
  tipo: TipoObjetivo;
  importeTexto: string;
  dia: number | null;
  modo: 'apartar' | 'rellenar';
  fecha: string;
  cadaMeses: CadenciaMeses;
};

function formularioDesde(
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

function objetivoDesde(f: Formulario): Objetivo | null {
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
 * «Editar objetivo» de una categoría (solo móvil), calcada de «Edit Target»
 * de YNAB: cada mes / cada semana / cada año / una vez, tendencias de gasto
 * y «Eliminar objetivo». Se guarda como plantilla de Actual en la nota de la
 * categoría (`#template …`) y se recalcula el objetivo del mes.
 */
export function ObjetivoPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id: categoryId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const month =
    monthParam && monthUtils.isValidYearMonth(monthParam)
      ? monthParam
      : monthUtils.currentMonth();

  const { data: category } = useCategory(categoryId);
  const nota = useNotes(categoryId);
  const source =
    category != null && category.template_settings?.source === 'ui'
      ? 'ui'
      : 'notes';

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const onLoaded = useCallback(
    (result: Record<string, Template[]>) => {
      setTemplates(result[categoryId] ?? []);
    },
    [categoryId],
  );
  useBudgetAutomations({ categoryId, source, onLoaded });

  const objetivoActual = useMemo(
    () => (templates ? objetivoDesdePlantillas(templates, nota) : null),
    [templates, nota],
  );

  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (templates && !tocado) {
      setFormulario(
        formularioDesde(
          objetivoActual === 'otro' ? null : objetivoActual,
          month,
          format.forEdit,
        ),
      );
    }
  }, [templates, objetivoActual, tocado, month, format.forEdit]);

  const cambiar = useCallback((cambios: Partial<Formulario>) => {
    setTocado(true);
    setFormulario(prev => (prev ? { ...prev, ...cambios } : prev));
  }, []);

  const [guardando, setGuardando] = useState(false);

  const guardar = useCallback(
    async (lineas: string[], mensaje: string) => {
      if (guardando) {
        return;
      }
      setGuardando(true);
      try {
        // 1. La nota manda: se dejan solo las líneas nuevas de objetivo.
        await send('notes-save', {
          id: categoryId,
          note: notaConObjetivo(nota, lineas),
        });
        // 2. Si la categoría estaba gestionada por la UI de automatizaciones,
        //    vuelve al modo «notas» (vaciando goal_def) para que el parser de
        //    notas sea la única fuente.
        if (source === 'ui') {
          await send('budget/set-category-automations', {
            categoriesWithTemplates: [{ id: categoryId, templates: [] }],
            source: 'notes',
          });
        }
        // 3. Parsear la nota a goal_def y recalcular el objetivo del mes.
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
        void navigate(-1);
      } finally {
        setGuardando(false);
      }
    },
    [categoryId, dispatch, guardando, month, navigate, nota, source],
  );

  const objetivoNuevo = formulario ? objetivoDesde(formulario) : null;
  const fechaPasada =
    objetivoNuevo != null &&
    (objetivoNuevo.tipo === 'anual' || objetivoNuevo.tipo === 'una-vez') &&
    objetivoNuevo.fecha.slice(0, 7) < month;
  const puedeGuardar = objetivoNuevo != null && !fechaPasada && !guardando;

  const onGuardar = () => {
    if (!objetivoNuevo || !puedeGuardar) {
      return;
    }
    void guardar(
      lineasDeObjetivo(objetivoNuevo, monthUtils.currentDay()),
      t('Target saved for {{categoryName}}.', {
        categoryName: category?.name ?? '',
      }),
    );
  };

  const onEliminar = () => {
    void guardar(
      [],
      t('Target removed from {{categoryName}}.', {
        categoryName: category?.name ?? '',
      }),
    );
  };

  const cargando = !category || !formulario;

  return (
    <Page
      padding={0}
      header={
        <MobilePageHeader
          title={<TextOneLine>{category?.name ?? ''}</TextOneLine>}
          leftContent={<MobileBackButton />}
          rightContent={
            <Button
              variant="bare"
              onPress={onGuardar}
              isDisabled={!puedeGuardar}
              data-testid="objetivo-guardar"
              style={{
                margin: 10,
                minHeight: ALTO_BOTON,
                fontWeight: 600,
                opacity: puedeGuardar ? 1 : 0.5,
              }}
            >
              <Trans>Save</Trans>
            </Button>
          }
        />
      }
    >
      {cargando ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <AnimatedLoading width={25} height={25} />
        </View>
      ) : (
        <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
          <View style={{ padding: 10, paddingBottom: 30, gap: 14 }}>
            {objetivoActual === 'otro' && (
              <Aviso>
                <Trans>
                  This category has an automation this screen cannot edit.
                  Saving here replaces it.
                </Trans>
              </Aviso>
            )}
            <Pestanas
              tipo={formulario.tipo}
              onChange={tipo => cambiar({ tipo })}
            />
            <Tarjeta>
              <Campo
                icon={<SvgEquals width={18} height={18} />}
                label={t('I need')}
              >
                <InputField
                  aria-label={t('I need')}
                  inputMode="decimal"
                  value={formulario.importeTexto}
                  placeholder={format(0, 'financial')}
                  onChangeValue={value => cambiar({ importeTexto: value })}
                  data-testid="objetivo-importe"
                  style={{ ...styles.tnum, fontSize: 18, fontWeight: 600 }}
                />
              </Campo>
              {formulario.tipo === 'mensual' && (
                <Campo
                  icon={<SvgCalendar width={18} height={18} />}
                  label={t('Needed by')}
                >
                  <Select
                    value={formulario.dia == null ? 0 : formulario.dia}
                    onChange={dia => cambiar({ dia: dia === 0 ? null : dia })}
                    options={[
                      [0, t('End of month')],
                      ...Array.from({ length: 31 }, (_, i) => {
                        const d = i + 1;
                        return [d, t('Day {{day}}', { day: d })] as [
                          number,
                          string,
                        ];
                      }),
                    ]}
                    style={selectStyle}
                  />
                </Campo>
              )}
              {(formulario.tipo === 'mensual' ||
                formulario.tipo === 'semanal') && (
                <Campo
                  icon={<SvgArrowsSynchronize width={18} height={18} />}
                  label={
                    formulario.tipo === 'mensual'
                      ? t('Next month I want to')
                      : t('Next week I want to')
                  }
                >
                  <Select
                    value={formulario.modo}
                    onChange={modo => cambiar({ modo })}
                    options={[
                      [
                        'apartar',
                        t('Set aside another {{amount}}', {
                          amount: importeFormateado(formulario, format),
                        }),
                      ],
                      [
                        'rellenar',
                        t('Refill up to {{amount}}', {
                          amount: importeFormateado(formulario, format),
                        }),
                      ],
                    ]}
                    style={selectStyle}
                  />
                </Campo>
              )}
              {(formulario.tipo === 'anual' ||
                formulario.tipo === 'una-vez') && (
                <Campo
                  icon={<SvgCalendar width={18} height={18} />}
                  label={
                    formulario.tipo === 'anual'
                      ? t('Needed by')
                      : t('Needed for')
                  }
                >
                  <InputField
                    aria-label={t('Date')}
                    type="date"
                    value={formulario.fecha}
                    min={`${month}-01`}
                    onChangeValue={fecha => cambiar({ fecha })}
                    data-testid="objetivo-fecha"
                    style={{ fontSize: 16 }}
                  />
                  {fechaPasada && (
                    <Text
                      style={{ ...styles.smallText, color: theme.errorText }}
                    >
                      <Trans>The date must be in this month or later.</Trans>
                    </Text>
                  )}
                </Campo>
              )}
              {formulario.tipo === 'anual' && (
                <Campo
                  icon={<SvgArrowsSynchronize width={18} height={18} />}
                  label={t('Repeat')}
                >
                  <Select
                    value={formulario.cadaMeses}
                    onChange={cadaMeses => cambiar({ cadaMeses })}
                    options={CADENCIAS_ANUALES.map(
                      meses =>
                        [
                          meses,
                          meses === 12
                            ? t('Every year')
                            : meses === 24
                              ? t('Every 2 years')
                              : t('Every {{count}} months', { count: meses }),
                        ] as [CadenciaMeses, string],
                    )}
                    style={selectStyle}
                  />
                </Campo>
              )}
              {objetivoNuevo &&
                (objetivoNuevo.tipo === 'anual' ||
                  objetivoNuevo.tipo === 'una-vez') &&
                !fechaPasada && (
                  <CuotaSugerida
                    categoryId={categoryId}
                    importe={objetivoNuevo.importe}
                    fecha={objetivoNuevo.fecha}
                    month={month}
                  />
                )}
            </Tarjeta>

            {objetivoActual !== null && (
              <IgnorarEsteMes categoryId={categoryId} month={month} />
            )}

            <Tendencias
              categoryId={categoryId}
              month={month}
              onFijar={importe =>
                cambiar({ importeTexto: format.forEdit(importe) })
              }
            />

            {objetivoActual !== null && (
              <Button
                onPress={onEliminar}
                isDisabled={guardando}
                data-testid="objetivo-eliminar"
                style={{
                  height: ALTO_BOTON,
                  minHeight: ALTO_BOTON,
                  borderRadius: ALTO_BOTON / 2,
                  marginTop: 10,
                  fontWeight: 600,
                  color: theme.errorText,
                  borderColor: theme.errorText,
                }}
              >
                <Trans>Delete target</Trans>
              </Button>
            )}
            <Text
              style={{
                ...styles.tinyText,
                color: theme.pageTextSubdued,
                textAlign: 'center',
              }}
            >
              {t('Viewing {{month}}', {
                month: monthUtils.format(month, 'MMMM yyyy', locale),
              })}
            </Text>
          </View>
        </SheetNameProvider>
      )}
    </Page>
  );
}

const selectStyle: CSSProperties = {
  minHeight: ALTO_BOTON,
  width: '100%',
  justifyContent: 'space-between',
  fontSize: 16,
};

function importeFormateado(
  f: Formulario,
  format: ReturnType<typeof useFormat>,
): string {
  const importe = currencyToInteger(f.importeTexto) ?? 0;
  return format(importe, 'financial');
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        padding: '10px 14px',
        borderRadius: radio.boton,
        backgroundColor: color.warnSoft,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: 700, color: color.warn }}>
        {children}
      </Text>
    </View>
  );
}

function Pestanas({
  tipo,
  onChange,
}: {
  tipo: TipoObjetivo;
  onChange: (tipo: TipoObjetivo) => void;
}) {
  const { t } = useTranslation();
  const opciones: [TipoObjetivo, string][] = [
    ['mensual', t('Every month')],
    ['semanal', t('Every week')],
    ['anual', t('Every year')],
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

/**
 * «Ignorar este mes» (el *snooze* de YNAB): la categoría deja de contar como
 * infrafinanciada solo este mes. Se guarda en su nota de mes, no en la
 * plantilla.
 */
function IgnorarEsteMes({
  categoryId,
  month,
}: {
  categoryId: string;
  month: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { ignorada, setIgnorada } = useIgnorarMes(categoryId, month);
  const nombreMes = monthUtils.format(month, 'MMMM', locale);
  return (
    <Tarjeta>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
        }}
      >
        <IconoZz
          width={18}
          height={18}
          style={{
            color: ignorada ? color.accent : color.fg3,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <label
            htmlFor="ignorar-mes"
            style={{ fontSize: 15, fontWeight: 700 }}
          >
            {t('Ignore this month ({{month}})', { month: nombreMes })}
          </label>
          <Text style={{ ...styles.tinyText, color: theme.pageTextSubdued }}>
            {ignorada
              ? t(
                  'Not counted as underfunded in {{month}}. The target stays.',
                  {
                    month: nombreMes,
                  },
                )
              : t(
                  'Already covered but short of the target? Skip it this month.',
                )}
          </Text>
        </View>
        <Toggle
          id="ignorar-mes"
          isOn={ignorada}
          onToggle={on => void setIgnorada(on)}
          aria-label={t('Ignore this month ({{month}})', { month: nombreMes })}
        />
      </View>
    </Tarjeta>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        ...estiloTarjeta('normal', 0),
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Campo({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderBottom: `1px solid ${color.line}`,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: color.surface2,
          color: color.fg2,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: 700, color: color.fg3 }}>
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

function CuotaSugerida({
  categoryId,
  importe,
  fecha,
  month,
}: {
  categoryId: string;
  importe: IntegerAmount;
  fecha: string;
  month: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const saldo =
    useSheetValue<'envelope-budget', 'leftover'>(
      envelopeBudget.catBalance(categoryId),
    ) ?? 0;
  const cuota = cuotaMensual(importe, saldo, fecha, month);
  return (
    <View style={{ padding: '10px 12px' }}>
      <PrivacyFilter>
        <Text
          style={{ ...styles.smallText, color: theme.pageTextSubdued }}
          data-testid="objetivo-cuota"
        >
          {t('About {{amount}} per month from now on (you have {{balance}}).', {
            amount: format(cuota, 'financial'),
            balance: format(saldo, 'financial'),
          })}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

function Tendencias({
  categoryId,
  month,
  onFijar,
}: {
  categoryId: string;
  month: string;
  onFijar: (importe: IntegerAmount) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const mesAnterior = monthUtils.prevMonth(month);
  const primerMes = monthUtils.subMonths(month, 12);

  const { data: transacciones } = useQuery<
    Pick<TransactionEntity, 'amount' | 'date'>
  >(
    () =>
      q('transactions')
        .options({ splits: 'inline' })
        .filter({
          category: categoryId,
          $and: [
            { date: { $transform: '$month', $gte: primerMes } },
            { date: { $transform: '$month', $lte: mesAnterior } },
          ],
        })
        .select(['amount', 'date']),
    [categoryId, primerMes, mesAnterior],
  );

  const { media, mesPasado } = useMemo(() => {
    let total = 0;
    let ultimo = 0;
    for (const tr of transacciones ?? []) {
      const gasto = tr.amount < 0 ? -tr.amount : 0;
      total += gasto;
      if (tr.date.slice(0, 7) === mesAnterior) {
        ultimo += gasto;
      }
    }
    return { media: Math.round(total / 12), mesPasado: ultimo };
  }, [transacciones, mesAnterior]);

  const fila = (label: string, importe: IntegerAmount, testId: string) => (
    <Button
      variant="bare"
      onPress={() => onFijar(importe)}
      data-testid={testId}
      aria-label={t('Set target to {{amount}}', {
        amount: format(importe, 'financial'),
      })}
      style={{
        display: 'flex',
        width: '100%',
        minHeight: 48,
        padding: '0 12px',
        borderRadius: 0,
        justifyContent: 'space-between',
        borderBottom: `1px solid ${color.line}`,
      }}
    >
      <Text style={{ color: color.fg, fontWeight: 700 }}>{label}</Text>
      <PrivacyFilter>
        <Text
          style={{
            ...styles.tnum,
            fontWeight: 600,
            color: theme.pageTextPositive,
          }}
        >
          {format(importe, 'financial')}
        </Text>
      </PrivacyFilter>
    </Button>
  );

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        <Text style={{ ...styles.smallText, fontWeight: 600 }}>
          <Trans>Spending trends</Trans>
        </Text>
        <Text style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
          <Trans>Set target to</Trans>
        </Text>
      </View>
      <Tarjeta>
        {fila(t('Average monthly spending'), media, 'objetivo-media')}
        {fila(t('Spent last month'), mesPasado, 'objetivo-mes-pasado')}
      </Tarjeta>
    </View>
  );
}
