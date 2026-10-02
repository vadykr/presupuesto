import {
  clasificarMes,
  mad,
  mediana,
  recortarInicioSinDatos,
  referenciaHabitual,
  umbralAtipico,
} from './estadisticaRobusta';

// Series sintéticas en céntimos.
const estable = [3200, 3500, 3800, 3400, 3600, 3300]; // 32-38 €
const conAtipico = [3200, 3500, 20000, 3400, 3600, 3300]; // un mes de 200 €
const tendencia = [3000, 3200, 4500, 6000, 7500, 9000]; // sube de verdad

describe('mediana y MAD', () => {
  it('mediana con número impar y par de valores', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(3); // (2+3)/2 = 2,5 → 3
    expect(mediana([])).toBe(0);
  });

  it('la MAD escalada es pequeña en una serie estable y no la mueve un atípico', () => {
    const madEstable = mad(estable);
    const madAtipico = mad(conAtipico);
    expect(madEstable).toBeGreaterThan(0);
    expect(madEstable).toBeLessThan(500); // < 5 €
    // El 200 € solo cambia un desvío: la MAD sigue siendo del mismo orden.
    expect(madAtipico).toBeLessThan(2 * madEstable + 100);
    expect(mad([5000, 5000, 5000])).toBe(0);
  });
});

describe('umbralAtipico', () => {
  it('es al menos 3·MAD, el 25 % de la mediana y 10 €', () => {
    expect(umbralAtipico(10000, 1000)).toBe(3000); // 3·MAD manda
    expect(umbralAtipico(10000, 0)).toBe(2500); // 25 % de 100 € con MAD 0
    expect(umbralAtipico(2000, 0)).toBe(1000); // mínimo absoluto, 10 €
  });
});

describe('referenciaHabitual', () => {
  it('en una serie estable nada es atípico y la referencia es la mediana', () => {
    const r = referenciaHabitual(estable);
    expect(r.atipicos).toEqual([false, false, false, false, false, false]);
    expect(r.referencia).toBe(mediana(estable));
    expect(r.habituales).toBe(6);
  });

  it('un gasto puntual se marca y no desplaza la referencia', () => {
    const r = referenciaHabitual(conAtipico);
    expect(r.atipicos).toEqual([false, false, true, false, false, false]);
    expect(r.referencia).toBe(mediana([3200, 3500, 3400, 3600, 3300]));
    expect(r.referencia).toBeLessThan(3600);
    expect(r.habituales).toBe(5);
  });

  it('una categoría siempre igual no marca pequeñas variaciones (MAD≈0)', () => {
    const r = referenciaHabitual([5000, 5000, 5000, 5000, 5600]);
    expect(r.atipicos[4]).toBe(false); // 56 € está dentro del 25 %
    const r2 = referenciaHabitual([5000, 5000, 5000, 5000, 7000]);
    expect(r2.atipicos[4]).toBe(true); // 70 € supera el 25 %
  });

  it('con menos de 3 meses no usa la MAD: umbral del 25 % de la mediana', () => {
    const r = referenciaHabitual([1000, 20000]);
    expect(r.mad).toBe(0);
    expect(r.umbral).toBe(Math.round(0.25 * r.mediana));
  });

  it('si todos los valores resultan atípicos, la referencia cae a la mediana', () => {
    const r = referenciaHabitual([0, 100000]);
    expect(r.referencia).toBe(r.mediana);
  });
});

describe('clasificarMes', () => {
  it('un mes de 200 € en una categoría de 30-40 € es «puntual», no «sube»', () => {
    const { tipo, referencia } = clasificarMes(20000, estable);
    expect(tipo).toBe('puntual');
    expect(referencia.referencia).toBe(mediana(estable));
  });

  it('un mes dentro de lo habitual es «normal»', () => {
    expect(clasificarMes(3700, estable).tipo).toBe('normal');
  });

  it('una subida que se repite dos meses de los últimos tres es «sube»', () => {
    // Previos estables y luego dos meses altos seguidos.
    const previos = [...estable, 9000];
    expect(clasificarMes(9500, previos).tipo).toBe('sube');
  });

  it('una tendencia real al alza se detecta como «sube»', () => {
    const previos = tendencia.slice(0, 5);
    expect(clasificarMes(9000, previos).tipo).toBe('sube');
  });

  it('un mes a 0 aislado es «normal», dos de tres por debajo es «baja»', () => {
    expect(clasificarMes(0, estable).tipo).toBe('normal');
    expect(clasificarMes(0, [...estable, 0]).tipo).toBe('baja');
  });

  it('los meses iniciales sin dato no cuentan como meses a 0', () => {
    expect(recortarInicioSinDatos([0, 0, 5, 0, 7])).toEqual([5, 0, 7]);
    expect(recortarInicioSinDatos([0, 0])).toEqual([]);
    // Categoría nueva: 9 meses sin nada y luego 3 meses de 30-35 €.
    const previos = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3000, 3500, 3200];
    const { tipo, referencia } = clasificarMes(3300, previos);
    expect(referencia.referencia).toBe(3200);
    expect(tipo).toBe('normal');
    expect(clasificarMes(20000, previos).tipo).toBe('puntual');
  });

  it('el atípico de los previos no infla la referencia al clasificar', () => {
    const { tipo, referencia } = clasificarMes(3500, conAtipico);
    expect(tipo).toBe('normal');
    expect(referencia.referencia).toBeLessThan(3600);
  });
});
