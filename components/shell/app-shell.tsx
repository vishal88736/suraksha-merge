"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  GitMerge,
  LayoutDashboard,
  ArrowUpRight,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { UI_LOCALES } from "../../lib/i18n/locales.ts";

export type View = "home" | "desk" | "pipeline" | "benchmarks" | "policy";

export const VIEWS = [
  { id: "desk", icon: LayoutDashboard, key: "nav.triageDesk" },
  { id: "pipeline", icon: Workflow, key: "nav.pipeline" },
  { id: "benchmarks", icon: FlaskConical, key: "nav.benchmarks" },
  { id: "policy", icon: BookOpen, key: "nav.policy" },
] as const satisfies readonly {
  id: View;
  icon: typeof LayoutDashboard;
  key: string;
}[];

export function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();
  return (
    <label className="language-switcher">
      <span className="visually-hidden">{t("nav.interfaceLanguage")}</span>
      <select
        aria-label={t("nav.interfaceLanguage")}
        value={locale}
        onChange={(event) =>
          setLocale(event.target.value as (typeof UI_LOCALES)[number]["code"])
        }
      >
        {UI_LOCALES.map((option) => (
          <option value={option.code} key={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
      <ChevronDown size={13} />
    </label>
  );
}

type ModelStatus = "none" | "pilot" | "trained";

/** Ask /api/health once which model, if any, is answering. */
function useModelStatus(): ModelStatus {
  const [status, setStatus] = useState<ModelStatus>("none");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then(
        (response) =>
          (response.ok ? response.json() : null) as Promise<{
            model_reachable?: boolean;
            trained_model_connected?: boolean;
          } | null>,
      )
      .then((body) =>
        setStatus(
          body?.trained_model_connected
            ? "trained"
            : body?.model_reachable
              ? "pilot"
              : "none",
        ),
      )
      .catch(() => {
        // Health is informational; the desk works without it.
      });
    return () => controller.abort();
  }, []);
  return status;
}

export function AppShell({
  view,
  onView,
  children,
}: {
  view: View;
  onView: (view: View) => void;
  children: React.ReactNode;
}) {
  const modelStatus = useModelStatus();
  const { t } = useI18n();
  const current = VIEWS.find((item) => item.id === view);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <aside className="sidebar">
        <Link
          href="/"
          className="brand"
          aria-label={t("nav.brandHome")}
          onClick={(event) => {
            event.preventDefault();
            onView("home");
          }}
        >
          <span className="brand-symbol">
            <ShieldCheck size={23} strokeWidth={1.7} />
          </span>
          <span>
            suraksha<span className="brand-desk">desk</span>
            <small>{t("nav.brandTagline")}</small>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            {t("nav.workspace")}
            <small>{t("nav.workspaceName")}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">{t("nav.section")}</div>
        <nav aria-label={t("nav.section")}>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => onView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              aria-label={t(item.key)}
              title={t(item.key)}
            >
              <item.icon size={18} aria-hidden="true" />
              <span aria-hidden="true">{t(item.key)}</span>
              {view === item.id && (
                <span className="nav-dot" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-shield">
            <ShieldCheck size={19} />
          </div>
          <strong>{t("nav.trustTitle")}</strong>
          <p>{t("nav.trustBody")}</p>
          <button onClick={() => onView("policy")}>
            {t("nav.trustLink")} <ArrowUpRight size={14} />
          </button>
        </div>
        <a
          className="repo-link"
          href="https://github.com/vishal88736/suraksha-merge"
          target="_blank"
          rel="noreferrer"
        >
          <GitMerge size={16} /> {t("nav.viewSource")}{" "}
          <ArrowUpRight size={14} />
        </a>
        <div className="operator">
          <span className="avatar">R</span>
          <div>
            {t("nav.operator")}
            <small>{t("nav.operatorDemo")}</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-brand"
            onClick={() => onView("home")}
            aria-label={t("nav.brandHome")}
          >
            <ShieldCheck size={23} />
            <span>
              suraksha<strong>desk</strong>
            </span>
          </button>
          <div className="breadcrumb">
            {t("nav.breadcrumbRoot")} <ChevronRight size={13} />
            <strong>{current ? t(current.key) : ""}</strong>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="topbar-divider" />
            <span className="engine-status">
              <span className="online-dot" />{" "}
              {t(
                modelStatus === "trained"
                  ? "topbar.engineTrained"
                  : modelStatus === "pilot"
                    ? "topbar.engineModel"
                    : "topbar.engine",
              )}
            </span>
            <span className="topbar-divider" />
            <span className="research-badge">
              <FlaskConical size={13} /> {t("topbar.research")}
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
