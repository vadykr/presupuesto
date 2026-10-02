# Gasto anual (`/anual`)

Punto 12 del plan: lo que se paga una vez al año (IBI, seguro del coche, ITV, mantenimiento, YNAB…) se ve
**aparte** del presupuesto mensual. Código en `packages/desktop-client/src/components/mobile/anual/`.

## Qué entra

- Categorías cuyo objetivo es **anual** (`#template X by AAAA-MM repeat every year`, o cada 2 años / 6 / 3
  meses) o **una vez** (`by` sin repetición); se leen de `goal_def` + la marca `#objetivo fecha …` de la nota,
  con `objetivoDesdePlantillas` (`budget/objetivos.ts`).
- Todas las categorías de los grupos marcados por el usuario (pref sincronizada `anual-grupos`, JSON array de
  ids; selector con el botón de ajustes de la cabecera). Sin objetivo con fecha salen como «Sin objetivo» al
  final («Sin fecha»).
- Se ignoran grupos y categorías ocultos y los de ingresos.

## Cálculo (`anual.ts`, con tests en `anual.test.ts`)

Todo con el mes **actual**: ahorrado = disponible (`leftover`), asignado y actividad de la hoja de ese mes.

- **Vencimiento**: la fecha guardada avanza de `cadaMeses` en `cadaMeses` hasta que su mes no sea anterior al
  actual (como la plantilla `by … repeat`). Si ya venció y se ha gastado algo este mes, se da por pagada y
  pasa al siguiente. Una vez vencida y pagada (o sin saldo) desaparece.
- **Cuota mensual** = `cuotaMensual(importe, saldo antes de asignar este mes, vence, mes actual)`: no cambia al
  asignar. «Toca este mes» = cuota − asignado (nunca más de lo que falta en total).
- **Estado**: «Cubierta» (gris, ahorrado ≥ importe) · «Al día» (verde, lo asignado cubre la cuota) ·
  «Faltan X este mes» (ámbar) · «Atrasada: faltan X» (rojo, el vencimiento pasó y no llega).
- **Totales**: ahorrado / objetivo de lo que vence en los próximos 12 meses y «este mes toca X».
- Agrupado por mes de vencimiento, en orden cronológico desde el actual.

Tocar una categoría abre su `ObjetivoPage`.

## Plegar en el Plan

Pref sincronizada `anual-ocultar-en-plan` (`'true'`/`'false'`), con el interruptor de la página Anual. Activada,
el Plan (`budget/BudgetTable.tsx`) quita por id las categorías anuales «al día» o «cubiertas» (un grupo que se
queda sin categorías desaparece) y añade al final el bloque `AnualPlegado`: «Anual · al día (N)» con lo
ahorrado; tocarlo abre `/anual`. Las atrasadas o infrafinanciadas siguen en su sitio.

## Accesos

- Botón de calendario en la cabecera del Plan (a la derecha de la navegación de mes; `NavegadorMes` gana la
  prop `derecha`).
- «Gasto anual» en `/mas`.

Capturas en `capturas/anual*.png` (390×844, presupuesto demo con IBI, seguro del coche, ITV y YNAB creados
desde `ObjetivoPage` y el grupo «Factures Anuals» marcado).
