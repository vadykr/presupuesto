import type { IntegerAmount } from '@actual-app/core/shared/util';

import { faltante } from '#components/mobile/budget/objetivos';
import type { DatosCategoriaMes } from '#components/mobile/budget/objetivos';

/**
 * Avance de una categoría fijada en el Inicio. Si se fija es porque importa,
 * así que además del disponible se enseña cuánto lleva:
 *
 * - con objetivo: asignado / objetivo (o saldo / objetivo si el objetivo se
 *   mide sobre el saldo, `#goal`);
 * - sin objetivo: gastado / asignado;
 * - sin objetivo ni nada asignado: sin avance.
 *
 * El estado da el color (píldora y anillo): `mal` gastado de más, `aviso` le
 * falta para el objetivo, `bien` cubierta, `neutro` nada pendiente.
 */
export type EstadoAvance = 'bien' | 'aviso' | 'mal' | 'neutro';

export type Avance = {
  modo: 'objetivo' | 'gastado' | 'sin-datos';
  /** 0..1 para dibujar; ya recortado. */
  fraccion: number;
  /** Lo que se lleva (céntimos, positivo). */
  hecho: IntegerAmount;
  /** El total contra el que se mide (objetivo o asignado). */
  total: IntegerAmount;
  /** Lo que falta para el objetivo (0 si nada o si está ignorada). */
  falta: IntegerAmount;
  estado: EstadoAvance;
};

function recortar(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 0;
  }
  return Math.max(0, Math.min(1, valor));
}

export function estadoDeCategoria(datos: DatosCategoriaMes): EstadoAvance {
  if (datos.balance < 0) {
    return 'mal';
  }
  if (!datos.ignorada && faltante(datos) > 0) {
    return 'aviso';
  }
  if (datos.balance > 0) {
    return 'bien';
  }
  return 'neutro';
}

export function avanceFijada(datos: DatosCategoriaMes): Avance {
  const estado = estadoDeCategoria(datos);
  const falta = faltante(datos);

  if (datos.goal != null && datos.goal > 0) {
    const hecho = Math.max(0, datos.longGoal ? datos.balance : datos.budgeted);
    return {
      modo: 'objetivo',
      fraccion: recortar(hecho / datos.goal),
      hecho,
      total: datos.goal,
      falta,
      estado,
    };
  }

  if (datos.budgeted > 0) {
    const gastado = Math.max(0, -datos.spent);
    return {
      modo: 'gastado',
      // Gastado de más: el anillo se ve lleno (y rojo por el estado).
      fraccion: datos.balance < 0 ? 1 : recortar(gastado / datos.budgeted),
      hecho: gastado,
      total: datos.budgeted,
      falta,
      estado,
    };
  }

  return {
    modo: 'sin-datos',
    fraccion: datos.balance < 0 ? 1 : 0,
    hecho: 0,
    total: 0,
    falta,
    estado,
  };
}

/**
 * Separa un emoji inicial del nombre («💳 Visa» → { emoji: '💳', nombre:
 * 'Visa' }). Sin emoji, la inicial hace de icono.
 */
export function iconoDeNombre(nombre: string): {
  emoji: string | null;
  nombre: string;
  inicial: string;
} {
  const m = nombre.match(
    /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator})*)\s*(.*)$/u,
  );
  if (m && m[2]) {
    return { emoji: m[1], nombre: m[2], inicial: m[2].charAt(0).toUpperCase() };
  }
  const limpio = nombre.trim();
  return {
    emoji: null,
    nombre: limpio,
    inicial: Array.from(limpio)[0]?.toUpperCase() ?? '?',
  };
}
