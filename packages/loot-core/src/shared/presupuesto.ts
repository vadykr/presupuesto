// Ajustes propios de «Presupuesto» (fork de Actual) que viven en loot-core.
// Cada uno se puede revertir cambiando una sola constante.

/**
 * «Listo para asignar» como en YNAB: lo que ya está asignado en meses
 * posteriores se descuenta del mes actual. Actual, por defecto, solo tiene en
 * cuenta lo asignado hasta el mes que se mira, así que en el mes actual
 * mostraba como disponible dinero que ya estaba repartido en el mes siguiente.
 *
 * Poner a `false` para recuperar el cálculo original de Actual.
 */
export const RTA_COMO_YNAB = true;
