"use client";
import { useRef } from "react";
import {
  Activity,
  ArrowUpRight,
  Braces,
  Check,
  CircleHelp,
  Copy,
  FileCheck2,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { currency, pretty } from "../../lib/format.ts";
import type { TriageResult } from "../../lib/engine.ts";
import { POLICY_VERSION } from "../../lib/policy.ts";
import { JsonView } from "./json-view.tsx";
import { MaskedText } from "./masked-text.tsx";

type Tab = "overview" | "json" | "provenance";
const TABS: Tab[] = ["overview", "json", "provenance"];

function Liability({ result }: { result: TriageResult }) {
  const { t } = useI18n();
  const tier = result.payload.rbi_liability_tier;
  const deadline = result.sla.deadline_days;
  const technical = deadline !== null;
  const zero = tier === "ZERO_LIABILITY_ELIGIBLE";
  const variant = technical ? "blue" : zero ? "green" : "amber";
  return (
    <div className={`liability ${variant}`}>
      <div className="liability-symbol">
        {technical ? (
          <Activity size={20} />
        ) : zero ? (
          <ShieldCheck size={20} />
        ) : (
          <CircleHelp size={20} />
        )}
      </div>
      <div>
        <div className="eyebrow">
          {technical ? t("liability.timeline") : t("liability.assessment")}
        </div>
        <strong>
          {technical
            ? t("liability.deadline", { days: deadline })
            : tier === "PENDING_VERIFICATION"
              ? t("liability.verificationRequired")
              : pretty(tier)}
        </strong>
        <p>
          {technical
            ? t("liability.dailyPenalty", { days: deadline })
            : zero
              ? t("liability.conditional")
              : t("liability.responsible")}
        </p>
      </div>
      {technical && result.sla.estimated_compensation_inr !== null && (
        <div className="compensation">
          <strong>{currency(result.sla.estimated_compensation_inr)}</strong>
          <span>{t("liability.compensation")}</span>
        </div>
      )}
    </div>
  );
}

export function EnginePanel({
  result,
  tab,
  onTab,
  onCopy,
  onExport,
  onDownloadPayload,
  rawVisible,
  stale,
}: {
  result: TriageResult;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onCopy: (text: string) => void;
  onExport: () => void;
  onDownloadPayload: () => void;
  rawVisible: boolean;
  stale: boolean;
}) {
  const { t } = useI18n();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as the tab pattern requires.
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.indexOf(tab);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onTab(TABS[next]!);
    tabRefs.current[next]?.focus();
  };

  const tabLabel = (value: Tab) =>
    value === "overview"
      ? t("engine.tabOverview")
      : value === "json"
        ? t("engine.tabJson")
        : t("engine.tabProvenance");

  return (
    <section
      className="panel intelligence-panel"
      aria-labelledby="engine-heading"
    >
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon teal-icon">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 id="engine-heading">{t("engine.title")}</h2>
            <span>{t("engine.subtitle")}</span>
          </div>
        </div>
        <span className="pill green-pill">
          <span className="online-dot" /> {t("engine.live")}
        </span>
      </div>
      <div className="engine-tabs-row">
        <div
          className="engine-tabs"
          role="tablist"
          aria-label={t("engine.title")}
          onKeyDown={onTabKeyDown}
        >
          {TABS.map((value, index) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`tab-${value}`}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              aria-controls="output-panel"
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => onTab(value)}
            >
              {value === "json" ? (
                <Braces size={14} />
              ) : value === "provenance" ? (
                <Fingerprint size={14} />
              ) : (
                <LayoutDashboard size={14} />
              )}{" "}
              {tabLabel(value)}
            </button>
          ))}
        </div>
        <span className="payload-version">{t("engine.schemaVersion")}</span>
      </div>
      <p className="engine-source" data-status={result.audit.model.status}>
        {result.audit.model.status === "used"
          ? t("engine.sourceModel", {
              model: result.audit.model.model.base_model,
              variant: result.audit.model.model.unreviewed_pilot
                ? t("engine.variantPilot")
                : result.audit.model.model.adapter
                  ? t("engine.variantAdapter")
                  : t("engine.variantBase"),
              ms: Math.round(result.audit.model.latency_ms),
            })
          : result.audit.model.status === "fallback"
            ? t("engine.sourceFallback", {
                reasons: result.audit.model.reasons.join(", "),
              })
            : t("engine.sourceRules")}
      </p>
      <div
        id="output-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="output-content"
      >
        {tab === "overview" && (
          <>
            <Liability result={result} />
            <div className="transaction-grid">
              <div>
                <span>{t("transaction.amount")}</span>
                <strong className="amount">
                  {currency(result.payload.amount_inr)}
                </strong>
              </div>
              <div>
                <span>
                  {t("transaction.reference")} <Fingerprint size={12} />
                </span>
                <strong className="mono utr-value">
                  {result.payload.utr_number ??
                    t("transaction.needsConfirmation")}
                </strong>
                <small>
                  {result.payload.utr_number ? (
                    <>
                      <Check size={11} /> {t("transaction.presentInSource")}
                    </>
                  ) : (
                    t("transaction.uniqueRequired")
                  )}
                </small>
              </div>
              <div className="wide">
                <span>
                  {t("transaction.classification")}{" "}
                  <span className="muted">
                    {t("transaction.internalTaxonomy")}
                  </span>
                </span>
                <strong className="classification">
                  {pretty(result.payload.dispute_category)}
                </strong>
              </div>
            </div>
            <div className="section-header">
              <h3>
                <LockKeyhole size={14} /> {t("privacy.heading")}
              </h3>
              <span className="subtle-label">{t("privacy.before")}</span>
            </div>
            <div className="privacy-summary">
              <div>
                <span className="privacy-count">
                  {result.privacy.redactions.length.toString().padStart(2, "0")}
                </span>
                <div>
                  <strong>{t("privacy.masked")}</strong>
                  <p>
                    {[
                      ...new Set(
                        result.privacy.redactions.map((r) => pretty(r.type)),
                      ),
                    ].join(" · ") || t("privacy.noPatterns")}
                  </p>
                  {rawVisible && (
                    <p className="privacy-warning">{t("intake.revealed")}</p>
                  )}
                </div>
                <ShieldCheck size={20} />
              </div>
              <div className="anchor-row">
                <Fingerprint size={14} />
                <span>
                  {result.payload.utr_number
                    ? t("privacy.preserved")
                    : t("privacy.noVerified")}
                </span>
                {result.payload.utr_number ? (
                  <Check size={14} />
                ) : (
                  <CircleHelp size={14} />
                )}
              </div>
            </div>
            <div className="section-header">
              <h3>
                <FileCheck2 size={14} /> {t("checks.heading")}
              </h3>
              <span className="subtle-label">
                {result.audit.mode === "model_validated"
                  ? t("checks.modelValidated")
                  : t("checks.deterministic")}
              </span>
            </div>
            <div className="guardrail-list">
              {[
                {
                  title: t("checks.schema"),
                  detail: t("checks.schemaDetail"),
                  pass: result.audit.schema_valid,
                },
                {
                  title: t("checks.provenance"),
                  detail: result.audit.utr_grounded
                    ? t("checks.provenanceOk")
                    : t("checks.provenanceBad"),
                  pass: result.audit.utr_grounded === true,
                },
                {
                  title: t("checks.guarantee"),
                  detail: t("checks.guaranteeDetail"),
                  pass: result.audit.no_unauthorized_promises,
                },
                {
                  title: t("checks.rails"),
                  detail: t("checks.railsDetail"),
                  pass: result.audit.fraud_rails_present,
                },
              ].map((check) => (
                <div className="guardrail" key={check.title}>
                  <span
                    className={`check-icon ${!check.pass ? "review-icon" : ""}`}
                  >
                    {check.pass ? (
                      <Check size={12} />
                    ) : (
                      <CircleHelp size={12} />
                    )}
                  </span>
                  <div>
                    <strong>{check.title}</strong>
                    <small>{check.detail}</small>
                  </div>
                  <span
                    className={`check-label ${!check.pass ? "review-label" : ""}`}
                  >
                    {check.pass ? t("checks.pass") : t("checks.review")}
                  </span>
                </div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <div className="review-note">
                <TriangleAlert size={15} />
                <div>
                  <strong>{t("checks.humanTitle")}</strong>
                  {result.warnings.map((warning, index) => (
                    <p key={index}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
            <button className="payload-link" onClick={() => onTab("json")}>
              <Braces size={15} /> {t("engine.inspectJson")}{" "}
              <ArrowUpRight size={14} />
            </button>
          </>
        )}
        {tab === "json" && (
          <>
            <div className="json-toolbar">
              <span>
                <span className="online-dot" /> {t("engine.validSchema")}
              </span>
              <button
                className="small-button"
                disabled={stale}
                onClick={() => onCopy(JSON.stringify(result.payload, null, 2))}
              >
                <Copy size={13} /> {t("engine.copyJson")}
              </button>
            </div>
            <JsonView value={result.payload} />
            <div className="json-bottom-note">
              <CircleHelp size={14} /> {t("engine.jsonNote")}
            </div>
            <button
              className="payload-link"
              disabled={stale}
              onClick={onDownloadPayload}
            >
              <Braces size={15} /> {t("engine.downloadPayload")}{" "}
              <ArrowUpRight size={14} />
            </button>
          </>
        )}
        {tab === "provenance" && (
          <>
            <div className="section-header">
              <h3>{t("provenance.evidence")}</h3>
              <span className="pill soft">
                {t("provenance.anchors", { count: result.evidence.length })}
              </span>
            </div>
            <div className="evidence-list">
              {result.evidence.map((evidence, index) => (
                <div className="evidence-card" key={index}>
                  <span className="mono">{evidence.field}</span>
                  <strong>{evidence.value}</strong>
                  <small>
                    <Fingerprint size={12} />
                    {pretty(evidence.source)}
                    {evidence.start !== undefined
                      ? ` · source offset ${evidence.start}`
                      : ""}
                  </small>
                </div>
              ))}
            </div>
            <div className="section-header">
              <h3>{t("provenance.context")}</h3>
              <span className="subtle-label">{t("provenance.regex")}</span>
            </div>
            <div className="sanitized-context">
              <MaskedText text={result.privacy.sanitized} />
            </div>
            <div className="review-note">
              <CircleHelp size={16} />
              <div>
                <strong>{t("provenance.disclaimerTitle")}</strong>
                <p>{t("provenance.disclaimerBody")}</p>
              </div>
            </div>
            <button
              className="payload-link"
              disabled={stale}
              onClick={onExport}
            >
              <ArrowUpRight size={15} /> {t("provenance.export")}
            </button>
          </>
        )}
      </div>
      <div className="engine-footer">
        <span>
          <LockKeyhole size={12} /> {t("engine.noStorage")}
        </span>
        <span>{POLICY_VERSION}</span>
      </div>
    </section>
  );
}
