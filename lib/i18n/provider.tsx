"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  type UiLocale,
} from "./locales";
import { translate, type MessageKey, type MessageVars } from "./catalog";

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
 * render agree and the stored preference is applied without a flash.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
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

  const setLocale = useCallback((next: UiLocale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can deny storage; the locale still applies.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value)
    throw new Error("useI18n must be used inside an I18nProvider boundary.");
  return value;
}
