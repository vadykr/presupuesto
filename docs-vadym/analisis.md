# Análisis inteligente («Consejos») — reglas y umbrales

PLAN.md, punto 8. Consejos activos en lenguaje normal, transparentes (cada uno enseña los números de
los que sale) y con acción de un toque. Código en
`packages/desktop-client/src/components/mobile/analisis/`:

| Archivo               | Qué hace                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `motor.ts`            | Motor puro (sin React ni i18n): entrada → consejos tipados + propuesta. Tests en `motor.test.ts`.     |
| `movimientos.ts`      | Lee las notas de movimiento de Actual («Reassigned 40,00 € from Capritxos → Bebot on …»).             |
| `frases.ts`           | Del dato tipado al título y texto (claves en inglés, castellano en `locale-overrides/es.json`).       |
| `useAnalisis.ts`      | Carga los datos (37 meses de movimientos, 13 meses + 1 de presupuesto, objetivos, notas) y descartes. |
| `acciones.ts`         | Fijar objetivo (mecanismo de `ObjetivoPage`), ajustar presupuesto y aplicar la propuesta (deshacer).  |
| `AnalisisPage.tsx`    | Ruta `/reports/analisis`: pestañas «Consejos» y «Presupuesto propuesto».                              |
| `TarjetaConsejos.tsx` | Tarjeta de la portada de Informes y tarjeta del Inicio («N consejos este mes»).                       |

## Principios

- **Meses completos**: el mes actual está a medias, así que todas las reglas miran los meses anteriores
  al actual. El actual solo cuenta en la estacionalidad («este mes suele ser caro») y como destino de las
  acciones.
- **Lo habitual** de una categoría es la mediana robusta de sus últimos 12 meses completos con datos
  (`estadisticaRobusta.ts`: mediana, MAD, umbral `max(3·MAD, 25 %, 10 €)`). Los meses atípicos son
  «gasto puntual»: no cuentan para ninguna regla crónica ni desplazan las propuestas; en «Ver cifras»
  salen con `*`. Pero si los «atípicos» se repiten en ≥ 3 de los últimos 4 meses ya no son puntuales: es
  un nuevo nivel y cuentan.
- **Nivel vigente** (`caracterizarSerie`): si el último mes completo confirma una tendencia
  (`clasificarMes`: fuera del umbral y repetido ≥ 2 de los últimos 3 meses), lo que conviene presupuestar
  es la mediana de los últimos 3 meses, no la referencia de 12. Las reglas a–c y la propuesta usan ese
  nivel; las frases siguen enseñando lo habitual de 12 meses para que se vea el cambio.
- **Gasto irregular** (facturas anuales, bimestrales…): ≤ la mitad de los últimos 12 meses con gasto y
  media positiva. No se juzga con las reglas mensuales (a, b, c, e); la propuesta usa la media de 12 meses
  («mensualizar»).
- **Categorías que cuentan**: las mismas que en Informes (filtro «qué cuenta como gasto», pref
  `informes-excluidas`; por defecto fuera Deutes, No computables e Inversions): ni consejos ni propuesta.
  Las ocultas y las de ingreso tampoco generan consejos. Los grupos de **ahorro** (nombre con «Estalvis»
  o «Inversions») no entran en las reglas a–e (asignar y no «gastar» es lo normal) pero sí en la
  propuesta y en el reparto de la subida de nómina.
- **Objetivos** se leen de las plantillas de la categoría (`goal_def`, las mismas que escribe el parser de
  notas o la UI de automatizaciones). **Acumulativo** = `by`, `schedule` o `periodic` no mensual
  («ahorrar X para una fecha»): gastar 0 es lo esperado, no se marcan como sobrepresupuestadas y la
  propuesta mantiene lo asignado. Con objetivo mensual, la acción de los consejos es «fijar objetivo»
  (la plantilla manda); sin él, «poner X este mes».
- **Propuestas redondeadas a 5 €**: hacia arriba cuando hay que cubrir gasto, al más cercano cuando se
  propone bajar. Un consejo solo sale si la diferencia con lo asignado es ≥ 5 €. Nunca se propone un
  importe negativo (categorías de devoluciones).
- **Una categoría, un consejo**: a, b y c son excluyentes; la tendencia (e) no se repite si la categoría
  ya tiene un consejo de presupuesto; un traspaso (h) ya explicado en «infrapresupuestada» no sale aparte.
- **Orden** por importe afectado (`relevancia`). **Gravedad**: `accion` (hay un botón que lo arregla),
  `aviso` (conviene mirarlo), `info`.
- **Descartar** guarda `id@mes` en la pref sincronizada `analisis-descartados`; caduca solo al cambiar
  de mes. Los descartados se pueden ver y restaurar al final de la lista.

## Reglas

| Regla                         | Condición (últimos 4 meses completos salvo que se diga)                                                                                                                                                                                                             | Propuesta / acción                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a. Infrapresupuestada         | ≥ 3 de 4 meses con asignado > 0 y gasto > asignado, sin contar los meses atípicos. Nivel vigente − asignado actual ≥ 5 €.                                                                                                                                           | Presupuesto = nivel vigente redondeado arriba. Si en los últimos 7 meses recibe dinero de la misma categoría ≥ 2 veces, lo dice («los 40 € salen de Capritxos»).                                                                                                   |
| b. Sobrepresupuestada         | ≥ 3 de 4 meses con asignado > 0 y gasto < 50 % de lo asignado. Asignado actual − nivel vigente ≥ 5 €. No aplica si algún mes de los 12 gastó ≥ 3× lo asignado (factura anual que se aparta) ni si es irregular. También para categorías que nunca han tenido gasto. | Bajar al nivel vigente (redondeo al más cercano; puede ser 0). Gravedad `aviso`: es una pregunta.                                                                                                                                                                  |
| c. Sin asignar pero con gasto | ≥ 3 de 4 meses con asignado 0 y ≥ 3 de 4 con gasto > 10 € (no atípico); habitual > 10 €.                                                                                                                                                                            | Objetivo mensual = nivel vigente redondeado arriba (si ya tiene objetivo, ajustar el presupuesto).                                                                                                                                                                 |
| d. Estacionalidad             | Para el mes actual y el siguiente: en **todos** los años anteriores con datos (≥ 2) el mismo mes supera la referencia robusta de los 11 meses de alrededor en más del umbral. Hace falta ≥ 6 meses de contexto por año.                                             | «Prepara Y» = mediana de esos meses redondeada arriba, si lo asignado para ese mes es menor. Acción: asignar en ese mes. También manda en la propuesta del mes siguiente.                                                                                          |
| e. Tendencia                  | Tendencia confirmada en el último mes completo (ver «nivel vigente»); referencia ≥ 10 € y desviación ≥ 10 €; ≥ 6 meses con datos. Solo en el sentido de la tendencia: si sube pero lo asignado ya cubre el nivel (o baja y ya está bajado), no hay consejo.         | Presupuesto = nivel vigente redondeado (arriba si sube). Sin presupuesto y bajando: solo informativo.                                                                                                                                                              |
| f. Ingresos                   | Beneficiario principal (más ingresos en 6 meses): mediana de los 3 últimos meses frente a los 3 anteriores; cambio ≥ 2 % y ≥ 10 €.                                                                                                                                  | Dice cuánto y qué parte ha ido a gasto (mediana del gasto sin ahorro) y a ahorro (mediana de lo asignado a grupos de ahorro).                                                                                                                                      |
| g. Tasa de ahorro             | Tasa del último mes completo (ingresos − gastos) / ingresos frente a la mediana de los 11 anteriores; diferencia ≥ 10 puntos. No se juzga un mes con ingresos atípicos (paga extra, devolución).                                                                    | Sin acción. Por debajo = aviso, por encima = info.                                                                                                                                                                                                                 |
| h. Traspasos                  | Notas `budget-<mes>` de los últimos 6 meses completos + el actual: la pareja origen → destino se repite en ≥ 3 meses (destino = categoría; origen = categoría o «Listo para asignar»).                                                                              | Info con la mediana del traspaso.                                                                                                                                                                                                                                  |
| i. Presupuesto propuesto      | Por categoría: «ahora» = asignado este mes (el siguiente suele estar a 0) → propuesto = nivel vigente redondeado (estacional si d lo marca; media de 12 meses si es irregular; se mantiene con objetivo acumulativo o con < 3 meses de datos).                      | Total propuesto, diferencia con lo de ahora y margen frente a los ingresos habituales (mediana de 6 meses). «Aplicar a <mes>» manda `budget-amounts` al mes siguiente en una sola acción con «Deshacer»; «Todas las categorías» enseña también las que no cambian. |

## Notas de movimiento

Actual escribe en la nota del mes (`notes.id = budget-AAAA-MM`) una línea por cubrir/traspasar:
`- Reassigned 40,00 € from Capritxos → Bebot on October 02`. El importe lleva el formato de número del
presupuesto y las categorías van por **nombre**, así que `movimientos.ts` resuelve nombre → id y descarta
los nombres repetidos en dos grupos y las categorías borradas. «To Budget» es `to-budget`;
«Overbudgeted» como destino se ignora.

## Datos

- Movimientos: `useTotalesMensuales({ meses: 37 })` (3 años + el actual), misma caché que Informes.
- Presupuesto: `usePresupuestado` de los últimos 13 meses y el siguiente (`envelope-budget-month`).
- Objetivos: `goal_def` de cada categoría (`useCategories`), sin consultas extra.
- Notas: consulta AQL `notes` con `$oneof` de los 8 ids `budget-<mes>`.

Capturas en `capturas/analisis.png`, `analisis-cifras.png`, `analisis-propuesta.png` (presupuesto demo,
390×844, claro; `*-oscuro.png` en oscuro).

## Cambio de nivel persistente (oct-2026)

- `cambioDeNivel` (`estadisticaRobusta.ts`): solo hay nivel nuevo con **≥ 3 meses seguidos** al mismo lado de
  lo habitual (más allá de max(25 %, 10 €) de la referencia de los meses anteriores y con su mediana a más de
  1 MAD), coherentes entre sí. Nivel = mediana de esa racha. Un gasto puntual (un móvil de 400 €) o dos picos
  sueltos nunca mueven la cifra; con solo dos meses, aviso «ojo: dos meses por encima». Lo usan el motor
  (`caracterizarSerie`) y la ficha (`nivelActual`). Antes bastaban 2 de los últimos 3 meses.
- Ficha: una sola cifra por categoría; si el motor ya propone una, la regla «Asigna X» de la ficha no sale.
- Mes de los botones (`mesDeAccion`, motor y ficha): el mes visto si es el actual o futuro y no tiene nada
  asignado; si no, el siguiente.
