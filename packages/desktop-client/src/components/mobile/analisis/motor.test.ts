import * as monthUtils from '@actual-app/core/shared/months';

import type {
  CategoriaInfo,
  Movimiento,
} from '#components/mobile/informes/calculos';

import {
  analizar,
  caracterizarSerie,
  esAhorroPorDefecto,
  estacionalidad,
  redondearA5,
} from './motor';
import type { Consejo, EntradaAnalisis, MovimientoDinero } from './motor';
import {
  indicePorNombre,
  movimientosDeNotas,
  parseImporteTexto,
  parseNotaMovimientos,
} from './movimientos';

// ---------------------------------------------------------------------------
// Series sintéticas
// ---------------------------------------------------------------------------

const MES_ACTUAL = '2026-10';
/** 37 meses: 36 completos + el actual. */
const MESES = monthUtils.rangeInclusive(
  monthUtils.subMonths(MES_ACTUAL, 36),
  MES_ACTUAL,
);
const COMPLETOS = MESES.slice(0, -1);

function cat(
  id: string,
  nombre: string,
  extra: Partial<CategoriaInfo> = {},
): CategoriaInfo {
  return {
    id,
    nombre,
    grupo: 'g1',
    nombreGrupo: 'Casa',
    esIngreso: false,
    oculta: false,
    ...extra,
  };
}

const SUELDO = cat('sueldo', 'Nómina', {
  grupo: 'gi',
  nombreGrupo: 'Ingresos',
  esIngreso: true,
});

type Serie = Record<string, number>; // mes → euros (gasto en positivo)

/** Gasto constante (euros) en todos los meses completos, con excepciones. */
function constante(euros: number, excepciones: Serie = {}): Serie {
  const s: Serie = {};
  for (const m of COMPLETOS) {
    s[m] = excepciones[m] ?? euros;
  }
  return s;
}

function movimientosDe(
  series: Record<string, Serie>,
  ingresos: Serie = constante(2000),
  payee = 'empresa',
): Movimiento[] {
  const lista: Movimiento[] = [];
  for (const [categoria, serie] of Object.entries(series)) {
    for (const [mes, euros] of Object.entries(serie)) {
      if (euros !== 0) {
        lista.push({ mes, categoria, payee: 'p', importe: -euros * 100 });
      }
    }
  }
  for (const [mes, euros] of Object.entries(ingresos)) {
    if (euros !== 0) {
      lista.push({ mes, categoria: 'sueldo', payee, importe: euros * 100 });
    }
  }
  return lista;
}

/** Presupuesto constante por categoría (euros) en los últimos 13 meses y el siguiente. */
function presupuestoDe(
  porCategoria: Record<string, number | Serie>,
  meses: readonly string[] = [
    ...MESES.slice(-13),
    monthUtils.nextMonth(MES_ACTUAL),
  ],
): Map<string, Map<string, number>> {
  const mapa = new Map<string, Map<string, number>>();
  for (const mes of meses) {
    const fila = new Map<string, number>();
    for (const [id, valor] of Object.entries(porCategoria)) {
      const euros = typeof valor === 'number' ? valor : (valor[mes] ?? 0);
      fila.set(id, euros * 100);
    }
    mapa.set(mes, fila);
  }
  return mapa;
}

function entrada(
  parcial: Partial<EntradaAnalisis> & {
    cats?: CategoriaInfo[];
  },
): EntradaAnalisis {
  const cats = [SUELDO, ...(parcial.cats ?? [])];
  return {
    meses: MESES,
    mesActual: MES_ACTUAL,
    movimientos: [],
    categorias: new Map(cats.map(c => [c.id, c])),
    presupuestado: new Map(),
    objetivos: new Map(),
    traspasos: [],
    ...parcial,
  };
}

function consejosDe(e: EntradaAnalisis, tipo?: Consejo['datos']['tipo']) {
  return analizar(e).consejos.filter(c => !tipo || c.datos.tipo === tipo);
}

const ult = (n: number) => COMPLETOS.slice(-n);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

describe('utilidades', () => {
  it('redondearA5 redondea a 5 € hacia arriba o al más cercano', () => {
    expect(redondearA5(13_240, 'ceil')).toBe(13_500);
    expect(redondearA5(13_240, 'round')).toBe(13_000);
    expect(redondearA5(13_260, 'round')).toBe(13_500);
    expect(redondearA5(0, 'ceil')).toBe(0);
  });

  it('esAhorroPorDefecto reconoce Estalvis e Inversions sin acentos ni mayúsculas', () => {
    expect(esAhorroPorDefecto(cat('a', 'x', { nombreGrupo: 'ESTALVIS' }))).toBe(
      true,
    );
    expect(
      esAhorroPorDefecto(cat('a', 'x', { nombreGrupo: 'Inversións' })),
    ).toBe(true);
    expect(esAhorroPorDefecto(cat('a', 'x', { nombreGrupo: 'Casa' }))).toBe(
      false,
    );
  });

  it('caracterizarSerie ignora los meses iniciales sin datos', () => {
    const c = caracterizarSerie([0, 0, 0, 3000, 3000, 3200]);
    expect(c.primerMes).toBe(3);
    expect(c.habitual.referencia).toBe(3000);
    expect(c.habitual.habituales).toBe(3);
    expect(c.tendencia).toBeNull();
    expect(c.irregular).toBe(false);
    expect(c.vigente).toBe(3000);
  });

  it('caracterizarSerie marca como irregular una factura bimestral y da su media', () => {
    const c = caracterizarSerie([
      8000, 0, 8000, 0, 8000, 0, 8000, 0, 8000, 0, 8000, 0,
    ]);
    expect(c.irregular).toBe(true);
    expect(c.mediaMensual).toBe(4000);
    expect(c.maximo).toBe(8000);
    expect(c.tendencia).toBeNull();
  });

  it('caracterizarSerie detecta una tendencia y usa el nivel de los últimos 3 meses', () => {
    const c = caracterizarSerie([
      6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 9500, 9500, 9500,
    ]);
    expect(c.tendencia?.sentido).toBe('sube');
    expect(c.vigente).toBe(9500);
  });
});

// ---------------------------------------------------------------------------
// a. Infrapresupuestada
// ---------------------------------------------------------------------------

describe('infrapresupuestada', () => {
  const bebot = cat('bebot', 'Bebot');

  it('≥ 3 de 4 meses con gasto > presupuestado → propone la mediana redondeada a 5 €', () => {
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({
        bebot: constante(140, { [ult(4)[1]]: 90 }),
      }),
      presupuestado: presupuestoDe({ bebot: 100 }),
    });
    const [c] = consejosDe(e, 'infrapresupuestada');
    expect(c).toBeDefined();
    expect(c.categoria).toBe('bebot');
    expect(c.gravedad).toBe('accion');
    if (c.datos.tipo !== 'infrapresupuestada') throw new Error();
    expect(c.datos.mesesSobre).toBe(3);
    expect(c.datos.presupuestado).toBe(10_000);
    expect(c.datos.habitual).toBe(14_000);
    expect(c.datos.propuesto).toBe(14_000);
    expect(c.accion).toEqual({
      tipo: 'ajustar-presupuesto',
      categoria: 'bebot',
      importe: 14_000,
      // Este mes ya tiene algo asignado: el botón va al mes siguiente.
      mes: monthUtils.nextMonth(MES_ACTUAL),
    });
    expect(c.cifras.filas).toHaveLength(4);
    expect(c.cifras.filas.filter(f => f.cumple)).toHaveLength(3);
  });

  it('solo 2 de 4 meses por encima: no hay consejo', () => {
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({
        bebot: constante(140, { [ult(4)[0]]: 90, [ult(4)[2]]: 95 }),
      }),
      presupuestado: presupuestoDe({ bebot: 100 }),
    });
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
  });

  it('un gasto puntual no cuenta como mes por encima', () => {
    // Habitual 100 = presupuesto; dos meses puntuales de 400 no deben bastar.
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({
        bebot: constante(100, {
          [ult(4)[0]]: 400,
          [ult(4)[2]]: 450,
          [ult(4)[3]]: 101,
        }),
      }),
      presupuestado: presupuestoDe({ bebot: 100 }),
    });
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
  });

  it('si ya se ha subido el presupuesto este mes, no insiste', () => {
    const presup = presupuestoDe({ bebot: 100 });
    presup.get(MES_ACTUAL)?.set('bebot', 14_000);
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({ bebot: constante(140) }),
      presupuestado: presup,
    });
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
  });

  it('con objetivo mensual la acción es cambiar el objetivo', () => {
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({ bebot: constante(140) }),
      presupuestado: presupuestoDe({ bebot: 100 }),
      objetivos: new Map([['bebot', { importe: 10_000, acumulativo: false }]]),
    });
    const [c] = consejosDe(e, 'infrapresupuestada');
    expect(c.accion?.tipo).toBe('fijar-objetivo');
  });

  it('las categorías con objetivo acumulativo (ahorrar para una fecha) se saltan', () => {
    const e = entrada({
      cats: [bebot],
      movimientos: movimientosDe({ bebot: constante(140) }),
      presupuestado: presupuestoDe({ bebot: 100 }),
      objetivos: new Map([['bebot', { importe: 300_000, acumulativo: true }]]),
    });
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
  });

  it('menciona de dónde sale el dinero si se le traspasa casi cada mes', () => {
    const capritxos = cat('capritxos', 'Capritxos');
    const traspasos: MovimientoDinero[] = ult(3).map(mes => ({
      mes,
      desde: 'capritxos',
      hacia: 'bebot',
      importe: 4000,
    }));
    const e = entrada({
      cats: [bebot, capritxos],
      movimientos: movimientosDe({
        bebot: constante(140),
        capritxos: constante(60),
      }),
      presupuestado: presupuestoDe({ bebot: 100, capritxos: 100 }),
      traspasos,
    });
    const r = analizar(e);
    const c = r.consejos.find(x => x.datos.tipo === 'infrapresupuestada');
    if (!c || c.datos.tipo !== 'infrapresupuestada') throw new Error();
    expect(c.datos.origen).toEqual({
      desde: 'capritxos',
      meses: 3,
      habitual: 4000,
    });
    // Y el traspaso ya explicado no sale como consejo aparte.
    expect(r.consejos.filter(x => x.datos.tipo === 'traspasos')).toHaveLength(
      0,
    );
  });

  it('con menos de 4 meses completos no se evalúa', () => {
    const meses = MESES.slice(-3);
    const e = entrada({
      cats: [bebot],
      meses,
      movimientos: movimientosDe({ bebot: constante(140) }),
      presupuestado: presupuestoDe({ bebot: 100 }),
    });
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// b. Sobrepresupuestada
// ---------------------------------------------------------------------------

describe('sobrepresupuestada', () => {
  const gats = cat('gats', 'Gats');

  it('3 meses con 60 € y gasto 0 → pregunta si está bien presupuestado', () => {
    const e = entrada({
      cats: [gats],
      movimientos: movimientosDe({
        gats: constante(30, Object.fromEntries(ult(4).map(m => [m, 0]))),
      }),
      presupuestado: presupuestoDe({ gats: 60 }),
    });
    const [c] = consejosDe(e, 'sobrepresupuestada');
    expect(c).toBeDefined();
    expect(c.gravedad).toBe('aviso');
    if (c.datos.tipo !== 'sobrepresupuestada') throw new Error();
    expect(c.datos.sinGasto).toBe(true);
    expect(c.datos.mesesBajo).toBe(4);
    expect(c.datos.presupuestado).toBe(6000);
    // Lo habitual de los 12 meses (8 a 30, 4 a 0) sigue siendo 30 €, pero
    // el gasto ha parado (4 meses a 0): se propone el nivel reciente.
    expect(c.datos.habitual).toBe(3000);
    expect(c.datos.propuesto).toBe(0);
    expect(c.relevancia).toBe(6000);
  });

  it('categoría presupuestada que nunca ha tenido gasto → también pregunta', () => {
    const e = entrada({
      cats: [gats],
      movimientos: movimientosDe({}),
      presupuestado: presupuestoDe({ gats: 60 }),
    });
    const [c] = consejosDe(e, 'sobrepresupuestada');
    expect(c).toBeDefined();
    if (c.datos.tipo !== 'sobrepresupuestada') throw new Error();
    expect(c.datos.sinGasto).toBe(true);
    expect(c.datos.propuesto).toBe(0);
  });

  it('gasto por debajo del 50 % en 3 de 4 → propone bajar al habitual', () => {
    const e = entrada({
      cats: [gats],
      movimientos: movimientosDe({ gats: constante(20, { [ult(4)[2]]: 55 }) }),
      presupuestado: presupuestoDe({ gats: 60 }),
    });
    const [c] = consejosDe(e, 'sobrepresupuestada');
    if (c.datos.tipo !== 'sobrepresupuestada') throw new Error();
    expect(c.datos.mesesBajo).toBe(3);
    expect(c.datos.sinGasto).toBe(false);
    expect(c.datos.propuesto).toBe(2000);
    expect(c.accion?.importe).toBe(2000);
  });

  it('gasto cercano al presupuesto: nada que decir', () => {
    const e = entrada({
      cats: [gats],
      movimientos: movimientosDe({ gats: constante(45) }),
      presupuestado: presupuestoDe({ gats: 60 }),
    });
    expect(consejosDe(e, 'sobrepresupuestada')).toHaveLength(0);
  });

  it('una factura anual que se va apartando no está sobrepresupuestada', () => {
    const ibi = cat('ibi', 'IBI');
    const e = entrada({
      cats: [ibi],
      // 0 € todos los meses salvo julio: 280 € (más de 3× lo asignado).
      movimientos: movimientosDe({ ibi: constante(0, { [ult(3)[0]]: 280 }) }),
      presupuestado: presupuestoDe({ ibi: 25 }),
    });
    expect(consejosDe(e, 'sobrepresupuestada')).toHaveLength(0);
  });

  it('un gasto irregular (bimestral) no se juzga con las reglas mensuales', () => {
    const gas = cat('gas', 'Gas');
    const bimestral: Record<string, number> = {};
    COMPLETOS.forEach((m, i) => {
      bimestral[m] = i % 2 === 0 ? 80 : 0;
    });
    const e = entrada({
      cats: [gas],
      movimientos: movimientosDe({ gas: bimestral }),
      presupuestado: presupuestoDe({ gas: 100 }),
    });
    expect(consejosDe(e, 'sobrepresupuestada')).toHaveLength(0);
    expect(consejosDe(e, 'infrapresupuestada')).toHaveLength(0);
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'gas');
    expect(fila).toMatchObject({ motivo: 'irregular', propuesto: 4000 });
  });

  it('las categorías de ahorro no se consideran sobrepresupuestadas', () => {
    const estalvis = cat('est', 'Fons', { nombreGrupo: 'Estalvis' });
    const e = entrada({
      cats: [estalvis],
      movimientos: movimientosDe({ est: constante(0) }),
      presupuestado: presupuestoDe({ est: 300 }),
    });
    expect(consejosDe(e, 'sobrepresupuestada')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// c. Sin asignar
// ---------------------------------------------------------------------------

describe('sin asignar pero con gasto', () => {
  const personal = cat('personal', 'Personal');

  it('asignado 0 y gasto ~22 €/mes → propone objetivo de 25 €', () => {
    const e = entrada({
      cats: [personal],
      movimientos: movimientosDe({
        personal: constante(22, { [ult(4)[1]]: 19 }),
      }),
      presupuestado: presupuestoDe({ personal: 0 }),
    });
    const [c] = consejosDe(e, 'sin-asignar');
    expect(c).toBeDefined();
    if (c.datos.tipo !== 'sin-asignar') throw new Error();
    expect(c.datos.habitual).toBe(2200);
    expect(c.datos.propuesto).toBe(2500);
    expect(c.datos.mesesConGasto).toBe(4);
    expect(c.accion).toEqual({
      tipo: 'fijar-objetivo',
      categoria: 'personal',
      importe: 2500,
      mes: MES_ACTUAL,
    });
  });

  it('gasto habitual por debajo de 10 €: no importa', () => {
    const e = entrada({
      cats: [personal],
      movimientos: movimientosDe({ personal: constante(8) }),
      presupuestado: presupuestoDe({ personal: 0 }),
    });
    expect(consejosDe(e, 'sin-asignar')).toHaveLength(0);
  });

  it('si ya hay objetivo, la acción es ajustar el presupuesto', () => {
    const e = entrada({
      cats: [personal],
      movimientos: movimientosDe({ personal: constante(22) }),
      presupuestado: presupuestoDe({ personal: 0 }),
      objetivos: new Map([['personal', { importe: 2500, acumulativo: false }]]),
    });
    const [c] = consejosDe(e, 'sin-asignar');
    expect(c.accion?.tipo).toBe('ajustar-presupuesto');
  });

  it('no sale si al menos 2 de los 4 meses sí tenían asignación', () => {
    const e = entrada({
      cats: [personal],
      movimientos: movimientosDe({ personal: constante(22) }),
      presupuestado: presupuestoDe({
        personal: { [ult(4)[2]]: 25, [ult(4)[3]]: 25 },
      }),
    });
    expect(consejosDe(e, 'sin-asignar')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// d. Estacionalidad
// ---------------------------------------------------------------------------

describe('estacionalidad', () => {
  const vacances = cat('vac', 'Vacances');
  const agosto = (ano: number) => `${ano}-08`;
  const serieVacances = constante(50, {
    [agosto(2024)]: 900,
    [agosto(2025)]: 1100,
  });

  it('estacionalidad() detecta un mes que supera lo habitual dos años seguidos', () => {
    const gasto = COMPLETOS.map(m => (serieVacances[m] ?? 0) * 100);
    const r = estacionalidad({ gasto, primerMes: 0 }, COMPLETOS, agosto(2026));
    expect(r).not.toBeNull();
    expect(r?.habitualMes).toBe(100_000);
    expect(r?.habitualAnual).toBe(5000);
    expect(r?.filas.map(f => f.mes)).toEqual([agosto(2024), agosto(2025)]);
  });

  it('un solo año alto no es estacional', () => {
    const serie = constante(50, { [agosto(2025)]: 1100 });
    const gasto = COMPLETOS.map(m => (serie[m] ?? 0) * 100);
    expect(
      estacionalidad({ gasto, primerMes: 0 }, COMPLETOS, agosto(2026)),
    ).toBeNull();
  });

  it('para el mes siguiente avisa y propone preparar la mediana redondeada', () => {
    const mesActual = '2026-07';
    const meses = monthUtils.rangeInclusive(
      monthUtils.subMonths(mesActual, 36),
      mesActual,
    );
    const e = entrada({
      cats: [vacances],
      meses,
      mesActual,
      movimientos: movimientosDe({ vac: serieVacances }),
      presupuestado: presupuestoDe({ vac: 50 }, [
        ...meses.slice(-13),
        '2026-08',
      ]),
    });
    const consejos = consejosDe(e, 'estacionalidad');
    expect(consejos).toHaveLength(1);
    const [c] = consejos;
    if (c.datos.tipo !== 'estacionalidad') throw new Error();
    expect(c.datos.mes).toBe('2026-08');
    expect(c.datos.habitualMes).toBe(100_000);
    expect(c.datos.propuesto).toBe(100_000);
    expect(c.datos.pct).toBeCloseTo(19, 5);
    expect(c.accion).toEqual({
      tipo: 'ajustar-presupuesto',
      categoria: 'vac',
      importe: 100_000,
      mes: '2026-08',
    });
    // La propuesta de agosto usa la cifra estacional.
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'vac');
    expect(fila?.motivo).toBe('estacional');
    expect(fila?.propuesto).toBe(100_000);
  });

  it('si ya está presupuestado, no avisa', () => {
    const mesActual = '2026-07';
    const meses = monthUtils.rangeInclusive(
      monthUtils.subMonths(mesActual, 36),
      mesActual,
    );
    const presup = presupuestoDe({ vac: 50 }, [...meses.slice(-13), '2026-08']);
    presup.get('2026-08')?.set('vac', 120_000);
    const e = entrada({
      cats: [vacances],
      meses,
      mesActual,
      movimientos: movimientosDe({ vac: serieVacances }),
      presupuestado: presup,
    });
    expect(consejosDe(e, 'estacionalidad')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// e. Tendencia
// ---------------------------------------------------------------------------

describe('tendencia', () => {
  const llum = cat('llum', 'Llum');

  it('dos picos sueltos (2 de los últimos 3 meses) no cambian el nivel', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, { [ult(4)[1]]: 95, [ult(4)[3]]: 95 }),
      }),
      presupuestado: presupuestoDe({ llum: 60 }),
    });
    expect(consejosDe(e, 'tendencia')).toHaveLength(0);
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'llum');
    expect(fila?.propuesto).toBe(6000);
  });

  it('subida persistente (3 meses seguidos) → sube y propone el nuevo nivel', () => {
    // Con 3 de 4 meses por encima mandaría «infrapresupuestada»; aquí son 3.
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, Object.fromEntries(ult(3).map(m => [m, 95]))),
      }),
      presupuestado: presupuestoDe({ llum: 60 }),
    });
    const c = analizar(e).consejos.find(x => x.categoria === 'llum');
    expect(c).toBeDefined();
    expect(c?.accion).toMatchObject({ importe: 9500 });
    // La propuesta del mes siguiente también usa el nivel reciente.
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'llum');
    expect(fila).toMatchObject({ propuesto: 9500 });
  });

  it('si sube pero lo asignado ya cubre el nuevo nivel, no hay consejo', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, { [ult(4)[1]]: 95, [ult(4)[3]]: 95 }),
      }),
      presupuestado: presupuestoDe({ llum: 120 }),
    });
    expect(consejosDe(e, 'tendencia')).toHaveLength(0);
  });

  it('una categoría de devoluciones (gasto neto negativo) no es irregular ni propone negativos', () => {
    const declaracio = cat('dec', 'Declaració');
    const e = entrada({
      cats: [declaracio],
      movimientos: movimientosDe({ dec: constante(0, { [ult(5)[0]]: -540 }) }),
      presupuestado: presupuestoDe({ dec: 0 }),
    });
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'dec');
    expect(fila?.propuesto).toBe(0);
    expect(fila?.motivo).not.toBe('irregular');
  });

  it('si el presupuesto ya está al nuevo nivel, la tendencia es vieja y no se avisa', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, Object.fromEntries(ult(3).map(m => [m, 95]))),
      }),
      presupuestado: presupuestoDe({ llum: 95 }),
    });
    expect(consejosDe(e, 'tendencia')).toHaveLength(0);
  });

  it('una categoría ya aconsejada por presupuesto no repite como tendencia', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, Object.fromEntries(ult(4).map(m => [m, 95]))),
      }),
      presupuestado: presupuestoDe({ llum: 60 }),
    });
    const consejos = analizar(e).consejos.filter(c => c.categoria === 'llum');
    expect(consejos).toHaveLength(1);
    expect(consejos[0].datos.tipo).toBe('infrapresupuestada');
  });

  it('un mes aislado alto es gasto puntual, no tendencia', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({ llum: constante(60, { [ult(1)[0]]: 400 }) }),
    });
    expect(consejosDe(e, 'tendencia')).toHaveLength(0);
  });

  it('bajada persistente (3 meses) → propone bajar al nivel nuevo', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, Object.fromEntries(ult(3).map(m => [m, 20]))),
      }),
      presupuestado: presupuestoDe({ llum: 60 }),
    });
    // Un solo consejo de cifra para la categoría, al nivel nuevo (20).
    const consejos = analizar(e).consejos.filter(c => c.categoria === 'llum');
    expect(consejos).toHaveLength(1);
    expect(consejos[0].accion?.importe).toBe(2000);
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'llum');
    expect(fila?.propuesto).toBe(2000);
  });

  it('dos meses abajo no bastan: el nivel sigue siendo el de siempre', () => {
    const e = entrada({
      cats: [llum],
      movimientos: movimientosDe({
        llum: constante(60, Object.fromEntries(ult(2).map(m => [m, 20]))),
      }),
      presupuestado: presupuestoDe({ llum: 60 }),
    });
    expect(consejosDe(e, 'tendencia')).toHaveLength(0);
    const fila = analizar(e).propuesta.filas.find(f => f.categoria === 'llum');
    expect(fila?.propuesto).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// f. Ingresos
// ---------------------------------------------------------------------------

describe('ingresos', () => {
  const menjar = cat('menjar', 'Menjar');
  const fons = cat('fons', 'Fons', { nombreGrupo: 'Estalvis' });

  it('nómina que sube: dice cuánto y a dónde ha ido', () => {
    const ingresos = constante(
      2000,
      Object.fromEntries(ult(3).map(m => [m, 2150])),
    );
    const e = entrada({
      cats: [menjar, fons],
      movimientos: movimientosDe(
        {
          menjar: constante(400, Object.fromEntries(ult(3).map(m => [m, 450]))),
        },
        ingresos,
      ),
      presupuestado: presupuestoDe({
        fons: {
          ...constante(300),
          ...Object.fromEntries(ult(3).map(m => [m, 400])),
        },
      }),
    });
    const [c] = consejosDe(e, 'ingresos');
    expect(c).toBeDefined();
    if (c.datos.tipo !== 'ingresos') throw new Error();
    expect(c.datos.payee).toBe('empresa');
    expect(c.datos.antes).toBe(200_000);
    expect(c.datos.ahora).toBe(215_000);
    expect(c.datos.diferencia).toBe(15_000);
    expect(c.datos.aGasto).toBe(5000);
    expect(c.datos.aAhorro).toBe(10_000);
    expect(c.cifras.filas).toHaveLength(6);
  });

  it('un cambio menor del 2 % no se menciona', () => {
    const ingresos = constante(
      2000,
      Object.fromEntries(ult(3).map(m => [m, 2020])),
    );
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe({}, ingresos),
    });
    expect(consejosDe(e, 'ingresos')).toHaveLength(0);
  });

  it('una paga extra aislada no cambia la mediana', () => {
    const ingresos = constante(2000, { [ult(2)[0]]: 4000 });
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe({}, ingresos),
    });
    expect(consejosDe(e, 'ingresos')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// g. Tasa de ahorro
// ---------------------------------------------------------------------------

describe('tasa de ahorro', () => {
  const menjar = cat('menjar', 'Menjar');

  it('último mes 10 puntos por debajo de la habitual → aviso', () => {
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe({
        menjar: constante(1000, { [ult(1)[0]]: 1400 }),
      }),
    });
    const [c] = consejosDe(e, 'tasa-ahorro');
    expect(c).toBeDefined();
    if (c.datos.tipo !== 'tasa-ahorro') throw new Error();
    expect(c.datos.tasaHabitual).toBeCloseTo(0.5);
    expect(c.datos.tasa).toBeCloseTo(0.3);
    expect(c.gravedad).toBe('aviso');
    expect(c.cifras.filas).toHaveLength(12);
  });

  it('un mes con ingresos atípicos (paga extra) no se juzga', () => {
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe(
        { menjar: constante(1000) },
        constante(2000, { [ult(1)[0]]: 9000 }),
      ),
    });
    expect(consejosDe(e, 'tasa-ahorro')).toHaveLength(0);
  });

  it('mes normal: sin consejo', () => {
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe({ menjar: constante(1000) }),
    });
    expect(consejosDe(e, 'tasa-ahorro')).toHaveLength(0);
  });

  it('mes mejor de lo habitual: informativo', () => {
    const e = entrada({
      cats: [menjar],
      movimientos: movimientosDe({
        menjar: constante(1000, { [ult(1)[0]]: 600 }),
      }),
    });
    const [c] = consejosDe(e, 'tasa-ahorro');
    expect(c.gravedad).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// h. Traspasos
// ---------------------------------------------------------------------------

describe('traspasos entre categorías', () => {
  const bebot = cat('bebot', 'Bebot');
  const capritxos = cat('capritxos', 'Capritxos');

  it('3 de los últimos 7 meses con dinero de Capritxos a Bebot', () => {
    const traspasos: MovimientoDinero[] = [
      ...ult(3).map(mes => ({
        mes,
        desde: 'capritxos',
        hacia: 'bebot',
        importe: 3000,
      })),
      { mes: ult(1)[0], desde: 'capritxos', hacia: 'bebot', importe: 1000 },
      // Devolver a «listo para asignar» no cuenta.
      { mes: ult(1)[0], desde: 'bebot', hacia: 'to-budget', importe: 5000 },
    ];
    const e = entrada({
      cats: [bebot, capritxos],
      movimientos: movimientosDe({
        bebot: constante(100),
        capritxos: constante(50),
      }),
      presupuestado: presupuestoDe({ bebot: 100, capritxos: 50 }),
      traspasos,
    });
    const consejos = consejosDe(e, 'traspasos');
    expect(consejos).toHaveLength(1);
    const [c] = consejos;
    if (c.datos.tipo !== 'traspasos') throw new Error();
    expect(c.datos).toMatchObject({
      desde: 'capritxos',
      hacia: 'bebot',
      meses: 3,
      de: 7,
    });
    expect(c.datos.habitual).toBe(3000);
    expect(c.cifras.filas).toHaveLength(7);
  });

  it('dos meses sueltos no bastan', () => {
    const traspasos: MovimientoDinero[] = ult(2).map(mes => ({
      mes,
      desde: 'capritxos',
      hacia: 'bebot',
      importe: 3000,
    }));
    const e = entrada({ cats: [bebot, capritxos], traspasos });
    expect(consejosDe(e, 'traspasos')).toHaveLength(0);
  });

  it('desde «listo para asignar» también se cuenta', () => {
    const traspasos: MovimientoDinero[] = ult(4).map(mes => ({
      mes,
      desde: 'to-budget',
      hacia: 'bebot',
      importe: 2000,
    }));
    const e = entrada({ cats: [bebot], traspasos });
    const [c] = consejosDe(e, 'traspasos');
    if (c.datos.tipo !== 'traspasos') throw new Error();
    expect(c.datos.desde).toBe('to-budget');
  });
});

// ---------------------------------------------------------------------------
// i. Propuesta y orden
// ---------------------------------------------------------------------------

describe('propuesta de presupuesto', () => {
  it('propone lo habitual redondeado, respeta objetivos acumulativos y suma totales', () => {
    const menjar = cat('menjar', 'Menjar');
    const vac = cat('vac', 'Vacances');
    const nueva = cat('nueva', 'Nueva');
    const e = entrada({
      cats: [menjar, vac, nueva],
      movimientos: movimientosDe({
        menjar: constante(412),
        vac: constante(0),
        nueva: { [ult(1)[0]]: 30 },
      }),
      presupuestado: presupuestoDe({ menjar: 350, vac: 250, nueva: 0 }),
      objetivos: new Map([['vac', { importe: 300_000, acumulativo: true }]]),
    });
    // El mes siguiente aún está a 0: «ahora» es lo asignado este mes.
    const presup = presupuestoDe({ menjar: 350, vac: 250, nueva: 0 });
    presup.get('2026-11')?.set('menjar', 0);
    const { propuesta } = analizar({ ...e, presupuestado: presup });
    expect(propuesta.mes).toBe('2026-11');
    const por = new Map(propuesta.filas.map(f => [f.categoria, f]));
    expect(por.get('menjar')).toMatchObject({
      actual: 35_000,
      propuesto: 41_000,
      motivo: 'habitual',
    });
    expect(por.get('vac')).toMatchObject({
      actual: 25_000,
      propuesto: 25_000,
      motivo: 'objetivo',
    });
    expect(por.get('nueva')).toMatchObject({
      propuesto: 0,
      motivo: 'sin-datos',
    });
    expect(propuesta.totalActual).toBe(60_000);
    expect(propuesta.totalPropuesto).toBe(66_000);
    expect(propuesta.ingresosHabituales).toBe(200_000);
    // Ordenada por cambio absoluto.
    expect(propuesta.filas[0].categoria).toBe('menjar');
  });

  it('los consejos salen ordenados por importe afectado', () => {
    const grande = cat('g', 'Grande');
    const pequena = cat('p', 'Pequeña');
    const e = entrada({
      cats: [grande, pequena],
      movimientos: movimientosDe({ g: constante(500), p: constante(60) }),
      presupuestado: presupuestoDe({ g: 300, p: 40 }),
    });
    const consejos = consejosDe(e, 'infrapresupuestada');
    expect(consejos.map(c => c.categoria)).toEqual(['g', 'p']);
    expect(consejos[0].relevancia).toBeGreaterThan(consejos[1].relevancia);
  });

  it('las categorías ocultas y de ingreso no generan consejos', () => {
    const oculta = cat('o', 'Oculta', { oculta: true });
    const e = entrada({
      cats: [oculta],
      movimientos: movimientosDe({ o: constante(500) }),
      presupuestado: presupuestoDe({ o: 100 }),
    });
    expect(analizar(e).consejos.filter(c => c.categoria === 'o')).toHaveLength(
      0,
    );
    expect(
      analizar(e).consejos.filter(c => c.categoria === 'sueldo'),
    ).toHaveLength(0);
  });

  it('sin datos no explota', () => {
    const r = analizar(entrada({ meses: [MES_ACTUAL], movimientos: [] }));
    expect(r.consejos).toEqual([]);
    expect(r.propuesta.filas).toEqual([]);
    expect(r.mesesCompletos).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Notas de movimiento
// ---------------------------------------------------------------------------

describe('notas de movimiento', () => {
  const cats = new Map([
    ['b', cat('b', 'Bebot')],
    ['c', cat('c', 'Capritxos')],
    ['d1', cat('d1', 'Duplicada')],
    ['d2', cat('d2', 'Duplicada', { grupo: 'g2' })],
  ]);

  it('parseImporteTexto entiende los formatos habituales', () => {
    expect(parseImporteTexto('40,00 €')).toBe(4000);
    expect(parseImporteTexto('€1,234.56')).toBe(123_456);
    expect(parseImporteTexto('1.234,5')).toBe(123_450);
    expect(parseImporteTexto('40')).toBe(4000);
    expect(parseImporteTexto('sin cifras')).toBeNull();
  });

  it('indicePorNombre descarta los nombres repetidos', () => {
    const indice = indicePorNombre(cats);
    expect(indice.get('Bebot')).toBe('b');
    expect(indice.has('Duplicada')).toBe(false);
  });

  it('parseNotaMovimientos lee las líneas de Actual y salta las que no entiende', () => {
    const nota = [
      'Nota mía del mes',
      '- Reassigned 40,00 € from Capritxos → Bebot on October 02',
      '- Reassigned 15,00 € from To Budget → Bebot on October 03',
      '- Reassigned 5,00 € from Bebot → Overbudgeted on October 04',
      '- Reassigned 7,00 € from Duplicada → Bebot on October 05',
      '- Reassigned 9,00 € from Borrada → Bebot on October 06',
    ].join('\n');
    expect(
      parseNotaMovimientos('2026-10', nota, indicePorNombre(cats)),
    ).toEqual([
      { mes: '2026-10', desde: 'c', hacia: 'b', importe: 4000 },
      { mes: '2026-10', desde: 'to-budget', hacia: 'b', importe: 1500 },
      { mes: '2026-10', desde: 'b', hacia: 'overbudgeted', importe: 500 },
    ]);
  });

  it('movimientosDeNotas solo mira las notas budget-<mes>', () => {
    const notas = [
      {
        id: 'budget-2026-09',
        note: '- Reassigned 40,00 € from Capritxos → Bebot on September 02',
      },
      {
        id: 'b-2026-09',
        note: '- Reassigned 40,00 € from Capritxos → Bebot on September 02',
      },
      { id: 'budget-2026-10', note: null },
    ];
    const r = movimientosDeNotas(notas, cats);
    expect(r).toEqual([
      { mes: '2026-09', desde: 'c', hacia: 'b', importe: 4000 },
    ]);
  });
});
