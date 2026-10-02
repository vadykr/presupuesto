export const languages = import.meta.glob([
  '/locale/*.json',
  '!/locale/*_old.json',
]);

// Traducciones propias de «Presupuesto», cargadas de forma inmediata (son
// pequeñas) y fusionadas sobre las de upstream en `loadLanguage` (i18n.ts).
export const languageOverrides = import.meta.glob<Record<string, string>>(
  '/src/locale-overrides/*.json',
  { eager: true, import: 'default' },
);
