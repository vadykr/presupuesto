import { describe, expect, it } from 'vitest';

import { notaDeCategoria, plantillasDeObjetivo } from './ynab5-objetivos';
import type { Category } from './ynab5-types';

const HOY = '2026-10';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    category_group_id: 'group-1',
    name: 'Categoría',
    deleted: false,
    hidden: false,
    budgeted: 0,
    activity: 0,
    balance: 0,
    goal_creation_month: '2025-09-01',
    ...overrides,
  };
}

describe('plantillasDeObjetivo (objetivos de YNAB → plantillas de Actual)', () => {
  it('sin objetivo no genera nada', () => {
    expect(plantillasDeObjetivo(makeCategory(), HOY)).toEqual([]);
    expect(
      plantillasDeObjetivo(
        makeCategory({ goal_type: 'MF', goal_target: 0 }),
        HOY,
      ),
    ).toEqual([]);
  });

  it('MF (monthly funding) → #template X', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({ goal_type: 'MF', goal_target: 31500 }),
        HOY,
      ),
    ).toEqual(['#template 31.5']);
  });

  it('DEBT → #template cuota', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'DEBT',
          goal_target: 246720,
          goal_cadence: 1,
          goal_cadence_frequency: 1,
          goal_day: 1,
        }),
        HOY,
      ),
    ).toEqual(['#template 246.72']);
  });

  it('TB (saldo objetivo sin fecha) → #goal X', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({ goal_type: 'TB', goal_target: 10000000 }),
        HOY,
      ),
    ).toEqual(['#goal 10000']);
  });

  it('TBD (saldo objetivo con fecha) → #template X by YYYY-MM', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'TBD',
          goal_target: 1200000,
          goal_target_month: '2027-06-01',
        }),
        HOY,
      ),
    ).toEqual(['#template 1200 by 2027-06']);
  });

  it('NEED mensual «Set aside another» → #template X', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 31500,
          goal_cadence: 1,
          goal_cadence_frequency: 1,
          goal_needs_whole_amount: true,
          goal_day: 1,
        }),
        HOY,
      ),
    ).toEqual(['#template 31.5']);
  });

  it('NEED mensual «Refill up to» → #template up to X', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 600000,
          goal_cadence: 1,
          goal_cadence_frequency: 1,
          goal_needs_whole_amount: false,
        }),
        HOY,
      ),
    ).toEqual(['#template up to 600']);
  });

  it('NEED cada N meses → periódica desde el mes de creación', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 90000,
          goal_cadence: 1,
          goal_cadence_frequency: 3,
          goal_needs_whole_amount: true,
        }),
        HOY,
      ),
    ).toEqual(['#template 90 repeat every 3 months starting 2025-09-01']);
  });

  it('NEED semanal → repeat every week desde el día de la semana indicado', () => {
    // 2025-09-01 fue lunes; goal_day 5 = viernes → 2025-09-05.
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 50000,
          goal_cadence: 2,
          goal_cadence_frequency: 2,
          goal_day: 5,
        }),
        HOY,
      ),
    ).toEqual(['#template 50 repeat every 2 weeks starting 2025-09-05']);
  });

  it('NEED anual con fecha («Factures Anuals») → by YYYY-MM repeat every year', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 119990,
          goal_cadence: 13,
          goal_cadence_frequency: 1,
          goal_target_month: '2025-12-17',
          goal_needs_whole_amount: true,
        }),
        HOY,
      ),
    ).toEqual(['#template 119.99 by 2025-12 repeat every year']);
  });

  it('NEED anual sin fecha → un año después de la creación', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 1000000,
          goal_cadence: 13,
          goal_cadence_frequency: 2,
          goal_creation_month: '2025-11-01',
        }),
        HOY,
      ),
    ).toEqual(['#template 1000 by 2027-11 repeat every 2 years']);
  });

  it('NEED una sola vez con fecha → #template X by YYYY-MM', () => {
    expect(
      plantillasDeObjetivo(
        makeCategory({
          goal_type: 'NEED',
          goal_target: 2500000,
          goal_cadence: 0,
          goal_target_month: '2026-08-01',
        }),
        HOY,
      ),
    ).toEqual(['#template 2500 by 2026-08']);
  });

  it('la nota de la categoría conserva la de YNAB y añade la plantilla', () => {
    expect(
      notaDeCategoria(
        makeCategory({
          note: 'Luz y gas',
          goal_type: 'MF',
          goal_target: 120500,
        }),
        HOY,
      ),
    ).toBe('Luz y gas\n#template 120.5');
    expect(notaDeCategoria(makeCategory(), HOY)).toBeNull();
  });
});
