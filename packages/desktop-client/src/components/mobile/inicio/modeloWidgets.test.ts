import {
  anadirWidget,
  cambiarTamano,
  escribirWidgets,
  leerWidgets,
  moverWidget,
  quitarWidget,
  reordenarWidget,
  WIDGETS_POR_DEFECTO,
  widgetsDisponibles,
} from './modeloWidgets';
import type { WidgetInicio } from './modeloWidgets';

const ids = (lista: readonly WidgetInicio[]) => lista.map(w => w.id);

describe('modelo de widgets del inicio', () => {
  describe('leerWidgets', () => {
    it('sin preferencia (o ilegible) da el orden por defecto del concepto A', () => {
      expect(leerWidgets(undefined)).toEqual(WIDGETS_POR_DEFECTO);
      expect(leerWidgets('')).toEqual(WIDGETS_POR_DEFECTO);
      expect(leerWidgets('{no es json')).toEqual(WIDGETS_POR_DEFECTO);
      expect(leerWidgets('{"id":"fijadas"}')).toEqual(WIDGETS_POR_DEFECTO);
      expect(ids(WIDGETS_POR_DEFECTO)).toEqual([
        'por-hacer',
        'fijadas',
        'cuenta-comun',
        'consejos',
        'resumen-mes',
      ]);
    });

    it('una lista vacía es válida (lo ha quitado todo)', () => {
      expect(leerWidgets('[]')).toEqual([]);
    });

    it('descarta ids desconocidos y repetidos; tamaño desconocido → normal', () => {
      const raw = JSON.stringify([
        { id: 'deudas', tamano: 'grande' },
        { id: 'inventado', tamano: 'normal' },
        { id: 'deudas', tamano: 'compacto' },
        { id: 'fijadas', tamano: 'gigante' },
        'huchas',
        null,
      ]);
      expect(leerWidgets(raw)).toEqual([
        { id: 'deudas', tamano: 'grande' },
        { id: 'fijadas', tamano: 'normal' },
        { id: 'huchas', tamano: 'normal' },
      ]);
    });

    it('ida y vuelta con escribirWidgets', () => {
      const lista: WidgetInicio[] = [
        { id: 'gasto-mes', tamano: 'compacto' },
        { id: 'por-hacer', tamano: 'grande' },
      ];
      expect(leerWidgets(escribirWidgets(lista))).toEqual(lista);
    });
  });

  describe('reordenar', () => {
    const base = leerWidgets(undefined);

    it('mueve con las flechas y no se sale de los bordes', () => {
      expect(ids(moverWidget(base, 'fijadas', -1)).slice(0, 2)).toEqual([
        'fijadas',
        'por-hacer',
      ]);
      expect(moverWidget(base, 'por-hacer', -1)).toEqual(base);
      expect(moverWidget(base, 'resumen-mes', 1)).toEqual(base);
      expect(moverWidget(base, 'deudas', 1)).toEqual(base);
    });

    it('arrastrar y soltar antes o después de otro widget', () => {
      expect(
        ids(reordenarWidget(base, 'resumen-mes', 'por-hacer', 'before')),
      ).toEqual([
        'resumen-mes',
        'por-hacer',
        'fijadas',
        'cuenta-comun',
        'consejos',
      ]);
      expect(
        ids(reordenarWidget(base, 'por-hacer', 'cuenta-comun', 'after')),
      ).toEqual([
        'fijadas',
        'cuenta-comun',
        'por-hacer',
        'consejos',
        'resumen-mes',
      ]);
      // Sobre sí mismo o sobre uno que no está: sin cambios.
      expect(reordenarWidget(base, 'fijadas', 'fijadas', 'after')).toEqual(
        base,
      );
      expect(reordenarWidget(base, 'fijadas', 'deudas', 'after')).toEqual(base);
    });

    it('no muta la lista original', () => {
      const copia = JSON.parse(JSON.stringify(base));
      moverWidget(base, 'fijadas', 1);
      reordenarWidget(base, 'fijadas', 'resumen-mes', 'after');
      expect(base).toEqual(copia);
    });
  });

  describe('añadir, quitar y tamaño', () => {
    const base = leerWidgets(undefined);

    it('añadir pone al final (o en la posición) y no duplica', () => {
      expect(anadirWidget(base, 'deudas').at(-1)).toEqual({
        id: 'deudas',
        tamano: 'normal',
      });
      expect(ids(anadirWidget(base, 'huchas', 'compacto', 0))[0]).toBe(
        'huchas',
      );
      expect(anadirWidget(base, 'fijadas')).toEqual(base);
    });

    it('quitar lo saca y vuelve a estar disponible', () => {
      const sin = quitarWidget(base, 'consejos');
      expect(ids(sin)).not.toContain('consejos');
      expect(widgetsDisponibles(sin)).toContain('consejos');
      expect(widgetsDisponibles(base)).toEqual([
        'deudas',
        'gasto-mes',
        'huchas',
      ]);
    });

    it('cambiar el tamaño solo afecta a ese widget', () => {
      const lista = cambiarTamano(base, 'fijadas', 'grande');
      expect(lista.find(w => w.id === 'fijadas')?.tamano).toBe('grande');
      expect(lista.filter(w => w.tamano === 'grande')).toHaveLength(1);
    });
  });
});
