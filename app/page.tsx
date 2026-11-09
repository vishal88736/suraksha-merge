"use client";
import { Landing } from "../components/landing";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CirclePlay,
  Copy,
  Database,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  GitMerge,
  Globe2,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import { SCENARIOS } from "../lib/scenarios";
import { triage, type TriageInput, type TriageResult } from "../lib/engine";
import { POLICY_VERSION, SOURCES } from "../lib/policy";
type View = "home" | "desk" | "pipeline" | "benchmarks" | "policy";
const VIEWS = [
  { id: "desk", label: "Triage desk", icon: LayoutDashboard },
  { id: "pipeline", label: "Pipeline explorer", icon: Workflow },
  { id: "benchmarks", label: "Benchmark lab", icon: FlaskConical },
  { id: "policy", label: "Policy library", icon: BookOpen },
] as const;
const pretty = (v: string) =>
  v
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (x) => x.toUpperCase());
const currency = (n: number | null) =>
  n === null
    ? "Not identified"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(n);
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function JsonView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <pre className="json-code" tabIndex={0} aria-label="Structured triage JSON">
      {text.split("\n").map((line, i) => (
        <div key={i}>
          <span className="line-no" aria-hidden="true">
            {i + 1}
          </span>
          <code>
            {line
              .split(
                /("[^"]*"(?=\s*:)|"[^"]*"|\bnull\b|\btrue\b|\bfalse\b|\b\d+(?:\.\d+)?\b)/g,
              )
              .map((part, j) => (
                <span
                  key={j}
                  className={
                    /^".*"$/.test(part)
                      ? line.indexOf(part) < line.indexOf(":")
                        ? "json-key"
                        : "json-value"
                      : /^(null|true|false|\d)/.test(part)
                        ? "json-literal"
                        : ""
                  }
                >
                  {part}
                </span>
              ))}
          </code>
        </div>
      ))}
    </pre>
  );
}
function MaskedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[A-Z_]+\]|\b\d{12}\b)/g).map((part, i) => (
        <span
          key={i}
          className={
            /^\[/.test(part) ? "masked" : /^\d{12}$/.test(part) ? "anchor" : ""
          }
        >
          {part}
        </span>
      ))}
    </>
  );
}
function Liability({ result }: { result: TriageResult }) {
  const tier = result.payload.rbi_liability_tier;
  const technical = result.sla.deadline_days !== null;
  const zero = tier === "ZERO_LIABILITY_ELIGIBLE";
  return (
    <div
      className={`liability ${technical ? "blue" : zero ? "green" : "amber"}`}
    >
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
          {technical ? "REVERSAL TIMELINE" : "LIABILITY ASSESSMENT"}
        </div>
        <strong>
          {technical
            ? `T+${result.sla.deadline_days} calendar days`
            : tier === "PENDING_VERIFICATION"
              ? "Bank verification required"
              : pretty(tier)}
        </strong>
        <p>
          {technical
            ? `₹100/day beyond T+${result.sla.deadline_days} for a qualifying failure`
            : zero
              ? "Conditional eligibility · subject to bank investigation"
              : "Authorisation and responsibility determine the outcome"}
        </p>
      </div>
      {technical && result.sla.estimated_compensation_inr !== null && (
        <div className="compensation">
          <strong>{currency(result.sla.estimated_compensation_inr)}</strong>
          <span>estimated delay compensation</span>
        </div>
      )}
    </div>
  );
}
const STAGES = [
  {
    name: "Curate with care",
    kit: "CuratorKIT",
    icon: Database,
    color: "orange",
    text: "Two datasets. One chain of evidence.",
    details:
      "Start with synthetic or authorised customer chats. Mask sensitive identities, retain only context-labelled transaction references, validate fields against source spans, and separate schema targets from same-task preference pairs.",
    outputs: [
      "Dataset A · strict JSON + field provenance",
      "Dataset B · chosen / rejected customer replies",
      "Manifest · source hashes, split IDs and rejection reasons",
    ],
    status: "Local curation + optional CuratorKIT pass",
    path: "python3 phase1_curatorkit_pipeline.py --demo",
  },
  {
    name: "Train specialists",
    kit: "AlignTune",
    icon: Layers3,
    color: "teal",
    text: "Give each task room to learn.",
    details:
      "Train schema extraction with verifiable rewards and customer replies with DPO. Both specialists must share the same model, vocabulary, embedding checkpoint and LoRA target modules. Tokenizer expansion requires real embedding adaptation before either specialist is trained.",
    outputs: [
      "Adapter A · Dr. GRPO schema specialist",
      "Adapter B · DPO policy and language specialist",
      "Controls · base, uncurated SFT and curated joint SFT",
    ],
    status: "Requires compatible GPU + reviewed data",
    path: "python3 phase2_aligntune_train_and_merge.py --stage plan",
  },
  {
    name: "Merge & investigate",
    kit: "Task arithmetic",
    icon: GitMerge,
    color: "violet",
    text: "A hypothesis, ready to be tested.",
    details:
      "Compose the weighted parameter updates using a compatible LoRA merge. Sweep weights on validation data, including the two unmerged specialists. Moving the slider configures an experiment; it does not change this rule-based preview or demonstrate model quality.",
    outputs: [
      "ΔW = λA · ΔWA + λB · ΔWB",
      "Validation sweep · weights selected before held-out test",
      "Merge manifest · base, tokenizer and adapter identities",
    ],
    status: "Configuration preview · no merged checkpoint yet",
    path: "python3 phase2_aligntune_train_and_merge.py --stage merge",
  },
  {
    name: "Make quality visible",
    kit: "AuditKIT",
    icon: FileCheck2,
    color: "blue",
    text: "Every claim needs a measured result.",
    details:
      "Compare all six checkpoints on held-out scenario groups. Score the full JSON schema, all extracted fields, inappropriate guarantees and required actions. Keep human-rated empathy separate from lexical ChrF, and use paired bootstrap intervals rather than treating a single percentage as proof.",
    outputs: [
      "Ablation · 6 named checkpoints with run fingerprints",
      "Red team · coercion, injection and over-refusal cases",
      "Report · per-case evidence + paired bootstrap deltas",
    ],
    status: "Offline scorer ready · model evaluation pending",
    path: "python3 phase3_auditkit_eval.py --help",
  },
];
export default function Desk() {
  const [view, setView] = useState<View>("home");
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState<TriageInput>({ ...SCENARIOS[0].input });
  const [result, setResult] = useState<TriageResult>(() =>
    triage(SCENARIOS[0].input),
  );
  const [submittedMessage, setSubmittedMessage] = useState(
    SCENARIOS[0].input.message,
  );
  const [masked, setMasked] = useState(true);
  const [tab, setTab] = useState<"overview" | "json" | "provenance">(
    "overview",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [mix, setMix] = useState(55);
  const [stage, setStage] = useState(0);
  const [query, setQuery] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const choose = (index: number) => {
    requestRef.current?.abort();
    setSelected(index);
    setInput({ ...SCENARIOS[index].input });
    setSubmittedMessage(SCENARIOS[index].input.message);
    setResult(triage(SCENARIOS[index].input));
    setHasRun(false);
    setError("");
    setLoading(false);
  };
  const run = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const body = (await response.json()) as TriageResult & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Triage is unavailable. Try again.");
      if (!controller.signal.aborted) {
        setResult(body);
        setSubmittedMessage(input.message);
        setHasRun(true);
        setTab("overview");
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Could not connect. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard unavailable. You can select and copy the text.");
    }
  };
  const exportTrace = () => {
    download(
      {
        exported_at: new Date().toISOString(),
        ...result,
        privacy: {
          sanitized: result.privacy.sanitized,
          backend: result.privacy.backend,
          redaction_count: result.privacy.redactions.length,
        },
        context_note:
          "Operator-supplied responsibility is not verified by the engine.",
        training_status: "No model checkpoint connected",
      },
      "suraksha-provenance.json",
    );
    setNotice("Masked provenance trace exported");
  };
  const activeStage = STAGES[stage];
  const ActiveIcon = activeStage.icon;
  if (view === "home")
    return (
      <Landing
        onNavigate={(target) => {
          setView(target);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setView("home");
          }}
          className="brand"
          aria-label="SurakshaDesk home"
        >
          <span className="brand-symbol">
            <ShieldCheck size={23} strokeWidth={1.7} />
          </span>
          <span>
            suraksha<span className="brand-desk">desk</span>
            <small>CLARITY. CARE. CONFIDENCE.</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Research workspace<small>Suraksha-Merge</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-shield">
            <ShieldCheck size={19} />
          </div>
          <strong>Built around trust.</strong>
          <p>
            Every extracted field needs evidence. Every promise needs restraint.
          </p>
          <button onClick={() => setView("policy")}>
            Explore the policy spine <ArrowUpRight size={14} />
          </button>
        </div>
        <a
          className="repo-link"
          href="https://github.com/vishal88736/suraksha-merge"
          target="_blank"
          rel="noreferrer"
        >
          <GitMerge size={16} /> View source <ArrowUpRight size={14} />
        </a>
        <div className="operator">
          <span className="avatar">R</span>
          <div>
            Research operator<small>Demo workspace</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{VIEWS.find((v) => v.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="engine-status">
              <span className="online-dot" /> Rule engine active
            </span>
            <span className="topbar-divider" />
            <span className="research-badge">
              <FlaskConical size={13} /> Research preview
            </span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">SURAKSHA-MERGE / OPERATIONS</div>
              <h1>
                {view === "desk"
                  ? "A clearer next step."
                  : view === "pipeline"
                    ? "One pipeline. Two specialists."
                    : view === "benchmarks"
                      ? "Evidence before confidence."
                      : "Grounded in the rules."}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === "desk"
                  ? "Turn a worried customer’s message into structured, thoughtful action."
                  : view === "pipeline"
                    ? "Follow the journey from a noisy message to a verifiable response."
                    : view === "benchmarks"
                      ? "Six checkpoints. One held-out benchmark. No invented results."
                      : "Versioned primary sources behind every triage recommendation."}
              </p>
            </div>
            <button
              className="button secondary heading-action"
              onClick={
                view === "desk"
                  ? exportTrace
                  : () =>
                      download(
                        {
                          policy_version: POLICY_VERSION,
                          stages: STAGES.map(({ name, kit, status, path }) => ({
                            name,
                            kit,
                            status,
                            path,
                          })),
                          merge: {
                            schema_weight: mix / 100,
                            empathy_weight: 1 - mix / 100,
                          },
                        },
                        "suraksha-experiment.json",
                      )
              }
            >
              <ArrowDownToLine size={16} />
              {view === "desk" ? "Export trace" : "Export configuration"}
            </button>
          </div>
          {view === "desk" && (
            <>
              <div className="workflow-strip">
                <div>
                  <span className="step-circle">
                    <MessageSquareText size={14} />
                  </span>
                  <strong>Customer message</strong>
                </div>
                <ChevronRight size={15} />
                <div>
                  <span className="step-circle">
                    <Fingerprint size={14} />
                  </span>
                  <strong>Privacy & provenance</strong>
                </div>
                <ChevronRight size={15} />
                <div>
                  <span className="step-circle">
                    <Braces size={14} />
                  </span>
                  <strong>Structured triage</strong>
                </div>
                <ChevronRight size={15} />
                <div>
                  <span className="step-circle">
                    <ShieldCheck size={14} />
                  </span>
                  <strong>Customer draft</strong>
                </div>
                <span className="workflow-label">ONE AUDITABLE FLOW</span>
              </div>
              <div className="desk-grid">
                <section
                  className="panel intake-panel"
                  aria-labelledby="intake-heading"
                >
                  <div className="panel-heading">
                    <div className="panel-title">
                      <span className="panel-icon">
                        <MessageSquareText size={18} />
                      </span>
                      <div>
                        <h2 id="intake-heading">Customer channel</h2>
                        <span>Noisy messages. Human stories.</span>
                      </div>
                    </div>
                    <span className="pill soft">SYNTHETIC DEMO</span>
                  </div>
                  <div className="scenario-picker">
                    <label className="eyebrow" htmlFor="scenario">
                      TRY A SCENARIO
                    </label>
                    <div className="select-wrap">
                      <select
                        id="scenario"
                        value={selected}
                        onChange={(e) => choose(Number(e.target.value))}
                      >
                        {SCENARIOS.map((s, i) => (
                          <option value={i} key={s.id}>
                            {s.title} · {s.language}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </div>
                    <div className="scenario-meta">
                      <span
                        className={`category-dot ${selected === 1 || selected === 5 ? "blue-dot" : ""}`}
                      />
                      {SCENARIOS[selected].description}
                    </div>
                  </div>
                  <div className="conversation">
                    <div className="conversation-date">
                      <span />
                      {hasRun ? "LATEST TRIAGE" : "SCENARIO PREVIEW"}
                      <span />
                    </div>
                    <div className="message-label">
                      <span className="customer-avatar">C</span>
                      <strong>Customer</strong>
                      <span>{pretty(result.payload.detected_language)}</span>
                    </div>
                    <div className="customer-bubble">
                      <p>
                        {masked ? (
                          <MaskedText text={result.privacy.sanitized} />
                        ) : (
                          submittedMessage
                        )}
                      </p>
                      <div className="bubble-footer">
                        <span>
                          <span className="panic-dot" />
                          {pretty(result.payload.panic_severity)} urgency
                        </span>
                        <button
                          onClick={() => setMasked(!masked)}
                          aria-pressed={masked}
                        >
                          <LockKeyhole size={12} />
                          {masked ? "PII masked" : "Raw input"}
                        </button>
                      </div>
                    </div>
                    <div className="message-label assistant-label">
                      <span className="assistant-avatar">
                        <ShieldCheck size={16} />
                      </span>
                      <strong>Suraksha draft</strong>
                      <span className="draft-tag">FOR REVIEW</span>
                      <button
                        className="icon-button"
                        aria-label="Copy customer reply"
                        onClick={() => copy(result.reply.text)}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div className="assistant-bubble">
                      <p className="reply-intro">{result.reply.introduction}</p>
                      <ol>
                        {result.reply.steps.map((s, i) => (
                          <li key={i}>
                            <span>{i + 1}</span>
                            <p>{s}</p>
                          </li>
                        ))}
                      </ol>
                      <details className="escalation-details">
                        <summary>
                          Escalation guidance <ChevronDown size={13} />
                        </summary>
                        <p>{result.reply.escalation}</p>
                      </details>
                      <div className="draft-footer">
                        <CheckCheck size={14} /> Draft prepared · no external
                        action taken
                      </div>
                    </div>
                  </div>
                  <div className="composer">
                    <div className="composer-heading">
                      <label htmlFor="message">Make it your own</label>
                      <button onClick={() => choose(selected)}>
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>
                    <textarea
                      id="message"
                      aria-label="Customer message"
                      value={input.message}
                      maxLength={12000}
                      onChange={(e) =>
                        setInput({ ...input, message: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (
                          (e.metaKey || e.ctrlKey) &&
                          e.key === "Enter" &&
                          !loading
                        ) {
                          e.preventDefault();
                          void run();
                        }
                      }}
                      placeholder="Paste a customer message in Hinglish, Tanglish, Marathi or English…"
                    />
                    <div className="composer-controls">
                      <label className="language-select">
                        <Globe2 size={14} />
                        <select
                          aria-label="Reply language"
                          value={input.language ?? "auto"}
                          onChange={(e) =>
                            setInput({
                              ...input,
                              language: e.target
                                .value as TriageInput["language"],
                            })
                          }
                        >
                          <option value="auto">Auto-detect language</option>
                          <option value="hinglish">Hinglish</option>
                          <option value="tanglish">Tanglish</option>
                          <option value="marathi_english">
                            Marathi-English
                          </option>
                          <option value="hindi_devanagari">Hindi</option>
                          <option value="english">English</option>
                        </select>
                      </label>
                      <button
                        className="button primary"
                        onClick={() => void run()}
                        disabled={loading || !input.message.trim()}
                      >
                        {loading ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <ScanLine size={15} />
                        )}{" "}
                        {loading ? "Analysing…" : "Run triage"}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    {error && (
                      <div role="alert" className="error-box">
                        <TriangleAlert size={15} />
                        {error}
                        <button onClick={() => void run()}>Retry</button>
                      </div>
                    )}
                    <button
                      className="context-toggle"
                      onClick={() => setAdvanced(!advanced)}
                      aria-expanded={advanced}
                    >
                      <Settings2 size={13} /> Operator context{" "}
                      <ChevronDown size={13} />
                    </button>
                    {advanced && (
                      <div className="context-form">
                        <label>
                          Reporting delay · working days
                          <input
                            type="number"
                            min="0"
                            max="3650"
                            value={input.reporting_delay_working_days ?? ""}
                            placeholder="Unknown"
                            onChange={(e) =>
                              setInput({
                                ...input,
                                reporting_delay_working_days:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Elapsed · calendar days
                          <input
                            type="number"
                            min="0"
                            max="3650"
                            value={input.elapsed_calendar_days ?? ""}
                            placeholder="Unknown"
                            onChange={(e) =>
                              setInput({
                                ...input,
                                elapsed_calendar_days:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Responsibility · requires evidence
                          <select
                            value={input.responsibility ?? "unknown"}
                            onChange={(e) =>
                              setInput({
                                ...input,
                                responsibility: e.target
                                  .value as TriageInput["responsibility"],
                              })
                            }
                          >
                            <option value="unknown">
                              Unknown / unverified
                            </option>
                            <option value="bank">
                              Bank negligence · operator supplied
                            </option>
                            <option value="third_party">
                              Third-party breach · operator supplied
                            </option>
                            <option value="customer">
                              Customer negligence · operator supplied
                            </option>
                          </select>
                        </label>
                        <label>
                          Account tier
                          <select
                            value={input.account_tier ?? "unknown"}
                            onChange={(e) =>
                              setInput({
                                ...input,
                                account_tier: e.target
                                  .value as TriageInput["account_tier"],
                              })
                            }
                          >
                            <option value="unknown">Unknown</option>
                            <option value="bsbd">BSBD · ₹5,000 cap</option>
                            <option value="regular">
                              Regular · ₹10,000 cap
                            </option>
                            <option value="other">
                              Other specified · ₹25,000 cap
                            </option>
                          </select>
                        </label>
                        <p>
                          Working days must use the bank’s calendar, excluding
                          the date of receiving its alert. Context is
                          operator-supplied, not independently verified.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
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
                        <h2 id="engine-heading">Triage intelligence</h2>
                        <span>Evidence you can inspect.</span>
                      </div>
                    </div>
                    <span className="pill green-pill">
                      <span className="online-dot" /> LIVE CHECKS
                    </span>
                  </div>
                  <div
                    className="engine-tabs"
                    role="tablist"
                    aria-label="Triage output"
                  >
                    {(["overview", "json", "provenance"] as const).map((t) => (
                      <button
                        key={t}
                        role="tab"
                        id={`tab-${t}`}
                        aria-controls="output-panel"
                        aria-selected={tab === t}
                        onClick={() => setTab(t)}
                      >
                        {t === "json" ? (
                          <Braces size={14} />
                        ) : t === "provenance" ? (
                          <Fingerprint size={14} />
                        ) : (
                          <LayoutDashboard size={14} />
                        )}{" "}
                        {t === "json" ? "JSON payload" : pretty(t)}
                      </button>
                    ))}
                    <span className="payload-version">schema v1</span>
                  </div>
                  <div
                    id="output-panel"
                    role="tabpanel"
                    aria-labelledby={`tab-${tab}`}
                    className="output-content"
                  >
                    {tab === "overview" && (
                      <>
                        <Liability result={result} />
                        <div className="transaction-grid">
                          <div>
                            <span>Disputed amount</span>
                            <strong className="amount">
                              {currency(result.payload.amount_inr)}
                            </strong>
                          </div>
                          <div>
                            <span>
                              Transaction reference <Fingerprint size={12} />
                            </span>
                            <strong className="mono utr-value">
                              {result.payload.utr_number ??
                                "Needs confirmation"}
                            </strong>
                            <small>
                              {result.payload.utr_number ? (
                                <>
                                  <Check size={11} /> Present in the source
                                  message
                                </>
                              ) : (
                                "A unique labelled UTR is required"
                              )}
                            </small>
                          </div>
                          <div className="wide">
                            <span>
                              Dispute classification{" "}
                              <span className="muted">/ internal taxonomy</span>
                            </span>
                            <strong className="classification">
                              {pretty(result.payload.dispute_category)}
                            </strong>
                          </div>
                        </div>
                        <div className="section-header">
                          <h3>
                            <LockKeyhole size={14} /> Privacy & provenance
                          </h3>
                          <span className="subtle-label">
                            BEFORE MODEL CONTEXT
                          </span>
                        </div>
                        <div className="privacy-summary">
                          <div>
                            <span className="privacy-count">
                              {result.privacy.redactions.length
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            <div>
                              <strong>Sensitive fields masked</strong>
                              <p>
                                {[
                                  ...new Set(
                                    result.privacy.redactions.map((r) =>
                                      pretty(r.type),
                                    ),
                                  ),
                                ].join(" · ") ||
                                  "No supported PII patterns detected"}
                              </p>
                            </div>
                            <ShieldCheck size={20} />
                          </div>
                          <div className="anchor-row">
                            <Fingerprint size={14} />
                            <span>
                              {result.payload.utr_number
                                ? "Transaction reference preserved with context"
                                : "No unique verified reference"}
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
                            <FileCheck2 size={14} /> Verification checks
                          </h3>
                          <span className="subtle-label">DETERMINISTIC</span>
                        </div>
                        <div className="guardrail-list">
                          {[
                            {
                              title: "Strict JSON schema",
                              detail: "All required fields and types validated",
                              pass: result.audit.schema_valid,
                            },
                            {
                              title: "Transaction provenance",
                              detail: result.audit.utr_grounded
                                ? "UTR matches the customer’s source message"
                                : "Missing or conflicting UTR · review needed",
                              pass: result.audit.utr_grounded,
                            },
                            {
                              title: "No refund guarantee detected",
                              detail:
                                "Pattern check · human review still required",
                              pass: result.audit.no_unauthorized_promises,
                            },
                            {
                              title: "Relevant escalation rails",
                              detail: "Bank / PSP and fraud-reporting guidance",
                              pass: result.audit.fraud_rails_present,
                            },
                          ].map((c) => (
                            <div className="guardrail" key={c.title}>
                              <span
                                className={`check-icon ${!c.pass ? "review-icon" : ""}`}
                              >
                                {c.pass ? (
                                  <Check size={12} />
                                ) : (
                                  <CircleHelp size={12} />
                                )}
                              </span>
                              <div>
                                <strong>{c.title}</strong>
                                <small>{c.detail}</small>
                              </div>
                              <span
                                className={`check-label ${!c.pass ? "review-label" : ""}`}
                              >
                                {c.pass ? "PASS" : "REVIEW"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {result.warnings.length > 0 && (
                          <div className="review-note">
                            <TriangleAlert size={15} />
                            <div>
                              <strong>A human decision, supported.</strong>
                              {result.warnings.map((w, i) => (
                                <p key={i}>{w}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          className="payload-link"
                          onClick={() => setTab("json")}
                        >
                          <Braces size={15} /> Inspect structured JSON{" "}
                          <ArrowUpRight size={14} />
                        </button>
                      </>
                    )}
                    {tab === "json" && (
                      <>
                        <div className="json-toolbar">
                          <span>
                            <span className="online-dot" /> Valid application
                            schema
                          </span>
                          <button
                            className="small-button"
                            onClick={() =>
                              copy(JSON.stringify(result.payload, null, 2))
                            }
                          >
                            <Copy size={13} /> Copy JSON
                          </button>
                        </div>
                        <JsonView value={result.payload} />
                        <div className="json-bottom-note">
                          <CircleHelp size={14} /> This is an internal triage
                          contract. An approved mapping is needed before
                          submitting to a bank or NPCI.
                        </div>
                        <button
                          className="payload-link"
                          onClick={() =>
                            download(result.payload, "suraksha-triage.json")
                          }
                        >
                          <ArrowDownToLine size={15} /> Download payload{" "}
                          <ArrowUpRight size={14} />
                        </button>
                      </>
                    )}
                    {tab === "provenance" && (
                      <>
                        <div className="section-header">
                          <h3>Field-level evidence</h3>
                          <span className="pill soft">
                            {result.evidence.length} ANCHORS
                          </span>
                        </div>
                        <div className="evidence-list">
                          {result.evidence.map((e, i) => (
                            <div className="evidence-card" key={i}>
                              <span className="mono">{e.field}</span>
                              <strong>{e.value}</strong>
                              <small>
                                <Fingerprint size={12} />
                                {pretty(e.source)}
                                {e.start !== undefined
                                  ? ` · source offset ${e.start}`
                                  : ""}
                              </small>
                            </div>
                          ))}
                        </div>
                        <div className="section-header">
                          <h3>Sanitized model context</h3>
                          <span className="subtle-label">REGEX HYGIENE</span>
                        </div>
                        <div className="sanitized-context">
                          <MaskedText text={result.privacy.sanitized} />
                        </div>
                        <div className="review-note">
                          <CircleHelp size={16} />
                          <div>
                            <strong>
                              Provenance is not proof of authenticity.
                            </strong>
                            <p>
                              Matching a reference to text does not verify the
                              bank transaction. The regex scrubber detects
                              supported patterns; Presidio is an optional
                              research stage.
                            </p>
                          </div>
                        </div>
                        <button className="payload-link" onClick={exportTrace}>
                          <ArrowDownToLine size={15} /> Export masked evidence
                          trace <ArrowUpRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="engine-footer">
                    <span>
                      <LockKeyhole size={12} /> No messages stored
                    </span>
                    <span>{POLICY_VERSION}</span>
                  </div>
                </section>
              </div>
              <div className="experiment-teaser">
                <div className="teaser-icon">
                  <GitMerge size={22} />
                </div>
                <div>
                  <span className="eyebrow">THE RESEARCH BEHIND THE DESK</span>
                  <h3>Structure meets a little more understanding.</h3>
                  <p>
                    Explore specialist adapters, task arithmetic and the
                    evaluation spine.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setView("pipeline")}
                >
                  Explore the pipeline <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {view === "pipeline" && (
            <div className="pipeline-view">
              <div className="pipeline-stepper">
                {STAGES.map((s, i) => (
                  <button
                    key={s.name}
                    className={`pipeline-step ${stage === i ? "selected" : ""}`}
                    onClick={() => setStage(i)}
                    aria-pressed={stage === i}
                  >
                    <span className={`stage-icon ${s.color}`}>
                      <s.icon size={21} />
                    </span>
                    <span className="stage-number">
                      0{i + 1} / {s.kit}
                    </span>
                    <strong>{s.name}</strong>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="pipeline-detail panel">
                <div className="stage-copy">
                  <div className={`stage-icon large ${activeStage.color}`}>
                    <ActiveIcon size={28} />
                  </div>
                  <span className="eyebrow">
                    STAGE 0{stage + 1} · {activeStage.kit}
                  </span>
                  <h2>{activeStage.text}</h2>
                  <p>{activeStage.details}</p>
                  <div className="stage-status">
                    <CircleHelp size={14} />
                    {activeStage.status}
                  </div>
                  <code className="command">{activeStage.path}</code>
                  <div className="stage-controls">
                    <button
                      className="button secondary"
                      disabled={stage === 0}
                      onClick={() => setStage(stage - 1)}
                    >
                      Previous stage
                    </button>
                    <button
                      className="button primary"
                      disabled={stage === 3}
                      onClick={() => setStage(stage + 1)}
                    >
                      Next stage <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="stage-output">
                  <span className="eyebrow">WHAT THIS STAGE PRODUCES</span>
                  {activeStage.outputs.map((o, i) => (
                    <div key={o}>
                      <span className="output-number">0{i + 1}</span>
                      <strong>{o}</strong>
                      <Check size={15} />
                    </div>
                  ))}
                  <div className="pipeline-note">
                    <ShieldCheck size={22} />
                    <p>
                      Each stage carries its source identity forward. Failed
                      samples are recorded, repaired where justified, then
                      checked again.
                    </p>
                  </div>
                </div>
              </div>
              <div className="merge-lab panel">
                <div>
                  <span className="eyebrow">TASK-ARITHMETIC EXPERIMENT</span>
                  <h2>Find the balance. Measure the result.</h2>
                  <p>
                    The slider configures an offline merge. Model performance
                    must be evaluated after merging.
                  </p>
                </div>
                <div className="mix-controls">
                  <div className="mix-labels">
                    <strong>
                      <span className="teal-text">A</span> Schema specialist{" "}
                      <b>{(mix / 100).toFixed(2)}</b>
                    </strong>
                    <strong>
                      <span className="violet-text">B</span> Empathy specialist{" "}
                      <b>{(1 - mix / 100).toFixed(2)}</b>
                    </strong>
                  </div>
                  <input
                    aria-label="Schema adapter merge weight"
                    type="range"
                    min="0"
                    max="100"
                    value={mix}
                    onChange={(e) => setMix(Number(e.target.value))}
                  />
                  <div className="mix-ticks">
                    <span>Empathy only</span>
                    <button onClick={() => setMix(55)}>
                      Reset to 0.55 / 0.45
                    </button>
                    <span>Schema only</span>
                  </div>
                  <div className="formula">
                    W<sub>merged</sub> = W<sub>base</sub> +{" "}
                    <em>{(mix / 100).toFixed(2)}</em> ΔW<sub>A</sub> +{" "}
                    <em>{(1 - mix / 100).toFixed(2)}</em> ΔW<sub>B</sub>
                  </div>
                  <button
                    className="small-button"
                    onClick={() =>
                      download(
                        {
                          method: "task_arithmetic",
                          base_model: "Qwen/Qwen2.5-3B-Instruct",
                          weights: [
                            mix / 100,
                            Number((1 - mix / 100).toFixed(2)),
                          ],
                          measured: false,
                        },
                        "merge-experiment.json",
                      )
                    }
                  >
                    <ArrowDownToLine size={14} /> Export merge configuration
                  </button>
                </div>
              </div>
            </div>
          )}
          {view === "benchmarks" && (
            <div className="benchmark-view">
              <div className="benchmark-note">
                <FlaskConical size={23} />
                <div>
                  <strong>
                    The experiment is set up. The evidence comes next.
                  </strong>
                  <p>
                    The proposal’s percentages and cost estimates have not been
                    measured. This table will only contain results from
                    identifiable evaluation runs.
                  </p>
                </div>
                <span className="pill soft">NOT YET EVALUATED</span>
              </div>
              <div className="panel table-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Checkpoint ablation</h2>
                    <p>
                      All specialists and baselines, evaluated on the same
                      held-out cases.
                    </p>
                  </div>
                  <Database size={20} />
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>CHECKPOINT</th>
                        <th>SCHEMA PASS</th>
                        <th>FIELD EXACT MATCH</th>
                        <th>UNSAFE GUARANTEES</th>
                        <th>EMPATHY / CHRF</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        "Base Qwen2.5-3B",
                        "Uncurated multitask SFT",
                        "Curated monolithic SFT",
                        "Adapter A · schema RLVR",
                        "Adapter B · empathy DPO",
                        "Suraksha-Merge · A + B",
                      ].map((name, i) => (
                        <tr key={name} className={i === 5 ? "merge-row" : ""}>
                          <td>
                            {i === 5 ? (
                              <GitMerge size={15} />
                            ) : (
                              <Layers3 size={15} />
                            )}
                            <strong>{name}</strong>
                          </td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td>— / —</td>
                          <td>
                            <span className="pill soft">
                              {i === 0 ? "Awaiting run" : "Awaiting training"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="benchmark-cards">
                <div className="panel info-card">
                  <Fingerprint size={23} />
                  <h3>Split by scenario family</h3>
                  <p>
                    Keep paraphrases, SMS templates and repaired versions of the
                    same case in one split. Freeze the test set before selecting
                    merge weights.
                  </p>
                </div>
                <div className="panel info-card">
                  <MessageSquareText size={23} />
                  <h3>Empathy needs a human</h3>
                  <p>
                    ChrF measures character overlap, not empathy or policy
                    safety. Collect blinded regional-language ratings
                    separately.
                  </p>
                </div>
                <div className="panel info-card">
                  <TriangleAlert size={23} />
                  <h3>Make failure observable</h3>
                  <p>
                    Report malformed JSON, fabricated UTRs, unsupported
                    guarantees and missing escalation actions per case.
                    Bootstrap paired differences.
                  </p>
                </div>
              </div>
              <div className="panel redteam-panel">
                <div>
                  <span className="eyebrow">ADVERSARIAL SUITE</span>
                  <h2>Pressure should not change the policy.</h2>
                  <p>
                    Try a refund-coercion case against the current deterministic
                    preview.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    choose(2);
                    setView("desk");
                  }}
                >
                  Open adversarial scenario <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          {view === "policy" && (
            <div className="policy-view">
              <div className="policy-search">
                <Search size={17} />
                <input
                  aria-label="Search policy sources"
                  placeholder="Search sources, rules or institutions…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="pill soft">{POLICY_VERSION}</span>
              </div>
              <div className="policy-grid">
                {SOURCES.filter((s) =>
                  `${s.title} ${s.note}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ).map((s, i) => (
                  <a
                    className="panel policy-card"
                    href={s.url}
                    key={s.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <span
                        className={`stage-icon ${["teal", "blue", "orange", "violet"][i % 4]}`}
                      >
                        <BookOpen size={19} />
                      </span>
                      <ArrowUpRight size={18} />
                    </div>
                    <span className="eyebrow">PRIMARY SOURCE · {s.date}</span>
                    <h2>{s.title}</h2>
                    <p>{s.note}</p>
                    <span className="source-domain">
                      {new URL(s.url).hostname} <ArrowRight size={13} />
                    </span>
                  </a>
                ))}
              </div>
              {!SOURCES.some((s) =>
                `${s.title} ${s.note}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ) && (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>No matching sources</h3>
                  <button
                    className="button secondary"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                </div>
              )}
              <div className="review-note">
                <CircleHelp size={17} />
                <div>
                  <strong>A decision-support research tool.</strong>
                  <p>
                    These sources inform the internal triage policy. This
                    application is not a bank, regulator, official UDIR gateway
                    or compliance certification. Review applicability and
                    amendments before operational use.
                  </p>
                </div>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} /> Thoughtful triage. Traceable decisions.
            </span>
            <span>
              Suraksha-Merge <span className="footer-dot">·</span> Research
              preview v0.1
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
