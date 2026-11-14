"use client";
import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  uiLocale,
  type UiLocale,
} from "./locales";
import {
  isLocaleLoaded,
  loadLocale,
  translate,
  type MessageKey,
  type MessageVars,
} from "./catalog";

export type I18nValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey, vars?: MessageVars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "suraksha.locale";
const CHANGE_EVENT = "suraksha:locale-change";

/**
 * The locale lives in localStorage and is read through
 * useSyncExternalStore, so the server-rendered markup and the first client
 * render agree; the browser then applies the URL or stored preference.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): UiLocale {
  try {
    // A link may carry the language, so a shared view opens in the reader's
    // language before the stored preference is applied.
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (isUiLocale(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isUiLocale(stored) ? stored : DEFAULT_UI_LOCALE;
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}

const getServerSnapshot = (): UiLocale => DEFAULT_UI_LOCALE;

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Generated locales load on demand; the counter re-renders once they arrive.
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const { htmlLang, dir } = uiLocale(locale);
    document.documentElement.lang = htmlLang;
    document.documentElement.dir = dir;
    if (isLocaleLoaded(locale)) return;
    let active = true;
    loadLocale(locale)
      .then(() => active && setLoaded((n) => n + 1))
      .catch(() => {
        // A failed chunk leaves the interface in English rather than blank.
      });
    return () => {
      active = false;
    };
  }, [locale]);

  const setLocale = useCallback((next: UiLocale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can deny storage; the locale still applies.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale, loaded],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value)
    throw new Error("useI18n must be used inside an I18nProvider boundary.");
  return value;
}
