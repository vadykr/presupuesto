import { ingresosGastosPorMes, nominasPorPayee } from './calculos';
import type { CategoriaInfo, Categorias, Movimiento } from './calculos';
import {
  conEtiquetaNoIngreso,
  descontarNoIngresos,
  ingresoNoContado,
  noCuentaComoIngreso,
  tieneEtiquetaNoIngreso,
} from './noIngreso';

function info(id: string, esIngreso: boolean): [string, CategoriaInfo] {
  return [
    id,
    {
      id,
      nombre: id,
      grupo: esIngreso ? 'gi' : 'g',
      nombreGrupo: esIngreso ? 'Income' : 'Gastos',
      esIngreso,
      oculta: false,
    },
  ];
}

const categorias: Categorias = new Map([
  info('ingreso', true),
  info('super', false),
]);

function mov(
  mes: string,
  categoria: string | null,
  payee: string | null,
  importe: number,
): Movimiento {
  return { mes, categoria, payee, importe };
}

describe('etiqueta #noingreso', () => {
  test('detecta la etiqueta como palabra suelta, sin distinguir mayúsculas', () => {
    expect(tieneEtiquetaNoIngreso('#noingreso')).toBe(true);
    expect(tieneEtiquetaNoIngreso('Traspaso #NoIngreso de Estalvis')).toBe(
      true,
    );
    expect(tieneEtiquetaNoIngreso('#noingresos')).toBe(false);
    expect(tieneEtiquetaNoIngreso('no#noingreso')).toBe(false);
    expect(tieneEtiquetaNoIngreso(null)).toBe(false);
  });

  test('poner y quitar la etiqueta conserva el resto de la nota', () => {
    expect(conEtiquetaNoIngreso('', true)).toBe('#noingreso');
    expect(conEtiquetaNoIngreso(null, true)).toBe('#noingreso');
    expect(conEtiquetaNoIngreso('Ahorro ', true)).toBe('Ahorro #noingreso');
    expect(conEtiquetaNoIngreso('Ahorro #noingreso', true)).toBe(
      'Ahorro #noingreso',
    );
    expect(conEtiquetaNoIngreso('Ahorro #noingreso #viaje', false)).toBe(
      'Ahorro #viaje',
    );
    expect(conEtiquetaNoIngreso('#noingreso', false)).toBe('');
  });

  test('los traspasos nunca cuentan como ingreso', () => {
    expect(noCuentaComoIngreso({ esTraspaso: true, notes: '' })).toBe(true);
    expect(noCuentaComoIngreso({ esTraspaso: false, notes: 'x' })).toBe(false);
    expect(
      noCuentaComoIngreso({ esTraspaso: false, notes: 'x #noingreso' }),
    ).toBe(true);
  });
});

describe('descontarNoIngresos', () => {
  const movimientos = [
    mov('2026-09', 'ingreso', 'empresa', 250000),
    mov('2026-09', 'ingreso', 'estalvis', 1140000),
    mov('2026-09', 'ingreso', 'bizum', 5000),
    mov('2026-09', 'super', 'mercadona', -30000),
  ];

  test('quita del ingreso los traspasos y lo etiquetado', () => {
    const excluidos = [
      mov('2026-09', 'ingreso', 'estalvis', 1140000),
      mov('2026-09', 'ingreso', 'bizum', 2000),
    ];
    const resultado = descontarNoIngresos(movimientos, excluidos, categorias);
    expect(resultado).toEqual([
      mov('2026-09', 'ingreso', 'empresa', 250000),
      mov('2026-09', 'ingreso', 'bizum', 3000),
      mov('2026-09', 'super', 'mercadona', -30000),
    ]);

    const [mes] = ingresosGastosPorMes(resultado, ['2026-09'], categorias);
    expect(mes.ingresos).toBe(253000);
    expect(mes.gastos).toBe(30000);
    expect(mes.tasa).toBeCloseTo((253000 - 30000) / 253000);

    const nominas = nominasPorPayee(resultado, ['2026-09'], categorias);
    expect(nominas.map(n => n.payee)).not.toContain('estalvis');
  });

  test('en categorías de gasto la etiqueta no cambia nada', () => {
    const excluidos = [mov('2026-09', 'super', 'mercadona', -30000)];
    expect(descontarNoIngresos(movimientos, excluidos, categorias)).toEqual(
      movimientos,
    );
  });

  test('sin excluidos devuelve los mismos movimientos', () => {
    expect(descontarNoIngresos(movimientos, [], categorias)).toEqual(
      movimientos,
    );
  });

  test('ingresoNoContado suma solo las categorías de ingreso', () => {
    expect(
      ingresoNoContado(
        [
          mov('2026-09', 'ingreso', 'estalvis', 1140000),
          mov('2026-09', 'super', 'x', -500),
          mov('2026-09', null, 'y', 700),
        ],
        categorias,
      ),
    ).toBe(1140000);
  });
});
