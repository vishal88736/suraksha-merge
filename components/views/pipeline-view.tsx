"use client";
import {
  ArrowRight,
  Database,
  FileCheck2,
  GitMerge,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { pick } from "../../lib/i18n/locales.ts";
import {
  PIPELINE_STAGES,
  type StageIcon,
} from "../../lib/content/pipeline.ts";
import { download } from "../../lib/format.ts";

const ICONS: Record<StageIcon, typeof Database> = {
  database: Database,
  layers: Layers3,
  merge: GitMerge,
  "file-check": FileCheck2,
};

export function PipelineView({
  stage,
  onStage,
  mix,
  onMix,
}: {
  stage: number;
  onStage: (index: number) => void;
  mix: number;
  onMix: (value: number) => void;
}) {
  const { t, locale } = useI18n();
  const active = PIPELINE_STAGES[stage] ?? PIPELINE_STAGES[0]!;
  const ActiveIcon = ICONS[active.icon];

  return (
    <div className="pipeline-view">
      <div className="pipeline-stepper">
        {PIPELINE_STAGES.map((item, index) => {
          const Icon = ICONS[item.icon];
          return (
            <button
              key={item.id}
              type="button"
              className={`pipeline-step ${stage === index ? "selected" : ""}`}
              onClick={() => onStage(index)}
              aria-pressed={stage === index}
            >
              <span className={`stage-icon ${item.color}`}>
                <Icon size={21} />
              </span>
              <span className="stage-number">
                0{index + 1} / {item.kit}
              </span>
              <strong>{pick(item.name, locale)}</strong>
              <ArrowRight size={16} />
            </button>
          );
        })}
      </div>
      <div className="pipeline-detail panel">
        <div className="stage-copy">
          <div className={`stage-icon large ${active.color}`}>
            <ActiveIcon size={28} />
          </div>
          <span className="eyebrow">
            STAGE 0{stage + 1} · {active.kit}
          </span>
          <h2>{pick(active.text, locale)}</h2>
          <p>{pick(active.details, locale)}</p>
          <div className="stage-status">
            <ShieldCheck size={14} />
            {pick(active.status, locale)}
          </div>
          <code className="command">{active.path}</code>
          <div className="stage-controls">
            <button
              className="button secondary"
              disabled={stage === 0}
              onClick={() => onStage(stage - 1)}
            >
              {t("pipeline.previous")}
            </button>
            <button
              className="button primary"
              disabled={stage === PIPELINE_STAGES.length - 1}
              onClick={() => onStage(stage + 1)}
            >
              {t("pipeline.next")} <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="stage-output">
          <span className="eyebrow">{t("pipeline.outputs")}</span>
          {active.outputs.map((output, index) => (
            <div key={index}>
              <span className="output-number">0{index + 1}</span>
              <strong>{pick(output, locale)}</strong>
              <ShieldCheck size={15} />
            </div>
          ))}
          <div className="pipeline-note">
            <ShieldCheck size={22} />
            <p>{t("pipeline.note")}</p>
          </div>
        </div>
      </div>
      <div className="merge-lab panel">
        <div>
          <span className="eyebrow">{t("pipeline.experimentEyebrow")}</span>
          <h2>{t("pipeline.experimentTitle")}</h2>
          <p>{t("pipeline.experimentBody")}</p>
        </div>
        <div className="mix-controls">
          <label className="mix-labels" htmlFor="merge-mix">
            <strong>
              <span className="teal-text">A</span> {t("pipeline.specialistA")}{" "}
              <b>{(mix / 100).toFixed(2)}</b>
            </strong>
            <strong>
              <span className="violet-text">B</span> {t("pipeline.specialistB")}{" "}
              <b>{(1 - mix / 100).toFixed(2)}</b>
            </strong>
          </label>
          <input
            id="merge-mix"
            aria-label={t("pipeline.specialistA")}
            aria-valuetext={`${(mix / 100).toFixed(2)} ${t(
              "pipeline.specialistA",
            )}, ${(1 - mix / 100).toFixed(2)} ${t("pipeline.specialistB")}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={mix}
            onChange={(event) => onMix(Number(event.target.value))}
          />
          <div className="mix-ticks">
            <span>{t("pipeline.empathyOnly")}</span>
            <button onClick={() => onMix(55)}>{t("pipeline.resetMix")}</button>
            <span>{t("pipeline.schemaOnly")}</span>
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
                    Number((mix / 100).toFixed(2)),
                    Number((1 - mix / 100).toFixed(2)),
                  ],
                  measured: false,
                },
                "merge-experiment.json",
              )
            }
          >
            {t("pipeline.exportMix")}
          </button>
        </div>
      </div>
    </div>
  );
}
