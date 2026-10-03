import type { AccountEntity } from '@actual-app/core/types/models';

import {
  alternarCategoriaComun,
  cobertura,
  cuentasDelTraspaso,
  enlaceTraspaso,
  gastoPrevisto,
  importeCuentaComun,
  leerCategoriasComunes,
  leerTraspasados,
  marcarTraspasado,
  sugerirTraspaso,
} from './cuentaComun';

const cuenta = (id: string, name: string, extra: Partial<AccountEntity> = {}) =>
  ({ id, name, offbudget: 0, closed: 0, ...extra }) as AccountEntity;

describe('cuenta común', () => {
  it('lee la lista de categorías sin repetidos ni basura', () => {
    expect(leerCategoriasComunes(undefined)).toEqual([]);
    expect(leerCategoriasComunes('roto')).toEqual([]);
    expect(leerCategoriasComunes('{"a":1}')).toEqual([]);
    expect(leerCategoriasComunes('["a", 3, "b", "a"]')).toEqual(['a', 'b']);
  });

  it('alterna una categoría', () => {
    expect(alternarCategoriaComun(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternarCategoriaComun(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('ingresar = suma de lo asignado este mes en esas categorías', () => {
    const asignado: Record<string, number> = {
      hipoteca: 700_00,
      llum: 45_50,
      menjar: 307_74,
      capritxos: 60_00,
    };
    expect(
      importeCuentaComun(['hipoteca', 'llum', 'menjar'], id => asignado[id]),
    ).toBe(1053_24);
    // Categoría borrada (sin dato) no cuenta; lo desasignado resta.
    expect(importeCuentaComun(['llum', 'borrada'], id => asignado[id])).toBe(
      45_50,
    );
    expect(
      importeCuentaComun(['llum', 'x'], id =>
        id === 'x' ? -10_00 : asignado[id],
      ),
    ).toBe(35_50);
    // Nunca negativo.
    expect(importeCuentaComun(['x'], () => -5_00)).toBe(0);
    expect(importeCuentaComun([], () => 1)).toBe(0);
  });

  it('encuentra las cuentas del traspaso por nombre (sin acentos ni mayúsculas)', () => {
    const cuentas = [
      cuenta('1', 'CaixaBank'),
      cuenta('2', 'Cuenta Personal'),
      cuenta('3', 'Conte conjunt'),
    ];
    const { origen, destino } = cuentasDelTraspaso(cuentas);
    expect(origen?.id).toBe('2');
    expect(destino?.id).toBe('3');

    expect(cuentasDelTraspaso([cuenta('4', 'Cuenta común')]).destino?.id).toBe(
      '4',
    );
    // Cerradas no cuentan.
    expect(
      cuentasDelTraspaso([cuenta('5', 'Conte conjunt', { closed: 1 })]).destino,
    ).toBeNull();
    expect(cuentasDelTraspaso([cuenta('1', 'CaixaBank')])).toEqual({
      origen: null,
      destino: null,
    });
  });

  it('el enlace abre una transacción nueva con el traspaso rellenado', () => {
    const url = enlaceTraspaso({
      origen: 'Cuenta Personal',
      destino: 'Conte conjunt',
      importe: 1053_24,
      nota: 'Cuenta común · octubre',
    });
    const [ruta, query] = url.split('?');
    expect(ruta).toBe('/transactions/new');
    const params = new URLSearchParams(query);
    expect(params.get('account')).toBe('Cuenta Personal');
    expect(params.get('payee')).toBe('Conte conjunt');
    expect(params.get('amount')).toBe('1053.24');
    expect(params.get('notes')).toBe('Cuenta común · octubre');
  });
});

describe('cuenta común: traspasado por mes', () => {
  it('lee y escribe el estado por mes', () => {
    expect(leerTraspasados(undefined)).toEqual({});
    expect(leerTraspasados('roto')).toEqual({});
    expect(leerTraspasados('[1]')).toEqual({});
    expect(leerTraspasados('{"2026-10":true,"2026-09":false,"x":1}')).toEqual({
      '2026-10': true,
    });
    const uno = marcarTraspasado(undefined, '2026-10', true);
    expect(JSON.parse(uno)).toEqual({ '2026-10': true });
    // Otro mes no pisa el anterior; desmarcar quita solo ese mes.
    const dos = marcarTraspasado(uno, '2026-11', true);
    expect(JSON.parse(dos)).toEqual({ '2026-10': true, '2026-11': true });
    expect(JSON.parse(marcarTraspasado(dos, '2026-10', false))).toEqual({
      '2026-11': true,
    });
  });
});

describe('cuenta común: gasto previsto', () => {
  const meses = (n: number) =>
    Array.from({ length: n }, (_, i) => `m${String(i + 1).padStart(2, '0')}`);

  it('mediana robusta: un mes atípico no desplaza el previsto', () => {
    const salidas: Record<string, number> = {};
    const base = [
      1000, 1020, 980, 1050, 1010, 1030, 990, 1020, 1040, 1000, 1020,
    ];
    meses(12).forEach((m, i) => {
      salidas[m] = (i === 5 ? 4800 : base[i > 5 ? i - 1 : i]) * 100;
    });
    const { previsto, meses: n } = gastoPrevisto(salidas, meses(12));
    expect(n).toBe(12);
    expect(previsto).toBe(1020_00);
  });

  it('los meses iniciales sin movimientos no cuentan', () => {
    const { previsto, meses: n } = gastoPrevisto(
      { m04: 900_00, m05: 1000_00, m06: 1100_00 },
      meses(6),
    );
    expect(n).toBe(3);
    expect(previsto).toBe(1000_00);
    expect(gastoPrevisto({}, meses(6))).toEqual({ previsto: 0, meses: 0 });
  });

  it('cobertura: verde si el saldo cubre, ámbar si no', () => {
    expect(cobertura(1217_63, 1020_00).cubre).toBe(true);
    expect(cobertura(500_00, 1000_00)).toEqual({ fraccion: 0.5, cubre: false });
    expect(cobertura(-5_00, 1000_00).fraccion).toBe(0);
    expect(cobertura(100_00, 0)).toEqual({ fraccion: 0, cubre: false });
  });
});

describe('cuenta común: sugerir traspaso hecho', () => {
  const entradas = [
    { date: '2026-09-19', amount: 1053_24 }, // antes del día 20
    { date: '2026-09-30', amount: 1060_00 }, // +0,6 %
    { date: '2026-10-01', amount: 2000_00 }, // importe distinto
    { date: '2026-10-05', amount: 1053_24 }, // futuro respecto a hoy
  ];

  it('encuentra el traspaso del 20 del mes anterior a hoy (±5 %)', () => {
    expect(sugerirTraspaso(entradas, 1053_24, '2026-10-03', '2026-09')).toEqual(
      { date: '2026-09-30', amount: 1060_00 },
    );
  });

  it('no sugiere nada fuera de rango o sin importe', () => {
    expect(
      sugerirTraspaso(entradas, 1500_00, '2026-10-03', '2026-09'),
    ).toBeNull();
    expect(sugerirTraspaso(entradas, 0, '2026-10-03', '2026-09')).toBeNull();
    expect(sugerirTraspaso([], 1053_24, '2026-10-03', '2026-09')).toBeNull();
  });
});
