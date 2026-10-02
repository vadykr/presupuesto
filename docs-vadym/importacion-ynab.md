# Importación desde YNAB: qué se traduce y cómo

El importador de Actual (`packages/loot-core/src/server/importers/ynab5.ts`) lee la exportación de la
API de YNAB (`data.budget` o `data.plan`). Este fork añade tres cosas: saldos de préstamo fieles (ver
[prestamos.md](prestamos.md)), objetivos como plantillas y «Listo para asignar» al estilo YNAB.

## Objetivos → plantillas de Actual

Actual no tiene «objetivos» como YNAB; tiene **plantillas** (`#template …`) y un indicador de objetivo
(`#goal …`) escritos en la nota de la categoría (documentación: `packages/docs/docs/experimental/goal-templates.md`).
Al importar, cada categoría con `goal_type` recibe en su nota la línea equivalente, después de la nota
que tuviera en YNAB. La traducción está en `ynab5-objetivos.ts` (`plantillasDeObjetivo`).

`X` es `goal_target` pasado de milésimas a euros (246720 → `246.72`).

| YNAB (`goal_type`, cadencia)                                            | Plantilla de Actual                                             | Observaciones                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **MF** Monthly Funding                                                  | `#template X`                                                   | Equivalente exacto.                                                                           |
| **DEBT** pago de deuda                                                  | `#template X`                                                   | X = cuota mensual que pedía YNAB. La deuda en sí va en la nota de la cuenta (`#prestamo`).    |
| **TB** Target Balance sin fecha                                         | `#goal X`                                                       | Solo indicador (verde/naranja según el saldo); no asigna nada automáticamente.                |
| **TBD** Target Balance by Date                                          | `#template X by YYYY-MM`                                        | Reparte lo que falta entre los meses que quedan. Sin `goal_target_month` → `#goal X`.         |
| **NEED** mensual, «Set aside another» (`goal_needs_whole_amount: true`) | `#template X`                                                   | Equivalente exacto.                                                                           |
| **NEED** mensual, «Refill up to» (`goal_needs_whole_amount: false`)     | `#template up to X`                                             | Rellena hasta X. Actual quita el sobrante por encima de X al aplicar; YNAB no (ver abajo).    |
| **NEED** cada N meses (`goal_cadence: 1`, `goal_cadence_frequency: N`)  | `#template X repeat every N months starting YYYY-MM-01`         | Inicio = `goal_creation_month`.                                                               |
| **NEED** semanal (`goal_cadence: 2`)                                    | `#template X repeat every [N] week(s) starting YYYY-MM-DD`      | Inicio = primer día con el día de la semana `goal_day` desde el mes de creación.              |
| **NEED** anual con fecha (`goal_cadence: 13`, «Factures Anuals»)        | `#template X by YYYY-MM repeat every year`                      | `YYYY-MM` = mes de `goal_target_month`. `goal_cadence_frequency: 2` → `repeat every 2 years`. |
| **NEED** anual sin fecha                                                | `#template X by (creación + 12·N meses) repeat every N year(s)` | Aproximación: YNAB no da el mes objetivo.                                                     |
| **NEED** cada 2 años (`goal_cadence: 14`)                               | `#template X by YYYY-MM repeat every 2 years`                   | Cadencia heredada de YNAB.                                                                    |
| **NEED** cada N meses heredado (`goal_cadence` 3-12)                    | `#template X by YYYY-MM repeat every N months` o periódica      | Según haya o no `goal_target_month`.                                                          |
| **NEED** una sola vez (`goal_cadence: 0`) con fecha                     | `#template X by YYYY-MM`                                        | Sin fecha → `#goal X`.                                                                        |

Después de importar las notas, el importador:

1. guarda las plantillas en `categories.goal_def` (`budget/store-note-templates`, lo mismo que hace
   Actual al aplicar plantillas);
2. calcula el **objetivo del mes actual** sin tocar lo presupuestado (`budget/refresh-goals`, método
   nuevo del fork), para que la columna de objetivo/infrafinanciado aparezca desde el primer día;
3. activa la opción `flags.goalTemplatesEnabled` en el presupuesto importado. Además, el fork la tiene
   activada por defecto (`packages/desktop-client/src/hooks/useFeatureFlag.ts`), así que se ve también
   en presupuestos que no vengan de YNAB.

### Lo que no tiene equivalente exacto

- **`goal_day` en objetivos mensuales** («by the 15th»): Actual no tiene fecha dentro del mes. Se ignora
  (el objetivo es «este mes»).
- **Refill up to**: YNAB nunca retira dinero de la categoría; Actual, al **aplicar** la plantilla
  `up to X`, puede devolver el sobrante a «Listo para asignar». Mientras no se apliquen plantillas (solo
  se mira el indicador), no hay diferencia. Si molesta, cambiar a mano por `#template up to X hold`.
- **Objetivos pospuestos** (`goal_snoozed_at`), **porcentaje completado**, **meses que faltan**: YNAB los
  calcula; Actual los deduce de la plantilla al aplicarla. No se importan.
- **Indicador «infrafinanciado»**: en Actual el objetivo de cada categoría/mes se recalcula solo al
  aplicar plantillas (o con el `refresh-goals` del importador para el mes actual). En meses posteriores
  aparecerá al abrir «Aplicar plantillas» o al refrescar; no es «en vivo» como en YNAB.
- **TB** (saldo objetivo sin fecha): YNAB sugiere asignar la diferencia; en Actual `#goal` solo colorea.
- Las categorías de tarjetas de crédito y la categoría interna de YNAB no se importan (ya era así).

## «Listo para asignar» como en YNAB

Ver la sección correspondiente en [listo-para-asignar.md](listo-para-asignar.md).
