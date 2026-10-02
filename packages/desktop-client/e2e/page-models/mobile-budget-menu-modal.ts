import type { Locator, Page } from '@playwright/test';

/**
 * Teclado de asignación inline (panel inferior) que sustituye al modal del
 * presupuesto de una categoría en el móvil. Conserva el nombre y la API del
 * antiguo modelo de página para no tocar los tests que lo usan.
 */
export class BudgetMenuModal {
  readonly page: Page;
  readonly locator: Locator;
  readonly autoAssignButton: Locator;
  readonly doneButton: Locator;
  readonly cancelButton: Locator;

  constructor(locator: Locator) {
    this.locator = locator;
    this.page = locator.page();

    this.autoAssignButton = locator.getByTestId('keypad-auto-assign');
    this.doneButton = locator.getByTestId('keypad-done');
    this.cancelButton = locator.getByTestId('keypad-cancel');
  }

  async close() {
    if (await this.locator.isVisible()) {
      await this.doneButton.click();
    }
  }

  async showActions() {
    await this.autoAssignButton.click();
  }

  /** Teclea los dígitos tal cual (céntimos, como YNAB: «12300» = 123,00) y pulsa Hecho. */
  async setBudgetAmount(newAmount: string) {
    for (const digit of newAmount.replace(/\D/g, '')) {
      await this.locator.getByTestId(`keypad-${digit}`).click();
    }
    await this.doneButton.click();
  }

  async #selectAutoAssign(name: string) {
    await this.showActions();
    await this.page
      .getByRole('menu')
      .getByRole('button', { name, exact: true })
      .click();
  }

  async copyLastMonthBudget() {
    await this.#selectAutoAssign("Copy last month's budget");
  }

  async setTo3MonthAverage() {
    await this.#selectAutoAssign('Set to 3 month average');
  }

  async setTo6MonthAverage() {
    await this.#selectAutoAssign('Set to 6 month average');
  }

  async setToYearlyAverage() {
    await this.#selectAutoAssign('Set to yearly average');
  }

  async applyBudgetTemplate() {
    await this.#selectAutoAssign('Overwrite with template');
  }
}
