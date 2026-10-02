# Informes (móvil) — decisiones de diseño

Pestaña **Informes** del móvil (`/reports` con pantalla estrecha; en escritorio sigue el panel de
Actual). Código en `packages/desktop-client/src/components/mobile/informes/`.

## Regla de cada pantalla

Número grande → frase en castellano que lo explica → gráfica → detalle (la lista bajo la gráfica es
la leyenda). Tarjetas en la portada; tocar una abre el detalle.

| Tarjeta / ruta                                         | Qué responde                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Este mes · `/reports/gasto`                            | Dónde se va el dinero: periodo (mes ← →, 3/6/12 m, año), barra apilada, lista con % y «ingresos positivos». |
| Ingresos y gastos · `/reports/ingresos-gastos`         | 12 meses de barras dobles y tasa de ahorro (ingresos − gastos) / ingresos.                                  |
| Evolución de una categoría · `/reports/categoria/:id?` | 12 o 24 meses, línea de lo habitual y marcador de lo presupuestado.                                         |
| Qué sube y qué baja · `/reports/sube-baja`             | Cada categoría frente a lo habitual de 6 meses; gastos puntuales aparte.                                    |
| Patrimonio · `/reports/patrimonio`                     | Activos − deudas, 12/24 meses (reutiliza `net-worth-spreadsheet`).                                          |
| Edad del dinero · `/reports/edad-dinero`               | Reutiliza `age-of-money-spreadsheet`.                                                                       |
| Nóminas · `/reports/nominas`                           | Ingresos por pagador y mes, 12 meses.                                                                       |

## Estadística robusta (`estadisticaRobusta.ts`)

Lo «habitual» de una categoría es la **mediana**, no la media. Dispersión = **MAD** (desviación
absoluta mediana) escalada ×1,4826. Umbral de atípico adaptado a cada serie:
`max(3·MAD, 25 % de la mediana, 10 €)`, sin parámetros por categoría. Un mes fuera del umbral es un
**gasto puntual**: no entra en la referencia, se dibuja hueco en la gráfica y la frase lo dice («Lo
habitual son 35 €; este mes 200 € (gasto puntual)»). En «qué sube y qué baja» solo cuenta como
tendencia (sube/baja) si se repite en ≥ 2 de los últimos 3 meses; la referencia se calcula sin esos
dos meses recientes para que una subida que empieza no infle su propio umbral.

## Datos

- `useTotalesMensuales({ meses, hasta, incluirOcultas, categoriasExcluidas })`: una consulta AQL
  agrupada por mes × categoría × beneficiario, sin cuentas fuera de presupuesto ni traspasos entre
  cuentas del presupuesto (los traspasos a cuentas fuera sí cuentan: es dinero que sale). Caché de
  TanStack Query (30 s) compartida entre páginas.
- `usePresupuestado(meses)`: lo asignado por categoría vía `envelope-budget-month`.
- Importes en céntimos; moneda y formato del presupuesto (`useFormat`).

## Preferencias sincronizadas

- `informes-excluidas`: JSON array de ids que **no** cuentan. Sin valor guardado, por defecto los
  grupos cuyo nombre contenga «Deutes», «No computables» o «Inversions». Editable desde el filtro
  (icono embudo) en Informes, Gasto y Qué sube y qué baja.
- `category-colors`: JSON `{ id: hueco 0..7 }` para personalizar el color de una categoría. Sin
  entrada, el hueco sale de un hash estable del id (`coloresCategorias.ts`): mismo color en todas las
  gráficas y dispositivos.

## Color (método `dataviz`)

Paleta categórica de 8 huecos en orden fijo, validada con `validate_palette.js` para daltonismo en
claro (superficie `#ffffff`) y oscuro (`#141520`): CVD ΔE adyacente 9,1 / 8,4, visión normal 19,6 /
19,3. En claro, aguamarina, amarillo y magenta quedan bajo 3:1 de contraste: por eso toda gráfica
lleva su lista con etiquetas y valores (la vía de relieve). Las variables `--informes-c0..c7` las
define `<PaletaInformes />` según el tema (con «auto» decide el navegador). Marcas finas (≤ 24 px,
extremo redondeado 4 px), hueco de 2 px entre segmentos, rejilla hairline sólida, etiqueta directa
solo en el último mes, tooltip táctil con todas las series.
