import i18n from 'i18next';

import {
  availableLanguages,
  DEFAULT_LANGUAGE,
  loadLanguage,
  setI18NextLanguage,
} from './i18n';

vi.mock('i18next', () => {
  const i18nMock = {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    changeLanguage: vi.fn(),
  };
  return {
    default: i18nMock,
  };
});

vi.mock('./languages', () => ({
  languages: {
    '/locale/en.json': vi.fn(),
    '/locale/es.json': vi.fn().mockResolvedValue({
      default: {
        'To Budget': 'Para presupuestar',
        Budgeted: 'Presupuestado',
      },
    }),
    '/locale/uk.json': vi.fn().mockResolvedValue({ Account: 'Рахунок' }),
    '/locale/pt-BR.json': vi.fn(),
  },
  languageOverrides: {
    '/src/locale-overrides/es.json': {
      'To Budget': 'Listo para asignar',
      'Pin to home': 'Fijar en inicio',
    },
  },
}));

vi.hoisted(vi.resetModules);

describe('setI18NextLanguage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(vi.unstubAllGlobals);

  test('should default to DEFAULT_LANGUAGE when no language is provided', () => {
    // En modo test DEFAULT_LANGUAGE es 'en'; en la app real es 'es'.
    vi.stubGlobal('navigator', { language: 'uk' });

    setI18NextLanguage('');

    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith(
      DEFAULT_LANGUAGE,
    );
  });

  test('should set the provided language if it is available', () => {
    const language = availableLanguages[0];

    setI18NextLanguage(language);

    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith(language);
  });

  test('should fallback to English if the provided language is unavailable', () => {
    vi.spyOn(console, 'info');

    setI18NextLanguage('unknown');

    expect(console.info).toHaveBeenCalledWith(
      'Unknown locale unknown, falling back to en',
    );
    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith('en');
  });

  test('should successfully use a language with a region code if it is known', () => {
    const language = 'pt-BR';

    setI18NextLanguage(language);

    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith(language);
  });

  test('should fallback to base language if the provided language has an unknown region code', () => {
    vi.spyOn(console, 'info');

    setI18NextLanguage('uk-ZZ');

    expect(console.info).toHaveBeenCalledWith(
      'Unknown locale uk-ZZ, falling back to uk-zz',
    );
    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith('uk');
  });

  test('should fallback to lowercase language if the provided language has uppercase letters', () => {
    vi.spyOn(console, 'info');

    setI18NextLanguage('EN');

    expect(console.info).toHaveBeenCalledWith(
      'Unknown locale EN, falling back to en',
    );
    expect(vi.mocked(i18n).changeLanguage).toHaveBeenCalledWith('en');
  });
});

describe('loadLanguage (traducciones propias)', () => {
  test('superpone locale-overrides/es.json sobre la traducción de upstream', async () => {
    const translations = await loadLanguage('es');

    // Corregida por el override
    expect(translations['To Budget']).toBe('Listo para asignar');
    // Nueva, solo en el override
    expect(translations['Pin to home']).toBe('Fijar en inicio');
    // Intacta, solo en upstream
    expect(translations['Budgeted']).toBe('Presupuestado');
  });

  test('devuelve la traducción de upstream tal cual si no hay override', async () => {
    const translations = await loadLanguage('uk');

    expect(translations).toEqual({ Account: 'Рахунок' });
  });

  test('falla con un idioma desconocido', async () => {
    await expect(loadLanguage('zz')).rejects.toThrow('Unknown locale zz');
  });
});
