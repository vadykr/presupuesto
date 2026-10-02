import type {
  AccountEntity,
  CategoryEntity,
} from '@actual-app/core/types/models';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DatosCategoriaMes } from '#components/mobile/budget/objetivos';
import { useDatosObjetivos } from '#components/mobile/budget/useDatosObjetivos';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useNavigate } from '#hooks/useNavigate';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import { useSheetValue } from '#hooks/useSheetValue';
import { TestProviders } from '#mocks';
import { useDispatch } from '#redux';

import { InicioPage } from './InicioPage';

// Preferencias sincronizadas simuladas (la de verdad pasa por redux).
const prefs = vi.hoisted(() => ({
  valores: {} as Record<string, string | undefined>,
  guardar: vi.fn(),
}));
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: (name: string) => [
    prefs.valores[name],
    (value: string) => prefs.guardar(name, value),
  ],
}));

vi.mock('#hooks/useSheetValue');
vi.mock('#hooks/useOverspentCategories');
vi.mock('#hooks/useCategories');
vi.mock('#hooks/usePinnedCategories');
vi.mock('#hooks/useNavigate');
vi.mock('#hooks/useAccounts');
vi.mock('#components/mobile/budget/useDatosObjetivos');
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
  name: '🛒 Menjar',
  group: 'grupo-1',
  is_income: false,
};
const regalos: CategoryEntity = {
  id: 'cat-regalos',
  name: 'Regals',
  group: 'grupo-1',
  is_income: false,
};
const llum: CategoryEntity = {
  id: 'cat-llum',
  name: 'Llum',
  group: 'grupo-1',
  is_income: false,
};
const grupo = {
  id: 'grupo-1',
  name: 'Despeses',
  is_income: false,
  categories: [comida, regalos, llum],
};

// Valores de la hoja de cálculo por nombre de celda (céntimos enteros).
const hoja: Record<string, unknown> = {
  'to-budget': 12_50,
  'total-budgeted': -3_000_00,
  'total-spent': -210_05,
  'total-income': 2_500_00,
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

const datosPorCategoria: Record<string, DatosCategoriaMes> = {
  // Objetivo 400, asignados 100 → 25 %, le falta.
  'cat-comida': {
    goal: 400_00,
    longGoal: false,
    budgeted: 100_00,
    balance: 401_74,
    spent: -10_00,
  },
  // Sin objetivo, gastado de más.
  'cat-regalos': {
    goal: null,
    longGoal: false,
    budgeted: 50_00,
    balance: -22_30,
    spent: -72_30,
  },
  'cat-llum': {
    goal: null,
    longGoal: false,
    budgeted: 45_50,
    balance: 45_50,
    spent: 0,
  },
};

const cuentas = [
  { id: 'a1', name: 'Cuenta Personal', offbudget: 0, closed: 0 },
  { id: 'a2', name: 'Conte conjunt', offbudget: 0, closed: 0 },
] as AccountEntity[];

describe('InicioPage', () => {
  const dispatch = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    prefs.valores = {};
    mockHoja();
    vi.mocked(useDispatch).mockReturnValue(dispatch as never);
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useCategories).mockReturnValue({
      data: { list: [comida, regalos, llum], grouped: [grupo] },
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
    vi.mocked(useDatosObjetivos).mockImplementation(
      (_month, categories) =>
        new Map(categories.map(c => [c.id, datosPorCategoria[c.id]])),
    );
    vi.mocked(useAccounts).mockReturnValue({ data: cuentas } as never);
  });

  const renderInicio = () =>
    render(
      <TestProviders>
        <InicioPage />
      </TestProviders>,
    );

  it('muestra cabecera y los widgets por defecto en el orden de A', async () => {
    renderInicio();

    const lista = await screen.findByTestId('inicio-widgets');
    expect(screen.getByText(/^day \d+ of \d+$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit home' })).toBeVisible();

    // «Consejos» no se pinta: en esta rama no hay módulo de análisis.
    const orden = [...lista.querySelectorAll('[data-testid^="inicio-"]')].map(
      el => el.getAttribute('data-testid'),
    );
    expect(orden).toEqual([
      'inicio-por-hacer',
      'inicio-fijadas',
      'inicio-cuenta-comun',
      'inicio-resumen',
    ]);

    // Por hacer
    expect(screen.getByText('1 category in the red')).toBeInTheDocument();
    expect(screen.getByText('12.50 ready to assign')).toBeInTheDocument();

    // Resumen: asignado y gastado en positivo
    expect(screen.getByTestId('resumen-asignado')).toHaveTextContent(
      '3,000.00',
    );
    expect(screen.getByTestId('resumen-gastado')).toHaveTextContent('210.05');
    expect(screen.getByTestId('resumen-ingresos')).toHaveTextContent(
      '2,500.00',
    );
  });

  it('fijadas: anillo de avance con el emoji y disponible en píldora', async () => {
    renderInicio();

    const fijadas = await screen.findByTestId('inicio-fijadas');
    // La categoría borrada se ignora.
    expect(
      within(fijadas).getAllByRole('button', { name: /^Open .* category$/ }),
    ).toHaveLength(2);
    expect(within(fijadas).getByText('🛒')).toBeInTheDocument();
    expect(within(fijadas).getByText('Menjar')).toBeInTheDocument();
    expect(within(fijadas).getByText('401.74')).toBeInTheDocument();
    expect(within(fijadas).getByText('-22.30')).toBeInTheDocument();
    // Avance hacia el objetivo (asignado / objetivo) y gastado / asignado.
    expect(
      within(fijadas).getByRole('img', {
        name: '100.00 of 400.00 · 300.00 to go',
      }),
    ).toBeInTheDocument();
    expect(
      within(fijadas).getByRole('img', { name: 'Spent 72.30 of 50.00' }),
    ).toBeInTheDocument();
  });

  it('fijadas: 2 en normal = dos tarjetas con el porcentaje dentro', async () => {
    renderInicio();

    const fijadas = await screen.findByTestId('inicio-fijadas');
    expect(within(fijadas).getByTestId('fijadas-rejilla')).toHaveAttribute(
      'data-columnas',
      '2',
    );
    // 100/400 = 25 %; gastado de más = 100 %.
    expect(
      within(fijadas)
        .getAllByTestId('fijada-porcentaje')
        .map(el => el.textContent),
    ).toEqual(['25%', '100%']);
    expect(within(fijadas).queryByTestId('fijada-heroe')).toBeNull();
  });

  it('fijadas: 3 o más en normal = rejilla de tres con porcentaje', async () => {
    vi.mocked(usePinnedCategories).mockReturnValue({
      pinnedIds: ['cat-comida', 'cat-regalos', 'cat-llum'],
      isPinned: vi.fn(),
      togglePinned: vi.fn(),
      setPinnedIds: vi.fn(),
    });
    renderInicio();

    const fijadas = await screen.findByTestId('inicio-fijadas');
    expect(within(fijadas).getByTestId('fijadas-rejilla')).toHaveAttribute(
      'data-columnas',
      '3',
    );
    expect(
      within(fijadas)
        .getAllByTestId('fijada-porcentaje')
        .map(el => el.textContent),
    ).toEqual(['25%', '100%', '0%']);
  });

  it('fijadas: una sola = tarjeta héroe con porcentaje, hasta ahora y faltan', async () => {
    const user = userEvent.setup();
    vi.mocked(usePinnedCategories).mockReturnValue({
      pinnedIds: ['cat-comida'],
      isPinned: vi.fn(),
      togglePinned: vi.fn(),
      setPinnedIds: vi.fn(),
    });
    vi.mocked(useCategories).mockReturnValue({
      data: {
        list: [
          {
            ...comida,
            goal_def: JSON.stringify([
              {
                type: 'by',
                amount: 400,
                month: '2027-07',
                directive: 'template',
              },
            ]),
          },
          regalos,
          llum,
        ],
        grouped: [grupo],
      },
    } as never);
    renderInicio();

    const heroe = await screen.findByTestId('fijada-heroe');
    expect(within(heroe).getByTestId('fijada-porcentaje')).toHaveTextContent(
      '25%',
    );
    expect(within(heroe).getByText('completed')).toBeInTheDocument();
    expect(within(heroe).getByText('So far')).toBeInTheDocument();
    expect(within(heroe).getByText('100.00')).toBeInTheDocument();
    expect(within(heroe).getByText('To go')).toBeInTheDocument();
    expect(within(heroe).getByText('300.00')).toBeInTheDocument();
    expect(within(heroe).getByTestId('fijada-fecha')).toHaveTextContent(
      'by 1 Jul 2027',
    );
    expect(screen.queryByTestId('fijadas-rejilla')).toBeNull();

    await user.click(heroe);
    expect(navigate).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/categories\/cat-comida\?month=\d{4}-\d{2}$/),
    );
  });

  it('fijadas: una sola sin objetivo = gastado y disponible', async () => {
    vi.mocked(usePinnedCategories).mockReturnValue({
      pinnedIds: ['cat-regalos'],
      isPinned: vi.fn(),
      togglePinned: vi.fn(),
      setPinnedIds: vi.fn(),
    });
    renderInicio();

    const heroe = await screen.findByTestId('fijada-heroe');
    expect(within(heroe).getByTestId('fijada-porcentaje')).toHaveTextContent(
      '100%',
    );
    expect(within(heroe).getByText('Spent')).toBeInTheDocument();
    expect(within(heroe).getByText('of 50.00')).toBeInTheDocument();
    expect(within(heroe).getByText('Available')).toBeInTheDocument();
    expect(within(heroe).getByText('-22.30')).toBeInTheDocument();
  });

  it('fijadas en grande: lista con barra y texto de avance', async () => {
    prefs.valores['inicio-widgets'] = JSON.stringify([
      { id: 'fijadas', tamano: 'grande' },
    ]);
    renderInicio();

    const fijadas = await screen.findByTestId('inicio-fijadas');
    expect(
      within(fijadas).getByText('100.00 of 400.00 · 300.00 to go'),
    ).toBeInTheDocument();
  });

  it('tocar una fijada abre la categoría y «Editar» lleva al presupuesto', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(
      await screen.findByRole('button', { name: 'Open 🛒 Menjar category' }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/categories\/cat-comida\?month=\d{4}-\d{2}$/),
    );

    const fijadas = screen.getByTestId('inicio-fijadas');
    await user.click(within(fijadas).getByRole('button', { name: 'Edit' }));
    expect(navigate).toHaveBeenLastCalledWith('/budget');
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

  it('cuenta común: suma lo asignado y abre el traspaso rellenado', async () => {
    prefs.valores['cuenta-comun-categorias'] = JSON.stringify([
      'cat-comida',
      'cat-llum',
      'cat-borrada',
    ]);
    const user = userEvent.setup();
    renderInicio();

    expect(await screen.findByTestId('cuenta-comun-importe')).toHaveTextContent(
      '145.50',
    );
    await user.click(screen.getByRole('button', { name: 'Record transfer' }));

    const url = navigate.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/transactions/new?')).toBe(true);
    expect(params.get('account')).toBe('Cuenta Personal');
    expect(params.get('payee')).toBe('Conte conjunt');
    expect(params.get('amount')).toBe('145.5');
  });

  it('cuenta común sin categorías invita a elegirlas', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(
      await screen.findByRole('button', { name: 'Choose categories' }),
    );
    const action = dispatch.mock.calls.at(-1)?.[0];
    expect(action.payload.modal.name).toBe('category-autocomplete');

    action.payload.modal.options.onSelect('cat-llum');
    expect(prefs.guardar).toHaveBeenLastCalledWith(
      'cuenta-comun-categorias',
      '["cat-llum"]',
    );
  });

  it('respeta el orden y los widgets de la preferencia', async () => {
    prefs.valores['inicio-widgets'] = JSON.stringify([
      { id: 'resumen-mes', tamano: 'compacto' },
      { id: 'por-hacer', tamano: 'normal' },
    ]);
    renderInicio();

    const lista = await screen.findByTestId('inicio-widgets');
    const orden = [...lista.querySelectorAll('[data-testid^="inicio-"]')].map(
      el => el.getAttribute('data-testid'),
    );
    expect(orden).toEqual(['inicio-resumen', 'inicio-por-hacer']);
    expect(screen.queryByTestId('inicio-fijadas')).not.toBeInTheDocument();
  });

  it('sin widgets enseña el estado vacío', async () => {
    prefs.valores['inicio-widgets'] = '[]';
    renderInicio();

    expect(
      await screen.findByText(
        'Nothing on your home. Tap «Edit» to add widgets.',
      ),
    ).toBeInTheDocument();
  });

  it('modo editar: subir, cambiar tamaño, quitar y añadir guardan la preferencia', async () => {
    const user = userEvent.setup();
    renderInicio();

    await user.click(await screen.findByRole('button', { name: 'Edit home' }));
    expect(screen.getByTestId('inicio-editar')).toBeInTheDocument();

    const ultimoGuardado = () =>
      JSON.parse(prefs.guardar.mock.calls.at(-1)?.[1] as string) as {
        id: string;
        tamano: string;
      }[];

    await user.click(screen.getByRole('button', { name: 'Move Pinned up' }));
    expect(
      ultimoGuardado()
        .map(w => w.id)
        .slice(0, 2),
    ).toEqual(['fijadas', 'por-hacer']);

    await user.click(screen.getByRole('button', { name: 'Pinned: Large' }));
    expect(ultimoGuardado().find(w => w.id === 'fijadas')?.tamano).toBe(
      'grande',
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove Joint account' }),
    );
    expect(ultimoGuardado().map(w => w.id)).not.toContain('cuenta-comun');

    await user.click(screen.getByRole('button', { name: 'Add Debts' }));
    expect(ultimoGuardado().at(-1)).toEqual({
      id: 'deudas',
      tamano: 'normal',
    });

    await user.click(
      screen.getByRole('button', { name: 'Restore default home' }),
    );
    expect(prefs.guardar).toHaveBeenLastCalledWith('inicio-widgets', '');

    await user.click(screen.getByRole('button', { name: 'Done editing home' }));
    expect(await screen.findByTestId('inicio-widgets')).toBeInTheDocument();
  });
});
