# Mapa técnico (fases 2-4) — resultado de la exploración del código de Actual

Rutas relativas a `packages/`.

## Hallazgos que condicionan el plan
- Cubrir y traspasar entre categorías YA existen en móvil: `mobile/budget/ExpenseCategoryListItem.tsx` (`onTransfer`, `onCover`) → modales `modals/CoverModal.tsx`, `modals/TransferModal.tsx`; servidor `loot-core/src/server/budget/actions.ts` (`coverOverspending` l.518 limita al saldo origen; `transferCategory` l.643 no valida).
- Objetivos (goals) detrás del flag `goalTemplatesEnabled` (`hooks/useFeatureFlag.ts`, pref `flags.goalTemplatesEnabled`). Definición en `categories.goal_def` (JSON) y `#template`/`#goal` en notas; cálculo en `loot-core/src/server/budget/goal-template.ts`.
- El importador YNAB (`loot-core/src/server/importers/ynab5.ts`) NO importa objetivos. Hay que ampliarlo (ynab5-types tiene goal_type/goal_target/goal_target_month) → mapear a plantillas.
- `BudgetAnalysis` (flag `budgetAnalysisReport`) solo agrega; reutilizar `budgetDataQuery.ts` (`fetchBudgetData`, `envelope-budget-month`).
- No hay préstamos: crear tabla aditiva `loans (id, account, rate, payment, start, term, tombstone)` + esquema AQL + db/types.
- No hay «home» ni «fijadas»: ruta nueva `/home` en `FinancesApp.tsx` + pestaña en `mobile/MobileNavTabs.tsx` (array `navTabs` l.95) + synced pref `pinned-categories`.
- Sincronización bancaria: no hay endpoint HTTP en el servidor; usar `@actual-app/api` `runBankSync()` o CLI `server bank-sync` en un contenedor/cron aparte (descargar, sincronizar, subir).
- Enable Banking: secretos en tabla `secrets` de `account.sqlite` en `/data` (`POST /enablebanking/configure`).
- i18n: traducciones propias con `src/locale-overrides/es.json` fusionado en `loadLanguage` de `src/i18n.ts` (glob eager). Permite corregir upstream.

## Puntos de anclaje
- Lista móvil: `mobile/budget/BudgetPage.tsx` (`Banners`: `OverspendingBanner` → `useOverspentCategories` → `cover`), `BudgetTable.tsx` (`ToBudget` l.68, binding `envelopeBudget.toBudget`), `BudgetCell.tsx` → `modals/EnvelopeBudgetMenuModal.tsx` (AmountInput; aquí van +10/−10 con `onUpdateBudget(budgeted ± 1000)`; forzar re-render con `key`).
- Saldo → `modals/EnvelopeBalanceMenuModal.tsx` → `components/budget/envelope/BalanceMenu.tsx` (añadir «Añadir desde…» reutilizando `cover` con `transfer-category`).
- Consultas: `aqlQuery(q('transactions'))`, `useQuery`, `components/reports/spreadsheets/makeQuery.ts` (agrupa mes+cuenta+payee+categoría), `send('envelope-budget-month',{month})`.
- Informes: ruta nueva en `components/reports/ReportRouter.tsx` (bajo `/reports/*`).
- Notas por id: `catId`, `${catId}-${month}`, `budget-${month}`.
- Migraciones: solo aditivas (`loot-core/migrations/README.md`).
- Importes en céntimos enteros (`amountToInteger`).

## Orden recomendado
Fase 2: overrides i18n → ±10 € → «Añadir desde…» → pref fijadas → página `/home` (ToBudget, overspending+cover, fijadas con BalanceCell, objetivo, resumen `envelopeBudget.totalIncome/totalSpent/totalBudgeted`).
Fase 3: hook `useMonthlyCategoryTotals(range)` → `/reports/analisis` (medias 3/6/12, mismo mes año anterior, consejos, «Aplicar» con `budget-amount`) → estadísticas por categoría → nóminas por pagador → pestaña Gasto anual (grupo dedicado + objetivos `by … repeat yearly`).
Fase 4: tabla `loans`.
