import type { Template } from '@actual-app/core/types/models/templates';

import {
  asignarGastadoMesPasado,
  asignarInfrafinanciadas,
  cuotaMensual,
  estadoFila,
  faltante,
  importeDePlantilla,
  lineasDeObjetivo,
  marcaDeNota,
  notaConObjetivo,
  objetivoDesdePlantillas,
  totalInfrafinanciado,
} from './objetivos';
import type { DatosCategoriaMes } from './objetivos';

function datos(parcial: Partial<DatosCategoriaMes> = {}): DatosCategoriaMes {
  return {
    goal: null,
    longGoal: false,
    budgeted: 0,
    balance: 0,
    spent: 0,
    ...parcial,
  };
}

describe('faltante (infrafinanciado)', () => {
  it('sin objetivo no falta nada', () => {
    expect(faltante(datos({ budgeted: 0 }))).toBe(0);
  });

  it('objetivo mensual: objetivo menos asignado', () => {
    // Gas: objetivo 134,17 €, asignado 47,85 € → faltan 86,32 €.
    expect(faltante(datos({ goal: 134_17, budgeted: 47_85 }))).toBe(86_32);
  });

  it('objetivo cumplido o superado: 0', () => {
    expect(faltante(datos({ goal: 100_00, budgeted: 100_00 }))).toBe(0);
    expect(faltante(datos({ goal: 100_00, budgeted: 120_00 }))).toBe(0);
  });

  it('objetivo a largo plazo (#goal): objetivo menos saldo', () => {
    expect(
      faltante(
        datos({
          goal: 3000_00,
          longGoal: true,
          budgeted: 50_00,
          balance: 1200_00,
        }),
      ),
    ).toBe(1800_00);
  });

  it('el total suma lo que falta en cada categoría', () => {
    expect(
      totalInfrafinanciado([
        datos({ goal: 134_17, budgeted: 47_85 }),
        datos({ goal: 98_37, budgeted: 98_37 }),
        datos({ goal: 300_00, budgeted: 99_30 }),
      ]),
    ).toBe(86_32 + 200_70);
  });
});

describe('estadoFila', () => {
  it('«Financiada» con objetivo cumplido y sin gasto', () => {
    expect(
      estadoFila(datos({ goal: 246_72, budgeted: 246_72, balance: 246_72 })),
    ).toEqual({ tipo: 'financiada', progreso: 1 });
  });

  it('«Totalmente gastada» cuando el saldo llega a cero', () => {
    expect(
      estadoFila(
        datos({ goal: 32_93, budgeted: 32_93, spent: -32_93, balance: 0 }),
      ),
    ).toEqual({ tipo: 'gastada', progreso: 1 });
  });

  it('«Financiada. Gastados X de Y» con gasto parcial', () => {
    const estado = estadoFila(
      datos({ goal: 292_82, budgeted: 292_82, spent: -292_81, balance: 1 }),
    );
    expect(estado).toMatchObject({
      tipo: 'gastado-parcial',
      gastado: 292_81,
      asignado: 292_82,
      financiada: true,
    });
  });

  it('«Faltan X» con la barra a la fracción asignada', () => {
    const estado = estadoFila(
      datos({ goal: 134_17, budgeted: 67_08, balance: 67_08 }),
    );
    expect(estado).toMatchObject({ tipo: 'faltan', importe: 67_09 });
    expect(estado.progreso).toBeCloseTo(0.5, 2);
  });

  it('en rojo si el saldo es negativo, tenga o no objetivo', () => {
    expect(
      estadoFila(
        datos({ goal: 50_00, budgeted: 50_00, spent: -70_00, balance: -20_00 }),
      ),
    ).toEqual({ tipo: 'sobregastada', importe: 20_00, progreso: 1 });
  });

  it('«Sin objetivo» cuando no hay plantilla ni gasto', () => {
    expect(estadoFila(datos({ budgeted: 20_00, balance: 20_00 }))).toEqual({
      tipo: 'sin-objetivo',
      progreso: 1,
    });
  });
});

describe('auto-asignar', () => {
  it('reparte lo disponible de arriba abajo hasta agotarlo', () => {
    const filas = [
      { id: 'llum', datos: datos({ goal: 98_37, budgeted: 98_37 }) },
      { id: 'gas', datos: datos({ goal: 134_17, budgeted: 47_85 }) },
      { id: 'ibi', datos: datos({ goal: 300_00, budgeted: 0 }) },
    ];
    expect(asignarInfrafinanciadas(filas, 143_90)).toEqual([
      { category: 'gas', amount: 134_17 },
      { category: 'ibi', amount: 57_58 },
    ]);
  });

  it('con dinero de sobra cubre todo lo que falta', () => {
    const filas = [
      { id: 'gas', datos: datos({ goal: 134_17, budgeted: 47_85 }) },
    ];
    expect(asignarInfrafinanciadas(filas, 1000_00)).toEqual([
      { category: 'gas', amount: 134_17 },
    ]);
  });

  it('sin dinero disponible no asigna nada', () => {
    const filas = [{ id: 'gas', datos: datos({ goal: 134_17 }) }];
    expect(asignarInfrafinanciadas(filas, 0)).toEqual([]);
    expect(asignarInfrafinanciadas(filas, -50_00)).toEqual([]);
  });

  it('gastado el mes pasado: el gasto en positivo, ignorando ingresos', () => {
    expect(
      asignarGastadoMesPasado([
        { id: 'a', gastadoMesPasado: -32_93 },
        { id: 'b', gastadoMesPasado: 10_00 },
        { id: 'c', gastadoMesPasado: null },
      ]),
    ).toEqual([{ category: 'a', amount: 32_93 }]);
  });
});

describe('objetivo → líneas de la nota', () => {
  const hoy = '2026-10-02';

  it('importes sin ceros sobrantes y con punto decimal', () => {
    expect(importeDePlantilla(31_50)).toBe('31.5');
    expect(importeDePlantilla(300_00)).toBe('300');
    expect(importeDePlantilla(1000_00)).toBe('1000');
    expect(importeDePlantilla(50_52)).toBe('50.52');
  });

  it('cada mes, apartar otros X, antes del día N', () => {
    expect(
      lineasDeObjetivo(
        { tipo: 'mensual', importe: 31_50, dia: 1, modo: 'apartar' },
        hoy,
      ),
    ).toEqual(['#template 31.5', '#objetivo día 1']);
  });

  it('cada mes, rellenar hasta X, sin día', () => {
    expect(
      lineasDeObjetivo(
        { tipo: 'mensual', importe: 150_00, dia: null, modo: 'rellenar' },
        hoy,
      ),
    ).toEqual(['#template up to 150']);
  });

  it('cada semana', () => {
    expect(
      lineasDeObjetivo(
        { tipo: 'semanal', importe: 20_00, modo: 'apartar' },
        hoy,
      ),
    ).toEqual(['#template 20 repeat every week starting 2026-10-01']);
    expect(
      lineasDeObjetivo(
        { tipo: 'semanal', importe: 20_00, modo: 'rellenar' },
        hoy,
      ),
    ).toEqual(['#template up to 20 per week starting 2026-10-01']);
  });

  it('cada año (o cada N meses) con fecha', () => {
    expect(
      lineasDeObjetivo(
        { tipo: 'anual', importe: 300_00, fecha: '2027-07-15', cadaMeses: 12 },
        hoy,
      ),
    ).toEqual([
      '#template 300 by 2027-07 repeat every year',
      '#objetivo fecha 2027-07-15',
    ]);
    expect(
      lineasDeObjetivo(
        { tipo: 'anual', importe: 90_00, fecha: '2027-01-31', cadaMeses: 6 },
        hoy,
      )[0],
    ).toBe('#template 90 by 2027-01 repeat every 6 months');
    expect(
      lineasDeObjetivo(
        { tipo: 'anual', importe: 90_00, fecha: '2027-01-31', cadaMeses: 24 },
        hoy,
      )[0],
    ).toBe('#template 90 by 2027-01 repeat every 2 years');
  });

  it('una vez', () => {
    expect(
      lineasDeObjetivo(
        { tipo: 'una-vez', importe: 3000_00, fecha: '2027-07-18' },
        hoy,
      ),
    ).toEqual(['#template 3000 by 2027-07', '#objetivo fecha 2027-07-18']);
  });

  it('la nota conserva el texto y sustituye las líneas de objetivo', () => {
    const nota = 'Seguro de la casa\n#template 30\n#objetivo día 5\n';
    expect(notaConObjetivo(nota, ['#template 31.5', '#objetivo día 1'])).toBe(
      'Seguro de la casa\n#template 31.5\n#objetivo día 1',
    );
    expect(notaConObjetivo(nota, [])).toBe('Seguro de la casa');
    expect(notaConObjetivo(null, ['#template 5'])).toBe('#template 5');
    expect(notaConObjetivo('#goal 100', ['#template 5'])).toBe('#template 5');
  });

  it('lee la marca de la nota', () => {
    expect(marcaDeNota('x\n#objetivo día 15')).toEqual({
      dia: 15,
      fecha: null,
    });
    expect(marcaDeNota('#objetivo fecha 2027-07-18')).toEqual({
      dia: null,
      fecha: '2027-07-18',
    });
    expect(marcaDeNota('#objetivo día 40')).toEqual({ dia: null, fecha: null });
    expect(marcaDeNota(null)).toEqual({ dia: null, fecha: null });
  });
});

describe('plantillas → objetivo', () => {
  const simple = (monthly: number): Template => ({
    directive: 'template',
    type: 'simple',
    monthly,
    priority: 0,
  });

  it('`#template 31.5` + marca de día → cada mes, apartar', () => {
    expect(objetivoDesdePlantillas([simple(31.5)], '#objetivo día 1')).toEqual({
      tipo: 'mensual',
      importe: 31_50,
      dia: 1,
      modo: 'apartar',
    });
  });

  it('`#template up to 150` → cada mes, rellenar', () => {
    const t: Template = {
      directive: 'template',
      type: 'simple',
      limit: { amount: 150, hold: false, period: 'monthly' },
      priority: 0,
    };
    expect(objetivoDesdePlantillas([t], null)).toEqual({
      tipo: 'mensual',
      importe: 150_00,
      dia: null,
      modo: 'rellenar',
    });
  });

  it('refill + limit de la UI de automatizaciones → rellenar', () => {
    const ts: Template[] = [
      { directive: 'template', type: 'refill', priority: 1 },
      {
        directive: 'template',
        type: 'limit',
        amount: 80,
        hold: false,
        period: 'weekly',
        start: '2026-10-01',
        priority: null,
      },
    ];
    expect(objetivoDesdePlantillas(ts, null)).toEqual({
      tipo: 'semanal',
      importe: 80_00,
      modo: 'rellenar',
    });
  });

  it('periódica mensual o semanal → apartar', () => {
    const periodica = (period: 'month' | 'week'): Template => ({
      directive: 'template',
      type: 'periodic',
      amount: 20,
      period: { period, amount: 1 },
      starting: '2026-10-01',
      priority: 0,
    });
    expect(objetivoDesdePlantillas([periodica('month')], null)).toMatchObject({
      tipo: 'mensual',
      importe: 20_00,
      modo: 'apartar',
    });
    expect(objetivoDesdePlantillas([periodica('week')], null)).toEqual({
      tipo: 'semanal',
      importe: 20_00,
      modo: 'apartar',
    });
  });

  it('`by` con repetición → cada año; sin repetición → una vez', () => {
    const anual: Template = {
      directive: 'template',
      type: 'by',
      amount: 300,
      month: '2027-07',
      annual: true,
      repeat: 1,
      priority: 0,
    };
    expect(
      objetivoDesdePlantillas([anual], '#objetivo fecha 2027-07-15'),
    ).toEqual({
      tipo: 'anual',
      importe: 300_00,
      fecha: '2027-07-15',
      cadaMeses: 12,
    });

    const cada6: Template = { ...anual, annual: false, repeat: 6 };
    expect(objetivoDesdePlantillas([cada6], null)).toEqual({
      tipo: 'anual',
      importe: 300_00,
      fecha: '2027-07-01',
      cadaMeses: 6,
    });

    const unaVez: Template = {
      directive: 'template',
      type: 'by',
      amount: 3000,
      month: '2027-07',
      priority: 0,
    };
    expect(
      objetivoDesdePlantillas([unaVez], '#objetivo fecha 2027-07-18'),
    ).toEqual({ tipo: 'una-vez', importe: 3000_00, fecha: '2027-07-18' });
    // La marca de otro mes no manda: se usa el mes de la plantilla.
    expect(
      objetivoDesdePlantillas([unaVez], '#objetivo fecha 2026-01-18'),
    ).toEqual({ tipo: 'una-vez', importe: 3000_00, fecha: '2027-07-01' });
  });

  it('sin plantillas → null; `#goal` u otras → «otro»', () => {
    expect(objetivoDesdePlantillas([], null)).toBeNull();
    expect(
      objetivoDesdePlantillas(
        [{ directive: 'goal', type: 'goal', amount: 100 }],
        null,
      ),
    ).toBe('otro');
    expect(objetivoDesdePlantillas([simple(10), simple(20)], null)).toBe(
      'otro',
    );
  });

  it('ida y vuelta: las líneas generadas reconstruyen el mismo objetivo', () => {
    // Lo que el parser de Actual devuelve para «#template 3000 by 2027-07».
    const unaVez: Template = {
      directive: 'template',
      type: 'by',
      amount: 3000,
      month: '2027-07',
      priority: 0,
    };
    const objetivo = {
      tipo: 'una-vez',
      importe: 3000_00,
      fecha: '2027-07-18',
    } as const;
    const lineas = lineasDeObjetivo(objetivo, '2026-10-02');
    expect(objetivoDesdePlantillas([unaVez], lineas.join('\n'))).toEqual(
      objetivo,
    );
  });
});

describe('cuotaMensual', () => {
  it('reparte lo que falta entre los meses que quedan, incluido el actual', () => {
    // 3.000 € para julio de 2027 desde octubre de 2026 (10 meses) con 600 € ya.
    expect(cuotaMensual(3000_00, 600_00, '2027-07-18', '2026-10')).toBe(240_00);
  });

  it('con la fecha pasada pide todo lo que falta', () => {
    expect(cuotaMensual(100_00, 30_00, '2026-01-01', '2026-10')).toBe(70_00);
  });

  it('nunca es negativa', () => {
    expect(cuotaMensual(100_00, 500_00, '2027-01-01', '2026-10')).toBe(0);
  });
});
