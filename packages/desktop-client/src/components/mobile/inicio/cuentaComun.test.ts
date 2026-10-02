import type { AccountEntity } from '@actual-app/core/types/models';

import {
  alternarCategoriaComun,
  cuentasDelTraspaso,
  enlaceTraspaso,
  importeCuentaComun,
  leerCategoriasComunes,
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
