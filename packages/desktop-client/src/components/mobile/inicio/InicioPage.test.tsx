import type { CategoryEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useCategories } from '#hooks/useCategories';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useNavigate } from '#hooks/useNavigate';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import { useSheetValue } from '#hooks/useSheetValue';
import { TestProviders } from '#mocks';
import { useDispatch } from '#redux';

import { InicioPage } from './InicioPage';

vi.mock('#hooks/useSheetValue');
vi.mock('#hooks/useOverspentCategories');
vi.mock('#hooks/useCategories');
vi.mock('#hooks/usePinnedCategories');
vi.mock('#hooks/useNavigate');
vi.mock('#hooks/useMetadataPref');
vi.mock('#hooks/useSpreadsheet', () => ({
  useSpreadsheet: () => ({}),
}));
vi.mock('#components/budget/util', async importOriginal => ({
  ...(await importOriginal<object>()),
  prewarmMonth: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('#budget', async importOriginal => ({
  ...(await importOriginal<object>()),
  useBudgetActions: () => ({ mutate: vi.fn() }),
}));
vi.mock('#redux', async importOriginal => ({
  ...(await importOriginal<object>()),
  useDispatch: vi.fn(),
}));

const comida: CategoryEntity = {
  id: 'cat-comida',
  name: 'Menjar',
  group: 'grupo-1',
  is_income: false,
};
const regalos: CategoryEntity = {
  id: 'cat-regalos',
  name: 'Regals',
  group: 'grupo-1',
  is_income: false,
};
const grupo = {
  id: 'grupo-1',
  name: 'Despeses',
  is_income: false,
  categories: [comida, regalos],
};

// Valores de la hoja de cálculo por nombre de celda (céntimos enteros).
const hoja: Record<string, unknown> = {
  'to-budget': 12_50,
  'total-budgeted': -3_000_00,
  'total-spent': -210_05,
  'total-income': 2_500_00,
  'leftover-cat-comida': 401_74,
  'leftover-cat-regalos': -22_30,
};

function mockHoja(valores: Record<string, unknown> = {}) {
  vi.mocked(useSheetValue).mockImplementation(((
    binding: string | { name: string },
  ) => {
    const name = typeof binding === 'string' ? binding : binding.name;
    const merged = { ...hoja, ...valores };
    return name in merged ? merged[name] : null;
  }) as never);
}

describe('InicioPage', () => {
  const dispatch = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHoja();
    vi.mocked(useDispatch).mockReturnValue(dispatch as never);
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useMetadataPref).mockReturnValue([
      'Presupuesto de prueba',
      vi.fn(),
    ] as never);
    vi.mocked(useCategories).mockReturnValue({
      data: { list: [comida, regalos], grouped: [grupo] },
    } as never);
    vi.mocked(usePinnedCategories).mockReturnValue({
      pinnedIds: ['cat-comida', 'cat-regalos', 'cat-borrada'],
      isPinned: vi.fn(),
      togglePinned: vi.fn(),
      setPinnedIds: vi.fn(),
    });
    vi.mocked(useOverspentCategories).mockReturnValue({
      categories: [regalos],
      amountsByCategory: new Map([['cat-regalos', -22_30]]),
      totalAmount: -22_30,
    });
  });

  const renderInicio = () =>
    render(
      <TestProviders>
        <InicioPage />
      </TestProviders>,
    );

  it('muestra cabecera, por hacer, fijadas y resumen', async () => {
    renderInicio();

    expect(
      await screen.findByText('Presupuesto de prueba'),
    ).toBeInTheDocument();

    // Por hacer
    expect(screen.getByText('1 category in the red')).toBeInTheDocument();
    expect(screen.getByText('12.50 ready to assign')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();

    // Fijadas (la categoría borrada se ignora)
    expect(screen.getByText('Menjar')).toBeInTheDocument();
    expect(screen.getByText('Regals')).toBeInTheDocument();
    expect(screen.getByText('401.74')).toBeInTheDocument();
    // Aparece dos veces: total en rojo de «Por hacer» y saldo de Regals
    expect(screen.getAllByText('-22.30')).toHaveLength(2);

    // Resumen: lo asignado se muestra en positivo
    expect(screen.getByTestId('resumen-asignado')).toHaveTextContent(
      '3,000.00',
    );
    expect(screen.getByTestId('resumen-gastado')).toHaveTextContent('-210.05');
    expect(screen.getByTestId('resumen-ingresos')).toHaveTextContent(
      '2,500.00',
    );
  });

  it('«Cubrir» abre el selector de categorías en rojo', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(await screen.findByRole('button', { name: 'Cover' }));

    const action = dispatch.mock.calls.at(-1)?.[0];
    expect(action.payload.modal.name).toBe('category-autocomplete');
    expect(action.payload.modal.options.categoryGroups[0].categories).toEqual([
      regalos,
    ]);
  });

  it('«Asignar» abre la pantalla «Asignar el mes»', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(await screen.findByRole('button', { name: 'Assign' }));

    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/asignar\?month=\d{4}-\d{2}$/),
    );
  });

  it('con sobreasignación ofrece «Corregir» y abre el resumen del mes', async () => {
    mockHoja({ 'to-budget': -10_00 });
    const user = userEvent.setup();
    renderInicio();

    expect(
      await screen.findByText('Overbudgeted by 10.00'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fix' }));

    const action = dispatch.mock.calls.at(-1)?.[0];
    expect(action.payload.modal.name).toBe('envelope-budget-summary');
  });

  it('sin nada que hacer muestra «Todo en orden»', async () => {
    mockHoja({ 'to-budget': 0 });
    vi.mocked(useOverspentCategories).mockReturnValue({
      categories: [],
      amountsByCategory: new Map(),
      totalAmount: 0,
    });
    renderInicio();

    expect(await screen.findByText('All in order')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cover' }),
    ).not.toBeInTheDocument();
  });

  it('tocar una fijada abre la categoría y «Editar» lleva al presupuesto', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(
      await screen.findByRole('button', { name: 'Open Menjar category' }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/categories\/cat-comida\?month=\d{4}-\d{2}$/),
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(navigate).toHaveBeenLastCalledWith('/budget');
  });
});
