// Ajustes propios de «Presupuesto» (fork de Actual para una sola persona,
// usado desde el móvil). Todo lo que se oculta en la interfaz pasa por aquí
// para poder revertirlo cambiando una sola constante.

/**
 * Modo «un solo presupuesto»: si solo existe un archivo de presupuesto se abre
 * directamente al arrancar y en la lista de archivos no se ofrece crear ni
 * duplicar otro. Importar (YNAB, Actual) sigue disponible, igual que la
 * pantalla de bienvenida cuando todavía no hay ningún archivo.
 *
 * Poner a `false` para recuperar el comportamiento original de Actual.
 */
export const SOLO_UN_PRESUPUESTO = true;

/**
 * Modo «Presupuesto»: quita los restos de Actual de las pantallas previas al
 * presupuesto, la importación, las novedades/avisos de actualización, la ayuda
 * y Ajustes (usuario único en PWA). Ver docs-vadym/simplificacion.md.
 *
 * Poner a `false` para recuperar el comportamiento original de Actual.
 */
export const MODO_PRESUPUESTO = true;

/** Nombre visible de la app. */
export const appName = 'Rumbo Finanzas';

/** Documentación propia (sustituye a actualbudget.org/docs). */
export const URL_AYUDA =
  'https://github.com/vadykr/presupuesto/tree/master/docs-vadym';

/** En modo Presupuesto los enlaces a la documentación de Actual van a la propia. */
export function urlAyuda(urlUpstream: string): string {
  return MODO_PRESUPUESTO ? URL_AYUDA : urlUpstream;
}

const CLAVE_LISTA_SOLICITADA = 'presupuesto:lista-solicitada';

// La apertura automática solo se intenta una vez por carga de la página:
// después de «Cambiar de archivo» (desde cualquier sitio: Ajustes, barra
// lateral, pestaña Presupuesto…) la lista debe quedarse visible.
let aperturaAutomaticaIntentada = false;

/**
 * Devuelve `true` solo la primera vez que se llama en esta carga de la página.
 */
export function primeraAperturaAutomatica(): boolean {
  if (aperturaAutomaticaIntentada) {
    return false;
  }
  aperturaAutomaticaIntentada = true;
  return true;
}

/**
 * Marca que el usuario ha pedido ver la lista de archivos a propósito
 * («Cambiar de archivo» en Ajustes o en la barra lateral), para que el modo
 * «un solo presupuesto» no vuelva a abrir el único archivo de inmediato.
 */
export function solicitarListaDePresupuestos() {
  try {
    sessionStorage.setItem(CLAVE_LISTA_SOLICITADA, '1');
  } catch {
    // sessionStorage no disponible: simplemente no se recuerda la petición
  }
}

/**
 * Devuelve `true` (una sola vez) si el usuario pidió ver la lista.
 */
export function consumirListaSolicitada(): boolean {
  try {
    const solicitada = sessionStorage.getItem(CLAVE_LISTA_SOLICITADA) === '1';
    sessionStorage.removeItem(CLAVE_LISTA_SOLICITADA);
    return solicitada;
  } catch {
    return false;
  }
}

const CLAVE_CONFIG_SERVIDOR = 'presupuesto:config-servidor';

/**
 * Ajustes → «Servidor»: pide que, tras cerrar el presupuesto, se abra la
 * pantalla de configuración del servidor (`/config-server`).
 */
export function solicitarConfigServidor() {
  try {
    sessionStorage.setItem(CLAVE_CONFIG_SERVIDOR, '1');
  } catch {
    // sessionStorage no disponible: simplemente no se recuerda la petición
  }
}

/**
 * Devuelve `true` (una sola vez) si Ajustes pidió abrir la configuración del
 * servidor.
 */
export function consumirConfigServidor(): boolean {
  try {
    const solicitada = sessionStorage.getItem(CLAVE_CONFIG_SERVIDOR) === '1';
    sessionStorage.removeItem(CLAVE_CONFIG_SERVIDOR);
    return solicitada;
  } catch {
    return false;
  }
}
