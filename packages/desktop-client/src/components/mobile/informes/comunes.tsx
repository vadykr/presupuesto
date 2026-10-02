import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';

import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { BarraProgreso } from '#components/mobile/ui/BarraProgreso';
import { BotonRedondo, Cabecera } from '#components/mobile/ui/Cabecera';
import { Cargando as CargandoBarquito } from '#components/mobile/ui/Cargando';
import { Icono } from '#components/mobile/ui/Icono';
import { estiloTarjeta } from '#components/mobile/ui/Tarjeta';
import {
  color,
  espacio,
  num,
  radio,
  sombra,
} from '#components/mobile/ui/tokens';
import { MobilePageHeader, Page } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useLocale } from '#hooks/useLocale';

import { PaletaInformes } from './paleta';

export const GUTTER = 16;

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

type PaginaInformeProps = {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  rightContent?: ReactNode;
  sinAtras?: boolean;
  children: ReactNode;
  'data-testid'?: string;
};

/** Página móvil de un informe: cabecera con «Atrás», paleta y contenido. */
export function PaginaInforme({
  titulo,
  subtitulo,
  rightContent,
  sinAtras,
  children,
  'data-testid': testId,
}: PaginaInformeProps) {
  return (
    <Page
      header={
        sinAtras ? (
          <Cabecera
            titulo={titulo}
            subtitulo={subtitulo}
            derecha={rightContent}
            style={{ paddingBottom: 10 }}
          />
        ) : (
          <MobilePageHeader
            title={
              subtitulo ? (
                <View>
                  <TextOneLine>{titulo}</TextOneLine>
                  <TextOneLine style={styles.smallText}>
                    {subtitulo}
                  </TextOneLine>
                </View>
              ) : (
                titulo
              )
            }
            leftContent={<MobileBackButton />}
            rightContent={rightContent}
          />
        )
      }
      padding={0}
    >
      <PaletaInformes />
      {/* flexShrink 0: la página desplaza, no se comprime (las gráficas tienen alto fijo). */}
      <View
        style={{ paddingBottom: MOBILE_NAV_HEIGHT + 16, flexShrink: 0 }}
        data-testid={testId}
      >
        {children}
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Número grande + frase
// ---------------------------------------------------------------------------

export type Tono = 'neutro' | 'bien' | 'mal' | 'aviso';

export function colorDeTono(tono: Tono): string {
  switch (tono) {
    case 'bien':
      return color.ok;
    case 'mal':
      return color.bad;
    case 'aviso':
      return color.warn;
    default:
      return color.fg;
  }
}

type HeroProps = {
  valor: ReactNode;
  frase: ReactNode;
  etiqueta?: ReactNode;
  tono?: Tono;
  /** Tamaño del número: grande en el detalle, medio en las tarjetas. */
  tamano?: 'grande' | 'medio';
  style?: CSSProperties;
};

/**
 * La regla de cada pantalla: número grande → frase en castellano que lo
 * explica. El número lleva figuras proporcionales (no tabulares).
 */
export function Hero({
  valor,
  frase,
  etiqueta,
  tono = 'neutro',
  tamano = 'grande',
  style,
}: HeroProps) {
  return (
    <View style={{ gap: 2, ...style }}>
      {etiqueta && (
        <Text style={{ fontSize: 13, fontWeight: 800, color: color.fg3 }}>
          {etiqueta}
        </Text>
      )}
      <PrivacyFilter>
        <Text
          style={{
            ...num,
            fontSize: tamano === 'grande' ? 42 : 28,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: colorDeTono(tono),
          }}
          data-testid="hero-valor"
        >
          {valor}
        </Text>
      </PrivacyFilter>
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: 500,
          color: color.fg2,
          lineHeight: 1.45,
          marginTop: 4,
        }}
        data-testid="hero-frase"
      >
        {frase}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas y secciones
// ---------------------------------------------------------------------------

type TarjetaProps = {
  children: ReactNode;
  style?: CSSProperties;
  'data-testid'?: string;
};

export function Tarjeta({
  children,
  style,
  'data-testid': testId,
}: TarjetaProps) {
  return (
    <View
      style={{
        ...estiloTarjeta('normal', 0),
        overflow: 'hidden',
        marginLeft: GUTTER,
        marginRight: GUTTER,
        marginTop: espacio.tarjetas,
        flexShrink: 0,
        ...style,
      }}
      data-testid={testId}
    >
      {children}
    </View>
  );
}

type TarjetaInformeProps = {
  titulo: ReactNode;
  valor: ReactNode;
  frase: ReactNode;
  tono?: Tono;
  onPress: () => void;
  children?: ReactNode;
  'data-testid'?: string;
};

/** Tarjeta de la lista de informes: título, número, frase y minigráfica. */
export function TarjetaInforme({
  titulo,
  valor,
  frase,
  tono,
  onPress,
  children,
  'data-testid': testId,
}: TarjetaInformeProps) {
  return (
    <Tarjeta data-testid={testId}>
      <Button
        variant="bare"
        onPress={onPress}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          textAlign: 'left',
          padding: 16,
          paddingBottom: 14,
          gap: 10,
          borderRadius: radio.tarjeta,
          color: color.fg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 800, color: color.fg3 }}>
            {titulo}
          </Text>
          <Icono nombre="cr" size={18} style={{ color: color.fg3 }} />
        </View>
        <Hero valor={valor} frase={frase} tono={tono} tamano="medio" />
        {children && <View style={{ marginTop: 2 }}>{children}</View>}
      </Button>
    </Tarjeta>
  );
}

export function Seccion({
  titulo,
  accion,
  children,
  style,
}: {
  titulo?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <View style={{ marginTop: espacio.seccion, ...style }}>
      {(titulo || accion) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: GUTTER,
            paddingRight: GUTTER,
            paddingBottom: 6,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 800, color: color.fg2 }}>
            {titulo}
          </Text>
          {accion}
        </View>
      )}
      {children}
    </View>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: color.fg3,
        padding: GUTTER,
        textAlign: 'center',
      }}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Marcas pequeñas: punto de color, barra apilada, minibarras
// ---------------------------------------------------------------------------

export function Punto({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export type Segmento = {
  clave: string;
  valor: number;
  color: string;
  nombre: string;
};

/** Barra apilada horizontal (parte-todo) con hueco de 2 px entre segmentos. */
export function BarraApilada({
  segmentos,
  total,
  alto = 16,
  onPress,
}: {
  segmentos: Segmento[];
  total: number;
  alto?: number;
  onPress?: (clave: string) => void;
}) {
  if (total <= 0) {
    return (
      <View
        style={{
          height: alto,
          borderRadius: 5,
          backgroundColor: color.surface3,
        }}
      />
    );
  }
  // Segmentos menores del 1,5 % se funden en «otros» para que no sean ruido.
  const minimo = total * 0.015;
  const visibles = segmentos.filter(s => s.valor >= minimo);
  const resto = segmentos
    .filter(s => s.valor < minimo)
    .reduce((a, s) => a + s.valor, 0);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 3,
        height: alto,
      }}
      role="img"
    >
      {visibles.map(s =>
        onPress ? (
          <Button
            key={s.clave}
            variant="bare"
            aria-label={s.nombre}
            onPress={() => onPress(s.clave)}
            style={{
              flex: `${s.valor} 0 0`,
              minWidth: 3,
              padding: 0,
              borderRadius: 5,
              backgroundColor: s.color,
            }}
          />
        ) : (
          <View
            key={s.clave}
            title={s.nombre}
            style={{
              flex: `${s.valor} 0 0`,
              minWidth: 3,
              borderRadius: 5,
              backgroundColor: s.color,
            }}
          />
        ),
      )}
      {resto > 0 && (
        <View
          style={{
            flex: `${resto} 0 0`,
            minWidth: 3,
            borderRadius: 5,
            backgroundColor: color.fg3,
            opacity: 0.5,
          }}
        />
      )}
    </View>
  );
}

/**
 * Minibarras mensuales para las tarjetas: el último mes en el color pleno,
 * los anteriores atenuados. Los valores atípicos se dibujan huecos.
 */
export function MiniBarras({
  valores,
  color,
  atipicos,
  alto = 40,
  referencia,
}: {
  valores: number[];
  color: string;
  atipicos?: boolean[];
  alto?: number;
  /** Línea horizontal de referencia (misma escala que `valores`). */
  referencia?: number;
}) {
  const maximo = Math.max(...valores.map(v => Math.abs(v)), referencia ?? 0, 1);
  return (
    <View style={{ position: 'relative', height: alto }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 3,
          height: alto,
        }}
      >
        {valores.map((v, i) => {
          const h = Math.max(2, Math.round((Math.abs(v) / maximo) * alto));
          const ultimo = i === valores.length - 1;
          const atipico = atipicos?.[i] ?? false;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                maxWidth: 24,
                borderRadius: '4px 4px 1px 1px',
                backgroundColor: atipico ? 'transparent' : color,
                boxShadow: atipico ? `inset 0 0 0 2px ${color}` : undefined,
                opacity: ultimo || atipico ? 1 : 0.45,
              }}
            />
          );
        })}
      </View>
      {referencia !== undefined && referencia > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: Math.round((referencia / maximo) * alto),
            borderTop: '1px dashed var(--p-fg-2, var(--color-pageText))',
            opacity: 0.6,
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Filas de lista (la lista bajo la gráfica es la leyenda)
// ---------------------------------------------------------------------------

type FilaValorProps = {
  nombre: ReactNode;
  detalle?: ReactNode;
  valor: ReactNode;
  valorSecundario?: ReactNode;
  color?: string;
  /** 0..1: barra fina bajo el nombre, en `color`. */
  fraccion?: number;
  icono?: ReactNode;
  tonoValor?: Tono;
  onPress?: () => void;
  'data-testid'?: string;
};

export function FilaValor({
  nombre,
  detalle,
  valor,
  valorSecundario,
  color: colorFila,
  fraccion,
  icono,
  tonoValor = 'neutro',
  onPress,
  'data-testid': testId,
}: FilaValorProps) {
  const contenido = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 52,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: GUTTER,
        paddingRight: onPress ? 8 : GUTTER,
        borderTop: `1px solid ${color.line}`,
      }}
      data-testid={testId}
    >
      {colorFila && <Punto color={colorFila} />}
      {icono}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <TextOneLine style={{ fontSize: 14, fontWeight: 700 }}>
          {nombre}
        </TextOneLine>
        {detalle && (
          <TextOneLine
            style={{ fontSize: 12.5, fontWeight: 600, color: color.fg3 }}
          >
            {detalle}
          </TextOneLine>
        )}
        {fraccion !== undefined && (
          <BarraProgreso
            valor={fraccion}
            alto={6}
            color={colorFila ?? color.fg3}
          />
        )}
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <PrivacyFilter>
          <Text
            style={{
              ...num,
              fontSize: 14,
              fontWeight: 800,
              color: colorDeTono(tonoValor),
            }}
          >
            {valor}
          </Text>
        </PrivacyFilter>
        {valorSecundario && (
          <Text
            style={{
              ...num,
              fontSize: 12,
              fontWeight: 700,
              color: color.fg3,
            }}
          >
            {valorSecundario}
          </Text>
        )}
      </View>
      {onPress && <Icono nombre="cr" size={16} style={{ color: color.fg3 }} />}
    </View>
  );
  if (!onPress) {
    return contenido;
  }
  return (
    <Button
      variant="bare"
      onPress={onPress}
      style={{
        display: 'block',
        padding: 0,
        borderRadius: 0,
        textAlign: 'left',
        color: color.fg,
      }}
    >
      {contenido}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Selectores de periodo
// ---------------------------------------------------------------------------

type OpcionPildora<T extends string> = { valor: T; etiqueta: ReactNode };

export function Pildoras<T extends string>({
  opciones,
  valor,
  onChange,
  'aria-label': ariaLabel,
}: {
  opciones: OpcionPildora<T>[];
  valor: T;
  onChange: (valor: T) => void;
  'aria-label'?: string;
}) {
  return (
    <View
      role="group"
      aria-label={ariaLabel}
      style={{
        flexDirection: 'row',
        gap: 6,
        paddingLeft: GUTTER,
        paddingRight: GUTTER,
        flexWrap: 'wrap',
      }}
    >
      {opciones.map(o => {
        const activa = o.valor === valor;
        return (
          <Button
            key={o.valor}
            variant="bare"
            data-selected={activa || undefined}
            onPress={() => onChange(o.valor)}
            style={{
              fontSize: 13,
              fontWeight: 800,
              padding: '0 14px',
              borderRadius: radio.pildora,
              minHeight: 36,
              backgroundColor: activa ? color.fg : color.surface,
              color: activa ? color.bg : color.fg2,
              boxShadow: activa ? undefined : sombra.tarjeta,
            }}
          >
            {o.etiqueta}
          </Button>
        );
      })}
    </View>
  );
}

/** «← septiembre 2026 →» */
export function SelectorMes({
  mes,
  onChange,
  maximo = monthUtils.currentMonth(),
}: {
  mes: string;
  onChange: (mes: string) => void;
  maximo?: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const puedeAvanzar = mes < maximo;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: GUTTER,
        paddingRight: GUTTER,
      }}
    >
      <BotonRedondo
        icono="cl"
        aria-label={t('Previous month')}
        onPress={() => onChange(monthUtils.prevMonth(mes))}
      />
      <Text
        style={{
          fontSize: 18,
          fontWeight: 800,
          textTransform: 'capitalize',
        }}
        data-testid="selector-mes"
      >
        {monthUtils.format(mes, 'MMMM yyyy', locale)}
      </Text>
      <BotonRedondo
        icono="cr"
        aria-label={t('Next month')}
        isDisabled={!puedeAvanzar}
        onPress={() => onChange(monthUtils.nextMonth(mes))}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/** «+12 %», «−8 %»; con signo siempre. */
export function formatPorcentaje(fraccion: number, conSigno = true): string {
  const pct = Math.round(fraccion * 100);
  const signo = conSigno
    ? pct > 0
      ? '+'
      : pct < 0
        ? '−'
        : ''
    : pct < 0
      ? '−'
      : '';
  return `${signo}${Math.abs(pct)} %`;
}

/** Etiqueta corta de mes para ejes: «ene», «feb»… sin punto. */
export function etiquetaMesCorta(mes: string, locale: Locale): string {
  return monthUtils.format(mes, 'MMM', locale).replace('.', '');
}

type Locale = ReturnType<typeof useLocale>;

export function NombreMes({ mes }: { mes: string }) {
  const locale = useLocale();
  return (
    <Text style={{ textTransform: 'capitalize' }}>
      {monthUtils.format(mes, 'MMMM yyyy', locale)}
    </Text>
  );
}

export function Cargando() {
  return <CargandoBarquito />;
}
