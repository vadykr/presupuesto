import { useTheme } from '#style/theme';

import { PALETA_CLARA, PALETA_OSCURA } from './coloresCategorias';

function declaraciones(paleta: readonly string[]) {
  return paleta.map((hex, i) => `--informes-c${i}: ${hex};`).join(' ');
}

const CLARO = `:root { ${declaraciones(PALETA_CLARA)} }`;
const OSCURO = `:root { ${declaraciones(PALETA_OSCURA)} }`;

/**
 * Variables CSS de la paleta categórica de «Informes» (`--informes-c0..c7`),
 * elegidas para el tema activo. Con el tema «auto» decide el navegador, igual
 * que hace `ThemeStyle` con el resto de colores.
 */
export function PaletaInformes() {
  const [tema] = useTheme();
  if (tema === 'auto') {
    return (
      <>
        <style media="(prefers-color-scheme: light)">{CLARO}</style>
        <style media="(prefers-color-scheme: dark)">{OSCURO}</style>
      </>
    );
  }
  return <style>{tema === 'light' ? CLARO : OSCURO}</style>;
}
