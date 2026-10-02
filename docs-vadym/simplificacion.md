# Simplificación para un solo usuario en el móvil

Fase 1.3 del [plan](../PLAN.md). Objetivo: que la app sirva a una sola persona desde el
móvil sin cambiar más código del necesario, para poder seguir trayendo mejoras de Actual.

## Qué se ha encontrado

### Varios presupuestos (archivos)

- `packages/desktop-client/src/components/App.tsx`: al arrancar ya abre solo el último
  presupuesto usado (`get-last-opened-backup`). La lista de archivos solo aparece cuando no hay
  «último» (primera vez) o cuando el usuario cierra el presupuesto.
- `packages/desktop-client/src/components/manager/ManagementApp.tsx`: pantalla de gestión.
  Sin archivos muestra `WelcomeScreen.tsx` (botones «Empezar», «Probar la demo», «Importar mi
  presupuesto»); con archivos muestra `BudgetFileSelection.tsx`.
- `BudgetFileSelection.tsx`: lista de archivos con menú por archivo (Duplicar, Eliminar) y
  botones «Importar archivo», «Crear archivo nuevo» y, solo en desarrollo, «Crear archivo de
  prueba». El importador de YNAB (JSON de la API) está en el modal `import` →
  `modals/manager/ImportYNAB5Modal.tsx`.
- Cómo se vuelve a la lista: en el móvil, Ajustes → «Cambiar de archivo» (único sitio en móvil,
  `settings/index.tsx`); en escritorio, menú del nombre del presupuesto en la barra lateral
  (`sidebar/BudgetName.tsx`).

### Tipos de cuenta y «tarjeta de crédito»

- En Actual **no existe un tipo de cuenta «tarjeta de crédito»**. Al crear una cuenta
  (`modals/CreateAccountModal.tsx` → `CreateLocalAccountModal.tsx`) solo se elige nombre, saldo
  inicial y la casilla «Fuera del presupuesto» (`offbudget`). Una tarjeta de crédito se
  modelaría como una cuenta normal dentro del presupuesto con saldo negativo; no hay flujo
  específico (grupos de pago, intereses) que ocultar.
- La otra vía de alta es «Configurar sincronización bancaria» (Enable Banking, GoCardless…),
  que se conserva.

### Ajustes que no aplican

- `settings/index.tsx`: la sección «Copias de seguridad» (`Backups.tsx`) ya está condicionada
  a `isElectron()`, igual que «Cargar copia…» en la barra lateral. En el navegador/PWA no
  aparecen: no hace falta tocarlas.
- «Exportar datos» se mantiene (copia de seguridad manual).
- «Funciones experimentales» se mantiene tal cual, según lo acordado.
- Opciones de sincronización, cifrado, idioma, formato, tema y moneda: se mantienen.

## Qué se ha ocultado y cómo revertirlo

Todo pasa por un único flag en `packages/desktop-client/src/presupuesto.ts`:

```ts
export const SOLO_UN_PRESUPUESTO = true;
```

Con `SOLO_UN_PRESUPUESTO = false` la app vuelve al comportamiento original de Actual sin más
cambios. Lo que hace el flag cuando está a `true`:

| Dónde                                           | Qué cambia                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manager/ManagementApp.tsx`                     | Si hay **exactamente un** archivo de presupuesto, lo abre directamente (local o remoto) en lugar de mostrar la lista.                                                                            |
| `manager/BudgetFileSelection.tsx`               | Si ya existe algún archivo, no se muestran «Crear archivo nuevo», «Crear archivo de prueba» ni el menú «Duplicar». «Importar archivo» sigue visible.                                             |
| `settings/index.tsx` y `sidebar/BudgetName.tsx` | «Cambiar de archivo» marca que el usuario quiere ver la lista (`solicitarListaDePresupuestos`, en `sessionStorage`), para que la apertura automática no lo devuelva al presupuesto de inmediato. |

Lo que **no** cambia:

- Sin ningún archivo, sigue saliendo la pantalla de bienvenida con «Importar mi presupuesto»
  (necesario para cargar el JSON de YNAB la primera vez) y «Empezar».
- Con dos o más archivos, se muestra la lista como siempre (solo sin el botón de crear).
- Sincronización bancaria, reglas, programaciones, informes, objetivos/plantillas y la vista
  móvil quedan intactos.

## Icono

- Fuente: `packages/desktop-client/public/icono.svg` (carpeta blanca con «€» sobre verde
  `#1f6f4a`).
- PNG/ICO generados con Pillow (no había rasterizador de SVG): `android-chrome-192x192.png`,
  `android-chrome-512x512.png`, `apple-touch-icon.png` (180), `mstile-150x150.png`,
  `maskable-192x192.png` y `maskable-512x512.png` (con margen de seguridad del 18 %),
  `favicon-16x16.png`, `favicon-32x32.png` (solo «€», la carpeta no se lee a ese tamaño) y
  `favicon.ico` (16/32/48). `browserconfig.xml` usa el mismo verde como color de mosaico.
- Para regenerarlos: `pip install Pillow && python3 docs-vadym/generar-iconos.py`.
