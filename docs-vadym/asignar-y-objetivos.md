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
- «Auto-asignar por…» (cada opción con su importe total, como YNAB): Infrafinanciadas (reparte lo
  disponible de arriba abajo, en cliente), Reducir sobrefinanciación (deja cada categoría en su
  objetivo), Asignado el mes pasado, Gastado el mes pasado, Promedio asignado y Promedio gastado (3 meses
  anteriores). Todo se manda en una sola acción `budget/budget-amounts` → un solo «Deshacer».
- Filas: un único estado corto por fila, por prioridad: «−X gastado de más» (rojo, disponible < 0) >
  «zZ Ignorada este mes» > «faltan X» (ámbar) > «sobran X» (azul, `sobrefinanciado`) > «Financiada»
  (verde) > «Sin objetivo» (gris); la barra va en el mismo color (`estadoFila`). «Infrafinanciado» =
  suma de lo que les falta a los objetivos este mes; el gasto de más no se suma (no cuenta dos veces).
  Tocar una fila abre el teclado (`AssignKeypad`) con «Asignar X — Importe infrafinanciado» y «⋯ Más».
- Filtros (chips sobre la lista): Todas · Infrafinanciadas · Sobrefinanciadas · Gastado de más (con
  cuántas hay) y filtros propios: «+ Nuevo filtro» → nombre → casillas de categorías → Guardar; con uno
  activo, «Editar» (y Borrar). Se guardan en la pref sincronizada `asignar-filtros`
  (`filtrosCategorias.ts`, con tests). En el Plan no: su lista es arrastrable y no comparte componente.
- Teclado: forma parte de la pantalla; la lista tiene debajo un relleno igual a su alto (`flexShrink: 0`
  en el contenedor, si no el relleno quedaba dentro y la última fila no podía subir) y la fila tocada se
  desplaza justo encima del panel. Igual en el Plan.
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

## Ignorar este mes (`#ignorar-mes`, el _snooze_ de YNAB)

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

## Ficha única de categoría (`/categories/:id/ficha?month=…`, `budget/ficha/`)

«Diseño 1 · Ficha única» (maqueta `referencias-ynab/maqueta-ficha/diseno-1.png`). Sustituye al doble paso
«Detalles» → «Objetivo»: la abren mantener pulsado el nombre en el Plan, «Detalles» del teclado, «Asignar el
mes» y «Gasto anual» (`useFichaCategoria` / `rutaFicha`). La ruta antigua `/categories/:id/objetivo` redirige
a la ficha con el editor abierto (`&editar=1`).

- Cabecera: «Disponible en <mes>», píldora de estado (`estadoFila`), anillo de % del objetivo y desglose
  del mes pasado · asignado · actividad (tocar actividad abre los movimientos).
- Objetivo: plegado (resumen, barra, «Faltan X», «Unos Y/mes», píldora ⛵ Rumbo fijo / Atrasado / Cumplido,
  `resumenObjetivo` en `fichaCalculos.ts`); al tocarlo se despliega el editor en el sitio (mismo formulario
  y guardado que antes: `formularioDesde`, `objetivoDesde`, `useGuardarObjetivo` en `ObjetivoPage.tsx`).
  «zZ» de 15 px (área de 44) entre el título y la píldora = «Ignorar este mes» (`useIgnorarMes`), con la
  burbuja de sueño (`BurbujaSueno.tsx`, SVG propio): al dormir se hincha despacio; mientras duerme queda
  pequeña junto al botón respirando (`BurbujaDormida`); al despertar revienta con partículas. Quieta o ausente
  con «reducir movimiento».
- Evolución: Gasto (barras de 12 meses, línea de lo asignado, banda mediana ± MAD solo con meses con gasto
  si es irregular) · Saldo (saldo real + proyección punteada a la meta) · Meses (mapa 12 × 2 años). Por
  defecto Saldo si el objetivo es de saldo (una vez / cada año / `long-goal`).
- Asesor: regla (a) «Asigna X…» con «Presupuestar X en <mes siguiente>» (`budget-amount`), consejos del
  motor de esta categoría y regla (b) «No la gastas dos meses seguidos» (≥ 6 meses de historia). Tests en
  `fichaCalculos.test.ts`.
- Notas sin líneas `#template`/`#goal`/`#objetivo` y pie Renombrar · Ocultar · Eliminar; «⋯» con fijar en
  inicio y ver movimientos.

### Objetivos por fecha que se repiten: próxima vuelta, ritmo, sobrante y adelanto

- **Próxima fecha**: en cuanto pasa el mes de la plantilla, la fecha salta a la siguiente vuelta
  (`proximoVencimiento` en `objetivos.ts`, el mismo salto que `runBy` de Actual). Lo usan el texto del
  objetivo (`useResumenObjetivo`), la ficha y «Gasto anual».
- **Cuota** (ficha): la fórmula de `runBy`: (meta − lo que traía del mes pasado) / (meses hasta la fecha + 1).
  IBI (300 € cada 1 jul, oct-2026, trae 93,29) → 20,67/mes, no 206,71.
- **Ritmo** = meta × meses transcurridos del ciclo / meses del ciclo. Estados: Cumplido (saldo ≥ meta) ·
  ⛵ Adelantado (saldo > ritmo) · ⛵ Rumbo fijo (lo asignado cubre la cuota) · Atrasado.
- **(a) Sobrante sobre la meta** = saldo − meta: se puede mover sin riesgo. Es lo único que cuenta como
  «sobrefinanciada» en Asignar (`DatosCategoriaMes.meta`, `sobrefinanciado`), con el mismo número que la ficha.
  **(b) Adelanto** = saldo − ritmo: se puede usar, pero habría que reponerlo antes de la fecha.
- **«Devolver X a Listo para asignar»** (solo el sobrante): si cabe en lo asignado este mes, se baja lo
  asignado (`budget-amount`, nunca por debajo de 0); si no, `transfer-category` a `to-budget` (el «Mover» de
  Actual: deja lo asignado en negativo y escribe la nota de movimiento). Con deshacer.

## Dormir hasta… (`dormir.ts`, pref `dormidas`)

Amplía «Ignorar este mes». Al tocar «zZ» en la ficha: «Este mes» (la marca `#ignorar-mes` de siempre), «Hasta
el cobro (<mes>)» si el objetivo tiene fecha (duerme hasta el mes de la próxima fecha, p. ej. IBI hasta jul 2027) y «Hasta <mes>» cuando el Asesor ve N meses de adelanto (también el botón «zZ Dormir N meses» del
consejo «Vas Y por delante del calendario»).

- Pref sincronizada `dormidas`, JSON aditivo `{ <categoría>: { desde, hasta, asignadoAlDormir, saldoAlDormir } }`.
  Duerme en `desde ≤ mes < hasta`. «Ignorada» = marca de la nota de mes **o** dormida (`useIgnorarMes`,
  `useDatosObjetivos`), así que no cuenta como infrafinanciada ni «faltan» en el Plan, Asignar, la ficha, el
  teclado ni las fijadas del Inicio. La marca por mes sigue funcionando igual.
- En la fila del Plan, burbuja pequeña «zZ hasta <mes>» que respira (`SuenoFila.tsx`).
- Despierta sola la próxima vez que se ve (fila del Plan o ficha), borra la entrada y la burbuja hace «pop»:
  (a) llega el mes `hasta`; (b) hay gasto en el mes visto; (c) se saca dinero: el saldo baja de
  `saldoAlDormir` sin gasto, o lo asignado en `desde` baja de `asignadoAlDormir`. En sobres el saldo positivo
  se arrastra y solo baja por gasto o por quitar dinero (bajar lo asignado, «Mover», «Cubrir»), así que el
  saldo detecta cualquier salida, en cualquier mes, sin recorrer el historial. Tests en `dormir.test.ts`.
