import type { Objetivo } from '#components/mobile/budget/objetivos';

import {
  agruparPorMes,
  calcularFila,
  calcularFilas,
  conmutarCategoria,
  conmutarGrupo,
  estadoGrupo,
  idsPlegables,
  incluida,
  parseGrupos,
  parseSeleccion,
  proximoVencimiento,
  resumir,
  seleccionInicial,
  sumarMeses,
} from './anual';
import type { EntradaAnual } from './anual';

const HOY = '2026-10-02';

function anual(importe: number, fecha: string, cadaMeses = 12): Objetivo {
  return { tipo: 'anual', importe, fecha, cadaMeses: cadaMeses as 12 };
}

function entrada(parcial: Partial<EntradaAnual> = {}): EntradaAnual {
  return {
    id: 'c1',
    nombre: '🏠 IBI',
    grupoId: 'g1',
    grupoNombre: 'Factures Anuals',
    objetivo: anual(30000, '2027-07-15'),
    saldo: 0,
    asignado: 0,
    actividad: 0,
    ...parcial,
  };
}

describe('sumarMeses / proximoVencimiento', () => {
  it('recorta el día al fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('avanza la fecha anual pasada al siguiente año', () => {
    const obj = anual(30000, '2025-07-15') as Extract<
      Objetivo,
      { tipo: 'anual' }
    >;
    expect(proximoVencimiento(obj, HOY)).toBe('2027-07-15');
  });

  it('respeta la cadencia (cada 2 años)', () => {
    const obj = anual(30000, '2024-12-01', 24) as Extract<
      Objetivo,
      { tipo: 'anual' }
    >;
    expect(proximoVencimiento(obj, HOY)).toBe('2026-12-01');
  });

  it('una fecha de este mes no avanza aunque su día ya haya pasado', () => {
    const obj = anual(30000, '2026-10-01') as Extract<
      Objetivo,
      { tipo: 'anual' }
    >;
    expect(proximoVencimiento(obj, HOY)).toBe('2026-10-01');
  });

  it('una sola vez conserva su fecha', () => {
    expect(
      proximoVencimiento(
        { tipo: 'una-vez', importe: 100, fecha: '2025-01-01' },
        HOY,
      ),
    ).toBe('2025-01-01');
  });
});

describe('calcularFila: estado y cuota', () => {
  it('cuota = (importe − saldo) / meses que quedan, contando este mes', () => {
    // De octubre 2026 a julio 2027 hay 9 meses de diferencia: 10 cuotas.
    const fila = calcularFila(entrada(), HOY)!;
    expect(fila.mesVence).toBe('2027-07');
    expect(fila.cuota).toBe(3000);
    expect(fila.estado).toBe('faltan');
    expect(fila.faltaEsteMes).toBe(3000);
  });

  it('«Al día» cuando lo asignado este mes cubre la cuota', () => {
    const fila = calcularFila(entrada({ saldo: 3000, asignado: 3000 }), HOY)!;
    // La cuota se calcula con el saldo de antes de asignar: no cambia.
    expect(fila.cuota).toBe(3000);
    expect(fila.faltaEsteMes).toBe(0);
    expect(fila.estado).toBe('al-dia');
  });

  it('«Faltan X este mes» si solo se ha asignado una parte', () => {
    const fila = calcularFila(entrada({ saldo: 1000, asignado: 1000 }), HOY)!;
    expect(fila.estado).toBe('faltan');
    expect(fila.faltaEsteMes).toBe(2000);
  });

  it('va al día si se ahorró de más en meses anteriores', () => {
    const fila = calcularFila(entrada({ saldo: 27000, asignado: 0 }), HOY)!;
    // (30000 − 27000) / 10 = 300 de cuota, pero lo asignado es 0: faltan 300.
    expect(fila.cuota).toBe(300);
    expect(fila.estado).toBe('faltan');
    const alDia = calcularFila(entrada({ saldo: 27300, asignado: 300 }), HOY)!;
    expect(alDia.estado).toBe('al-dia');
  });

  it('«Cubierta» cuando lo ahorrado llega al importe', () => {
    const fila = calcularFila(entrada({ saldo: 30000 }), HOY)!;
    expect(fila.estado).toBe('cubierta');
    expect(fila.cuota).toBe(0);
    expect(fila.faltaEsteMes).toBe(0);
    expect(fila.progreso).toBe(1);
  });

  it('el ahorrado se recorta al importe y el progreso es una fracción', () => {
    const cubierta = calcularFila(entrada({ saldo: 45000 }), HOY)!;
    expect(cubierta.ahorrado).toBe(30000);
    const media = calcularFila(entrada({ saldo: 15000 }), HOY)!;
    expect(media.progreso).toBe(0.5);
    const negativa = calcularFila(entrada({ saldo: -500 }), HOY)!;
    expect(negativa.ahorrado).toBe(0);
    expect(negativa.progreso).toBe(0);
  });

  it('«Atrasada» si el vencimiento de este mes ya pasó y no llega', () => {
    const fila = calcularFila(
      entrada({ objetivo: anual(30000, '2026-10-01'), saldo: 12000 }),
      HOY,
    )!;
    expect(fila.estado).toBe('atrasada');
    expect(fila.faltaTotal).toBe(18000);
    expect(fila.cuota).toBe(18000);
  });

  it('si vence este mes y aún no ha llegado el día, faltan X este mes', () => {
    const fila = calcularFila(
      entrada({ objetivo: anual(30000, '2026-10-20'), saldo: 12000 }),
      HOY,
    )!;
    expect(fila.estado).toBe('faltan');
    expect(fila.faltaEsteMes).toBe(18000);
  });

  it('vence hoy: todavía no está atrasada', () => {
    const fila = calcularFila(
      entrada({ objetivo: anual(30000, HOY), saldo: 10000 }),
      HOY,
    )!;
    expect(fila.estado).toBe('faltan');
  });

  it('tras pagarla (gasto este mes) pasa al vencimiento del año siguiente', () => {
    const fila = calcularFila(
      entrada({
        objetivo: anual(30000, '2026-10-01'),
        saldo: 0,
        actividad: -30000,
      }),
      HOY,
    )!;
    expect(fila.vence).toBe('2027-10-01');
    expect(fila.estado).toBe('faltan');
    // 12 meses de diferencia: 13 cuotas.
    expect(fila.cuota).toBe(2308);
  });

  it('una sola vez vencida y pagada desaparece; sin saldo, también', () => {
    const una: Objetivo = {
      tipo: 'una-vez',
      importe: 5000,
      fecha: '2026-10-01',
    };
    expect(
      calcularFila(entrada({ objetivo: una, actividad: -5000 }), HOY),
    ).toBeNull();
    const vieja: Objetivo = {
      tipo: 'una-vez',
      importe: 5000,
      fecha: '2026-03-01',
    };
    expect(
      calcularFila(entrada({ objetivo: vieja, saldo: 0 }), HOY),
    ).toBeNull();
    expect(
      calcularFila(entrada({ objetivo: vieja, saldo: 2000 }), HOY)!.estado,
    ).toBe('atrasada');
  });

  it('un grupo marcado sin objetivo con fecha sale «sin objetivo»', () => {
    const fila = calcularFila(
      entrada({
        objetivo: {
          tipo: 'mensual',
          importe: 5000,
          dia: null,
          modo: 'apartar',
        },
        saldo: 4000,
      }),
      HOY,
    )!;
    expect(fila.estado).toBe('sin-objetivo');
    expect(fila.importe).toBeNull();
    expect(fila.mesVence).toBeNull();
    expect(fila.ahorrado).toBe(4000);
  });
});

describe('agruparPorMes y orden', () => {
  const entradas = [
    entrada({
      id: 'a',
      nombre: 'Seguro coche',
      objetivo: anual(40000, '2027-03-10'),
    }),
    entrada({ id: 'b', nombre: 'ITV', objetivo: anual(5000, '2026-12-20') }),
    entrada({ id: 'c', nombre: 'IBI', objetivo: anual(30000, '2027-07-15') }),
    entrada({
      id: 'd',
      nombre: 'Mantenimiento',
      objetivo: anual(20000, '2026-12-05'),
    }),
    entrada({ id: 'e', nombre: 'Sin fecha', objetivo: null }),
  ];

  it('ordena cronológicamente desde el mes actual y deja «sin fecha» al final', () => {
    const grupos = agruparPorMes(calcularFilas(entradas, HOY));
    expect(grupos.map(g => g.mes)).toEqual([
      '2026-12',
      '2027-03',
      '2027-07',
      null,
    ]);
    expect(grupos[0].filas.map(f => f.nombre)).toEqual([
      'Mantenimiento',
      'ITV',
    ]);
  });

  it('las fechas pasadas de una vez salen antes que las futuras', () => {
    const una: Objetivo = {
      tipo: 'una-vez',
      importe: 5000,
      fecha: '2026-08-01',
    };
    const grupos = agruparPorMes(
      calcularFilas(
        [...entradas, entrada({ id: 'f', objetivo: una, saldo: 1000 })],
        HOY,
      ),
    );
    expect(grupos[0].mes).toBe('2026-08');
  });
});

describe('resumir', () => {
  it('suma ahorrado, objetivo de los próximos 12 meses y lo que toca este mes', () => {
    const filas = calcularFilas(
      [
        entrada({
          id: 'a',
          objetivo: anual(30000, '2027-07-15'),
          saldo: 3000,
          asignado: 3000,
        }),
        entrada({ id: 'b', objetivo: anual(6000, '2026-12-20'), saldo: 2000 }),
        entrada({ id: 'c', objetivo: anual(9000, '2028-10-01'), saldo: 100 }),
        entrada({ id: 'd', objetivo: anual(8000, '2027-02-01'), saldo: 8000 }),
      ],
      HOY,
    );
    const r = resumir(filas, '2026-10');
    // c vence en 24 meses: no cuenta en el año.
    expect(r.objetivo).toBe(30000 + 6000 + 8000);
    expect(r.ahorrado).toBe(3000 + 2000 + 8000);
    // a: al día (0); b: (6000 − 2000) / 3 = 1333; c: (9000 − 100) / 25 = 356.
    expect(r.esteMes).toBe(0 + 1333 + 356 + 0);
    expect(r.porEstado).toEqual({
      cubierta: 1,
      'al-dia': 1,
      faltan: 2,
      atrasada: 0,
      'sin-objetivo': 0,
    });
  });
});

describe('idsPlegables y parseGrupos', () => {
  it('pliega solo lo al día o cubierto', () => {
    const filas = calcularFilas(
      [
        entrada({ id: 'ok', saldo: 3000, asignado: 3000 }),
        entrada({ id: 'cub', saldo: 30000 }),
        entrada({ id: 'falta', saldo: 0 }),
        entrada({
          id: 'tarde',
          objetivo: anual(30000, '2026-10-01'),
          saldo: 100,
        }),
        entrada({ id: 'sin', objetivo: null }),
      ],
      HOY,
    );
    expect([...idsPlegables(filas)].sort()).toEqual(['cub', 'ok']);
  });

  it('lee la pref como lista de ids y tolera basura', () => {
    expect(parseGrupos('["a","b"]')).toEqual(['a', 'b']);
    expect(parseGrupos(undefined)).toEqual([]);
    expect(parseGrupos('no es json')).toEqual([]);
    expect(parseGrupos('{"a":1}')).toEqual([]);
    expect(parseGrupos('["a",3]')).toEqual(['a']);
  });
});

describe('selección de Gasto anual', () => {
  const vacia = { grupos: [], categorias: [], excluidas: [] };
  const g = { id: 'g1', categorias: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };

  it('parseSeleccion: nulo si falta o es inválida', () => {
    expect(parseSeleccion(undefined)).toBeNull();
    expect(parseSeleccion('no json')).toBeNull();
    expect(parseSeleccion('[]')).toBeNull();
    expect(parseSeleccion('{"grupos":["g1"],"categorias":[1,"a"]}')).toEqual({
      grupos: ['g1'],
      categorias: ['a'],
      excluidas: [],
    });
  });

  it('incluida: grupo menos excluidas, o categoría suelta', () => {
    const s = { grupos: ['g1'], categorias: ['z'], excluidas: ['b'] };
    expect(incluida(s, 'a', 'g1')).toBe(true);
    expect(incluida(s, 'b', 'g1')).toBe(false);
    expect(incluida(s, 'z', 'g2')).toBe(true);
    expect(incluida(s, 'y', 'g2')).toBe(false);
  });

  it('seleccionInicial: grupos marcados y automáticas de otros grupos', () => {
    expect(
      seleccionInicial(
        ['g1'],
        [
          { id: 'a', grupoId: 'g1' },
          { id: 'p', grupoId: 'g2' },
        ],
      ),
    ).toEqual({ grupos: ['g1'], categorias: ['p'], excluidas: [] });
  });

  it('conmutarGrupo marca todas y desmarca todas', () => {
    const marcado = conmutarGrupo(vacia, g);
    expect(estadoGrupo(marcado, g)).toBe('todas');
    expect(estadoGrupo(conmutarGrupo(marcado, g), g)).toBe('ninguna');
  });

  it('desmarcar una del grupo deja estado intermedio; el grupo la completa', () => {
    const marcado = conmutarGrupo(vacia, g);
    const parcial = conmutarCategoria(marcado, 'b', 'g1');
    expect(parcial.excluidas).toEqual(['b']);
    expect(estadoGrupo(parcial, g)).toBe('algunas');
    expect(estadoGrupo(conmutarGrupo(parcial, g), g)).toBe('todas');
    expect(conmutarGrupo(parcial, g).excluidas).toEqual([]);
  });

  it('marcar una suelta de un grupo sin marcar', () => {
    const s = conmutarCategoria(vacia, 'a', 'g1');
    expect(s.categorias).toEqual(['a']);
    expect(estadoGrupo(s, g)).toBe('algunas');
    expect(conmutarCategoria(s, 'a', 'g1')).toEqual(vacia);
  });

  it('volver a marcar una excluida la quita de excluidas', () => {
    const s = { grupos: ['g1'], categorias: [], excluidas: ['b'] };
    expect(conmutarCategoria(s, 'b', 'g1').excluidas).toEqual([]);
  });
});
