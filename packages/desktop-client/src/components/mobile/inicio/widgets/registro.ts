import type { ComponentType } from 'react';

import type { TFunction } from 'i18next';

import type { PropsWidget } from '#components/mobile/inicio/comunes';
import type { IdWidget, Tamano } from '#components/mobile/inicio/modeloWidgets';

import { Consejos } from './Consejos';
import { CuentaComun } from './CuentaComun';
import { Deudas } from './Deudas';
import { Fijadas } from './Fijadas';
import { GastoMes } from './GastoMes';
import { Huchas } from './Huchas';
import { PorHacer } from './PorHacer';
import { ResumenMes } from './ResumenMes';

export const COMPONENTES_WIDGET: Record<
  IdWidget,
  ComponentType<PropsWidget>
> = {
  'por-hacer': PorHacer,
  fijadas: Fijadas,
  'cuenta-comun': CuentaComun,
  consejos: Consejos,
  'resumen-mes': ResumenMes,
  deudas: Deudas,
  'gasto-mes': GastoMes,
  huchas: Huchas,
};

/** Widgets que solo tienen sentido con el presupuesto por sobres. */
export const SOLO_SOBRES: ReadonlySet<IdWidget> = new Set([
  'por-hacer',
  'resumen-mes',
]);

export function nombreWidget(t: TFunction, id: IdWidget): string {
  switch (id) {
    case 'por-hacer':
      return t('To do');
    case 'fijadas':
      return t('Pinned');
    case 'cuenta-comun':
      return t('Joint account');
    case 'consejos':
      return t('Advice');
    case 'resumen-mes':
      return t('Month summary');
    case 'deudas':
      return t('Debts');
    case 'gasto-mes':
      return t('Spending this month');
    case 'huchas':
      return t('Piggy banks');
    default:
      return id;
  }
}

export function descripcionWidget(t: TFunction, id: IdWidget): string {
  switch (id) {
    case 'por-hacer':
      return t('Categories in the red, money ready to assign');
    case 'fijadas':
      return t('Progress of your pinned categories');
    case 'cuenta-comun':
      return t('How much to deposit in the joint account');
    case 'consejos':
      return t('Advice from the monthly analysis');
    case 'resumen-mes':
      return t('Income, assigned and spent');
    case 'deudas':
      return t('Loans: % paid and end date');
    case 'gasto-mes':
      return t('Where the money goes, by category');
    case 'huchas':
      return t('Off-budget savings and last transfer');
    default:
      return '';
  }
}

export function nombreTamano(t: TFunction, tamano: Tamano): string {
  switch (tamano) {
    case 'compacto':
      return t('Compact');
    case 'grande':
      return t('Large');
    default:
      return t('Normal');
  }
}
