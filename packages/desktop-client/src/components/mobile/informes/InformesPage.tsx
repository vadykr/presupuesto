import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { TarjetaConsejosInforme } from '#components/mobile/analisis/TarjetaConsejos';
import { BotonRedondo } from '#components/mobile/ui/Cabecera';
import { color } from '#components/mobile/ui/tokens';
import { createAgeOfMoneySpreadsheet } from '#components/reports/spreadsheets/age-of-money-spreadsheet';
import type { AgeOfMoneyData } from '#components/reports/spreadsheets/age-of-money-spreadsheet';
import { createSpreadsheet as netWorthSpreadsheet } from '#components/reports/spreadsheets/net-worth-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useAccounts } from '#hooks/useAccounts';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';

import {
  evolucionCategoria,
  gastoPorCategoria,
  ingresosGastosPorMes,
  rankingSubeBaja,
} from './calculos';
import { fraseCategoria } from './CategoriaPage';
import { CategoriasQueCuentanModal } from './CategoriasQueCuentanModal';
import {
  BarraApilada,
  formatPorcentaje,
  GUTTER,
  MiniBarras,
  PaginaInforme,
  Punto,
  TarjetaInforme,
} from './comunes';
import { COLOR_EDAD, fraseEdad, tonoEdad } from './EdadDineroPage';
import {
  clasificarMes,
  mediana,
  recortarInicioSinDatos,
  referenciaHabitual,
} from './estadisticaRobusta';
import {
  COLOR_GASTOS,
  COLOR_INGRESOS,
  fraseAhorro,
} from './IngresosGastosPage';
import { COLOR_NOMINAS, fraseNominas } from './NominasPage';
import { COLOR_PATRIMONIO } from './PatrimonioPage';
import {
  Flecha,
  fraseSubeBaja,
  MESES_REFERENCIA,
  mesPorDefectoSubeBaja,
} from './SubeBajaPage';
import { useCategoriasExcluidas } from './useCategoriasExcluidas';
import { useColoresCategorias } from './useColoresCategorias';
import { useTotalesMensuales } from './useTotalesMensuales';

type PuntoPatrimonio = { x: string; y: number; assets: string; debt: string };
type DatosPatrimonio = {
  graphData: { data: PuntoPatrimonio[] };
  netWorth: number;
  totalChange: number;
};

/**
 * Pestaña «Informes» (móvil): respuestas de un vistazo. Cada tarjeta lleva un
 * número grande, una frase que lo explica y una minigráfica; tocarla abre el
 * detalle.
 */
export function InformesPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useFormat();
  const navigate = useNavigate();
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const fmt = (v: number) => format(v, 'financial');

  const { excluidas } = useCategoriasExcluidas();
  const { colorDe } = useColoresCategorias();
  const { movimientos, categorias, meses, isLoading } = useTotalesMensuales({
    meses: 13,
    categoriasExcluidas: excluidas,
  });
  const mesActual = meses[meses.length - 1];
  const nombreMes = monthUtils.format(mesActual, 'MMMM', locale);
  const nombreDe = (id: string | null) =>
    id == null
      ? t('Uncategorized')
      : (categorias.get(id)?.nombre ?? t('Unknown'));

  // a. Este mes
  const desglose = gastoPorCategoria(movimientos, [mesActual], categorias);
  const mayor = desglose.filas[0];

  // b. Ingresos vs gastos (12 meses)
  const ultimos12 = meses.slice(-12);
  const porMes = ingresosGastosPorMes(movimientos, ultimos12, categorias);
  const mesIG = porMes[porMes.length - 1];
  const ahorro = fraseAhorro(t, mesIG.tasa, mesIG.ahorro, fmt);

  // c. Evolución de la categoría mayor
  const catEvolucion = mayor?.categoria ?? null;
  const serieCat = evolucionCategoria(movimientos, catEvolucion, ultimos12);
  const clasif = clasificarMes(
    serieCat[serieCat.length - 1] ?? 0,
    serieCat.slice(0, -1),
  );
  const previosCat = recortarInicioSinDatos(serieCat.slice(0, -1));
  const atipicosCat = [
    ...serieCat
      .slice(0, -1)
      .map(() => false)
      .slice(previosCat.length),
    ...referenciaHabitual(previosCat).atipicos,
    clasif.tipo === 'puntual',
  ];

  // d. Qué sube y qué baja: el último mes completo frente a sus 6 previos.
  const mesSubeBaja = mesPorDefectoSubeBaja(mesActual);
  const mesesRef = meses.slice(-(MESES_REFERENCIA + 2), -2);
  const ranking = rankingSubeBaja(
    movimientos,
    mesSubeBaja,
    mesesRef,
    categorias,
  );
  const subeBaja = fraseSubeBaja(t, ranking, id => nombreDe(id), fmt);
  const destacadas = [
    ...ranking
      .filter(f => f.tipo === 'sube' || f.tipo === 'puntual')
      .slice(0, 2),
    ...ranking.filter(f => f.tipo === 'baja').slice(-2),
  ].slice(0, 4);

  // e. Patrimonio
  const { data: cuentas = [] } = useAccounts();
  const cuentasAbiertas = useMemo(
    () => cuentas.filter(c => !c.closed),
    [cuentas],
  );
  const hastaP = monthUtils.currentMonth();
  const desdeP = monthUtils.subMonths(hastaP, 11);
  const getPatrimonio = useMemo(
    () =>
      netWorthSpreadsheet(
        desdeP,
        hastaP,
        cuentasAbiertas,
        [],
        'and',
        locale,
        'Monthly',
        '0',
        format,
      ),
    [desdeP, hastaP, cuentasAbiertas, locale, format],
  );
  const patrimonio = useReport<DatosPatrimonio>('patrimonio', getPatrimonio);
  const puntosP = (patrimonio?.graphData.data ?? []).slice(-12);
  const ultimoP = puntosP[puntosP.length - 1];
  const anteriorP = puntosP[puntosP.length - 2];

  // f. Edad del dinero
  const getEdad = useMemo(
    () =>
      createAgeOfMoneySpreadsheet({
        start: desdeP,
        end: hastaP,
        granularity: 'monthly',
      }),
    [desdeP, hastaP],
  );
  const edad = useReport<AgeOfMoneyData>('edad-dinero', getEdad);

  // g. Nóminas
  const ingresos = porMes.map(m => m.ingresos);
  const ingresoActual = ingresos[ingresos.length - 1] ?? 0;

  return (
    <PaginaInforme
      titulo={t('Reports')}
      subtitulo={monthUtils.format(mesActual, 'MMMM yyyy', locale)}
      sinAtras
      data-testid="informes"
      rightContent={
        <BotonRedondo
          icono="sliders"
          aria-label={t('What counts as spending')}
          onPress={() => setFiltroAbierto(true)}
        />
      }
    >
      <View style={{ paddingLeft: GUTTER + 4, paddingRight: GUTTER }}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: color.fg2 }}>
          {t('How you are doing, at a glance.')}
        </Text>
      </View>

      {/* Consejos del análisis inteligente */}
      <TarjetaConsejosInforme />

      {/* a. Este mes */}
      <TarjetaInforme
        data-testid="tarjeta-este-mes"
        titulo={t('This month')}
        valor={isLoading ? '…' : fmt(desglose.total)}
        frase={
          isLoading
            ? ''
            : desglose.total === 0
              ? t('Nothing spent yet in {{month}}.', { month: nombreMes })
              : t(
                  'Spent so far in {{month}}. The biggest: {{category}} ({{pct}}).',
                  {
                    month: nombreMes,
                    category: nombreDe(mayor.categoria),
                    pct: formatPorcentaje(
                      mayor.importe / desglose.total,
                      false,
                    ),
                  },
                )
        }
        onPress={() => void navigate('/reports/gasto')}
      >
        <BarraApilada
          total={desglose.total}
          segmentos={desglose.filas.map(f => ({
            clave: f.categoria ?? 'sin',
            valor: f.importe,
            color: colorDe(f.categoria),
            nombre: nombreDe(f.categoria),
          }))}
        />
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 8,
          }}
        >
          {desglose.filas.slice(0, 3).map(f => (
            <View
              key={f.categoria ?? 'sin'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Punto color={colorDe(f.categoria)} size={8} />
              <Text
                style={{ ...styles.smallText, color: theme.pageTextSubdued }}
              >
                {nombreDe(f.categoria)}
              </Text>
            </View>
          ))}
        </View>
      </TarjetaInforme>

      {/* b. Ingresos vs gastos */}
      <TarjetaInforme
        data-testid="tarjeta-ingresos-gastos"
        titulo={t('Income vs spending')}
        valor={
          isLoading || mesIG.tasa === null
            ? '—'
            : formatPorcentaje(mesIG.tasa, false)
        }
        frase={isLoading ? '' : ahorro.frase}
        tono={ahorro.tono}
        onPress={() => void navigate('/reports/ingresos-gastos')}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <MiniBarras
              valores={porMes.map(m => m.ingresos)}
              color={COLOR_INGRESOS}
              alto={34}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MiniBarras
              valores={porMes.map(m => m.gastos)}
              color={COLOR_GASTOS}
              alto={34}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <Text
            style={{
              ...styles.smallText,
              color: theme.pageTextSubdued,
              flex: 1,
            }}
          >
            <Trans>Income</Trans>
          </Text>
          <Text
            style={{
              ...styles.smallText,
              color: theme.pageTextSubdued,
              flex: 1,
            }}
          >
            <Trans>Spending</Trans>
          </Text>
        </View>
      </TarjetaInforme>

      {/* c. Evolución de una categoría */}
      <TarjetaInforme
        data-testid="tarjeta-categoria"
        titulo={t('Category trend')}
        valor={
          isLoading
            ? '…'
            : catEvolucion
              ? fmt(serieCat[serieCat.length - 1] ?? 0)
              : '—'
        }
        frase={
          isLoading
            ? ''
            : catEvolucion
              ? `${nombreDe(catEvolucion)}: ${fraseCategoria(
                  t,
                  serieCat[serieCat.length - 1] ?? 0,
                  clasif.referencia.referencia,
                  clasif.tipo,
                  12,
                  fmt,
                )}`
              : t('Pick any category to see its last 12 months.')
        }
        tono={clasif.tipo === 'puntual' ? 'aviso' : 'neutro'}
        onPress={() =>
          void navigate(
            catEvolucion
              ? `/reports/categoria/${catEvolucion}`
              : '/reports/categoria',
          )
        }
      >
        <MiniBarras
          valores={serieCat}
          color={colorDe(catEvolucion)}
          atipicos={atipicosCat}
          referencia={clasif.referencia.referencia}
        />
      </TarjetaInforme>

      {/* d. Qué sube y qué baja */}
      <TarjetaInforme
        data-testid="tarjeta-sube-baja"
        titulo={t('Rising and falling · {{month}}', {
          month: monthUtils.format(mesSubeBaja, 'MMMM', locale),
        })}
        valor={isLoading ? '…' : subeBaja.valor}
        frase={isLoading ? '' : subeBaja.frase}
        tono={subeBaja.tono}
        onPress={() => void navigate('/reports/sube-baja')}
      >
        {destacadas.length > 0 && (
          <View style={{ gap: 4 }}>
            {destacadas.map(f => (
              <View
                key={f.categoria}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Flecha desviacion={f.desviacion} tipo={f.tipo} />
                <Punto color={colorDe(f.categoria)} size={8} />
                <Text style={{ ...styles.smallText, flex: 1 }}>
                  {nombreDe(f.categoria)}
                </Text>
                <Text
                  style={{
                    ...styles.smallText,
                    ...styles.tnum,
                    color: theme.pageTextSubdued,
                  }}
                >
                  {`${f.desviacion >= 0 ? '+' : '−'}${fmt(Math.abs(f.desviacion))}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TarjetaInforme>

      {/* e. Patrimonio */}
      <TarjetaInforme
        data-testid="tarjeta-patrimonio"
        titulo={t('Net worth')}
        valor={ultimoP ? fmt(ultimoP.y) : '…'}
        tono={ultimoP && ultimoP.y < 0 ? 'mal' : 'neutro'}
        frase={
          ultimoP && anteriorP
            ? ultimoP.y - anteriorP.y >= 0
              ? t('Up {{amount}} since last month.', {
                  amount: fmt(ultimoP.y - anteriorP.y),
                })
              : t('Down {{amount}} since last month.', {
                  amount: fmt(anteriorP.y - ultimoP.y),
                })
            : ultimoP
              ? t('Assets {{assets}}, debts {{debt}}.', {
                  assets: ultimoP.assets,
                  debt: ultimoP.debt.replace(/^-/, ''),
                })
              : ''
        }
        onPress={() => void navigate('/reports/patrimonio')}
      >
        <MiniBarras
          valores={puntosP.map(p => p.y)}
          color={COLOR_PATRIMONIO}
          alto={34}
        />
      </TarjetaInforme>

      {/* f. Edad del dinero */}
      <TarjetaInforme
        data-testid="tarjeta-edad-dinero"
        titulo={t('Age of money')}
        valor={
          !edad
            ? '…'
            : edad.currentAge === null
              ? '—'
              : t('{{count}} days', { count: edad.currentAge })
        }
        tono={edad ? tonoEdad(edad.currentAge) : 'neutro'}
        frase={edad ? fraseEdad(t, edad) : ''}
        onPress={() => void navigate('/reports/edad-dinero')}
      >
        <MiniBarras
          valores={(edad?.graphData ?? []).map(p => p.ageOfMoney)}
          color={COLOR_EDAD}
          alto={34}
          referencia={30}
        />
      </TarjetaInforme>

      {/* g. Nóminas */}
      <TarjetaInforme
        data-testid="tarjeta-nominas"
        titulo={t('Income by payer')}
        valor={isLoading ? '…' : fmt(ingresoActual)}
        frase={
          isLoading
            ? ''
            : fraseNominas(t, ingresoActual, ingresos.slice(0, -1), fmt)
        }
        onPress={() => void navigate('/reports/nominas')}
      >
        <MiniBarras
          valores={ingresos}
          color={COLOR_NOMINAS}
          alto={34}
          referencia={mediana(ingresos.filter(v => v > 0))}
        />
      </TarjetaInforme>

      <CategoriasQueCuentanModal
        abierto={filtroAbierto}
        onClose={() => setFiltroAbierto(false)}
      />
    </PaginaInforme>
  );
}
