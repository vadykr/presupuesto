# Préstamos: qué importa de YNAB y dónde queda guardado

Base para la fase 4 del [plan](../PLAN.md) (hipoteca y coche con interés, cuota y fecha).

## El problema con los saldos de YNAB

En YNAB las cuentas de préstamo (`type` = `mortgage`, `autoLoan`, `studentLoan`, `personalLoan`,
`medicalDebt`, `otherDebt`) acumulan intereses «virtuales»: el saldo de la cuenta (`account.balance`)
crece cada mes sin que exista un movimiento. Por eso, en la exportación de la API:

- `account.balance` ≠ suma de `transactions[].amount` de esa cuenta;
- una cuenta cerrada puede tener `balance = 0` y una suma de movimientos distinta de 0.

Actual calcula el saldo solo con movimientos, así que al importar tal cual los préstamos salían con
menos deuda de la real y las cuentas cerradas con saldo residual.

## Qué hace ahora el importador (`ynab5.ts` + `ynab5-prestamos.ts`)

Para **cada cuenta** (no solo préstamos) compara el saldo de YNAB con la suma de los movimientos
importados, redondeando movimiento a movimiento como hace el importador (milésimas → céntimos). Si no
cuadran, añade **un movimiento de ajuste**:

| Campo        | Préstamos                                                                               | Resto de cuentas                                                                  |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Importe      | `balance` − suma de movimientos                                                         | igual                                                                             |
| Fecha        | la del último movimiento de la cuenta; si no hay, día 1 de `last_month` del presupuesto | igual                                                                             |
| Beneficiario | «Intereses del préstamo» (se crea si no existe)                                         | «Ajuste de saldo» (se crea si no existe)                                          |
| Categoría    | ninguna                                                                                 | ninguna (si la cuenta está en presupuesto, queda «sin categoría» para que se vea) |
| Nota         | «Intereses acumulados en YNAB hasta la importación»                                     | «Ajuste para cuadrar con el saldo de YNAB»                                        |

Las cuentas con `closed: true` se crean ya cerradas (`api/account-create` acepta `closed` y no exige
saldo 0); con el ajuste quedan a 0 igual que en YNAB.

## Datos de deuda: nota de la cuenta

La cuenta no tiene campos para interés o cuota en Actual, y las notas de cuenta ya existen (tabla
`notes`, `id` = id de la cuenta; en móvil se ven y editan desde la cuenta). Se eligió guardar los
datos ahí en lugar de crear una tabla `loans` nueva: no hace falta migración ni tocar el esquema AQL,
y el dato es visible y editable a mano. Si en la fase 4 hiciera falta histórico de tipos o más campos,
se puede pasar a una tabla aditiva sin perder nada (la nota se puede leer y volcar).

Formato: una línea que empieza por `#prestamo` seguida de un JSON en una sola línea. Si la cuenta tenía
nota en YNAB, va antes.

```
Nota que tenía en YNAB
#prestamo {"tipo":"autoLoan","interes_anual":8.72,"cuota_minima":246.72,"desde":"2026-07-01"}
```

| Clave           | Significado                                                                    | Origen en YNAB                                                |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `tipo`          | tipo de cuenta de YNAB                                                         | `account.type`                                                |
| `interes_anual` | TAE nominal anual en % (8.72 = 8,72 %), `null` si no consta                    | último valor de `debt_interest_rates` (milésimas de %)        |
| `cuota_minima`  | cuota mínima mensual en euros, `null` si no consta                             | último valor de `debt_minimum_payments` (milésimas)           |
| `desde`         | fecha (`YYYY-MM-DD`, día 1) desde la que rigen interés y cuota actuales        | clave más reciente de `debt_interest_rates` (o de las cuotas) |
| `escrow`        | (opcional) importe mensual de plica/escrow en euros, solo si YNAB lo tenía ≠ 0 | último valor de `debt_escrow_amounts`                         |

Solo se guarda el **último** valor de cada serie; el histórico de tipos de YNAB no se conserva
(`debt_original_balance` venía siempre `null` en la exportación).

Lectura en código: `leerDatosPrestamo(note)` en
`packages/loot-core/src/server/importers/ynab5-prestamos.ts` devuelve el objeto o `null`. La fase 4
puede usarlo tal cual o moverlo a un módulo común.

## Fase 4: pantalla de deuda (rama `claude/deudas`)

- `leerDatosPrestamo` / `escribirDatosPrestamo` y el tipo `DatosPrestamo` viven ahora en
  `packages/loot-core/src/shared/prestamos.ts` (el importador los reexporta). Clave opcional nueva:
  `saldo_inicial` (euros, positivo) para fijar la deuda inicial a mano.
- La nota de cuenta se guarda con id `account-<id>` (el que lee la interfaz). Antes el importador la
  guardaba con el id de la cuenta y no se veía; la pantalla de deuda lee ambos.
- `mobile/deudas/`: `amortizacion.ts` (método francés, interés mensual = anual/12, `simularExtra`),
  `movimientosDeuda.ts` (saldo inicial, pagado, reparto interés/capital de cada letra), `DeudaPage.tsx`
  (cabecera + pestañas Deuda/Movimientos), `SimuladorPage.tsx`, `FormularioPrestamo.tsx`.
- Ruta: la de siempre `/accounts/:id`; `?vista=simulador` abre el simulador y `?prestamo=1` el formulario
  (menú de cuenta → «Marcar como préstamo» / «Datos del préstamo»).
- Reparto de una letra: interés = el movimiento «Intereses del préstamo» del mes si existe; si no,
  deuda anterior × interés / 12. «Registrar intereses del mes» crea ese movimiento (importe = deuda × i/12).
- Capturas: `capturas/deuda*.png` (390×844, presupuesto demo).
