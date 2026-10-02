import type { DatosCategoriaMes } from '#components/mobile/budget/objetivos';

import {
  avanceFijada,
  estadoDeCategoria,
  iconoDeNombre,
  porcentajeAvance,
} from './avance';

const datos = (d: Partial<DatosCategoriaMes>): DatosCategoriaMes => ({
  goal: null,
  longGoal: false,
  budgeted: 0,
  balance: 0,
  spent: 0,
  ...d,
});

describe('avance de las fijadas', () => {
  it('con objetivo: asignado / objetivo y lo que falta', () => {
    const a = avanceFijada(
      datos({ goal: 200_00, budgeted: 50_00, balance: 50_00 }),
    );
    expect(a).toMatchObject({
      modo: 'objetivo',
      fraccion: 0.25,
      hecho: 50_00,
      total: 200_00,
      falta: 150_00,
      estado: 'aviso',
    });
  });

  it('objetivo sobre el saldo (#goal): saldo / objetivo', () => {
    const a = avanceFijada(
      datos({
        goal: 3000_00,
        longGoal: true,
        budgeted: 100_00,
        balance: 1500_00,
      }),
    );
    expect(a.fraccion).toBe(0.5);
    expect(a.hecho).toBe(1500_00);
  });

  it('objetivo cumplido: anillo lleno y verde, sin pasarse de 1', () => {
    const a = avanceFijada(
      datos({ goal: 100_00, budgeted: 150_00, balance: 150_00 }),
    );
    expect(a.fraccion).toBe(1);
    expect(a.falta).toBe(0);
    expect(a.estado).toBe('bien');
  });

  it('sin objetivo: gastado / asignado', () => {
    const a = avanceFijada(
      datos({ budgeted: 200_00, spent: -50_00, balance: 150_00 }),
    );
    expect(a).toMatchObject({
      modo: 'gastado',
      fraccion: 0.25,
      hecho: 50_00,
      total: 200_00,
      estado: 'bien',
    });
  });

  it('gastado de más: lleno y en rojo', () => {
    const a = avanceFijada(
      datos({ budgeted: 100_00, spent: -130_00, balance: -30_00 }),
    );
    expect(a.fraccion).toBe(1);
    expect(a.estado).toBe('mal');
  });

  it('sin objetivo ni asignado: sin avance', () => {
    expect(avanceFijada(datos({}))).toMatchObject({
      modo: 'sin-datos',
      fraccion: 0,
      estado: 'neutro',
    });
  });

  it('ignorada este mes: no avisa aunque falte', () => {
    const d = datos({
      goal: 200_00,
      budgeted: 50_00,
      balance: 50_00,
      ignorada: true,
    });
    expect(estadoDeCategoria(d)).toBe('bien');
    expect(avanceFijada(d).falta).toBe(0);
  });
});

describe('icono de la categoría', () => {
  it('separa el emoji inicial del nombre', () => {
    expect(iconoDeNombre('💳 Visa')).toEqual({
      emoji: '💳',
      nombre: 'Visa',
      inicial: 'V',
    });
    expect(iconoDeNombre('🏖️ Vacances').emoji).toBe('🏖️');
  });

  it('sin emoji usa la inicial', () => {
    expect(iconoDeNombre('capritxos')).toEqual({
      emoji: null,
      nombre: 'capritxos',
      inicial: 'C',
    });
  });
});

describe('porcentaje de las fijadas', () => {
  it('asignado / objetivo, redondeado', () => {
    expect(
      porcentajeAvance(
        avanceFijada(datos({ goal: 3000_00, budgeted: 923_08 })),
      ),
    ).toBe(31);
  });
  it('tope 100 % con el objetivo superado', () => {
    expect(
      porcentajeAvance(avanceFijada(datos({ goal: 100_00, budgeted: 250_00 }))),
    ).toBe(100);
  });
  it('sin objetivo: gastado / asignado; sin nada, 0 %', () => {
    expect(
      porcentajeAvance(
        avanceFijada(
          datos({ budgeted: 200_00, balance: 150_00, spent: -50_00 }),
        ),
      ),
    ).toBe(25);
    expect(porcentajeAvance(avanceFijada(datos({})))).toBe(0);
  });
});
