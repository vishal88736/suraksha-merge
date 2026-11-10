"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { View } from "../components/shell/app-shell.tsx";

const VIEWS: View[] = ["home", "desk", "pipeline", "benchmarks", "policy"];
const CHANGE_EVENT = "suraksha:view-change";

function readView(): View {
  if (typeof window === "undefined") return "home";
  const value = new URLSearchParams(window.location.search).get("view");
  return value && VIEWS.includes(value as View) ? (value as View) : "home";
}

/**
 * Keep the current view in the address bar so a view can be linked and the
 * browser's back button works. The landing page stays the bare path.
 */
export function useUrlView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("popstate", onChange);
        window.removeEventListener(CHANGE_EVENT, onChange);
      };
    },
    readView,
    () => "home" as View,
  );

  const setView = useCallback((next: View) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    window.scrollTo({ top: 0 });
  }, []);

  return [view, setView];
}
