import {
  desviacionPct,
  evolucionCategoria,
  gastoPorCategoria,
  ingresosGastosPorMes,
  media,
  nominasPorPayee,
  rankingSubeBaja,
  tasaDeAhorro,
} from './calculos';
import type { CategoriaInfo, Movimiento } from './calculos';
import {
  asignarColoresVista,
  colorDeCategoria,
  huecoDeCategoria,
  huecoPorDefecto,
  NUM_HUECOS,
  parseAsignacionColores,
} from './coloresCategorias';

function cat(
  id: string,
  nombre: string,
  extra: Partial<CategoriaInfo> = {},
): [string, CategoriaInfo] {
  return [
    id,
    {
      id,
      nombre,
      grupo: 'g1',
      nombreGrupo: 'Casa',
      esIngreso: false,
      oculta: false,
      ...extra,
    },
  ];
}

const categorias = new Map<string, CategoriaInfo>([
  cat('super', 'Supermercat'),
  cat('gats', 'Gats'),
  cat('oci', 'Oci'),
  cat('nomina', 'Nòmina', {
    esIngreso: true,
    grupo: 'gi',
    nombreGrupo: 'Ingressos',
  }),
]);

const meses = [
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];

function mov(
  mes: string,
  categoria: string | null,
  importe: number,
  payee: string | null = 'p1',
): Movimiento {
  return { mes, categoria, payee, importe };
}

const movimientos: Movimiento[] = [
  // Supermercat: 300 € cada mes previo, 450 € en octubre (sube).
  ...meses.slice(0, 6).map(m => mov(m, 'super', -30000)),
  mov('2026-10', 'super', -45000),
  // Gats: 60 € cada mes previo, 0 en octubre (baja).
  ...meses.slice(0, 6).map(m => mov(m, 'gats', -6000)),
  // Oci: media pequeña (5 €), no entra en el ranking.
  ...meses.slice(0, 6).map(m => mov(m, 'oci', -500)),
  mov('2026-10', 'oci', 2000), // devolución: ingreso positivo en una categoría de gasto
  // Nómina: 2.000 € al mes, dos pagadores en octubre.
  ...meses.slice(0, 6).map(m => mov(m, 'nomina', 200000, 'empresa')),
  mov('2026-10', 'nomina', 150000, 'empresa'),
  mov('2026-10', 'nomina', 50000, 'extra'),
  // Sin categoría.
  mov('2026-10', null, -1000, null),
];

describe('gastoPorCategoria', () => {
  it('suma el gasto en positivo, ordena de mayor a menor y aparta las devoluciones', () => {
    const r = gastoPorCategoria(movimientos, ['2026-10'], categorias);
    expect(r.total).toBe(45000 + 1000);
    expect(r.filas).toEqual([
      { categoria: 'super', importe: 45000 },
      { categoria: null, importe: 1000 },
    ]);
    expect(r.ingresosPositivos).toEqual([{ categoria: 'oci', importe: 2000 }]);
  });

  it('ignora las categorías de ingreso y los meses fuera del periodo', () => {
    const r = gastoPorCategoria(
      movimientos,
      ['2026-04', '2026-05'],
      categorias,
    );
    expect(r.total).toBe(2 * (30000 + 6000 + 500));
    expect(r.filas.map(f => f.categoria)).toEqual(['super', 'gats', 'oci']);
    expect(r.ingresosPositivos).toEqual([]);
  });
});

describe('tasaDeAhorro', () => {
  it('es (ingresos − gastos) / ingresos', () => {
    expect(tasaDeAhorro(200000, 150000)).toBeCloseTo(0.25);
  });
  it('es negativa cuando se gasta más de lo ingresado', () => {
    expect(tasaDeAhorro(100000, 120000)).toBeCloseTo(-0.2);
  });
  it('no existe sin ingresos', () => {
    expect(tasaDeAhorro(0, 5000)).toBeNull();
  });
});

describe('ingresosGastosPorMes', () => {
  it('devuelve un punto por mes con ingresos, gastos, ahorro y tasa', () => {
    const r = ingresosGastosPorMes(movimientos, meses, categorias);
    expect(r).toHaveLength(meses.length);
    const abril = r[0];
    expect(abril.ingresos).toBe(200000);
    expect(abril.gastos).toBe(36500);
    expect(abril.ahorro).toBe(163500);
    expect(abril.tasa).toBeCloseTo(0.8175);
    const octubre = r[6];
    expect(octubre.ingresos).toBe(200000);
    // 450 + 10 − 20 (devolución) = 440 €
    expect(octubre.gastos).toBe(44000);
  });

  it('un mes sin movimientos vale 0 y sin tasa', () => {
    const r = ingresosGastosPorMes(movimientos, ['2025-01'], categorias);
    expect(r[0]).toEqual({
      mes: '2025-01',
      ingresos: 0,
      gastos: 0,
      ahorro: 0,
      tasa: null,
    });
  });
});

describe('evolucionCategoria, media y desviacionPct', () => {
  it('alinea el gasto con los meses pedidos', () => {
    const v = evolucionCategoria(movimientos, 'super', meses);
    expect(v).toEqual([30000, 30000, 30000, 30000, 30000, 30000, 45000]);
  });
  it('para una categoría de ingreso devuelve el ingreso en positivo', () => {
    const v = evolucionCategoria(movimientos, 'nomina', ['2026-10'], true);
    expect(v).toEqual([200000]);
  });
  it('la media se redondea al céntimo y la desviación es relativa a la media', () => {
    expect(media([30000, 30000, 45000])).toBe(35000);
    expect(media([])).toBe(0);
    expect(media([1, 2])).toBe(2); // 1,5 → 2
    expect(desviacionPct(45000, 30000)).toBeCloseTo(0.5);
    expect(desviacionPct(0, 6000)).toBeCloseTo(-1);
    expect(desviacionPct(100, 0)).toBeNull();
  });
});

describe('rankingSubeBaja', () => {
  it('ordena por desviación en €, sube arriba y baja abajo, y exige referencia mínima', () => {
    const r = rankingSubeBaja(
      movimientos,
      '2026-10',
      meses.slice(0, 6),
      categorias,
      1000,
    );
    expect(r.map(f => f.categoria)).toEqual(['super', 'gats']);
    // Supermercat: 300 € habituales y 450 € este mes, sin repetirse → puntual.
    expect(r[0]).toEqual({
      categoria: 'super',
      actual: 45000,
      referencia: 30000,
      desviacion: 15000,
      desviacionPct: 0.5,
      tipo: 'puntual',
    });
    // Gats: 60 € habituales y 0 este mes, un solo mes → no es tendencia.
    expect(r[1]).toMatchObject({
      categoria: 'gats',
      actual: 0,
      referencia: 6000,
      desviacion: -6000,
      desviacionPct: -1,
      tipo: 'normal',
    });
  });

  it('un gasto puntual previo no desplaza la referencia y la subida repetida es «sube»', () => {
    const previos = [
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ];
    const movs = [
      mov('2026-04', 'super', -30000),
      mov('2026-05', 'super', -32000),
      mov('2026-06', 'super', -200000), // mes puntual
      mov('2026-07', 'super', -31000),
      mov('2026-08', 'super', -30000),
      mov('2026-09', 'super', -60000), // empieza a subir
      mov('2026-10', 'super', -65000),
    ];
    const r = rankingSubeBaja(movs, '2026-10', previos, categorias);
    expect(r[0].referencia).toBe(31000);
    expect(r[0].tipo).toBe('sube');
    expect(r[0].desviacion).toBe(34000);
  });

  it('la referencia cuenta los meses sin gasto como 0', () => {
    const r = rankingSubeBaja(
      [
        mov('2026-07', 'super', -30000),
        mov('2026-09', 'super', -30000),
        mov('2026-10', 'super', -30000),
      ],
      '2026-10',
      ['2026-07', '2026-08', '2026-09'],
      categorias,
    );
    expect(r[0].referencia).toBe(30000);
    expect(r[0].desviacion).toBe(0);
    expect(r[0].tipo).toBe('normal');
  });

  it('sin meses previos no hay ranking', () => {
    expect(rankingSubeBaja(movimientos, '2026-10', [], categorias)).toEqual([]);
  });
});

describe('nominasPorPayee', () => {
  it('agrupa los ingresos por pagador y mes, de mayor a menor total', () => {
    const r = nominasPorPayee(movimientos, meses, categorias);
    expect(r.map(f => f.payee)).toEqual(['empresa', 'extra']);
    expect(r[0].porMes).toEqual([
      200000, 200000, 200000, 200000, 200000, 200000, 150000,
    ]);
    expect(r[0].total).toBe(6 * 200000 + 150000);
    expect(r[1].porMes[6]).toBe(50000);
  });
});

describe('coloresCategorias', () => {
  it('el hueco por defecto es estable y cae en 0..7', () => {
    const a = huecoPorDefecto('abc-123');
    expect(a).toBe(huecoPorDefecto('abc-123'));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(NUM_HUECOS);
    const huecos = new Set(
      Array.from({ length: 40 }, (_, i) => huecoPorDefecto(`cat-${i}`)),
    );
    expect(huecos.size).toBeGreaterThan(4);
  });

  it('la preferencia personaliza el hueco y descarta valores inválidos', () => {
    const asignacion = parseAsignacionColores(
      JSON.stringify({ super: 3, gats: 99, oci: 'x' }),
    );
    expect(asignacion).toEqual({ super: 3 });
    expect(huecoDeCategoria('super', asignacion)).toBe(3);
    expect(colorDeCategoria('super', asignacion)).toBe('var(--informes-c3)');
    expect(parseAsignacionColores('{no json')).toEqual({});
    expect(parseAsignacionColores(undefined)).toEqual({});
  });

  it('sin categoría usa el color neutro', () => {
    expect(colorDeCategoria(null)).toBe('var(--color-pageTextSubdued)');
  });

  it('en una vista, hasta 12 categorías no repiten color', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `cat-${i}`);
    const vista = asignarColoresVista(ids);
    expect(new Set(vista.values()).size).toBe(12);
    expect(vista.get('cat-0')).toBe(0);
    expect(vista.get('cat-1')).toBe(1);
  });

  it('en una vista, la preferencia manda y su hueco se salta', () => {
    const vista = asignarColoresVista(['a', 'b', 'c', null, 'a'], { b: 0 });
    expect(vista.get('b')).toBe(0);
    expect(vista.get('a')).toBe(1);
    expect(vista.get('c')).toBe(2);
    expect(vista.size).toBe(3);
  });

  it('en una vista con más de 12 categorías se vuelve a empezar', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `cat-${i}`);
    const vista = asignarColoresVista(ids);
    expect(vista.get('cat-12')).toBe(0);
    expect(vista.get('cat-13')).toBe(1);
  });
});
