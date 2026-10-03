import { useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { v4 as uuidv4 } from 'uuid';

import { Boton } from '#components/mobile/ui/Boton';
import { separarEmoji } from '#components/mobile/ui/emoji';
import { Icono } from '#components/mobile/ui/Icono';
import {
  color,
  densidad,
  espacio,
  movimiento,
  radio,
  sombra,
  texto,
} from '#components/mobile/ui/tokens';

import { KEYPAD_Z_INDEX } from './AssignKeypad';
import { alternarCategoria } from './filtrosCategorias';
import type { FiltroPropio } from './filtrosCategorias';
import type { FiltroEstado } from './objetivos';

/** `todas`, un filtro de estado o `propio:<id>`. */
export type FiltroActivo = 'todas' | FiltroEstado | `propio:${string}`;

type GrupoConCategorias = CategoryGroupEntity & {
  categories: CategoryEntity[];
};

function Chip({
  activo,
  onPress,
  children,
  testId,
  punteado = false,
}: {
  activo: boolean;
  onPress: () => void;
  children: ReactNode;
  testId?: string;
  punteado?: boolean;
}) {
  return (
    <Button
      variant="bare"
      onPress={onPress}
      aria-pressed={activo}
      data-testid={testId}
      style={{
        flexShrink: 0,
        minHeight: 44,
        padding: 0,
        backgroundColor: 'transparent',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 30,
          padding: '0 12px',
          borderRadius: radio.pildora,
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          backgroundColor: activo ? color.accent : color.surface2,
          color: activo ? color.accentInk : color.fg2,
          border: punteado ? `1px dashed ${color.line2}` : 0,
          transition: `background-color ${movimiento.pildora}ms`,
        }}
      >
        {children}
      </span>
    </Button>
  );
}

function Cuenta({ n }: { n: number }) {
  return <span style={{ opacity: 0.75, fontWeight: 600 }}>{n}</span>;
}

type ChipsFiltrosProps = {
  activo: FiltroActivo;
  onChange: (filtro: FiltroActivo) => void;
  conteos: Record<FiltroEstado, number>;
  propios: FiltroPropio[];
  onNuevo: () => void;
  onEditar: (filtro: FiltroPropio) => void;
};

/**
 * Chips de filtro sobre la lista: Todas · Infrafinanciadas · Sobrefinanciadas
 * · Gastado de más · filtros propios · «+ Nuevo filtro». Con un filtro propio
 * activo aparece «Editar».
 */
export function ChipsFiltros({
  activo,
  onChange,
  conteos,
  propios,
  onNuevo,
  onEditar,
}: ChipsFiltrosProps) {
  const { t } = useTranslation();
  const propioActivo = activo.startsWith('propio:')
    ? propios.find(f => `propio:${f.id}` === activo)
    : undefined;
  const estados: { id: FiltroEstado; texto: string }[] = [
    { id: 'infrafinanciadas', texto: t('Underfunded') },
    { id: 'sobrefinanciadas', texto: t('Overfunded') },
    { id: 'gastado-de-mas', texto: t('Overspent') },
  ];
  return (
    <View
      role="toolbar"
      aria-label={t('Category filters')}
      data-testid="asignar-filtros"
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        gap: 6,
        overflowX: 'auto',
        padding: `0 ${espacio.margen}px 4px`,
        scrollbarWidth: 'none',
      }}
    >
      <Chip
        activo={activo === 'todas'}
        onPress={() => onChange('todas')}
        testId="filtro-todas"
      >
        <Trans>All</Trans>
      </Chip>
      {estados.map(e => (
        <Chip
          key={e.id}
          activo={activo === e.id}
          onPress={() => onChange(activo === e.id ? 'todas' : e.id)}
          testId={`filtro-${e.id}`}
        >
          {e.texto}
          {conteos[e.id] > 0 && <Cuenta n={conteos[e.id]} />}
        </Chip>
      ))}
      {propios.map(f => (
        <Chip
          key={f.id}
          activo={activo === `propio:${f.id}`}
          onPress={() =>
            onChange(activo === `propio:${f.id}` ? 'todas' : `propio:${f.id}`)
          }
          testId="filtro-propio"
        >
          {f.nombre}
        </Chip>
      ))}
      {propioActivo && (
        <Chip
          activo={false}
          onPress={() => onEditar(propioActivo)}
          testId="filtro-editar"
        >
          <Trans>Edit</Trans>
        </Chip>
      )}
      <Chip activo={false} onPress={onNuevo} testId="filtro-nuevo" punteado>
        <Icono nombre="plus" size={14} />
        <Trans>New filter</Trans>
      </Chip>
    </View>
  );
}

type EditorFiltroProps = {
  /** `null` para uno nuevo. */
  filtro: FiltroPropio | null;
  grupos: GrupoConCategorias[];
  onGuardar: (filtro: FiltroPropio) => void;
  onBorrar: (id: string) => void;
  onCerrar: () => void;
};

/**
 * Hoja para crear o editar un filtro propio: nombre y casillas de
 * categorías (tocar, tocar, tocar), Guardar y, si ya existe, Borrar.
 */
export function EditorFiltro({
  filtro,
  grupos,
  onGuardar,
  onBorrar,
  onCerrar,
}: EditorFiltroProps) {
  const { t } = useTranslation();
  const [nombre, setNombre] = useState(filtro?.nombre ?? '');
  const [seleccion, setSeleccion] = useState<string[]>(
    filtro?.categorias ?? [],
  );
  const puedeGuardar = nombre.trim() !== '' && seleccion.length > 0;

  return createPortal(
    <View
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: KEYPAD_Z_INDEX + 5,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          onCerrar();
        }
      }}
    >
      <View
        role="dialog"
        aria-modal
        aria-label={filtro ? t('Edit filter') : t('New filter')}
        data-testid="editor-filtro"
        style={{
          maxHeight: '88%',
          backgroundColor: color.surface,
          borderRadius: `${radio.heroe}px ${radio.heroe}px 0 0`,
          boxShadow: sombra.hoja,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <View
          style={{
            flexShrink: 0,
            gap: 10,
            padding: `${espacio.margen}px ${espacio.margen}px 8px`,
          }}
        >
          <Text style={{ ...texto.titulo, color: color.fg }}>
            {filtro ? <Trans>Edit filter</Trans> : <Trans>New filter</Trans>}
          </Text>
          <Input
            autoFocus={!filtro}
            value={nombre}
            placeholder={t('Name (e.g. Annual bills)')}
            aria-label={t('Filter name')}
            data-testid="filtro-nombre"
            onChangeValue={setNombre}
            style={{
              height: 44,
              fontSize: 15,
              borderRadius: radio.sm,
              backgroundColor: color.surface2,
              color: color.fg,
              border: `1px solid ${color.line}`,
              padding: '0 12px',
            }}
          />
          <Text style={{ ...texto.etiqueta, color: color.fg3 }}>
            <Trans>Categories</Trans> · {seleccion.length}
          </Text>
        </View>
        <View style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {grupos.map(grupo => (
            <View key={grupo.id} style={{ flexShrink: 0 }}>
              <Text
                style={{
                  ...densidad.grupo,
                  fontSize: 13,
                  color: color.fg3,
                  padding: `8px ${espacio.margen}px 4px`,
                  backgroundColor: color.surface2,
                }}
              >
                {grupo.name}
              </Text>
              {grupo.categories.map(c => {
                const marcada = seleccion.includes(c.id);
                const { emoji, resto } = separarEmoji(c.name);
                return (
                  <Button
                    key={c.id}
                    variant="bare"
                    aria-pressed={marcada}
                    data-testid="filtro-categoria"
                    onPress={() =>
                      setSeleccion(s => alternarCategoria(s, c.id))
                    }
                    style={{
                      display: 'flex',
                      flexShrink: 0,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 10,
                      minHeight: 44,
                      padding: `0 ${espacio.margen}px`,
                      borderRadius: 0,
                      textAlign: 'left',
                      color: color.fg,
                      boxShadow: `inset 0 -1px 0 ${color.line}`,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: marcada ? color.accent : 'transparent',
                        border: marcada ? 0 : `2px solid ${color.line2}`,
                        color: color.accentInk,
                      }}
                    >
                      {marcada && <Icono nombre="check" size={14} />}
                    </span>
                    <Text style={{ ...densidad.nombre, color: color.fg }}>
                      {emoji ? `${emoji} ${resto}` : c.name}
                    </Text>
                  </Button>
                );
              })}
            </View>
          ))}
        </View>
        <View
          style={{
            flexShrink: 0,
            flexDirection: 'row',
            gap: 8,
            padding: espacio.margen,
            borderTop: `1px solid ${color.line}`,
          }}
        >
          {filtro && (
            <Boton
              variante="tonal"
              onPress={() => onBorrar(filtro.id)}
              data-testid="filtro-borrar"
            >
              <Trans>Delete</Trans>
            </Boton>
          )}
          <View style={{ flex: 1 }} />
          <Boton variante="fantasma" onPress={onCerrar}>
            <Trans>Cancel</Trans>
          </Boton>
          <Boton
            isDisabled={!puedeGuardar}
            data-testid="filtro-guardar"
            onPress={() =>
              onGuardar({
                id: filtro?.id ?? uuidv4(),
                nombre,
                categorias: seleccion,
              })
            }
          >
            <Trans>Save</Trans>
          </Boton>
        </View>
      </View>
    </View>,
    document.body,
  );
}
