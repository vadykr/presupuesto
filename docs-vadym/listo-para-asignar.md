# «Listo para asignar» como en YNAB

## El problema

YNAB calcula «Listo para asignar» (Ready to Assign) del mes M descontando **también lo que ya está
asignado en meses posteriores**. Actual solo descuenta lo asignado hasta M. Con el mismo presupuesto,
si en noviembre ya hay dinero repartido, Actual muestra en octubre ese dinero como disponible y YNAB no.
Al pasar de uno a otro parece que «ha aparecido» dinero.

## Cómo lo calcula Actual (hoja de cálculo del presupuesto por sobres)

`packages/loot-core/src/server/budget/envelope.ts`, `createSummary`, una hoja por mes (`budget202610`):

```
from-last-month   = mes anterior!to-budget + mes anterior!buffered-selected
available-funds   = total-income + from-last-month
to-budget         = available-funds + last-month-overspent + total-budgeted − buffered-selected
```

(`total-budgeted` ya va con signo negativo.)

## Qué cambia en el fork

Detrás de la constante `RTA_COMO_YNAB` (`packages/loot-core/src/shared/presupuesto.ts`, `true`):

```
to-budget-local   = la fórmula original de Actual (sin tocar)
future-budgeted   = mes siguiente!total-budgeted + mes siguiente!future-budgeted
to-budget         = to-budget-local + future-budgeted        (si RTA_COMO_YNAB)
                  = to-budget-local                          (si no)
from-last-month   = mes anterior!to-budget-local + mes anterior!buffered-selected
```

- `future-budgeted` se encadena mes a mes hacia delante; en el último mes cargado la hoja siguiente no
  existe, sus celdas valen `null` → 0. Cuando Actual crea más meses (siempre crea hasta 12 por delante
  del actual) la cadena se extiende sola.
- `from-last-month` pasa a arrastrar `to-budget-local`: si arrastrara el `to-budget` descontado, cada
  mes volvería a descontar lo asignado en el siguiente (doble descuento).
- Todo lo que mostraba o usaba `to-budget` (móvil, `/inicio`, cubrir sobregasto, mover desde «Listo para
  asignar», plantillas con prioridad) ve ya el valor al estilo YNAB sin cambios.
- Con `RTA_COMO_YNAB = false` la celda `to-budget` vuelve a ser idéntica a la original.

Prueba: `packages/loot-core/src/server/budget/envelope.test.ts`.

## Lo que no cambia

- El desglose del resumen de escritorio (fondos disponibles, sobregasto, asignado, para el mes
  siguiente) sigue mostrando las piezas de `to-budget-local`; la cifra grande de «Listo para asignar»
  es la descontada, así que la suma del desglose puede no coincidir con ella en el mes actual. No se ha
  añadido una fila «Asignado en meses futuros» para tocar lo mínimo.
- El «para el mes siguiente» (`buffered`/hold) de Actual sigue existiendo y es independiente.
