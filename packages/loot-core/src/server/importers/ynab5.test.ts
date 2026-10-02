import { beforeEach, describe, expect, it, vi } from 'vitest';

import { send } from '#server/main-app';

import {
  getBudgetName,
  importPayees,
  importScheduledTransactions,
  importTransactions,
  parseFile,
} from './ynab5';
import {
  calcularAjusteDeSaldo,
  leerDatosPrestamo,
  notaDeCuenta,
  PAYEE_AJUSTE,
  PAYEE_INTERESES,
} from './ynab5-prestamos';
import type { Account, Payee, Transaction } from './ynab5-types';

vi.mock('#server/main-app', () => ({
  send: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(send).mockReset();
});

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

function makePayee(overrides: Partial<Payee> = {}): Payee {
  return {
    id: 'payee-1',
    name: 'Some Payee',
    deleted: false,
    ...overrides,
  };
}

describe('importPayees', () => {
  it('does not create an Actual payee for a YNAB transfer-linked payee', async () => {
    vi.mocked(send).mockResolvedValue('created-payee-id');

    const transferPayee = makePayee({
      id: 'ynab-transfer-payee',
      name: 'Transfer : Savings',
      transfer_account_id: 'ynab-account-2',
    });
    const normalPayee = makePayee({
      id: 'ynab-normal-payee',
      name: 'Coffee Shop',
    });

    const entityIdMap = new Map<string, string>();
    await importPayees(
      { payees: [transferPayee, normalPayee] } as Parameters<
        typeof importPayees
      >[0],
      entityIdMap,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('api/payee-create', {
      payee: { name: 'Coffee Shop' },
    });
    expect(entityIdMap.has('ynab-transfer-payee')).toBe(false);
    expect(entityIdMap.get('ynab-normal-payee')).toBe('created-payee-id');
  });

  it('still skips deleted payees', async () => {
    vi.mocked(send).mockResolvedValue('created-payee-id');

    const deletedPayee = makePayee({ id: 'deleted-1', deleted: true });
    const entityIdMap = new Map<string, string>();

    await importPayees(
      { payees: [deletedPayee] } as Parameters<typeof importPayees>[0],
      entityIdMap,
    );

    expect(send).not.toHaveBeenCalled();
    expect(entityIdMap.size).toBe(0);
  });
});

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    date: '2026-01-01',
    amount: -10000,
    cleared: 'cleared',
    approved: true,
    account_id: 'ynab-account-1',
    deleted: false,
    ...overrides,
  };
}

describe('importTransactions', () => {
  it('resolves a transfer transaction to the account-transfer payee', async () => {
    const entityIdMap = new Map<string, string>([
      ['ynab-account-1', 'actual-account-1'],
      ['ynab-account-2', 'actual-account-2'],
    ]);

    const transactionOut = makeTransaction({
      id: 'txn-out',
      account_id: 'ynab-account-1',
      amount: -10000,
      transfer_account_id: 'ynab-account-2',
      transfer_transaction_id: 'txn-in',
      payee_id: 'ynab-transfer-payee',
    });
    const transactionIn = makeTransaction({
      id: 'txn-in',
      account_id: 'ynab-account-2',
      amount: 10000,
      transfer_account_id: 'ynab-account-1',
      transfer_transaction_id: 'txn-out',
      payee_id: 'ynab-transfer-payee',
    });

    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/payees-get') {
        return [
          {
            id: 'actual-payee-for-account-1',
            transfer_acct: 'actual-account-1',
          },
          {
            id: 'actual-payee-for-account-2',
            transfer_acct: 'actual-account-2',
          },
        ];
      }
      if (name === 'api/categories-get') {
        return [];
      }
      if (name === 'api/transactions-add') {
        return null;
      }
      throw new Error(`Unexpected send call: ${name}`);
    });

    await importTransactions(
      {
        payees: [],
        transactions: [transactionOut, transactionIn],
        subtransactions: [],
      } as unknown as Parameters<typeof importTransactions>[0],
      entityIdMap,
      new Set(),
    );

    const transactionsAddCalls = vi
      .mocked(send)
      .mock.calls.filter(([name]) => name === 'api/transactions-add');
    expect(transactionsAddCalls).toHaveLength(2);

    const allImportedTransactions = transactionsAddCalls.flatMap(
      ([, args]) => args.transactions,
    );
    const outImported = allImportedTransactions.find(
      t => t.id === entityIdMap.get('txn-out'),
    );
    const inImported = allImportedTransactions.find(
      t => t.id === entityIdMap.get('txn-in'),
    );

    expect(outImported.payee).toBe('actual-payee-for-account-2');
    expect(inImported.payee).toBe('actual-payee-for-account-1');

    expect(outImported.transfer_id).toBe(inImported.id);
    expect(inImported.transfer_id).toBe(outImported.id);
  });
});

describe('importScheduledTransactions', () => {
  function makeScheduledTransaction() {
    return {
      id: 'scheduled-1',
      account_id: 'ynab-account-1',
      payee_id: 'ynab-payee-1',
      category_id: 'ynab-category-1',
      amount: -1000,
      memo: '',
      frequency: 'never',
      date_next: '2026-02-01',
      date_first: '2026-02-01',
      deleted: false,
    };
  }

  const entityIdMap = new Map<string, string>([
    ['ynab-account-1', 'actual-account-1'],
    ['ynab-payee-1', 'actual-payee-1'],
    ['ynab-category-1', 'actual-category-1'],
  ]);

  it('advances progress after its category rule update completes', async () => {
    const tick = vi.fn();
    const rule = {
      id: 'rule-1',
      stage: null,
      conditions_op: 'and',
      conditions: '[]',
      actions: '[]',
    };
    let queryCount = 0;

    vi.mocked(send).mockImplementation(async name => {
      if (name === 'api/payees-get') return [];
      if (name === 'api/schedule-create') return 'schedule-1';
      if (name === 'api/query') {
        queryCount += 1;
        return queryCount === 1 ? { data: 'rule-1' } : { data: [rule] };
      }
      if (name === 'api/rule-update') {
        expect(tick).not.toHaveBeenCalled();
        return null;
      }
      throw new Error(`Unexpected send call: ${name}`);
    });

    await importScheduledTransactions(
      {
        scheduled_transactions: [makeScheduledTransaction()],
        scheduled_subtransactions: [],
      } as unknown as Parameters<typeof importScheduledTransactions>[0],
      entityIdMap,
      new Set(),
      tick,
    );

    expect(tick).toHaveBeenCalledOnce();
  });

  it('does not advance progress when schedule creation fails', async () => {
    const tick = vi.fn();
    vi.mocked(send).mockImplementation(async name => {
      if (name === 'api/payees-get') return [];
      if (name === 'api/schedule-create') throw new Error('create failed');
      throw new Error(`Unexpected send call: ${name}`);
    });

    await expect(
      importScheduledTransactions(
        {
          scheduled_transactions: [makeScheduledTransaction()],
          scheduled_subtransactions: [],
        } as unknown as Parameters<typeof importScheduledTransactions>[0],
        entityIdMap,
        new Set(),
        tick,
      ),
    ).rejects.toThrow('create failed');

    expect(tick).not.toHaveBeenCalled();
  });
});

describe('ynab5 parseFile', () => {
  it('unwraps the legacy `budget` wrapper', () => {
    const data = parseFile(
      toBuffer({ data: { budget: { name: 'Legacy', accounts: [] } } }),
    );

    expect(data.name).toBe('Legacy');
    expect(getBudgetName('legacy.json', data)).toBe('Legacy');
  });

  it('unwraps the renamed `plan` wrapper from the current YNAB API', () => {
    const data = parseFile(
      toBuffer({ data: { plan: { name: 'Modern', accounts: [] } } }),
    );

    expect(data.name).toBe('Modern');
    expect(getBudgetName('modern.json', data)).toBe('Modern');
  });

  it('returns an already-unwrapped object unchanged', () => {
    const data = parseFile(toBuffer({ name: 'Bare', accounts: [] }));

    expect(data.name).toBe('Bare');
  });
});

describe('saldos de préstamo (ajuste al saldo de YNAB)', () => {
  function makeAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: 'ynab-account-1',
      name: 'Cuenta',
      type: 'checking',
      on_budget: true,
      closed: false,
      balance: 0,
      cleared_balance: 0,
      uncleared_balance: 0,
      transfer_payee_id: null,
      deleted: false,
      ...overrides,
    };
  }

  it('no crea ajuste cuando la cuenta cuadra', () => {
    const ajuste = calcularAjusteDeSaldo(
      makeAccount({ balance: -10000 }),
      [makeTransaction({ amount: -10000 })],
      '2026-11-01',
    );
    expect(ajuste).toBeNull();
  });

  it('crea el ajuste de intereses en la fecha del último movimiento', () => {
    const ajuste = calcularAjusteDeSaldo(
      makeAccount({ type: 'autoLoan', balance: -13700000 }),
      [
        makeTransaction({ date: '2026-08-02', amount: -13500000 }),
        makeTransaction({ date: '2026-09-02', amount: -173280 }),
        makeTransaction({ date: '2026-09-30', amount: -1, deleted: true }),
      ],
      '2026-11-01',
    );
    expect(ajuste).toEqual({
      amount: -2672,
      date: '2026-09-02',
      payeeName: PAYEE_INTERESES,
      notes: 'Intereses acumulados en YNAB hasta la importación',
    });
  });

  it('deja a 0 una cuenta cerrada cuyos movimientos no suman 0', () => {
    const ajuste = calcularAjusteDeSaldo(
      makeAccount({ type: 'autoLoan', closed: true, balance: 0 }),
      [makeTransaction({ date: '2025-10-16', amount: 123450 })],
      '2026-11-01',
    );
    expect(ajuste?.amount).toBe(-12345);
    expect(ajuste?.payeeName).toBe(PAYEE_INTERESES);
  });

  it('usa «Ajuste de saldo» y el último mes del presupuesto si no es deuda ni hay movimientos', () => {
    const ajuste = calcularAjusteDeSaldo(
      makeAccount({ type: 'savings', balance: 5000 }),
      [],
      '2026-11-01',
    );
    expect(ajuste).toEqual({
      amount: 500,
      date: '2026-11-01',
      payeeName: PAYEE_AJUSTE,
      notes: 'Ajuste para cuadrar con el saldo de YNAB',
    });
  });

  it('guarda los datos de deuda en la nota de la cuenta y se pueden releer', () => {
    const note = notaDeCuenta(
      makeAccount({
        type: 'autoLoan',
        note: 'Nota de YNAB',
        debt_interest_rates: { '2026-01-01': 5000, '2026-07-01': 8720 },
        debt_minimum_payments: { '2026-07-01': 246720 },
        debt_escrow_amounts: {},
      }),
    );
    expect(note).toBe(
      'Nota de YNAB\n#prestamo {"tipo":"autoLoan","interes_anual":8.72,"cuota_minima":246.72,"desde":"2026-07-01"}',
    );
    expect(leerDatosPrestamo(note)).toEqual({
      tipo: 'autoLoan',
      interes_anual: 8.72,
      cuota_minima: 246.72,
      desde: '2026-07-01',
    });
    expect(notaDeCuenta(makeAccount())).toBeNull();
  });

  it('importTransactions añade el movimiento de ajuste con su beneficiario', async () => {
    const entityIdMap = new Map<string, string>([
      ['ynab-account-1', 'actual-account-1'],
    ]);
    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/payees-get') return [];
      if (name === 'api/categories-get') return [];
      if (name === 'api/transactions-add') return null;
      if (name === 'api/payee-create') return 'payee-intereses';
      throw new Error(`Unexpected send call: ${name}`);
    });

    await importTransactions(
      {
        accounts: [
          makeAccount({
            type: 'mortgage',
            on_budget: false,
            balance: -30000000,
          }),
        ],
        last_month: '2026-11-01',
        payees: [],
        transactions: [
          makeTransaction({ date: '2026-10-01', amount: -29000000 }),
        ],
        subtransactions: [],
      } as unknown as Parameters<typeof importTransactions>[0],
      entityIdMap,
      new Set(),
    );

    expect(send).toHaveBeenCalledWith('api/payee-create', {
      payee: { name: PAYEE_INTERESES },
    });
    const adds = vi
      .mocked(send)
      .mock.calls.filter(([name]) => name === 'api/transactions-add');
    expect(adds).toHaveLength(2);
    const ajuste = adds[1][1].transactions[0];
    expect(adds[1][1].accountId).toBe('actual-account-1');
    expect(ajuste).toMatchObject({
      date: '2026-10-01',
      amount: -100000,
      payee: 'payee-intereses',
      category: null,
      notes: 'Intereses acumulados en YNAB hasta la importación',
    });
  });
});
