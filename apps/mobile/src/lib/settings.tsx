import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { I18nManager, Platform } from 'react-native';
import { isLanguageCode, isRtl, pickLanguage, type LanguageCode, type UserLocation } from '@cityjoy/shared';

import i18n from './i18n';
import { deviceStorage } from './storage';

const STORAGE_KEY = 'settings:v1';

interface StoredSettings {
  language: LanguageCode | null;
  location: UserLocation | null;
  /** Kullanıcı konum adımını tamamladı ya da atladı. */
  locationStepDone: boolean;
}

interface SettingsContextValue extends StoredSettings {
  ready: boolean;
  suggestedLanguage: LanguageCode;
  rtl: boolean;
  setLanguage(code: LanguageCode): Promise<void>;
  setLocation(location: UserLocation | null): Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const EMPTY: StoredSettings = { language: null, location: null, locationStepDone: false };

function applyDirection(code: LanguageCode) {
  const rtl = isRtl(code);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = code;
    }
    return;
  }
  // Yerel bileşenler (gezinme başlıkları vb.) yön değişikliğini bir sonraki açılışta alır;
  // ekran içeriği kök görünümdeki "direction" sayesinde hemen çevrilir.
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(EMPTY);
  const suggestedLanguage = useMemo(
    () => pickLanguage(getLocales().map((l) => l.languageTag)),
    [],
  );

  useEffect(() => {
    (async () => {
      const raw = await deviceStorage.get(STORAGE_KEY);
      let stored = EMPTY;
      try {
        if (raw) stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<StoredSettings>) };
      } catch {}
      if (stored.language && !isLanguageCode(stored.language)) stored.language = null;
      const lang = stored.language ?? suggestedLanguage;
      await i18n.changeLanguage(lang);
      applyDirection(lang);
      setSettings(stored);
      setReady(true);
    })();
  }, [suggestedLanguage]);

  const persist = useCallback(async (next: StoredSettings) => {
    setSettings(next);
    await deviceStorage.set(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setLanguage = useCallback(
    async (code: LanguageCode) => {
      await i18n.changeLanguage(code);
      applyDirection(code);
      await persist({ ...settings, language: code });
    },
    [persist, settings],
  );

  const setLocation = useCallback(
    (location: UserLocation | null) => persist({ ...settings, location, locationStepDone: true }),
    [persist, settings],
  );

  const activeLanguage = settings.language ?? suggestedLanguage;
  const value: SettingsContextValue = {
    ...settings,
    ready,
    suggestedLanguage,
    rtl: isRtl(activeLanguage),
    setLanguage,
    setLocation,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı');
  return ctx;
}
