"use client";
import {
  ArrowRight,
  Database,
  Fingerprint,
  FlaskConical,
  GitMerge,
  Layers3,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { BENCHMARK_CHECKPOINTS } from "../../lib/content/pipeline.ts";

export function BenchmarksView({
  onOpenScenario,
}: {
  onOpenScenario: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="benchmark-view">
      <div className="benchmark-note">
        <FlaskConical size={23} />
        <div>
          <strong>{t("bench.noteTitle")}</strong>
          <p>{t("bench.noteBody")}</p>
        </div>
        <span className="pill soft">{t("bench.notEvaluated")}</span>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("bench.ablation")}</h2>
            <p>{t("bench.ablationBody")}</p>
          </div>
          <Database size={20} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("bench.colCheckpoint")}</th>
                <th>{t("bench.colSchema")}</th>
                <th>{t("bench.colFields")}</th>
                <th>{t("bench.colUnsafe")}</th>
                <th>{t("bench.colEmpathy")}</th>
                <th>{t("bench.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_CHECKPOINTS.map((name, index) => (
                <tr key={name} className={index === 5 ? "merge-row" : ""}>
                  <td>
                    {index === 5 ? (
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
                      {index === 0
                        ? t("bench.awaitingRun")
                        : t("bench.awaitingTraining")}
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
          <h3>{t("bench.splitTitle")}</h3>
          <p>{t("bench.splitBody")}</p>
        </div>
        <div className="panel info-card">
          <MessageSquareText size={23} />
          <h3>{t("bench.empathyTitle")}</h3>
          <p>{t("bench.empathyBody")}</p>
        </div>
        <div className="panel info-card">
          <TriangleAlert size={23} />
          <h3>{t("bench.failureTitle")}</h3>
          <p>{t("bench.failureBody")}</p>
        </div>
      </div>
      <div className="panel redteam-panel">
        <div>
          <span className="eyebrow">{t("bench.adversarialEyebrow")}</span>
          <h2>{t("bench.adversarialTitle")}</h2>
          <p>{t("bench.adversarialBody")}</p>
        </div>
        <button className="button primary" onClick={onOpenScenario}>
          {t("bench.adversarialCta")} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
