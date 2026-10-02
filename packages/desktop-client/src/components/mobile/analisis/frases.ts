import type { Consejo, FilaPropuesta } from './motor';

/**
 * Redacción de los consejos: del dato tipado del motor a título y texto en
 * el idioma de la app. Las claves están en inglés (como todo el código) y se
 * traducen en `src/locale-overrides/es.json`. Los importes llegan en
 * céntimos y se formatean con `fmt` (useFormat).
 */

export type Redactor = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** Céntimos → «140,00 €». */
  fmt: (centimos: number) => string;
  /** Fracción → «+12 %». */
  pct: (fraccion: number, conSigno?: boolean) => string;
  nombreDe: (categoria: string | null) => string;
  nombrePayee: (payee: string | null) => string;
  /** 'yyyy-MM' → «agosto». */
  nombreMes: (mes: string) => string;
};

export type Texto = { titulo: string; texto: string };

function nombreOrigen(r: Redactor, desde: string | 'to-budget'): string {
  return desde === 'to-budget' ? r.t('To Budget') : r.nombreDe(desde);
}

export function redactar(consejo: Consejo, r: Redactor): Texto {
  const { t, fmt, pct } = r;
  const d = consejo.datos;
  const nombre = consejo.categoria ? r.nombreDe(consejo.categoria) : '';
  switch (d.tipo) {
    case 'infrapresupuestada': {
      const base = t(
        'In {{category}} you budget {{budgeted}} but end up spending about {{usual}} ({{count}} of the last {{total}} months).',
        {
          category: nombre,
          budgeted: fmt(d.presupuestado),
          usual: fmt(d.habitual),
          count: d.mesesSobre,
          total: d.meses,
        },
      );
      const origen = d.origen
        ? ' ' +
          t('The extra usually comes from {{source}} ({{amount}} a month).', {
            source: nombreOrigen(r, d.origen.desde),
            amount: fmt(d.origen.habitual),
          })
        : '';
      return {
        titulo: t('{{category}} needs more', { category: nombre }),
        texto: `${base}${origen} ${t('Suggested: {{amount}}.', { amount: fmt(d.propuesto) })}`,
      };
    }
    case 'sobrepresupuestada':
      return {
        titulo: t('Is {{category}} budgeted right?', { category: nombre }),
        texto:
          d.sinGasto && d.habitual === 0
            ? t(
                '{{count}} months with {{budgeted}} in {{category}} and nothing spent, not even before. Does it still need money? Suggested: {{amount}}.',
                {
                  count: d.mesesBajo,
                  budgeted: fmt(d.presupuestado),
                  category: nombre,
                  amount: fmt(d.propuesto),
                },
              )
            : d.sinGasto
              ? t(
                  '{{count}} months with {{budgeted}} in {{category}} and nothing spent. You used to spend {{usual}}; suggested: {{amount}}.',
                  {
                    count: d.mesesBajo,
                    budgeted: fmt(d.presupuestado),
                    category: nombre,
                    usual: fmt(d.habitual),
                    amount: fmt(d.propuesto),
                  },
                )
              : t(
                  'You budget {{budgeted}} for {{category}} but spend under half of it ({{count}} of the last {{total}} months). You usually spend {{usual}}; suggested: {{amount}}.',
                  {
                    budgeted: fmt(d.presupuestado),
                    category: nombre,
                    count: d.mesesBajo,
                    total: d.meses,
                    usual: fmt(d.habitual),
                    amount: fmt(d.propuesto),
                  },
                ),
      };
    case 'sin-asignar':
      return {
        titulo: t('{{category}} has no budget', { category: nombre }),
        texto: t(
          'You never assign money to {{category}} but spend about {{usual}} a month ({{count}} of the last {{total}} months). Suggested target: {{amount}} a month.',
          {
            category: nombre,
            usual: fmt(d.habitual),
            count: d.mesesConGasto,
            total: d.meses,
            amount: fmt(d.propuesto),
          },
        ),
      };
    case 'estacionalidad':
      return {
        titulo: t('{{month}}: {{category}} is usually higher', {
          month: r.nombreMes(d.mes),
          category: nombre,
        }),
        texto: t(
          'In {{month}} {{category}} is usually {{pct}} above your yearly usual ({{usualMonth}} vs {{usualYear}}, {{years}} years). You have {{budgeted}} set aside; prepare {{amount}}.',
          {
            month: r.nombreMes(d.mes),
            category: nombre,
            pct: pct(d.pct),
            usualMonth: fmt(d.habitualMes),
            usualYear: fmt(d.habitualAnual),
            years: d.anos,
            budgeted: fmt(d.presupuestado),
            amount: fmt(d.propuesto),
          },
        ),
      };
    case 'tendencia': {
      const base =
        d.sentido === 'sube'
          ? t(
              '{{category}} was {{amount}} in {{month}}, {{diff}} above your usual {{usual}}, and it has been above it for 3 months: about {{level}} a month now.',
              {
                category: nombre,
                amount: fmt(d.actual),
                month: r.nombreMes(d.mes),
                diff: d.pct === null ? fmt(d.desviacion) : pct(d.pct),
                usual: fmt(d.habitual),
                level: fmt(d.nivel),
              },
            )
          : t(
              '{{category}} was {{amount}} in {{month}}, {{diff}} below your usual {{usual}}, and it keeps falling: about {{level}} a month now.',
              {
                category: nombre,
                amount: fmt(d.actual),
                month: r.nombreMes(d.mes),
                diff: d.pct === null ? fmt(-d.desviacion) : pct(-d.pct, false),
                usual: fmt(d.habitual),
                level: fmt(d.nivel),
              },
            );
      const propuesta =
        d.propuesto === null
          ? ''
          : ' ' +
            t('You budget {{budgeted}}; suggested: {{amount}}.', {
              budgeted: fmt(d.presupuestado),
              amount: fmt(d.propuesto),
            });
      return {
        titulo:
          d.sentido === 'sube'
            ? t('{{category}} keeps rising', { category: nombre })
            : t('{{category}} keeps falling', { category: nombre }),
        texto: `${base}${propuesta}`,
      };
    }
    case 'ingresos': {
      const payee = r.nombrePayee(d.payee);
      const cabecera =
        d.diferencia > 0
          ? t(
              'Your income from {{payee}} is up {{diff}} ({{before}} → {{after}} a month).',
              {
                payee,
                diff: fmt(d.diferencia),
                before: fmt(d.antes),
                after: fmt(d.ahora),
              },
            )
          : t(
              'Your income from {{payee}} is down {{diff}} ({{before}} → {{after}} a month).',
              {
                payee,
                diff: fmt(-d.diferencia),
                before: fmt(d.antes),
                after: fmt(d.ahora),
              },
            );
      const destino =
        d.diferencia > 0
          ? t(
              'Of that, spending went up {{spending}} and savings {{savings}}.',
              {
                spending: fmt(d.aGasto),
                savings: fmt(d.aAhorro),
              },
            )
          : t(
              'Since then, spending changed {{spending}} and savings {{savings}}.',
              {
                spending: fmt(d.aGasto),
                savings: fmt(d.aAhorro),
              },
            );
      return {
        titulo:
          d.diferencia > 0
            ? t('Your income went up')
            : t('Your income went down'),
        texto: `${cabecera} ${destino}`,
      };
    }
    case 'tasa-ahorro':
      return {
        titulo:
          d.tasa < d.tasaHabitual
            ? t('You saved less in {{month}}', { month: r.nombreMes(d.mes) })
            : t('You saved more in {{month}}', { month: r.nombreMes(d.mes) }),
        texto: t(
          'Savings rate in {{month}}: {{rate}} ({{saved}} of {{income}}); your usual over 12 months is {{usual}}.',
          {
            month: r.nombreMes(d.mes),
            rate: pct(d.tasa, false),
            saved: fmt(d.ahorro),
            income: fmt(d.ingresos),
            usual: pct(d.tasaHabitual, false),
          },
        ),
      };
    case 'traspasos':
      return {
        titulo: t('{{to}} gets money from {{from}}', {
          to: r.nombreDe(d.hacia),
          from: nombreOrigen(r, d.desde),
        }),
        texto: t(
          '{{to}} received money from {{from}} in {{count}} of the last {{total}} months, about {{amount}} each time. Maybe its budget should be higher.',
          {
            to: r.nombreDe(d.hacia),
            from: nombreOrigen(r, d.desde),
            count: d.meses,
            total: d.de,
            amount: fmt(d.habitual),
          },
        ),
      };
    default:
      return { titulo: '', texto: '' };
  }
}

/** Etiqueta del botón de acción de un consejo. */
export function textoAccion(consejo: Consejo, r: Redactor): string | null {
  const { accion } = consejo;
  if (!accion) {
    return null;
  }
  if (accion.tipo === 'fijar-objetivo') {
    return r.t('Set target to {{amount}}', { amount: r.fmt(accion.importe) });
  }
  return r.t('Budget {{amount}} in {{month}}', {
    amount: r.fmt(accion.importe),
    month: r.nombreMes(accion.mes),
  });
}

/** Motivo de una fila de la propuesta («lo habitual», «estacional»…). */
export function textoMotivo(fila: FilaPropuesta, r: Redactor): string {
  switch (fila.motivo) {
    case 'habitual':
      return r.t('Usual: {{amount}}', { amount: r.fmt(fila.habitual) });
    case 'tendencia':
      return r.t('Last 3 months: {{amount}}', {
        amount: r.fmt(fila.propuesto),
      });
    case 'irregular':
      return r.t('Irregular: 12-month average');
    case 'estacional':
      return r.t('Seasonal month');
    case 'objetivo':
      return r.t('Kept: savings target');
    case 'sin-datos':
      return r.t('Kept: not enough history');
    default:
      return '';
  }
}
