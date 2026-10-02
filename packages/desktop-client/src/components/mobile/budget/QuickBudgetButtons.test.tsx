import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestProviders } from '#mocks';

import { QuickBudgetButtons } from './QuickBudgetButtons';

describe('QuickBudgetButtons', () => {
  it('muestra los cuatro botones rápidos', () => {
    render(
      <TestProviders>
        <QuickBudgetButtons budgeted={5000} onUpdateBudget={vi.fn()} />
      </TestProviders>,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map(b => b.textContent)).toEqual(['−10', '−1', '+1', '+10']);
  });

  it('suma y resta en céntimos sobre lo presupuestado', async () => {
    const user = userEvent.setup();
    const onUpdateBudget = vi.fn();
    render(
      <TestProviders>
        <QuickBudgetButtons budgeted={5000} onUpdateBudget={onUpdateBudget} />
      </TestProviders>,
    );

    const [minus10, minus1, plus1, plus10] = screen.getAllByRole('button');

    await user.click(plus10);
    expect(onUpdateBudget).toHaveBeenLastCalledWith(6000);

    await user.click(plus1);
    expect(onUpdateBudget).toHaveBeenLastCalledWith(5100);

    await user.click(minus1);
    expect(onUpdateBudget).toHaveBeenLastCalledWith(4900);

    await user.click(minus10);
    expect(onUpdateBudget).toHaveBeenLastCalledWith(4000);
  });

  it('trata un presupuesto vacío como cero', async () => {
    const user = userEvent.setup();
    const onUpdateBudget = vi.fn();
    render(
      <TestProviders>
        <QuickBudgetButtons budgeted={0} onUpdateBudget={onUpdateBudget} />
      </TestProviders>,
    );

    await user.click(screen.getAllByRole('button')[0]);
    expect(onUpdateBudget).toHaveBeenLastCalledWith(-1000);
  });
});
