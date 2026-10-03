# Sistema de diseño móvil — concepto A · Cartera

Guía para pintar cualquier pantalla móvil (390 px, también 360 px) con el sistema elegido por Vadym
(maqueta `conceptos.html`, concepto A). Oscuro es el modo principal; claro es derivado. Todo lo de aquí
está en la rama `claude/estetica`.

## 1. Temas y tokens

- Temas propios: `packages/component-library/src/themes/presupuesto-dark.css` y `presupuesto-light.css`.
  Son **capas** que se aplican encima de `dark.css` / `light.css` (ver `src/style/theme.tsx`): solo
  redefinen lo que cambia, así que cualquier variable `--color-*` de Actual sigue existiendo.
- Por defecto: el tema global es `auto` y elige `presupuesto-light` (sistema en claro) o
  `presupuesto-dark` (preferencia oscura por defecto). En Ajustes → Tema se pueden elegir también
  «Presupuesto oscuro/claro» de forma fija, o volver a Light/Dark/Midnight de Actual.
- Los temas de Actual siguen funcionando: los tokens TS llevan un valor de reserva con los colores de
  Actual.

### Tokens CSS (`--p-*`)

| Grupo          | Variables                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficies    | `--p-bg` (fondo de página), `--p-surface` (tarjeta), `--p-surface-2` (relleno de controles, barra de pestañas, teclado), `--p-surface-3` (pista de barras, teclas de operador)                                                                                                                                                                                                                                      |
| Líneas         | `--p-line` (separadores), `--p-line-2` (bordes punteados, asa de hojas)                                                                                                                                                                                                                                                                                                                                             |
| Texto          | `--p-fg`, `--p-fg-2` (secundario), `--p-fg-3` (etiquetas, apagado)                                                                                                                                                                                                                                                                                                                                                  |
| Acento         | `--p-accent`, `--p-accent-2`, `--p-accent-ink` (texto sobre acento), `--p-accent-soft`                                                                                                                                                                                                                                                                                                                              |
| Estados        | `--p-ok`/`-soft` (cubierta), `--p-warn`/`-soft` (le falta), `--p-bad`/`-soft` (en rojo), `--p-mute-soft` (nada pendiente)                                                                                                                                                                                                                                                                                           |
| Héroe y Wallet | `--p-hero-a/b/fg` (cabecera verde de Asignar), `--p-card-a..d` (degradados de tarjetas de cuenta)                                                                                                                                                                                                                                                                                                                   |
| Sombras        | `--p-shadow` (tarjeta), `--p-shadow-sheet` (hojas y teclado)                                                                                                                                                                                                                                                                                                                                                        |
| Categorías     | `--p-k0..k11`: los 12 huecos de `useColoresCategorias` (azul, naranja, turquesa, granate, azul petróleo, ámbar, orquídea, verde agua, lavanda, verde hoja, rosa, oliva), validados con dataviz en claro y oscuro. `PaletaInformes` los usa para `--informes-c0..11`. En un informe, `useColoresCategorias(idsVista)` reparte huecos distintos por importe (`asignarColoresVista`); la pref `category-colors` manda. |

Los colores de Actual (`--color-pageBackground`, `--color-cardBackground`, `--color-buttonPrimary*`,
`--color-mobileHeader*`, `--color-numberPositive`…) están remapeados a estos tokens: las pantallas
antiguas cambian solas de color.

### Tokens TS (`components/mobile/ui/tokens.ts`)

```ts
import {
  color,
  colorCategoria,
  espacio,
  movimiento,
  num,
  radio,
  sombra,
  suave,
  texto,
  TACTIL,
} from '#components/mobile/ui/tokens';
```

- `color.*` → `var(--p-*, reserva)` (`color.surface`, `color.fg3`, `color.badSoft`…).
- `colorCategoria(hueco)` → color del hueco 0..11; `suave(color, 18)` → fondo suave con `color-mix`.
- `radio`: `sm` 12 · `boton` 14 (botones y teclas) · `tarjeta` 20 · `heroe` 24 (héroe, hojas, barra de pestañas) · `pildora` 999.
- `espacio`: `fila` 8 · `icono` 12 · `tarjetas` 14 · `margen` 16 (margen y relleno de tarjeta) · `seccion` 24.
- `texto` (escala contenida, oct-2026): `display` 26/800 · `heroe` 28/800 · `cifra` 26/800 · `titulo` 16/800 · `seccion` 15/800 · `fila` 15/700 · `cuerpo` 14/500 · `secundario` 13/500 · `pequeno` 12.5/700 · `etiqueta` 11/800 mayúsculas; `INTERLINEADO` 1,25. Frases explicativas: 2 líneas como máximo (`Hero` las recorta), sin justificar.
- `num` → `font-variant-numeric: tabular-nums` (los temas Presupuesto ya lo ponen en `body`).
- `densidad` (listas del presupuesto, ver § 8): `nombre` 15/500 · `emoji` 15 · `cifra` 14/600 tabular ·
  `pildora` 13/700 · `pequeno` 12/600 · `grupo` 15/700 · `grupoCifra` 13/600; `altoFila` 52 ·
  `altoGrupo` 46 · `altoFilaBarra` 56; `margen` 16 · `vertical` 10 · `sangria` 8; columnas
  `colAsignado` 92 · `colDisponible` 96.
- `movimiento`: `muelle` `cubic-bezier(.2,.9,.3,1.15)`, `tarjeta` 380 ms, `hoja` 320 ms, `fondo` 200 ms, `pildora` 180 ms, `cifra` 400 ms, `pulsar` 90 ms.
- `TACTIL` = 44: ninguna zona táctil por debajo.

### Tipografía

Manrope variable (200–800, OFL 1.1) autoalojada en `packages/desktop-client/public/fonts/manrope/`
(latin + latin-ext, `@font-face` en `index.html`). Los temas Presupuesto la activan con
`--font-family`; con los temas de Actual se sigue usando la fuente de siempre.

## 2. Componentes (`components/mobile/ui/`)

| Componente                  | Uso                                                                                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tarjeta`                   | Superficie elevada (radio 20, sombra, relleno 16). `onPress` la hace tocable (baja a 0,97). `variante="punteada"` para huchas o huecos. `estiloTarjeta()` da el mismo estilo para usarlo en un `View` propio.                                |
| `Pildora`                   | Estado relleno: `ok`, `aviso`, `rojo`, `neutro`, `ignorada` (antepone zZ). `coloresPildora(estado)` devuelve fondo y texto.                                                                                                                  |
| `PildoraCategoria`          | Emoji + nombre de categoría sobre su color de categoría (`hueco` de `useColoresCategorias().huecoDe`).                                                                                                                                       |
| `BarraProgreso`             | 8 px, redonda, pista visible, se llena al aparecer (quieta con «reducir movimiento»). `valor` 0..1, `color`.                                                                                                                                 |
| `Cabecera`                  | Cabecera grande tipo iOS: `subtitulo` 11/700 encima y `titulo` 26/800; `derecha` para botones. Úsala como `header` de `Page` en las pestañas raíz.                                                                                           |
| `BotonRedondo`              | Botón circular de 44 px con relieve y icono Lucide (navegación de mes, «+», «⋯»).                                                                                                                                                            |
| `TituloSeccion`             | Título 13/800 sobre un grupo de tarjetas, con acción opcional a la derecha.                                                                                                                                                                  |
| `Boton`                     | Botón del sistema: `variante` `primario` · `tonal` (rojo) · `aviso` · `fantasma`; `bloque` = ancho completo, 54 px, radio 18.                                                                                                                |
| `IconoCaja`                 | Icono Lucide (`icono="wallet"`) o emoji (`children`) en una cajita de color suave de 32–44 px; `tono` o `colorPropio`.                                                                                                                       |
| `Icono`                     | Iconos Lucide inline, trazo 2 px (`nombre`: home, plan, receipt, wallet, pie, zap, move, info, piggy, bank, car, cal, tag, user, note, more, plus, cl, cr, cd, x, bksp, sliders, store, refresh, settings…).                                 |
| `Importe`                   | Importe en céntimos con el formato del presupuesto (es-ES vía `useFormat`), tabular y con `PrivacyFilter`. `tono="auto"` pinta en rojo los negativos.                                                                                        |
| `SelectorMes`               | Botón con el mes (`variante` `titulo` o `compacto`, `logPose` decorativo) que abre `HojaSelectorMes`: ‹ año › y rejilla 4×3 Ene–Dic, elegido en acento, futuros atenuados, «Hoy» y `accion` opcional («Opciones del mes…»). Sin flechas ‹ ›. |
| `EstadoVacio`               | Tarjeta con ilustración de línea de un color (`ilustracion="sombrero"` o `"barquito"`), título, frase y acción.                                                                                                                              |
| `Cargando`                  | «Zarpando…» con el barquito meciéndose (2,4 s; quieto con «reducir movimiento»). `pantalla` para pantalla completa.                                                                                                                          |
| `IconoZz`                   | «zZ» tipográfico para lo ignorado este mes.                                                                                                                                                                                                  |
| `separarEmoji` (`emoji.ts`) | Separa el emoji inicial de un nombre («🏠 Hipoteca» → «🏠» + «Hipoteca»).                                                                                                                                                                    |

Formularios (`mobile/MobileForms.tsx`): `TapField` e `InputField` aceptan `etiqueta` para pintarse como
fila del sistema A (icono en cajita, etiqueta a la izquierda, valor a la derecha, 54 px). Agrúpalas en un
`View` con `tarjetaFormularioStyle` (pone las líneas entre filas). `TapField` acepta `valorNodo` (p. ej.
una `PildoraCategoria`).

## 3. Navegación

- Barra de pestañas flotante en cápsula (`mobile/MobileNavTabs.tsx`): **Inicio · Plan · Gastos · Cuentas
  · Informes**. Se esconde al desplazar hacia abajo. `MOBILE_NAV_HEIGHT` (84 px) es el hueco que deben
  dejar las páginas al final.
- `/gastos` (`mobile/gastos/GastosPage.tsx`): movimientos de todas las cuentas (la vista «Todas las
  cuentas» de Actual) con «+» en la cabecera para apuntar uno nuevo.
- `/mas` (`mobile/mas/MasPage.tsx`): Pagos programados, Beneficiarios, Reglas, Sincronización bancaria y
  Ajustes. Se llega desde el «⋯» de la cabecera de Cuentas; Ajustes enseña la misma lista arriba
  (`ListaMas sinAjustes`). **Inicio**: el agente de Inicio puede poner un `BotonRedondo icono="more"` que
  navegue a `/mas`.

## 4. Movimiento

- Cambio de pestaña: la página entra con opacidad + 8 px y muelle de 320 ms (`Page.tsx`).
- Hojas y modales: entran desde abajo con el muelle de 320 ms; radio 24 en el móvil (`common/Modal.tsx`).
- Teclado de asignar: sube desde abajo (320 ms, muelle) con asa.
- Pulsación: tarjetas y botones bajan a 0,97 en 90 ms; píldoras cambian de color en 180 ms.
- Todo respeta `prefers-reduced-motion: reduce`.

## 5. Cómo pintar una pantalla nueva

1. `Page` con `padding={0}`. Si es una pestaña raíz, `header={<Cabecera titulo subtitulo derecha />}`;
   si es de detalle, deja el `MobilePageHeader` de siempre (ya toma el fondo del tema).
2. Contenido en un `View` con `padding: \`0 ${espacio.margen}px\``, `gap: espacio.tarjetas`y`paddingBottom: MOBILE_NAV_HEIGHT + espacio.margen` si se ve la barra de pestañas.
3. Agrupa en `Tarjeta` (o `estiloTarjeta()` + `overflow: hidden`) con filas de ≥ 52 px separadas por
   `1px solid color.line` (sin línea en la primera).
4. Estados con `Pildora` (verde cubierta, ámbar le falta, rojo en negativo, gris nada pendiente); avance
   con `BarraProgreso`; importes con `Importe` o `format(x, 'financial')` + `num`.
5. Iconos siempre dentro de `IconoCaja` (o la cajita de 32 px de los formularios). Nada de iconos sueltos
   salvo en botones redondos y chevrons.
6. Vacío → `EstadoVacio`; cargando → `Cargando`. Un guiño One Piece como mucho, y nunca en números.
7. Colores solo desde `color.*` / `colorCategoria()`: nada de hex en las pantallas. Comprueba claro y
   oscuro, y que no haya scroll horizontal a 360 px.
8. Textos en inglés en el código (`t('…')` / `<Trans>`) y su traducción en
   `src/locale-overrides/es.json`.

## 6. Pantallas repintadas en esta rama

Plan (navegador Log Pose, píldora «listos para asignar», grupos en tarjetas, columnas Asignado ·
Disponible con el gasto en rojo bajo lo asignado, píldoras de disponible, «Faltan X» / «zZ Ignorada este
mes»), teclado de asignar (píldoras Auto · Mover · Detalles · zZ Ignorar, teclas del sistema), Asignar el
mes (héroe verde con ‹ ›, auto-asignar, filas con barra de 8 px y estado), Objetivo, Cuentas (Wallet,
préstamos con % pagado y «Libre en», huchas punteadas), lista de movimientos y Gastos, Movimiento
(importe grande, Gasto/Ingreso, campos en tarjetas, Guardar ancho), Informes (cabecera grande, tarjetas,
chips, 8 colores del tema), Más. Inicio (rama `claude/inicio-estetica`): cabecera grande «Octubre» · «día 2
de 31» con «Editar» y «⋯» (→ `/mas`), cada widget con `TituloSeccion` + `Tarjeta`, Fijadas en baldosas-tarjeta
con anillo y píldora, Consejos con puntos de paginación, entrada escalonada de tarjetas y modo «Editar inicio»
con asa de arrastre y botones de 44 px (`inicio-estetica*.png`).

Capturas: `docs-vadym/capturas/estetica-*.png` (390×844, demo; `-claro` en modo claro).

## 7. Pulido (rama `claude/pulido`)

- Selector de mes como YNAB en Plan y Asignar el mes; Informes · Gasto con botón de periodo (Mes…, Últimos
  3/6/12 meses, Año en curso, Año pasado, Todo) recordado en la pref sincronizada `informes-periodo`.
- 12 colores de categoría y asignación por vista: sin repeticiones con ≤ 12 categorías.
- Tipografía más contenida y frases de Informes e Inicio en una línea.

Capturas: `docs-vadym/capturas/pulido-*.png`.

## 8. Densidad del Plan (rama `claude/plan-denso`)

Medido contra YNAB a 390 px (captura de Vadym, oct-2026). Las medidas salen de `getComputedStyle` y
`boundingBox` sobre el build real: `node docs-vadym/comprobar-densidad.mjs` falla si alguna no cuadra.

| Elemento                         | Antes (medido)          | Ahora                |
| -------------------------------- | ----------------------- | -------------------- |
| Nombre de categoría              | 14 px / 700             | 15 px / 500          |
| Emoji                            | 16 px en caja de 24     | 15 px, sin caja      |
| Cifra de fila (asignado)         | 14 px / 700 (AutoText)  | 14 px / 600 tab.     |
| Gasto bajo lo asignado           | 11,5 px / 700           | 12 px / 600          |
| Píldora de disponible            | 13 px (11,5 si larga)   | 13 px / 700, 26 alto |
| Alto de fila de categoría        | 57 px (76 con «Faltan») | 52 px                |
| Nombre de grupo                  | 15 px / 800             | 15 px / 700          |
| Totales de grupo                 | 12 px / 800 (`fg2`)     | 13 px / 600 `fg3`    |
| Alto de fila de grupo            | 48 px                   | 46 px                |
| «Listos para asignar»            | 15 px / 800, 48 alto    | 16 px / 700, 44      |
| Mes / año de la cabecera         | 19 px / 12 px           | 22 px / 11 px        |
| Banner rojo                      | 13,5 px, 56 alto        | 13 px, 48 alto       |
| «Seguro Hipoteca»                | 2 líneas                | 1 línea              |
| Letra más pequeña (Plan)         | 10,5 px (pestañas)      | 11 px                |
| «Asignar el mes»: fila con barra | 14,5/700, ~81 px        | 15/500, 56 px        |
| «Gasto anual»: fila              | 14,5/700, ~95 px        | 15/500, 56 px        |

Reglas:

- Sin tarjetas en la lista: el **grupo** es una franja `surface2` de 46 px (chevron de 14 px, nombre 15/700,
  totales 13/600 en `fg3`, ⋮ de 18 px solo en el grupo); las **categorías** van debajo sobre `surface`, con
  8 px de sangría, emoji delante del nombre y una línea fina (`inset 0 1px 0 line`, no suma alto) entre filas.
- Columnas de cifras de ancho fijo (Asignado 92 · Disponible 96) y el nombre con `flex: 1`; el total
  asignado del grupo no tiene ancho fijo para dejar sitio al nombre. Nombres de ≤ 24 caracteres sin elipsis
  (pasan a dos líneas si no caben; la comprobación lo vigila).
- Zonas táctiles de 44 px sin engordar la fila: el contenido mide 32 px y los botones llevan margen
  negativo de 6 px arriba y abajo.
- Nada bajo la fila: el estado del objetivo lo dice el color de la píldora (ámbar infrafinanciada, rojo
  negativo, verde con saldo, gris cero). Sin letra < 11 px.
- «Asignar el mes» y «Gasto anual»: nombre y cifra en la primera línea; estado (12 px, en su color) a la
  izquierda y barra de 5 px bajo la cifra en la segunda. 56 px.

Interacción del Plan: tocar el nombre o lo asignado abre el **teclado**; mantener pulsado el nombre abre
la ficha (`category-menu`), que también está en «Detalles». Si la categoría está infrafinanciada, el
teclado enseña «Asignar X para el objetivo» (asigna lo que falta, `useFaltanteObjetivo`) con «zZ Ignorar»
a su derecha. La ficha oculta las líneas `#template` / `#goal` / `#objetivo` de la nota
(`notaSinObjetivo`); si no queda nada, «Sin notas».

Capturas: `plan-denso.png`, `plan-denso-teclado.png`, `plan-denso-ficha.png`, `plan-denso-asignar.png`,
`plan-denso-anual.png`.

## 9. Movimiento y traspasos (rama `claude/traspasos`)

- Pantalla de movimiento densa: importe 30 px/800 con el símbolo de moneda al lado (no 46), selector
  **Gasto · Ingreso · Traspaso** de 44 px, filas de formulario de 48 px (valor 15/500 como
  `densidad.nombre`, icono en cajita de 28), tarjetas de radio 16 y botón Guardar de 48.
- Beneficiario (móvil): arriba «PAGOS Y TRASPASOS → Traspaso entre cuentas» abre la lista de cuentas
  abiertas (sin cerradas ni la del propio movimiento; primero las del presupuesto). Elegir una guarda el
  beneficiario de traspaso de Actual (`payee.transfer_acct`): Actual crea el movimiento espejo
  (`transfer_id`). «Traspaso» en el selector abre la misma lista directamente.
- Traspaso: «Desde ↓ Hacia» (el ↓ invierte el sentido, es el signo del importe). Desde una cuenta fuera
  de presupuesto a una dentro → categoría de ingreso (la llamada Ready to Assign/Income/Ingresos o la
  primera que no sea de saldos iniciales), que se enseña como **Listo para asignar**. Entre dos cuentas
  del presupuesto, sin fila de categoría.
- **No contar como ingreso**: etiqueta `#noingreso` en la nota del movimiento (aditiva, sincroniza sin
  migraciones; Actual la pinta como etiqueta). El interruptor la pone o la quita. Un movimiento con
  beneficiario de traspaso **nunca** cuenta como ingreso (interruptor fijo). Lógica en
  `mobile/informes/noIngreso.ts`: `consultaMovimientos` saca aparte lo excluido y `descontarNoIngresos`
  lo resta de las categorías de ingreso, así que Nóminas, Ingresos vs gastos, tasa de ahorro, reglas
  del análisis e Inicio (Gasto del mes; Resumen del mes vía `useIngresoNoContado`) lo ignoran. Sigue
  sumando a Listo para asignar.

Capturas: `traspasos-*.png` (scratchpad de la sesión).
