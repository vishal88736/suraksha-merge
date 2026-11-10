"use client";
import { useCallback, useRef, useState } from "react";
import { Globe2, LoaderCircle, RotateCcw, ScanLine, Settings2, ChevronDown, TriangleAlert, Mic, Square } from "lucide-react";
import { REPLY_LANGUAGES, replyLanguage, uiLocale, type UiLocale } from "../../lib/i18n/locales.ts";
import { useI18n } from "../../lib/i18n/provider.tsx";
import type { TriageInput } from "../../lib/engine.ts";
import { useDictation } from "../../hooks/use-dictation.ts";

const REPLY_LANGUAGE_OPTIONS = [
  { code: "auto", label: "Auto-detect language" },
  ...REPLY_LANGUAGES.map((language) => ({
    code: language.code,
    label: language.label,
  })),
] as const;

export function Composer({
  input,
  loading,
  error,
  locale,
  onInput,
  onRun,
  onRetry,
  onReset,
}: {
  input: TriageInput;
  loading: boolean;
  error: string;
  locale: UiLocale;
  onInput: (patch: Partial<TriageInput>) => void;
  onRun: () => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dictationTag =
    !input.language || input.language === "auto"
      ? uiLocale(locale).speech
      : replyLanguage(input.language).speech;

  const handleTranscript = useCallback(
    (transcript: string) => {
      // Dictation is detected on its own, so the reply follows the customer.
      onInput({ message: transcript, language: "auto" });
      textareaRef.current?.focus();
    },
    [onInput],
  );

  const dictation = useDictation({
    language: dictationTag,
    onFinal: handleTranscript,
  });

  const dictationMessage =
    dictation.status === "unsupported"
      ? t("composer.voiceUnsupported")
      : dictation.status === "denied"
        ? t("composer.voiceDenied")
        : dictation.status === "empty"
          ? t("composer.voiceEmpty")
          : "";

  // A browser that cannot dictate still needs the operator context to hand.
  const contextOpen =
    advanced ||
    dictation.status === "unsupported" ||
    dictation.status === "denied";

  return (
    <div className="composer">
      <div className="composer-heading">
        <label htmlFor="message">{t("composer.heading")}</label>
        <button onClick={onReset}>
          <RotateCcw size={12} /> {t("common.reset")}
        </button>
      </div>
      <textarea
        id="message"
        ref={textareaRef}
        value={input.message}
        maxLength={12000}
        aria-describedby="message-hint"
        onChange={(e) => onInput({ message: e.target.value })}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !loading
          ) {
            e.preventDefault();
            onRun();
          }
        }}
        placeholder={t("composer.placeholder")}
      />
      <p id="message-hint" className="composer-hint">
        {t("composer.languageHint")}
      </p>
      <div className="composer-controls">
        <label className="language-select">
          <Globe2 size={14} />
          <select
            aria-label={t("nav.interfaceLanguage")}
            value={input.language ?? "auto"}
            onChange={(e) =>
              onInput({
                language: e.target.value as TriageInput["language"],
              })
            }
          >
            {REPLY_LANGUAGE_OPTIONS.map((option) => (
              <option value={option.code} key={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="composer-actions">
          {dictation.supported && (
            <button
              className={`button ghost voice-button ${
                dictation.status === "listening" ? "listening" : ""
              }`}
              onClick={() =>
                dictation.status === "listening" ? dictation.stop() : dictation.start()
              }
              aria-pressed={dictation.status === "listening"}
            >
              {dictation.status === "listening" ? (
                <Square size={14} />
              ) : (
                <Mic size={14} />
              )}
              {dictation.status === "listening"
                ? t("composer.stop")
                : t("composer.dictate")}
            </button>
          )}
          <button
            className="button primary"
            onClick={onRun}
            disabled={loading || !input.message.trim()}
          >
            {loading ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <ScanLine size={15} />
            )}{" "}
            {loading ? t("composer.running") : t("composer.run")}
          </button>
        </div>
      </div>
      {dictation.status === "listening" && (
        <div className="dictation-live" role="status">
          <span className="panic-dot" />
          {t("composer.listening")}
          {dictation.interim ? ` — ${dictation.interim}` : ""}
        </div>
      )}
      {dictationMessage && (
        <div role="status" className="dictation-note">
          {dictationMessage}
        </div>
      )}
      {error && (
        <div role="alert" className="error-box">
          <TriangleAlert size={15} />
          {error}
          <button onClick={onRetry}>{t("common.retry")}</button>
        </div>
      )}
      <button
        className="context-toggle"
        onClick={() => setAdvanced(!advanced)}
        aria-expanded={contextOpen}
        aria-controls="context-form"
      >
        <Settings2 size={13} /> {t("context.toggle")}{" "}
        <ChevronDown size={13} />
      </button>
      {contextOpen && (
        <div className="context-form" id="context-form">
          <label>
            {t("context.delay")}
            <input
              type="number"
              min="0"
              max="3650"
              aria-describedby="context-note"
              value={input.reporting_delay_working_days ?? ""}
              placeholder={t("context.tierUnknown")}
              onChange={(e) =>
                onInput({
                  reporting_delay_working_days:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            {t("context.elapsed")}
            <input
              type="number"
              min="0"
              max="3650"
              aria-describedby="context-note"
              value={input.elapsed_calendar_days ?? ""}
              placeholder={t("context.tierUnknown")}
              onChange={(e) =>
                onInput({
                  elapsed_calendar_days:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            {t("context.responsibility")}
            <select
              aria-describedby="context-note"
              value={input.responsibility ?? "unknown"}
              onChange={(e) =>
                onInput({
                  responsibility: e.target
                    .value as TriageInput["responsibility"],
                })
              }
            >
              <option value="unknown">
                {t("context.responsibilityUnknown")}
              </option>
              <option value="bank">{t("context.responsibilityBank")}</option>
              <option value="third_party">
                {t("context.responsibilityThirdParty")}
              </option>
              <option value="customer">
                {t("context.responsibilityCustomer")}
              </option>
            </select>
          </label>
          <label>
            {t("context.tier")}
            <select
              aria-describedby="context-note"
              value={input.account_tier ?? "unknown"}
              onChange={(e) =>
                onInput({
                  account_tier: e.target.value as TriageInput["account_tier"],
                })
              }
            >
              <option value="unknown">{t("context.tierUnknown")}</option>
              <option value="bsbd">{t("context.tierBsbd")}</option>
              <option value="regular">{t("context.tierRegular")}</option>
              <option value="other">{t("context.tierOther")}</option>
            </select>
          </label>
          <p id="context-note">{t("context.note")}</p>
        </div>
      )}
    </div>
  );
}
