# «Asignar el mes» y objetivos de categoría (estilo YNAB)

Dos pantallas móviles nuevas, calcadas de «Assign Money» y «Edit Target» de YNAB, sobre las plantillas
de Actual (`#template …` en la nota de la categoría; sintaxis en
`packages/docs/docs/experimental/goal-templates.md`). Código en
`packages/desktop-client/src/components/mobile/budget/`.

## Asignar el mes (`/asignar?month=AAAA-MM`, `AsignarMesPage.tsx`)

- Entradas: botón «Asignar» del Inicio y «Listo para asignar» de la pestaña Presupuesto (el resumen del mes
  de Actual sigue en el menú «⋯» de la cabecera).
- Cabecera verde: «Listos para asignar» (`to-budget` de la hoja) y «X en categorías infrafinanciadas»:
  suma de lo que falta en cada categoría = objetivo − asignado (o objetivo − saldo si la plantilla es
  `#goal`). Cálculo en `objetivos.ts` (`faltante`, `estadoFila`), con tests.
- Al abrir la pantalla (y al cambiar de mes) se llama a `budget/refresh-goals` para que el objetivo del
  mes (`goal-<cat>` / `long-goal-<cat>`) esté calculado sin tener que «aplicar plantillas».
- «Auto-asignar por…»: Infrafinanciadas (reparte lo disponible de arriba abajo, en cliente, y lo manda en
  una sola acción `budget/budget-amounts` → un solo «Deshacer»), Asignado el mes pasado (`copy-last`),
  Promedio de 3 meses (`set-3-avg`), Gastado el mes pasado (lee `envelope-budget-month` del mes anterior
  y manda `budget-amounts`).
- Filas: nombre, asignado, barra y estado («Financiada», «Totalmente gastada», «Financiada. Gastados X de
  Y», «Faltan X antes del día N» / «Faltan X este mes», «Sin objetivo», «Sobregastada en X»). Tocar una
  fila abre el teclado inline existente (`AssignKeypad`) con la fila de acciones sustituida por
  «Asignar X — Importe infrafinanciado» y «⋯ Más» (Mover dinero, Objetivo, Detalles).
- En la pestaña Presupuesto, bajo el disponible de cada categoría, aparece «Faltan X» cuando procede
  (`EstadoObjetivoCorto.tsx`).

## Editar objetivo (`/categories/:id/objetivo?month=…`, `ObjetivoPage.tsx`)

Accesible desde la ficha de categoría (botón «Objetivo», que enseña el resumen actual) y desde «⋯ Más»
del teclado. Solo los tipos que usa Vadym:

| Pestaña     | Opciones                                                    | Nota de la categoría                                             |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Cada mes    | Necesito X · antes del día N · apartar / rellenar           | `#template X` o `#template up to X` (+ `#objetivo día N`)        |
| Cada semana | Necesito X · apartar / rellenar                             | `#template X repeat every week starting …` / `up to X per week…` |
| Cada año    | Necesito X · antes del D/M/AAAA · cada año/2 años/6/3 meses | `#template X by AAAA-MM repeat every …` + `#objetivo fecha …`    |
| Una vez     | Necesito X para el D/M/AAAA                                 | `#template X by AAAA-MM` + `#objetivo fecha AAAA-MM-DD`          |

- La **nota manda**: al guardar se sustituyen las líneas `#template`/`#goal`/`#objetivo` de la nota, se
  parsea con `budget/store-note-templates` (el parser de Actual escribe `goal_def`) y se recalcula el
  objetivo con `budget/refresh-goals`. Si la categoría estaba en modo «UI de automatizaciones», se
  devuelve al modo notas. Así lo importado de YNAB y lo editado aquí usan el mismo mecanismo.
- `#objetivo día N` / `#objetivo fecha …` es una línea propia (Actual la ignora) que guarda lo que la
  plantilla no sabe representar: el día dentro del mes solo cambia el texto «Faltan X antes del día N».
- «Tendencias»: media de gasto de los últimos 12 meses y gasto del mes pasado (de las transacciones de la
  categoría); tocar el importe lo pone en «Necesito».
- Para «cada año» y «una vez» se enseña la cuota aproximada al mes: (importe − saldo) / meses que quedan.
- Plantillas que esta pantalla no sabe editar (`#goal`, porcentajes, varias líneas…) se marcan como
  «Automatización avanzada»; guardar aquí las sustituye.

## Ignorar este mes (`#ignorar-mes`, el *snooze* de YNAB)

«Si algo ya está cubierto, pero no llega a lo planeado, que pueda ignorarlo este mes.»

- Estado por categoría y mes: una línea `#ignorar-mes` en la **nota de mes** de la categoría (id
  `<categoría>-<AAAA-MM>`, tabla `notes`, la misma nota que Actual edita desde el menú de la celda).
  Solo afecta a ese mes y no toca la plantilla ni el objetivo. Funciones puras en `objetivos.ts`
  (`notaIgnoraMes`, `notaConIgnorarMes`, `categoriasIgnoradas`); hook `useIgnorarMes(categoryId, month)`.
- Efecto (`faltante` devuelve 0 si `ignorada`): no cuenta en «X en categorías infrafinanciadas» ni en
  «Auto-asignar → Infrafinanciadas»; la fila de Asignar el mes enseña «zZ Ignorada este mes» en gris; en
  la pestaña Presupuesto el texto corto pasa a «Ignorada este mes» y el disponible deja de ir en ámbar
  (`BalanceWithCarryover` recibe `goalIgnored`), también en las fijadas del Inicio. Sobregastada manda:
  ignorar solo quita el aviso de infrafinanciada.
- UI: conmutador «Ignorar este mes (octubre)» en `ObjetivoPage` (debajo del objetivo, solo si hay
  objetivo) y en el menú «⋯ Más» del teclado de Asignar.
- Tests en `objetivos.test.ts` (bloque «ignorar este mes»).

Capturas en `capturas/ignorar-mes.png` (Asignar el mes), `ignorar-mes-mas.png` (menú del teclado),
`ignorar-mes-objetivo.png` (conmutador) y `ignorar-mes-presupuesto.png` (pestaña Presupuesto).

Capturas en `capturas/asignar-mes*.png`, `objetivo-editar*.png`, `objetivo-ficha.png`,
`presupuesto-faltan.png` (presupuesto demo, 390×844).
