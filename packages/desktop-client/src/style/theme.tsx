import { useEffect, useMemo } from 'react';

import darkThemeCss from '@actual-app/components/themes/dark.css?inline';
import lightThemeCss from '@actual-app/components/themes/light.css?inline';
import midnightThemeCss from '@actual-app/components/themes/midnight.css?inline';
import paletteCss from '@actual-app/components/themes/palette.css?inline';
import presupuestoDarkCss from '@actual-app/components/themes/presupuesto-dark.css?inline';
import presupuestoLightCss from '@actual-app/components/themes/presupuesto-light.css?inline';
import sidebarRedesignLightCss from '@actual-app/components/themes/sidebar-redesign-light.css?inline';
import type { DarkTheme, Theme } from '@actual-app/core/types/prefs';

import { useGlobalPref } from '#hooks/useGlobalPref';

import {
  isBaseTheme,
  migrateLegacyOverride,
  parseInstalledTheme,
  usesRedesignSidebarPalette,
  validateThemeCssSafely,
} from './customThemes';

// Temas propios del fork (concepto A · Cartera): capa encima de light/dark.
// Son los temas por defecto: «auto» elige entre ellos según el sistema.
const themes = {
  'presupuesto-dark': {
    name: 'Rumbo oscuro',
    colors: `${darkThemeCss}\n${presupuestoDarkCss}`,
  },
  'presupuesto-light': {
    name: 'Rumbo claro',
    colors: `${lightThemeCss}\n${presupuestoLightCss}`,
  },
  light: { name: 'Light', colors: lightThemeCss },
  dark: { name: 'Dark', colors: darkThemeCss },
  midnight: { name: 'Midnight', colors: midnightThemeCss },
  auto: { name: 'System default' },
} as const;

/** Tema claro que usa «auto» cuando el sistema está en modo claro. */
const AUTO_LIGHT_THEME = 'presupuesto-light';

/** ¿El tema elegido es oscuro? (para «auto» decide el sistema). */
export function isDarkThemeName(theme: string | undefined): boolean {
  if (theme === 'auto' || theme === undefined) {
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }
  return (
    theme === 'dark' || theme === 'midnight' || theme === 'presupuesto-dark'
  );
}

export const themeOptions = Object.entries(themes).map(
  ([key, { name }]) => [key, name] as [Theme, string],
);

export const darkThemeOptions = Object.entries({
  'presupuesto-dark': themes['presupuesto-dark'],
  dark: themes.dark,
  midnight: themes.midnight,
}).map(([key, { name }]) => [key, name] as [DarkTheme, string]);

// Presupuesto: las preferencias guardadas con los temas de Actual («dark»,
// «midnight», «light») se leen como los temas propios, para que un archivo
// importado antes del pase visual no se quede con el morado de Actual.
function temaPropio<T extends string>(theme: T): T {
  if (theme === 'dark' || theme === 'midnight') {
    return 'presupuesto-dark' as T;
  }
  if (theme === 'light') {
    return 'presupuesto-light' as T;
  }
  return theme;
}

export function useTheme() {
  const [theme = 'auto', setThemePref] = useGlobalPref('theme');
  return [temaPropio(theme), setThemePref] as const;
}

export function usePreferredDarkTheme() {
  const [darkTheme = 'presupuesto-dark', setDarkTheme] =
    useGlobalPref('preferredDarkTheme');
  return [temaPropio(darkTheme), setDarkTheme] as const;
}

/**
 * One-time migration: moves any legacy `overrideCss` field out of the
 * installed theme JSON blobs and into the new `customCssOverride` global pref.
 *
 * TODO: remove this after v26.6.0 is released
 */
function useMigrateLegacyOverride() {
  const [customCssOverride, setCustomCssOverride] =
    useGlobalPref('customCssOverride');
  const [installedCustomLightThemeJson, setInstalledCustomLightThemeJson] =
    useGlobalPref('installedCustomLightTheme');
  const [installedCustomDarkThemeJson, setInstalledCustomDarkThemeJson] =
    useGlobalPref('installedCustomDarkTheme');

  useEffect(() => {
    const result = migrateLegacyOverride({
      existingOverride: customCssOverride,
      lightJson: installedCustomLightThemeJson,
      darkJson: installedCustomDarkThemeJson,
    });

    if (!result) return;

    setCustomCssOverride(result.override);
    if (result.newLightJson !== installedCustomLightThemeJson) {
      setInstalledCustomLightThemeJson(result.newLightJson);
    }
    if (result.newDarkJson !== installedCustomDarkThemeJson) {
      setInstalledCustomDarkThemeJson(result.newDarkJson);
    }
    // Re-runs when prefs hydrate so migration isn't missed if the installed
    // theme JSONs arrive after the first render. migrateLegacyOverride is
    // idempotent: once customCssOverride is set (or the legacy field is
    // stripped), subsequent invocations return null.
  }, [
    customCssOverride,
    installedCustomLightThemeJson,
    installedCustomDarkThemeJson,
    setCustomCssOverride,
    setInstalledCustomLightThemeJson,
    setInstalledCustomDarkThemeJson,
  ]);
}

function getBaseThemeColors(baseTheme: string | undefined) {
  // Theme prefs are untrusted strings; unknown values resolve to undefined.
  return baseTheme !== undefined && isBaseTheme(baseTheme)
    ? themes[baseTheme].colors
    : undefined;
}

export function ThemeStyle() {
  const [activeTheme] = useTheme();
  const [darkThemePreference] = usePreferredDarkTheme();
  const [installedCustomLightThemeJson] = useGlobalPref(
    'installedCustomLightTheme',
  );
  const [installedCustomDarkThemeJson] = useGlobalPref(
    'installedCustomDarkTheme',
  );

  const [customCssOverride] = useGlobalPref('customCssOverride');

  // Rendered rather than injected from an effect so the CSS variables exist
  // in the same commit as any consumer effect that reads them.
  const customLightTheme = parseInstalledTheme(installedCustomLightThemeJson);
  const themeColors =
    getBaseThemeColors(customLightTheme?.baseTheme) ??
    getBaseThemeColors(activeTheme === 'auto' ? AUTO_LIGHT_THEME : activeTheme);

  if (!themeColors) return null;

  const sidebarRedesignCss =
    (themeColors === themes.light.colors ||
      themeColors === themes['presupuesto-light'].colors) &&
    usesRedesignSidebarPalette(
      [customLightTheme?.cssContent, customCssOverride]
        .map(css => validateThemeCssSafely(css))
        .join('\n'),
    )
      ? sidebarRedesignLightCss
      : null;

  if (activeTheme !== 'auto') {
    return (
      <>
        <style>{paletteCss}</style>
        <style>{themeColors}</style>
        {sidebarRedesignCss != null && <style>{sidebarRedesignCss}</style>}
      </>
    );
  }

  // Let the browser pick the sheet so system theme changes need no re-render.
  const darkColors =
    getBaseThemeColors(
      parseInstalledTheme(installedCustomDarkThemeJson)?.baseTheme,
    ) ??
    getBaseThemeColors(darkThemePreference) ??
    themes['presupuesto-dark'].colors;

  return (
    <>
      <style>{paletteCss}</style>
      <style media="(prefers-color-scheme: light)">{themeColors}</style>
      {sidebarRedesignCss != null && (
        <style media="(prefers-color-scheme: light)">
          {sidebarRedesignCss}
        </style>
      )}
      <style media="(prefers-color-scheme: dark)">{darkColors}</style>
    </>
  );
}

/**
 * CustomThemeStyle injects CSS from the installed custom theme (if any).
 * This is rendered after ThemeStyle to allow custom themes to override base theme variables.
 *
 * When `theme === 'auto'`, separate custom themes can be set for light and dark modes,
 * injected via @media (prefers-color-scheme) rules. Otherwise, a single custom theme applies.
 */
export function CustomThemeStyle() {
  useMigrateLegacyOverride();
  const [activeTheme] = useTheme();
  const [installedCustomLightThemeJson] = useGlobalPref(
    'installedCustomLightTheme',
  );
  const [installedCustomDarkThemeJson] = useGlobalPref(
    'installedCustomDarkTheme',
  );
  const [customCssOverride] = useGlobalPref('customCssOverride');

  const validatedCss = useMemo(() => {
    const safeValidate = (css: string | undefined, errorLabel: string) =>
      validateThemeCssSafely(css, error =>
        console.error(errorLabel, { error }),
      );

    let baseCss = '';
    if (activeTheme === 'auto') {
      const lightCss = safeValidate(
        parseInstalledTheme(installedCustomLightThemeJson)?.cssContent,
        'Invalid custom light theme CSS',
      );
      if (lightCss) {
        baseCss += `@media (prefers-color-scheme: light) { ${lightCss} }\n`;
      }
      const darkCss = safeValidate(
        parseInstalledTheme(installedCustomDarkThemeJson)?.cssContent,
        'Invalid custom dark theme CSS',
      );
      if (darkCss) {
        baseCss += `@media (prefers-color-scheme: dark) { ${darkCss} }\n`;
      }
    } else {
      baseCss = safeValidate(
        parseInstalledTheme(installedCustomLightThemeJson)?.cssContent,
        'Invalid custom theme CSS',
      );
    }

    const overrideLayer = safeValidate(
      customCssOverride,
      'Invalid custom CSS override',
    );

    const combined = [baseCss, overrideLayer].filter(Boolean).join('\n');
    return combined || null;
  }, [
    activeTheme,
    installedCustomLightThemeJson,
    installedCustomDarkThemeJson,
    customCssOverride,
  ]);

  if (!validatedCss) {
    return null;
  }

  return <style id="custom-theme-active">{validatedCss}</style>;
}
