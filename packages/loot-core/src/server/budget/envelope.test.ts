// @ts-strict-ignore
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as db from '#server/db';
import * as sheet from '#server/sheet';

import { getSheetValue, setBudget } from './actions';
import * as budget from './base';

// «Listo para asignar» como en YNAB (RTA_COMO_YNAB en shared/presupuesto.ts):
// lo asignado en meses posteriores se descuenta del mes que se mira.
describe('to-budget del presupuesto por sobres', () => {
  beforeEach(global.emptyDatabase());
  afterEach(global.emptyDatabase());

  async function setupDatabase() {
    await db.insertAccount({ id: 'account1', name: 'Account 1' });
    await db.insertCategoryGroup({
      id: 'income-group',
      name: 'Income',
      is_income: 1,
    });
    await db.insertCategory({
      id: 'income-cat',
      name: 'Income',
      cat_group: 'income-group',
      is_income: 1,
    });
    await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
    await db.insertCategory({ id: 'cat1', name: 'cat1', cat_group: 'group1' });
    await db.insertCategory({ id: 'cat2', name: 'cat2', cat_group: 'group1' });

    // 1000 de ingresos en enero; nada más.
    await db.insertTransaction({
      date: '2024-01-05',
      amount: 1000,
      account: 'account1',
      category: 'income-cat',
    });

    await sheet.loadSpreadsheet(db);
    await budget.createBudget(['2024-01', '2024-02', '2024-03']);
    await sheet.waitOnSpreadsheet();
  }

  it('descuenta lo asignado en los meses siguientes', async () => {
    await setupDatabase();

    await setBudget({ category: 'cat1', month: '2024-01', amount: 300 });
    await setBudget({ category: 'cat1', month: '2024-02', amount: 200 });
    await setBudget({ category: 'cat2', month: '2024-03', amount: 100 });
    await sheet.waitOnSpreadsheet();

    // Enero: 1000 − 300 (enero) − 200 (febrero) − 100 (marzo).
    expect(await getSheetValue('budget202401', 'to-budget-local')).toBe(700);
    expect(await getSheetValue('budget202401', 'future-budgeted')).toBe(-300);
    expect(await getSheetValue('budget202401', 'to-budget')).toBe(400);

    // Febrero arrastra el «to budget» local de enero, no el descontado.
    expect(await getSheetValue('budget202402', 'from-last-month')).toBe(700);
    expect(await getSheetValue('budget202402', 'to-budget-local')).toBe(500);
    expect(await getSheetValue('budget202402', 'to-budget')).toBe(400);

    // Marzo es el último mes cargado: no hay nada por delante.
    expect(await getSheetValue('budget202403', 'future-budgeted')).toBe(0);
    expect(await getSheetValue('budget202403', 'to-budget')).toBe(400);
  });

  it('se recalcula al cambiar lo asignado en un mes futuro', async () => {
    await setupDatabase();

    await setBudget({ category: 'cat1', month: '2024-03', amount: 250 });
    await sheet.waitOnSpreadsheet();
    expect(await getSheetValue('budget202401', 'to-budget')).toBe(750);

    await setBudget({ category: 'cat1', month: '2024-03', amount: 0 });
    await sheet.waitOnSpreadsheet();
    expect(await getSheetValue('budget202401', 'to-budget')).toBe(1000);
  });
});
