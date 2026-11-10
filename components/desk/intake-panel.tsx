"use client";
import {
  CheckCheck,
  ChevronDown,
  Copy,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { pretty } from "../../lib/format.ts";
import { SCENARIOS } from "../../lib/content/scenarios.ts";
import { replyLanguage } from "../../lib/i18n/locales.ts";
import type { TriageInput, TriageResult } from "../../lib/engine.ts";
import { MaskedText } from "./masked-text.tsx";
import { Composer } from "./composer.tsx";

export function IntakePanel({
  selected,
  input,
  rawMessage,
  result,
  stale,
  hasRun,
  loading,
  error,
  masked,
  revealed,
  authRequired, apiKey, onApiKey,
  onSelect,
  onInput,
  onRun,
  onRetry,
  onReset,
  onCopy,
  onTogglePrivacy,
}: {
  selected: number;
  input: TriageInput;
  /** The submitted message for the temporary local reveal; never included in trace exports. */
  rawMessage: string;
  result: TriageResult;
  stale: boolean;
  hasRun: boolean;
  loading: boolean;
  error: string;
  masked: boolean;
  revealed: boolean;
  authRequired: boolean; apiKey: string; onApiKey: (key: string) => void;
  onSelect: (index: number) => void;
  onInput: (patch: Partial<TriageInput>) => void;
  onRun: () => void;
  onRetry: () => void;
  onReset: () => void;
  onCopy: (text: string) => void;
  onTogglePrivacy: () => void;
}) {
  const { t, locale } = useI18n();
  const scenario = SCENARIOS[selected]!;

  return (
    <section className="panel intake-panel" aria-labelledby="intake-heading">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon">
            <MessageSquareText size={18} />
          </span>
          <div>
            <h2 id="intake-heading">{t("intake.title")}</h2>
            <span>{t("intake.subtitle")}</span>
          </div>
        </div>
        <span className="pill soft">{t("intake.demoBadge")}</span>
      </div>
      <div className="scenario-picker">
        <label className="eyebrow" htmlFor="scenario">
          {t("intake.tryScenario")}
        </label>
        <div className="select-wrap">
          <select
            id="scenario"
            value={selected}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            {SCENARIOS.map((item, index) => (
              <option value={index} key={item.id}>
                {item.title[locale]} · {replyLanguage(item.language).label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="scenario-meta">
          <span
            className={`category-dot ${selected === 1 || selected === 5 ? "blue-dot" : ""}`}
          />
          {scenario.description[locale]}
        </div>
      </div>
      <Composer
        input={input}
        loading={loading}
        error={error}
        authRequired={authRequired}
        apiKey={apiKey}
        onApiKey={onApiKey}
        locale={locale}
        onInput={onInput}
        onRun={onRun}
        onRetry={onRetry}
        onReset={onReset}
      />
      <div className="conversation">
        <div className="conversation-date">
          <span />
          {stale
            ? t("intake.unrunChanges")
            : hasRun
              ? t("intake.latestTriage")
              : t("intake.scenarioPreview")}
          <span />
        </div>
        <details className="source-details"><summary><LockKeyhole size={14}/>{t("intake.sourceMessage")}<ChevronDown size={14}/></summary>
        <div className="message-label">
          <span className="customer-avatar">C</span>
          <strong>{t("intake.customer")}</strong>
          <span>{replyLanguage(result.payload.detected_language).label}</span>
        </div>
        <div className="customer-bubble">
          <p>
            {masked ? (
              <MaskedText text={result.privacy.sanitized} />
            ) : (
              rawMessage
            )}
          </p>
          <div className="bubble-footer">
            <span>
              <span className="panic-dot" />
              {t("intake.urgency", {
                severity: pretty(result.payload.panic_severity),
              })}
            </span>
            <button
              onClick={onTogglePrivacy}
              aria-pressed={revealed}
              aria-label={t("intake.revealRaw")}
              title={t("intake.revealRaw")}
            >
              <LockKeyhole size={12} />
              {revealed ? t("intake.revealed") : t("intake.maskPii")}
            </button>
          </div>
        </div>
        </details>
        <div className="message-label assistant-label">
          <span className="assistant-avatar">
            <ShieldCheck size={16} />
          </span>
          <strong>{t("intake.draft")}</strong>
          <span className="draft-tag">{t("intake.forReview")}</span>
          <button
            className="icon-button"
            disabled={stale || loading}
            aria-label={t("intake.copyReply")}
            onClick={() => onCopy(result.reply.text)}
          >
            <Copy size={14} />
          </button>
        </div>
        <div className="assistant-bubble">
          <p className="reply-intro">{result.reply.introduction}</p>
          <ol>
            {result.reply.steps.map((step, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <details className="escalation-details">
            <summary>
              {t("intake.escalation")} <ChevronDown size={13} />
            </summary>
            <p>{result.reply.escalation}</p>
          </details>
          <div className="draft-footer">
            <CheckCheck size={14} /> {t("intake.draftFooter")}
          </div>
        </div>
      </div>

    </section>
  );
}
