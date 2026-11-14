"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  Fingerprint,
  GitMerge,
  MessageSquareText,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  requestTriage,
  TriageClientError,
  type ClientErrorCode,
} from "../lib/triage-client.ts";
import { useI18n } from "../lib/i18n/provider.tsx";
import { useUrlView } from "../lib/nav.ts";
import {
  initialTriageState,
  isStale,
  triageReducer,
} from "../lib/triage-reducer.ts";
import { download } from "../lib/format.ts";
import { POLICY_VERSION } from "../lib/policy.ts";
import { PIPELINE_STAGES } from "../lib/content/pipeline.ts";
import { AppShell, type View } from "../components/shell/app-shell.tsx";
import { IntakePanel } from "../components/desk/intake-panel.tsx";
import { EnginePanel } from "../components/desk/engine-panel.tsx";
import { Mascot } from "../components/mascot/mascot.tsx";
import { PipelineView } from "../components/views/pipeline-view.tsx";
import { BenchmarksView } from "../components/views/benchmarks-view.tsx";
import { PolicyView } from "../components/views/policy-view.tsx";
import { Landing } from "../components/landing.tsx";

import type { MessageKey } from "../lib/i18n/catalog.ts";

const ERROR_KEYS: Record<ClientErrorCode, MessageKey> = {
  unauthorized: "error.unauthorized",
  rate_limited: "error.rateLimited",
  timeout: "error.timeout",
  invalid_input: "error.invalidInput",
  payload_too_large: "error.tooLarge",
  invalid_response: "error.invalidResponse",
  network: "error.connection",
  unavailable: "error.unavailable",
};

type Tab = "overview" | "json" | "provenance";

export default function Page() {
  const { t, locale } = useI18n();
  const [view, setView] = useUrlView();
  const [state, dispatch] = useReducer(
    triageReducer,
    undefined,
    initialTriageState,
  );
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const loading = state.status === "running";
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const [mix, setMix] = useState(55);
  const [stage, setStage] = useState(0);
  const [query, setQuery] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  // The raw view hides itself again so unmasked PII is never left on screen.
  useEffect(() => {
    if (!state.revealed) return;
    const remaining = state.revealUntil - Date.now();
    if (remaining <= 0) {
      dispatch({ type: "privacy/hide" });
      return;
    }
    const id = setTimeout(() => dispatch({ type: "privacy/hide" }), remaining);
    return () => clearTimeout(id);
  }, [state.revealed, state.revealUntil]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const choose = useCallback((index: number) => {
    requestRef.current?.abort();
    setSelected(index);
    dispatch({ type: "scenario/select", index });
  }, []);

  const run = useCallback(async (patch?: Partial<typeof state.input>) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestId = crypto.randomUUID();
    const input = { ...state.input, ...patch };
    if (patch) dispatch({ type: "input/edit", patch });
    dispatch({ type: "run/start", requestId, input });
    try {
      const result = await requestTriage(input, {
        signal: controller.signal,
        apiKey,
      });
      if (!controller.signal.aborted) {
        dispatch({ type: "run/success", requestId, result });
        setTab("overview");
      }
    } catch (error) {
      if (!controller.signal.aborted)
        dispatch({
          type: "run/error",
          requestId,
          message: error instanceof TriageClientError ? error.code : "network",
        });
    }
  }, [state.input, apiKey]);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setNotice(t("toast.copied"));
      } catch {
        setNotice(t("toast.clipboardUnavailable"));
      }
    },
    [t],
  );

  const exportTrace = useCallback(() => {
    download(
      {
        exported_at: new Date().toISOString(),
        ...state.result,
        privacy: {
          sanitized: state.result.privacy.sanitized,
          backend: state.result.privacy.backend,
          redaction_count: state.result.privacy.redactions.length,
        },
        context_note:
          "Operator-supplied responsibility is not verified by the engine.",
        // A stable, machine-readable status field for the audit artifact.
        training_status:
          state.result.audit.model.status === "used"
            ? state.result.audit.model.model.unreviewed_pilot
              ? "unreviewed_pilot_model_used"
              : "fine_tuned_model_used"
            : state.result.audit.model.status === "fallback"
              ? "rules_fallback"
              : "no_model_checkpoint_connected",
        stale: isStale(state),
      },
      "suraksha-provenance.json",
    );
    setNotice(t("toast.traceExported"));
  }, [state, t]);

  if (view === "home")
    return <Landing onNavigate={(target) => setView(target as View)} />;

  const stale = isStale(state);
  const heading =
    view === "desk"
      ? t("desk.title")
      : view === "pipeline"
        ? t("desk.pipelineTitle")
        : view === "benchmarks"
          ? t("desk.benchmarksTitle")
          : t("desk.policyTitle");
  const subtitle =
    view === "desk"
      ? t("desk.subtitle")
      : view === "pipeline"
        ? t("desk.pipelineSubtitle")
        : view === "benchmarks"
          ? t("desk.benchmarksSubtitle")
          : t("desk.policySubtitle");

  return (
    <AppShell view={view} onView={setView}>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <div className="eyebrow">{t("desk.eyebrow")}</div>
            <h1 tabIndex={-1}>
              {heading}
              {/* Some locales close the sentence themselves. */}
              {/\s*[।.!]$/.test(heading) ? null : (
                <span className="heading-dot">.</span>
              )}
            </h1>
            <p>{subtitle}</p>
          </div>
          <button
            className="button secondary heading-action"
            disabled={view === "desk" && (isStale(state) || loading)}
            onClick={
              view === "desk"
                ? exportTrace
                : () =>
                    download(
                      {
                        policy_version: POLICY_VERSION,
                        stages: PIPELINE_STAGES.map(
                          ({ kit, status, path }) => ({ kit, status, path }),
                        ),
                        merge: {
                          schema_weight: Number((mix / 100).toFixed(2)),
                          empathy_weight: Number((1 - mix / 100).toFixed(2)),
                        },
                      },
                      "suraksha-experiment.json",
                    )
            }
          >
            <ArrowDownToLine size={16} />
            {view === "desk"
              ? t("common.exportTrace")
              : t("common.exportConfiguration")}
          </button>
        </div>

        {view === "desk" && (
          <>
            {(stale || loading) && (
              <div className="stale-banner" role="status">
                <ShieldCheck size={19} />
                <div>
                  <strong>
                    {t(loading ? "desk.runningTitle" : "desk.staleTitle")}
                  </strong>
                  <p>{t(loading ? "desk.runningBody" : "desk.staleBody")}</p>
                </div>
                <button
                  className="button primary"
                  disabled={loading}
                  onClick={() => void run()}
                >
                  {t(loading ? "composer.running" : "composer.run")}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
            <div className="workflow-strip">
              {(
                [
                  ["workflow.message", MessageSquareText],
                  ["workflow.privacy", Fingerprint],
                  ["workflow.structured", Braces],
                  ["workflow.draft", ShieldCheck],
                ] as const
              ).map(([key, Icon], index) => (
                <div className="workflow-step-wrap" key={key}>
                  {index > 0 && <ChevronRight size={15} />}
                  <div>
                    <span className="step-circle">
                      <Icon size={14} />
                    </span>
                    <strong>{t(key)}</strong>
                  </div>
                </div>
              ))}
              <span className="workflow-label">{t("workflow.label")}</span>
            </div>
            <Mascot
              state={state}
              locale={locale}
              listening={false}
              running={loading}
            />
            <div className="desk-grid">
              <IntakePanel
                selected={selected}
                input={state.input}
                rawMessage={state.submittedMessage}
                result={state.result}
                stale={stale}
                hasRun={state.hasRun}
                loading={loading}
                error={
                  state.error
                    ? t(
                        ERROR_KEYS[state.error as ClientErrorCode] ??
                          "error.unavailable",
                      )
                    : ""
                }
                authRequired={state.error === "unauthorized"}
                apiKey={apiKey}
                onApiKey={setApiKey}
                masked={state.masked}
                revealed={state.revealed}
                onSelect={choose}
                onInput={(patch) => dispatch({ type: "input/edit", patch })}
                onRun={() => void run()}
                onReplyLanguage={(language) => void run({ language })}
                onRetry={() => void run()}
                onReset={() => choose(selected)}
                onCopy={(text) => {
                  if (!isStale(state) && !loading) void copy(text);
                }}
                onTogglePrivacy={() => dispatch({ type: "privacy/toggle" })}
              />
              <EnginePanel
                result={state.result}
                tab={tab}
                onTab={setTab}
                onCopy={(text) => {
                  if (!isStale(state) && !loading) void copy(text);
                }}
                onExport={exportTrace}
                onDownloadPayload={() =>
                  download(state.result.payload, "suraksha-triage.json")
                }
                rawVisible={state.revealed}
                stale={stale || loading}
              />
            </div>
            <div className="experiment-teaser">
              <div className="teaser-icon">
                <GitMerge size={22} />
              </div>
              <div>
                <span className="eyebrow">{t("teaser.eyebrow")}</span>
                <h3>{t("teaser.title")}</h3>
                <p>{t("teaser.body")}</p>
              </div>
              <button
                className="button secondary"
                onClick={() => setView("pipeline")}
              >
                {t("teaser.cta")} <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}

        {view === "pipeline" && (
          <PipelineView
            stage={stage}
            onStage={setStage}
            mix={mix}
            onMix={setMix}
          />
        )}
        {view === "benchmarks" && (
          <BenchmarksView
            onOpenScenario={() => {
              choose(2);
              setView("desk");
            }}
          />
        )}
        {view === "policy" && <PolicyView query={query} onQuery={setQuery} />}

        <footer className="page-footer">
          <span>
            <ShieldCheck size={13} /> {t("footer.tagline")}
          </span>
          <span>{t("footer.version")}</span>
        </footer>
      </main>
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <Check size={15} />
            {notice}
            <button
              aria-label={t("common.dismiss")}
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
