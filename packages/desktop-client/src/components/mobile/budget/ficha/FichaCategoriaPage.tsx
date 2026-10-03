import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { currencyToInteger } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';
import type { Template } from '@actual-app/core/types/models/templates';

import {
  useBudgetActions,
  useDeleteCategoryMutation,
  useSaveCategoryMutation,
} from '#budget';
import type { ApplyBudgetActionPayload } from '#budget';
import {
  formularioDesde,
  objetivoDesde,
  Pestanas,
  useGuardarObjetivo,
  useResumenObjetivo,
} from '#components/mobile/budget/ObjetivoPage';
import type { Formulario } from '#components/mobile/budget/ObjetivoPage';
import {
  CADENCIAS_ANUALES,
  cuotaMensual,
  estadoFila,
  lineasDeObjetivo,
  metaDeObjetivo,
  notaSinObjetivo,
  objetivoDesdePlantillas,
} from '#components/mobile/budget/objetivos';
import type {
  CadenciaMeses,
  Objetivo,
} from '#components/mobile/budget/objetivos';
import {
  useDespertarAuto,
  useIgnorarMes,
} from '#components/mobile/budget/useIgnorarMes';
import { evolucionCategoria } from '#components/mobile/informes/calculos';
import { useTotalesMensuales } from '#components/mobile/informes/useTotalesMensuales';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { InputField } from '#components/mobile/MobileForms';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { Boton } from '#components/mobile/ui/Boton';
import { Icono } from '#components/mobile/ui/Icono';
import type { NombreIcono } from '#components/mobile/ui/Icono';
import { IconoCaja } from '#components/mobile/ui/IconoCaja';
import { Pildora } from '#components/mobile/ui/Pildora';
import type { EstadoPildora } from '#components/mobile/ui/Pildora';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  densidad,
  espacio,
  num,
  radio,
  TACTIL,
  texto,
} from '#components/mobile/ui/tokens';
import { Notes } from '#components/Notes';
import { MobilePageHeader, Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategory } from '#hooks/useCategory';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useNotes } from '#hooks/useNotes';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSheetValue } from '#hooks/useSheetValue';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget } from '#spreadsheet/bindings';

import { AsesorFicha } from './AsesorFicha';
import { BurbujaDormida, BurbujaSueno } from './BurbujaSueno';
import {
  ChipsEvolucion,
  GraficoGasto,
  GraficoSaldo,
  MapaMeses,
} from './EvolucionFicha';
import type { VistaEvolucion } from './EvolucionFicha';
import {
  bandaFicha,
  consejoAdelanto,
  esObjetivoDeSaldo,
  filasEstacionalidad,
  mesesAnteriores,
  mesesConHistoria,
  resumenObjetivo,
} from './fichaCalculos';
import type { EstadoObjetivo } from './fichaCalculos';
import { useHistoriaCategoria } from './useDatosFicha';

/** Meses de historial (3 años + el actual): misma caché que el análisis. */
const MESES_HISTORIAL = 37;

/**
 * Ficha única de una categoría («Diseño 1 · Ficha única»): disponible del
 * mes con su desglose, objetivo editable en el sitio (con «Ignorar este
 * mes»), evolución (gasto, saldo, mapa de meses), lo que opina el Asesor,
 * notas y acciones. Sustituye al doble paso «Detalles» → «Objetivo».
 */
export function FichaCategoriaPage() {
  const { id: categoryId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const month =
    monthParam && monthUtils.isValidYearMonth(monthParam)
      ? monthParam
      : monthUtils.currentMonth();
  const editar = searchParams.get('editar') === '1';
  const { data: category } = useCategory(categoryId);

  return (
    <Page
      padding={0}
      header={
        <MobilePageHeader
          title={<TextOneLine>{category?.name ?? ''}</TextOneLine>}
          leftContent={<MobileBackButton />}
          rightContent={
            category ? <MenuFicha category={category} month={month} /> : null
          }
        />
      }
    >
      {category && (
        <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
          <ContenidoFicha
            key={category.id}
            category={category}
            month={month}
            editarAlAbrir={editar}
          />
        </SheetNameProvider>
      )}
    </Page>
  );
}

function MenuFicha({
  category,
  month,
}: {
  category: CategoryEntity;
  month: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ref = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const { isPinned, togglePinned } = usePinnedCategories();
  const fijada = isPinned(category.id);
  return (
    <Button
      ref={ref}
      variant="bare"
      aria-label={t('More')}
      onPress={() => setAbierto(true)}
      style={{ minWidth: TACTIL, minHeight: TACTIL, margin: '0 6px' }}
    >
      <Icono nombre="more" size={20} />
      <Popover
        triggerRef={ref}
        isOpen={abierto}
        placement="bottom end"
        onOpenChange={() => setAbierto(false)}
      >
        <Menu
          items={[
            ...(category.is_income
              ? []
              : [
                  {
                    name: 'pin',
                    text: fijada ? t('Unpin from home') : t('Pin to home'),
                  },
                ]),
            { name: 'movimientos', text: t('See transactions') },
          ]}
          onMenuSelect={name => {
            setAbierto(false);
            if (name === 'pin') {
              togglePinned(category.id);
            } else if (name === 'movimientos') {
              void navigate(`/categories/${category.id}?month=${month}`);
            }
          }}
        />
      </Popover>
    </Button>
  );
}

function plantillasDe(goalDef: string | null | undefined): Template[] {
  if (!goalDef) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(goalDef);
    return Array.isArray(parsed) ? (parsed as Template[]) : [];
  } catch {
    return [];
  }
}

function ContenidoFicha({
  category,
  month,
  editarAlAbrir,
}: {
  category: CategoryEntity;
  month: string;
  editarAlAbrir: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const id = category.id;
  const nota = useNotes(id);

  const asignadoHoja = useSheetValue<'envelope-budget', 'budget'>(
    envelopeBudget.catBudgeted(id),
  );
  const actividadHoja = useSheetValue<'envelope-budget', 'sum-amount'>(
    envelopeBudget.catSumAmount(id),
  );
  const saldoHoja = useSheetValue<'envelope-budget', 'leftover'>(
    envelopeBudget.catBalance(id),
  );
  const asignado = asignadoHoja ?? 0;
  const actividad = actividadHoja ?? 0;
  const saldo = saldoHoja ?? 0;
  const goal = useSheetValue<'envelope-budget', 'goal'>(
    envelopeBudget.catGoal(id),
  );
  const longGoal =
    useSheetValue<'envelope-budget', 'long-goal'>(
      envelopeBudget.catLongGoal(id),
    ) === 1;
  const sueno = useIgnorarMes(id, month);
  const { ignorada } = sueno;
  // Despertar automático al verla (fecha, gasto o dinero que sale): pop.
  const [pop, setPop] = useState(0);
  useDespertarAuto({
    categoryId: id,
    month,
    actividad: actividadHoja,
    saldo: saldoHoja,
    asignado: asignadoHoja,
    onDespierta: () => setPop(Date.now()),
  });

  const objetivo = useMemo(
    () => objetivoDesdePlantillas(plantillasDe(category.goal_def), nota),
    [category.goal_def, nota],
  );
  const objetivoValido =
    objetivo != null && objetivo !== 'otro' ? objetivo : null;
  const resumen = objetivoValido
    ? resumenObjetivo({
        objetivo: objetivoValido,
        saldo,
        asignado,
        actividad,
        goal,
        month,
      })
    : null;

  // Historia: 36 meses completos de gasto y 12 + el actual de saldo.
  const { movimientos } = useTotalesMensuales({
    meses: MESES_HISTORIAL,
    hasta: month,
    incluirOcultas: true,
  });
  const meses36 = useMemo(() => mesesAnteriores(month, 36), [month]);
  const gasto36 = useMemo(
    () => evolucionCategoria(movimientos, id, meses36, !!category.is_income),
    [movimientos, id, meses36, category.is_income],
  );
  const meses12 = meses36.slice(-12);
  const gasto12 = gasto36.slice(-12);
  const mesesSaldo = useMemo(
    () => [...mesesAnteriores(month, 12), month],
    [month],
  );
  const historia = useHistoriaCategoria(id, mesesSaldo);
  const filasMapa = useMemo(() => filasEstacionalidad(month, 2), [month]);
  const valoresMapa = filasMapa.map(fila =>
    fila.map(mes => gasto36[meses36.indexOf(mes)] ?? 0),
  );
  const banda = bandaFicha(gasto36);

  const deSaldo = esObjetivoDeSaldo(objetivoValido, longGoal);
  const [vista, setVista] = useState<VistaEvolucion>(
    deSaldo ? 'saldo' : 'gasto',
  );

  const nombreMes = monthUtils.format(month, 'MMMM', locale);
  const nombreMesCorto = monthUtils
    .format(month, 'MMM', locale)
    .replace('.', '');

  return (
    <View
      style={{
        padding: `${espacio.fila}px ${espacio.margen}px 32px`,
        flexShrink: 0,
        gap: espacio.fila + 4,
      }}
    >
      <Cabecera
        nombreMes={nombreMes}
        nombreMesCorto={nombreMesCorto}
        saldo={saldo}
        asignado={asignado}
        actividad={actividad}
        estado={estadoFila({
          goal: goal ?? null,
          longGoal,
          budgeted: asignado,
          balance: saldo,
          spent: actividad,
          ignorada,
          meta: metaDeObjetivo(objetivoValido),
        })}
        resumen={resumen}
        progreso={resumen?.progreso ?? null}
        meta={objetivoValido?.importe ?? null}
        onActividad={() => void navigate(`/categories/${id}?month=${month}`)}
      />

      <TarjetaObjetivo
        category={category}
        month={month}
        objetivo={objetivo}
        estado={resumen?.estado ?? null}
        resumen={resumen}
        saldo={saldo}
        asignado={asignado}
        actividad={actividad}
        sueno={sueno}
        pop={pop}
        editarAlAbrir={editarAlAbrir}
      />

      <Seccion
        icono="pie"
        titulo={t('Evolution')}
        derecha={<ChipsEvolucion vista={vista} onChange={setVista} />}
      >
        {vista === 'gasto' && (
          <GraficoGasto
            meses={meses12}
            gasto={gasto12}
            asignado={historia.asignado.slice(0, 12)}
            banda={banda}
          />
        )}
        {vista === 'saldo' && (
          <GraficoSaldo
            meses={mesesSaldo}
            saldo={[...historia.saldo.slice(0, 12), saldo]}
            meta={
              objetivoValido &&
              (objetivoValido.tipo === 'una-vez' ||
                objetivoValido.tipo === 'anual')
                ? {
                    importe: objetivoValido.importe,
                    mes: (resumen?.fecha ?? objetivoValido.fecha).slice(0, 7),
                  }
                : null
            }
          />
        )}
        {vista === 'meses' && (
          <MapaMeses filas={filasMapa} valores={valoresMapa} />
        )}
      </Seccion>

      {!category.is_income && (
        <AsesorFicha
          categoryId={id}
          month={month}
          meses={meses36}
          gasto={gasto36}
          asignado={asignado}
          tieneObjetivo={objetivoValido != null}
          resumen={resumen}
          onDormir={meses =>
            sueno.dormirHasta(
              monthUtils.addMonths(month, meses),
              asignado,
              saldo,
            )
          }
          mesesHistoria={Math.max(mesesConHistoria(gasto36), 12)}
        />
      )}

      <NotasFicha category={category} nota={nota} />

      <PieFicha category={category} />

      <Text
        style={{
          fontSize: 12,
          color: color.fg3,
          textAlign: 'center',
        }}
      >
        {t('Viewing {{month}}', {
          month: monthUtils.format(month, 'MMMM yyyy', locale),
        })}
      </Text>
    </View>
  );
}

const ESTADO_CABECERA: Record<
  ReturnType<typeof estadoFila>['tipo'],
  EstadoPildora
> = {
  'gastado-de-mas': 'rojo',
  falta: 'aviso',
  sobrefinanciada: 'ok',
  financiada: 'ok',
  'sin-objetivo': 'neutro',
  ignorada: 'ignorada',
};

function Cabecera({
  nombreMes,
  nombreMesCorto,
  saldo,
  asignado,
  actividad,
  estado,
  progreso,
  meta,
  resumen,
  onActividad,
}: {
  resumen: ReturnType<typeof resumenObjetivo> | null;
  nombreMes: string;
  nombreMesCorto: string;
  saldo: IntegerAmount;
  asignado: IntegerAmount;
  actividad: IntegerAmount;
  estado: ReturnType<typeof estadoFila>;
  progreso: number | null;
  meta: IntegerAmount | null;
  onActividad: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const fmt = (v: number) => format(v, 'financial');
  const textoEstado = (() => {
    switch (estado.tipo) {
      case 'gastado-de-mas':
        return t('Overspent by {{amount}}', { amount: fmt(estado.importe) });
      case 'falta':
        return t('{{amount}} short this month', {
          amount: fmt(estado.importe),
        });
      case 'sobrefinanciada':
      case 'financiada':
        // Objetivo por fecha: dice también lo que sobra o lo adelantado.
        if (resumen && resumen.sobrante > 0) {
          return t('Covered · {{amount}} over the goal', {
            amount: fmt(resumen.sobrante),
          });
        }
        if (resumen && resumen.adelanto > 0) {
          return t('Covered · {{amount}} ahead', {
            amount: fmt(resumen.adelanto),
          });
        }
        return t('Covered this month');
      case 'ignorada':
        return t('Ignored this month');
      default:
        return saldo > 0 ? t('Money available') : t('Nothing pending');
    }
  })();
  const anterior = saldo - asignado - actividad;

  return (
    <View style={{ ...estiloTarjeta('normal', 0), overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={{ ...texto.etiqueta, color: color.fg3 }}>
            {t('Available in {{month}}', { month: nombreMes })}
          </Text>
          <PrivacyFilter>
            <Text
              data-testid="ficha-disponible"
              style={{
                ...texto.heroe,
                ...num,
                color: saldo < 0 ? color.bad : color.fg,
              }}
            >
              {fmt(saldo)}
            </Text>
          </PrivacyFilter>
          <View style={{ flexDirection: 'row' }}>
            <Pildora
              estado={ESTADO_CABECERA[estado.tipo]}
              data-testid="ficha-estado"
            >
              {estado.tipo === 'financiada' ||
              estado.tipo === 'sobrefinanciada' ? (
                <Icono nombre="check" size={13} strokeWidth={3} />
              ) : null}
              {textoEstado}
            </Pildora>
          </View>
        </View>
        {progreso != null && meta != null && (
          <Anillo progreso={progreso} meta={meta} />
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderTop: `1px solid ${color.line}`,
        }}
      >
        <Desglose
          primera
          etiqueta={t('From last month')}
          valor={fmt(anterior)}
          tono={anterior < 0 ? color.bad : color.fg}
        />
        <Desglose
          etiqueta={t('Assigned {{month}}', { month: nombreMesCorto })}
          valor={`${asignado > 0 ? '+' : ''}${fmt(asignado)}`}
          tono={asignado > 0 ? color.ok : color.fg}
        />
        <Desglose
          etiqueta={t('Activity {{month}}', { month: nombreMesCorto })}
          valor={fmt(actividad)}
          tono={actividad < 0 ? color.bad : color.fg}
          onPress={onActividad}
        />
      </View>
    </View>
  );
}

function Desglose({
  primera = false,
  etiqueta,
  valor,
  tono,
  onPress,
}: {
  primera?: boolean;
  etiqueta: string;
  valor: string;
  tono: string;
  onPress?: () => void;
}) {
  const contenido = (
    <>
      <Text
        style={{
          ...densidad.pequeno,
          fontWeight: 500,
          color: color.fg3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {etiqueta}
      </Text>
      <PrivacyFilter>
        <Text style={{ ...densidad.cifra, color: tono }}>{valor}</Text>
      </PrivacyFilter>
    </>
  );
  const estilo = {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    gap: 2,
    alignItems: 'flex-start' as const,
    borderLeft: primera ? undefined : `1px solid ${color.line}`,
  };
  return onPress ? (
    <Button
      variant="bare"
      onPress={onPress}
      style={{ ...estilo, borderRadius: 0, justifyContent: 'center' }}
    >
      <View style={{ gap: 2, minWidth: 0, width: '100%' }}>{contenido}</View>
    </Button>
  ) : (
    <View style={estilo}>{contenido}</View>
  );
}

function Anillo({ progreso, meta }: { progreso: number; meta: IntegerAmount }) {
  const { t } = useTranslation();
  const format = useFormat();
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <View
      style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}
      data-testid="ficha-anillo"
    >
      <svg width={84} height={84} viewBox="0 0 84 84" aria-hidden>
        <circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          stroke={color.surface3}
          strokeWidth={8}
        />
        <circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          stroke={color.accent}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${c * progreso} ${c}`}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: 800, ...num }}>
          {Math.round(progreso * 100)} %
        </Text>
        <PrivacyFilter>
          <Text style={{ fontSize: 11, fontWeight: 600, color: color.fg3 }}>
            {t('of {{amount}}', {
              amount: format(meta, 'financial-no-decimals'),
            })}
          </Text>
        </PrivacyFilter>
      </View>
    </View>
  );
}

function Seccion({
  icono,
  titulo,
  derecha,
  children,
  testId,
}: {
  icono: NombreIcono;
  titulo: string;
  derecha?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <View
      style={{ ...estiloTarjeta('normal', 16), gap: 10, minWidth: 0 }}
      data-testid={testId}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 10,
          minHeight: TACTIL,
          margin: '-6px 0',
        }}
      >
        <IconoCaja icono={icono} tono="acento" size={32} />
        <Text style={{ ...texto.titulo, flex: 1, minWidth: 0 }}>{titulo}</Text>
        {derecha}
      </View>
      {children}
    </View>
  );
}

const ESTADO_OBJETIVO: Record<EstadoObjetivo, EstadoPildora> = {
  rumbo: 'ok',
  adelantado: 'ok',
  cumplido: 'ok',
  atrasado: 'aviso',
};

function TarjetaObjetivo({
  category,
  month,
  objetivo,
  estado,
  resumen,
  saldo,
  asignado,
  actividad,
  sueno,
  pop,
  editarAlAbrir,
}: {
  category: CategoryEntity;
  month: string;
  objetivo: Objetivo | null | 'otro';
  estado: EstadoObjetivo | null;
  resumen: ReturnType<typeof resumenObjetivo> | null;
  saldo: IntegerAmount;
  asignado: IntegerAmount;
  actividad: IntegerAmount;
  sueno: ReturnType<typeof useIgnorarMes>;
  /** Marca de tiempo del último despertar automático (0 = ninguno). */
  pop: number;
  editarAlAbrir: boolean;
}) {
  const { ignorada, setIgnorada, dormida, dormirHasta } = sueno;
  const locale = useLocale();
  const zzRef = useRef<HTMLButtonElement>(null);
  const [menuSueno, setMenuSueno] = useState(false);
  const { t } = useTranslation();
  const format = useFormat();
  const resumenTexto = useResumenObjetivo();
  const applyBudgetAction = useBudgetActions();
  const { showUndoNotification } = useUndo();
  const [abierto, setAbierto] = useState(editarAlAbrir);
  const [burbuja, setBurbuja] = useState<{
    modo: 'dormir' | 'despertar';
    clave: number;
  } | null>(null);
  const finBurbuja = useCallback(() => setBurbuja(null), []);
  useEffect(() => {
    if (pop) {
      setBurbuja({ modo: 'despertar', clave: pop });
    }
  }, [pop]);
  const fmt = (v: number) => format(v, 'financial');

  const mesCorto = (mes: string) =>
    monthUtils.format(mes, 'MMM yyyy', locale).replace('.', '');
  const textoEstado = dormida
    ? t('Asleep until {{month}}', { month: mesCorto(dormida.hasta) })
    : ignorada
      ? t('Ignored this month')
      : estado === 'adelantado'
        ? `⛵ ${t('Ahead')}`
        : estado === 'rumbo'
          ? `⛵ ${t('Steady course')}`
          : estado === 'cumplido'
            ? t('Reached')
            : estado === 'atrasado'
              ? t('Behind')
              : null;

  // «Devolver X a Listo para asignar» (solo el sobrante sobre la meta, que se
  // puede mover sin riesgo). Si cabe en lo asignado este mes, se baja lo
  // asignado (`budget-amount`, nunca por debajo de 0); si no, el traspaso de
  // Actual de la categoría a «Listo para asignar» (`transfer-category` con
  // `to-budget`, el mismo que usa «Mover» del menú del saldo). Con deshacer.
  const devolver = () => {
    if (!resumen || resumen.sobrante <= 0) {
      return;
    }
    const importe = resumen.sobrante;
    if (importe <= asignado) {
      applyBudgetAction.mutate({
        month,
        type: 'budget-amount',
        args: { category: category.id, amount: asignado - importe },
      } as ApplyBudgetActionPayload);
    } else {
      applyBudgetAction.mutate({
        month,
        type: 'transfer-category',
        args: {
          amount: importe,
          from: category.id,
          to: 'to-budget',
          currencyCode: format.currency.code,
        },
      } as ApplyBudgetActionPayload);
    }
    showUndoNotification({
      message: t(
        '{{amount}} returned to Ready to Assign from {{categoryName}}.',
        {
          amount: fmt(importe),
          categoryName: category.name,
        },
      ),
    });
  };

  // Opciones de «dormir»: este mes, hasta el cobro (objetivo con fecha) y
  // hasta <mes> cuando el Asesor ve N meses de adelanto.
  const mesCobro =
    resumen?.fecha && resumen.fecha.slice(0, 7) > month
      ? resumen.fecha.slice(0, 7)
      : null;
  const adelanto = consejoAdelanto(
    resumen?.adelanto ?? 0,
    resumen?.cuotaNormal ?? null,
  );
  const mesAdelanto =
    adelanto && adelanto.meses > 1
      ? monthUtils.addMonths(month, adelanto.meses)
      : null;
  const elegirSueno = (opcion: string) => {
    setMenuSueno(false);
    if (opcion === 'mes') {
      void setIgnorada(true);
    } else if (opcion === 'cobro' && mesCobro) {
      dormirHasta(mesCobro, asignado, saldo, actividad);
    } else if (opcion === 'adelanto' && mesAdelanto) {
      dormirHasta(mesAdelanto, asignado, saldo, actividad);
    } else {
      return;
    }
    setBurbuja({ modo: 'dormir', clave: Date.now() });
  };
  const alternarIgnorar = () => {
    if (ignorada) {
      void setIgnorada(false);
      setBurbuja({ modo: 'despertar', clave: Date.now() });
    } else if (mesCobro || mesAdelanto) {
      setMenuSueno(true);
    } else {
      elegirSueno('mes');
    }
  };

  return (
    <View
      style={{ ...estiloTarjeta('normal', 16), gap: 10 }}
      data-testid="ficha-objetivo"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: TACTIL,
          margin: '-6px 0',
        }}
      >
        <IconoCaja icono="target" tono="ok" size={32} />
        <Text style={{ ...texto.titulo }}>
          <Trans>Target</Trans>
        </Text>
        <View style={{ flex: 1 }} />
        {objetivo !== null && (
          <View style={{ position: 'relative' }}>
            {ignorada && !burbuja && (
              <View
                style={{
                  position: 'absolute',
                  right: 30,
                  top: -8,
                  pointerEvents: 'none',
                }}
              >
                <BurbujaDormida size={22} data-testid="burbuja-respira" />
              </View>
            )}
            <Button
              ref={zzRef}
              variant="bare"
              onPress={alternarIgnorar}
              aria-pressed={ignorada}
              aria-label={t('Ignore this month')}
              data-testid="ficha-ignorar"
              style={{
                width: TACTIL,
                height: TACTIL,
                minHeight: TACTIL,
                padding: 0,
                borderRadius: radio.pildora,
                backgroundColor: 'transparent',
              }}
            >
              <Text
                aria-hidden
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '-0.05em',
                  color: ignorada ? color.accent : color.fg3,
                  opacity: ignorada ? 1 : 0.5,
                  transition: 'color 180ms, opacity 180ms',
                }}
              >
                zZ
              </Text>
            </Button>
            {burbuja && (
              <BurbujaSueno
                key={burbuja.clave}
                modo={burbuja.modo}
                onFin={finBurbuja}
              />
            )}
            <Popover
              triggerRef={zzRef}
              isOpen={menuSueno}
              placement="bottom end"
              onOpenChange={() => setMenuSueno(false)}
            >
              <Menu
                items={[
                  { name: 'mes', text: t('This month') },
                  ...(mesCobro
                    ? [
                        {
                          name: 'cobro',
                          text: t('Until the charge ({{month}})', {
                            month: mesCorto(mesCobro),
                          }),
                        },
                      ]
                    : []),
                  ...(mesAdelanto
                    ? [
                        {
                          name: 'adelanto',
                          text: t('Until {{month}}', {
                            month: mesCorto(mesAdelanto),
                          }),
                        },
                      ]
                    : []),
                ]}
                onMenuSelect={name => elegirSueno(String(name))}
              />
            </Popover>
          </View>
        )}
        {textoEstado && objetivo !== null && (
          <Pildora
            estado={
              dormida
                ? 'neutro'
                : ignorada
                  ? 'ignorada'
                  : ESTADO_OBJETIVO[estado ?? 'rumbo']
            }
            data-testid="objetivo-estado"
          >
            {textoEstado}
          </Pildora>
        )}
      </View>

      {!abierto && objetivo === null && (
        <Boton
          variante="fantasma"
          onPress={() => setAbierto(true)}
          data-testid="objetivo-anadir"
        >
          <Trans>Add target</Trans>
        </Boton>
      )}

      {!abierto && objetivo !== null && (
        <Button
          variant="bare"
          onPress={() => setAbierto(true)}
          data-testid="objetivo-resumen"
          aria-label={t('Edit target')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 8,
            padding: 0,
            borderRadius: 0,
            backgroundColor: 'transparent',
            textAlign: 'left',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <PrivacyFilter>
              <Text style={{ fontSize: 15, fontWeight: 800, color: color.fg }}>
                {resumenTexto(objetivo, month)}
              </Text>
            </PrivacyFilter>
            {objetivo !== 'otro' && objetivo.tipo === 'una-vez' && (
              <Text style={{ fontSize: 13, color: color.fg3 }}>
                {t('once')}
              </Text>
            )}
          </View>
          {resumen && (
            <>
              <BarraProgreso
                valor={resumen.progreso}
                color={ignorada ? color.fg3 : color.accent}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <PrivacyFilter>
                  <Text style={{ fontSize: 13, color: color.fg2 }}>
                    {resumen.falta > 0
                      ? t('Missing {{amount}}', { amount: fmt(resumen.falta) })
                      : resumen.sobrante > 0
                        ? t('{{amount}} over the goal', {
                            amount: fmt(resumen.sobrante),
                          })
                        : t('Nothing missing')}
                  </Text>
                </PrivacyFilter>
                <PrivacyFilter>
                  <Text style={{ fontSize: 13, color: color.fg2, ...num }}>
                    {(resumen.cuota === 0 || resumen.falta === 0) &&
                    resumen.cuotaNormal
                      ? t('Usually about {{amount}}/month', {
                          amount: fmt(resumen.cuotaNormal),
                        })
                      : t('About {{amount}}/month', {
                          amount: fmt(resumen.cuota),
                        })}
                  </Text>
                </PrivacyFilter>
              </View>
              {resumen.adelanto > 0 && resumen.ritmo != null && !ignorada && (
                <PrivacyFilter>
                  <Text
                    style={{ ...texto.secundario, color: color.fg2 }}
                    data-testid="objetivo-adelanto"
                  >
                    {t(
                      "You're ahead: you have {{balance}}; by now about {{pace}} would be enough.",
                      {
                        balance: fmt(saldo),
                        pace: format(resumen.ritmo, 'financial-no-decimals'),
                      },
                    )}
                  </Text>
                </PrivacyFilter>
              )}
            </>
          )}
        </Button>
      )}

      {!abierto && resumen && resumen.sobrante > 0 && (
        <Boton
          variante="fantasma"
          onPress={devolver}
          data-testid="objetivo-devolver"
          style={{ alignSelf: 'flex-start', padding: '0 14px', fontSize: 14 }}
        >
          {t('Return {{amount}} to Ready to Assign', {
            amount: fmt(resumen.sobrante),
          })}
        </Boton>
      )}

      {abierto && (
        <EditorObjetivo
          category={category}
          month={month}
          objetivo={objetivo}
          saldo={saldo}
          asignado={asignado}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </View>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <Text style={{ ...texto.etiqueta, color: color.fg3 }}>{etiqueta}</Text>
      {children}
    </View>
  );
}

const estiloControl = {
  minHeight: TACTIL + 4,
  width: '100%',
  minWidth: 0,
  marginLeft: 0,
  marginRight: 0,
  boxSizing: 'border-box',
  fontSize: 16,
  borderRadius: radio.boton,
} as const;

function EditorObjetivo({
  category,
  month,
  objetivo,
  saldo,
  asignado,
  onCerrar,
}: {
  category: CategoryEntity;
  month: string;
  objetivo: Objetivo | null | 'otro';
  saldo: IntegerAmount;
  asignado: IntegerAmount;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const { guardar, guardando } = useGuardarObjetivo(category.id, month);
  const [formulario, setFormulario] = useState<Formulario>(() =>
    formularioDesde(
      objetivo === 'otro' ? null : objetivo,
      month,
      format.forEdit,
    ),
  );
  const cambiar = (cambios: Partial<Formulario>) =>
    setFormulario(prev => ({ ...prev, ...cambios }));

  const nuevo = objetivoDesde(formulario);
  const conFecha = formulario.tipo === 'anual' || formulario.tipo === 'una-vez';
  const fechaPasada =
    nuevo != null &&
    (nuevo.tipo === 'anual' || nuevo.tipo === 'una-vez') &&
    nuevo.fecha.slice(0, 7) < month;
  const puedeGuardar = nuevo != null && !fechaPasada && !guardando;

  const onGuardar = async () => {
    if (!nuevo || !puedeGuardar) {
      return;
    }
    const ok = await guardar(
      lineasDeObjetivo(nuevo, monthUtils.currentDay()),
      t('Target saved for {{categoryName}}.', { categoryName: category.name }),
    );
    if (ok) {
      onCerrar();
    }
  };
  const onQuitar = async () => {
    const ok = await guardar(
      [],
      t('Target removed from {{categoryName}}.', {
        categoryName: category.name,
      }),
    );
    if (ok) {
      onCerrar();
    }
  };

  const importe = currencyToInteger(formulario.importeTexto) ?? 0;
  const cuota =
    nuevo && (nuevo.tipo === 'anual' || nuevo.tipo === 'una-vez')
      ? cuotaMensual(nuevo.importe, saldo - asignado, nuevo.fecha, month)
      : null;
  const mesesHasta =
    nuevo && (nuevo.tipo === 'anual' || nuevo.tipo === 'una-vez')
      ? monthUtils.differenceInCalendarMonths(nuevo.fecha.slice(0, 7), month) +
        1
      : 0;

  return (
    <View
      style={{
        gap: 12,
        paddingTop: 10,
        borderTop: `1px dashed ${color.line2}`,
      }}
      data-testid="objetivo-editor"
    >
      {objetivo === 'otro' && (
        <Text
          style={{
            padding: '8px 12px',
            borderRadius: radio.boton,
            backgroundColor: color.warnSoft,
            color: color.warn,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {t(
            'This category has an automation this screen cannot edit. Saving here replaces it.',
          )}
        </Text>
      )}
      <Pestanas tipo={formulario.tipo} onChange={tipo => cambiar({ tipo })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Campo etiqueta={t('I need')}>
          <InputField
            aria-label={t('I need')}
            inputMode="decimal"
            value={formulario.importeTexto}
            placeholder={format(0, 'financial')}
            onChangeValue={value => cambiar({ importeTexto: value })}
            data-testid="objetivo-importe"
            style={{ ...estiloControl, ...num, fontWeight: 600 }}
          />
        </Campo>
        {conFecha ? (
          <Campo
            etiqueta={
              formulario.tipo === 'anual' ? t('Needed by') : t('Needed for')
            }
          >
            <InputField
              aria-label={t('Date')}
              type="date"
              value={formulario.fecha}
              min={`${month}-01`}
              onChangeValue={fecha => cambiar({ fecha })}
              data-testid="objetivo-fecha"
              style={estiloControl}
            />
          </Campo>
        ) : formulario.tipo === 'mensual' ? (
          <Campo etiqueta={t('Needed by')}>
            <Select
              value={formulario.dia == null ? 0 : formulario.dia}
              onChange={dia => cambiar({ dia: dia === 0 ? null : dia })}
              options={[
                [0, t('End of month')],
                ...Array.from(
                  { length: 31 },
                  (_, i) =>
                    [i + 1, t('Day {{day}}', { day: i + 1 })] as [
                      number,
                      string,
                    ],
                ),
              ]}
              style={{ ...estiloControl, justifyContent: 'space-between' }}
            />
          </Campo>
        ) : null}
      </View>
      {(formulario.tipo === 'mensual' || formulario.tipo === 'semanal') && (
        <Campo
          etiqueta={
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
                  amount: format(importe, 'financial'),
                }),
              ],
              [
                'rellenar',
                t('Refill up to {{amount}}', {
                  amount: format(importe, 'financial'),
                }),
              ],
            ]}
            style={{ ...estiloControl, justifyContent: 'space-between' }}
          />
        </Campo>
      )}
      {formulario.tipo === 'anual' && (
        <Campo etiqueta={t('Repeat')}>
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
            style={{ ...estiloControl, justifyContent: 'space-between' }}
          />
        </Campo>
      )}
      {fechaPasada && (
        <Text style={{ fontSize: 13, color: color.bad }}>
          <Trans>The date must be in this month or later.</Trans>
        </Text>
      )}
      {cuota != null && !fechaPasada && (
        <PrivacyFilter>
          <Text
            style={{ ...texto.secundario, color: color.fg2 }}
            data-testid="objetivo-cuota"
          >
            {t(
              'Works out at {{amount}}/month for {{count}} months. This month you already assigned {{assigned}}.',
              {
                amount: format(cuota, 'financial'),
                count: mesesHasta,
                assigned: format(asignado, 'financial'),
              },
            )}
          </Text>
        </PrivacyFilter>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {objetivo !== null && (
          <Button
            variant="bare"
            onPress={() => void onQuitar()}
            isDisabled={guardando}
            data-testid="objetivo-eliminar"
            style={{
              minHeight: TACTIL,
              padding: '0 4px',
              color: color.bad,
              fontWeight: 700,
              fontSize: 14,
              backgroundColor: 'transparent',
            }}
          >
            <Trans>Remove target</Trans>
          </Button>
        )}
        <View style={{ flex: 1 }} />
        <Button
          variant="bare"
          onPress={onCerrar}
          data-testid="objetivo-cancelar"
          style={{
            minHeight: TACTIL,
            padding: '0 10px',
            color: color.fg2,
            fontWeight: 700,
            fontSize: 15,
            backgroundColor: 'transparent',
          }}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Boton
          onPress={() => void onGuardar()}
          isDisabled={!puedeGuardar}
          data-testid="objetivo-guardar"
          style={{ padding: '0 20px', opacity: puedeGuardar ? 1 : 0.5 }}
        >
          <Trans>Save</Trans>
        </Boton>
      </View>
    </View>
  );
}

function NotasFicha({
  category,
  nota,
}: {
  category: CategoryEntity;
  nota: string | null | undefined;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const visibles = notaSinObjetivo(nota);
  const editar = () =>
    dispatch(
      pushModal({
        modal: {
          name: 'notes',
          options: {
            id: category.id,
            name: category.name,
            onSave: async (id, notes) => {
              await send('notes-save', { id, note: notes });
            },
          },
        },
      }),
    );
  return (
    <Seccion
      icono="note"
      titulo={t('Notes')}
      testId="ficha-notas"
      derecha={
        <Button
          variant="bare"
          onPress={editar}
          data-testid="ficha-notas-editar"
          style={{
            minHeight: TACTIL,
            padding: '0 4px',
            color: color.fg3,
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: 'transparent',
          }}
        >
          <Trans>Edit</Trans>
        </Button>
      }
    >
      {visibles.length > 0 ? (
        <Notes
          notes={visibles}
          editable={false}
          focused={false}
          getStyle={() => ({ padding: 0, fontSize: 14 })}
        />
      ) : (
        <Text style={{ ...texto.secundario, color: color.fg3 }}>
          <Trans>No notes</Trans>
        </Text>
      )}
    </Seccion>
  );
}

function PieFicha({ category }: { category: CategoryEntity }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const saveCategory = useSaveCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(category.name);

  const guardarNombre = () => {
    const limpio = nombre.trim();
    if (limpio && limpio !== category.name) {
      saveCategory.mutate({ category: { ...category, name: limpio } });
    }
    setRenombrando(false);
  };

  if (renombrando) {
    return (
      <View
        style={{ ...estiloTarjeta('normal', 12), flexDirection: 'row', gap: 8 }}
      >
        <InputField
          aria-label={t('Name')}
          value={nombre}
          autoFocus
          onChangeValue={setNombre}
          onEnter={guardarNombre}
          data-testid="ficha-nombre"
          style={{ ...estiloControl, flex: 1 }}
        />
        <Boton onPress={guardarNombre} data-testid="ficha-nombre-guardar">
          <Trans>Save</Trans>
        </Boton>
      </View>
    );
  }

  const accion = (
    icono: NombreIcono,
    etiqueta: string,
    onPress: () => void,
    peligro = false,
    testId?: string,
  ) => (
    <Button
      variant="bare"
      onPress={onPress}
      data-testid={testId}
      style={{
        flex: 1,
        minHeight: TACTIL,
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: peligro ? color.bad : color.fg3,
        backgroundColor: 'transparent',
      }}
    >
      <Icono nombre={icono} size={16} />
      {etiqueta}
    </Button>
  );

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {accion(
        'tag',
        t('Rename'),
        () => setRenombrando(true),
        false,
        'ficha-renombrar',
      )}
      {accion(
        'eye',
        category.hidden ? t('Show') : t('Hide'),
        () =>
          saveCategory.mutate({
            category: { ...category, hidden: !category.hidden },
          }),
        false,
        'ficha-ocultar',
      )}
      {accion(
        'trash',
        t('Delete'),
        () => {
          deleteCategory.mutate({ id: category.id });
          void navigate(-1);
        },
        true,
        'ficha-eliminar',
      )}
    </View>
  );
}
