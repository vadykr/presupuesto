import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSheetValue } from '#hooks/useSheetValue';

import { BalanceMenu } from './BalanceMenu';

vi.mock('#hooks/useSheetValue');

// El hook se llama dos veces por render: carryover y saldo.
function mockSheet({
  carryover,
  balance,
}: {
  carryover: boolean;
  balance: number;
}) {
  vi.mocked(useSheetValue).mockImplementation(((
    binding: string | { name: string },
  ) => {
    const name = typeof binding === 'string' ? binding : binding.name;
    return name.startsWith('carryover-') ? carryover : balance;
  }) as never);
}

describe('BalanceMenu («Añadir desde…»)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra «Add from…» aunque el saldo sea positivo, y «Transfer»', () => {
    mockSheet({ carryover: false, balance: 1500 });
    render(<BalanceMenu categoryId="cat-1" onAddFrom={vi.fn()} />);

    expect(screen.getByText('Add from…')).toBeInTheDocument();
    expect(
      screen.getByText('Transfer to another category'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cover overspending')).not.toBeInTheDocument();
  });

  it('muestra «Add from…» junto a «Cover overspending» con saldo negativo', () => {
    mockSheet({ carryover: false, balance: -800 });
    render(<BalanceMenu categoryId="cat-1" onAddFrom={vi.fn()} />);

    expect(screen.getByText('Add from…')).toBeInTheDocument();
    expect(screen.getByText('Cover overspending')).toBeInTheDocument();
  });

  it('no muestra «Add from…» si no se pasa onAddFrom (escritorio)', () => {
    mockSheet({ carryover: false, balance: 0 });
    render(<BalanceMenu categoryId="cat-1" />);

    expect(screen.queryByText('Add from…')).not.toBeInTheDocument();
  });

  it('llama a onAddFrom al elegir la opción', async () => {
    const user = userEvent.setup();
    const onAddFrom = vi.fn();
    mockSheet({ carryover: false, balance: 0 });
    render(<BalanceMenu categoryId="cat-1" onAddFrom={onAddFrom} />);

    await user.click(screen.getByText('Add from…'));
    expect(onAddFrom).toHaveBeenCalledTimes(1);
  });
});
