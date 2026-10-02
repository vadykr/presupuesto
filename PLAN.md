# Presupuesto — plan del proyecto

App de presupuesto personal de Vadym, construida sobre un fork de
[Actual Budget](https://github.com/actualbudget/actual) y adaptada a su forma de usar YNAB.
Uso siempre desde el móvil. Idioma: castellano (las categorías se quedan en catalán).

## Lo que ya trae Actual y se conserva

- Presupuesto por sobres (asignado / actividad / disponible), meses futuros.
- Traspasos entre cuentas como traspaso, no como gasto.
- Objetivos de varios tipos (mensual, «antes del día X», ahorrar X € para una fecha).
- Reglas por beneficiario (recuerda la categoría de cada pagador).
- Importador de YNAB (JSON de la API de YNAB).
- Sincronización bancaria con Enable Banking (CaixaBank, Trade Republic).
- Informes: ingresos vs gastos, patrimonio neto, Age of Money, gasto por categoría.

## Fases

### Fase 1 — que funcione con sus datos

1. Castellano por defecto.
2. Nombre «Presupuesto», icono propio, instalable en el móvil (PWA).
3. Quitar lo que no usa: tarjetas de crédito, varios presupuestos, opciones extra.
4. Publicar en un servidor propio; importar el JSON de YNAB; conectar CaixaBank (y probar Trade Republic).
5. Sincronización bancaria automática diaria.

### Fase 2 — las comodidades de YNAB

6. Pantalla de inicio: categorías en rojo con «Cubrir», «Listo para asignar», categorías fijadas,
   objetivo actual, resumen del mes.
7. En cada categoría: «Añadir desde… (otra categoría)» y botones rápidos +10 € / −10 €.

### Fase 3 — lo que YNAB no da

8. **Análisis inteligente mensual**: comparación de cada categoría con la media de 3/6/12 meses y con el
   mismo mes del año anterior; estacionalidad («agosto: Vacances +X %»); consejos activos en lenguaje
   normal («3 meses con 60 € en Gats y gasto 0: ¿está bien presupuestado?», «Bebot se come 40 € de
   Capritxos casi cada mes»); propuesta de presupuesto realista con botón «Aplicar». Cada consejo
   enseña los números de los que sale.
9. Estadísticas por categoría: evolución mes a mes, qué sube y qué baja frente a la media.
10. Historial de nóminas por pagador y su evolución.
11. «Cuánto ingresar a la cuenta común» cada mes (a partir de la vista _Ingrés comuna_).
12. Pestaña **Gasto anual**: IBI, seguro del coche, etc. fuera del presupuesto mensual; cuánto hay
    ahorrado, cuánto toca poner al mes, si va al día. Solo aparece en el principal si va por detrás.

### Fase 4 — deudas

13. Hipoteca y coche con interés, cuota y fecha; al pagar la letra se separan interés y capital y la
    deuda se recalcula sola.
14. Simulador de amortización anticipada: reducir cuota o plazo, interés ahorrado, comparar deudas.

### Sugerencias pendientes de decidir

- Tasa de ahorro mensual (% de la nómina a Estalvis / Inversions / hija) y su evolución.
- Gasto por beneficiario («MAS BES: 87 € este mes, 12 visitas»).
- Fin de mes proyectado según el ritmo habitual.
- Resumen de cierre de mes el día 1, con los consejos del mes.

## Reglas

- Los datos (JSON de YNAB, base de datos, claves de Enable Banking) **nunca** van al repositorio.
- Las credenciales viven solo en el servidor (secretos cifrados). Claude no las ve ni las pide.
- Cambios mínimos sobre el código de Actual para poder traer mejoras futuras del proyecto original.
- Antes de subir: `yarn typecheck` y `yarn lint:fix` desde la raíz.
