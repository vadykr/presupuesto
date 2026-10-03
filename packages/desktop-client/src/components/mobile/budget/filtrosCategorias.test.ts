import {
  alternarCategoria,
  borrarFiltro,
  escribirFiltros,
  filtrarGrupos,
  guardarFiltro,
  leerFiltros,
} from './filtrosCategorias';

describe('filtros propios', () => {
  it('lee la pref y descarta lo que no es un filtro', () => {
    expect(leerFiltros(null)).toEqual([]);
    expect(leerFiltros('no es json')).toEqual([]);
    expect(leerFiltros('{"a":1}')).toEqual([]);
    expect(
      leerFiltros(
        '[{"id":"f1","nombre":"Facturas anuales","categorias":["ibi",3]},{"id":2}]',
      ),
    ).toEqual([{ id: 'f1', nombre: 'Facturas anuales', categorias: ['ibi'] }]);
  });

  it('crea, edita y borra con ida y vuelta por JSON', () => {
    let filtros = guardarFiltro([], {
      id: 'f1',
      nombre: '  Facturas anuales ',
      categorias: ['ibi', 'seguro', 'ibi'],
    });
    expect(filtros).toEqual([
      { id: 'f1', nombre: 'Facturas anuales', categorias: ['ibi', 'seguro'] },
    ]);
    filtros = guardarFiltro(filtros, {
      id: 'f1',
      nombre: 'Anuales',
      categorias: ['ibi'],
    });
    filtros = guardarFiltro(filtros, {
      id: 'f2',
      nombre: 'Coche',
      categorias: ['gasolina'],
    });
    expect(leerFiltros(escribirFiltros(filtros))).toEqual([
      { id: 'f1', nombre: 'Anuales', categorias: ['ibi'] },
      { id: 'f2', nombre: 'Coche', categorias: ['gasolina'] },
    ]);
    expect(borrarFiltro(filtros, 'f1').map(f => f.id)).toEqual(['f2']);
  });

  it('las casillas marcan y desmarcan', () => {
    expect(alternarCategoria([], 'a')).toEqual(['a']);
    expect(alternarCategoria(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('filtra categorías y quita los grupos vacíos', () => {
    const grupos = [
      { id: 'g1', categories: [{ id: 'a' }, { id: 'b' }] },
      { id: 'g2', categories: [{ id: 'c' }] },
    ];
    const ids = new Set(['b']);
    expect(filtrarGrupos(grupos, c => ids.has(c.id))).toEqual([
      { id: 'g1', categories: [{ id: 'b' }] },
    ]);
  });
});
