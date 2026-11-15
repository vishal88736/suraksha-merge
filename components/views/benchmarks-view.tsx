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
import { CURRENT_RESULTS, MEASURED_AT, PILOT_RESULTS } from "../../lib/content/benchmarks.ts";

export function BenchmarksView({
  onOpenScenario,
}: {
  onOpenScenario: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="benchmark-view">
      <div className="benchmark-note">
        <FlaskConical size={23} />
        <div>
          <strong>{t("bench.noteTitle")}</strong>
          <p>{t("bench.noteBody")}</p>
        </div>
        <span className="pill soft">{t("bench.measuredOn", { date: MEASURED_AT })}</span>
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
                <th>{t("bench.colReviewed")}</th>
                <th>{t("bench.colChallenge")}</th>
                <th>{t("bench.colReview")}</th>
                <th>{t("bench.colLatency")}</th>
              </tr>
            </thead>
            <tbody>
              {CURRENT_RESULTS.map((row) => (
                <tr key={row.model} className={row.highlight ? "merge-row" : ""}>
                  <td>
                    <Layers3 size={15} />
                    <span className="bench-name">
                      <strong>{row.model}</strong>
                      <small className="bench-detail">
                        {locale === "hi" ? row.detail.hi : row.detail.en}
                        {row.highlight === "served" && ` · ${t("bench.mostAccurate")}`}
                        {row.highlight === "default" && ` · ${t("bench.defaultMode")}`}
                      </small>
                    </span>
                  </td>
                  <td>{row.reviewedAllFields}</td>
                  <td>{row.challengeCategory}</td>
                  <td>{row.review}</td>
                  <td>{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bench-footnote">{t("bench.footnote")}</p>
        <details className="bench-sources">
          <summary>{t("bench.colSource")}</summary>
          <ul>
            {CURRENT_RESULTS.map((row) => (
              <li key={row.model}>
                <strong>{row.model}</strong>: <code>{row.source}</code>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("bench.pilotTitle")}</h2>
            <p>{t("bench.pilotBody")}</p>
          </div>
          <GitMerge size={20} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("bench.colCheckpoint")}</th>
                <th>{t("bench.colUtility")}</th>
                <th>{t("bench.colFields")}</th>
                <th>{t("bench.colLatency")}</th>
              </tr>
            </thead>
            <tbody>
              {PILOT_RESULTS.map((row) => (
                <tr key={row.model}>
                  <td>
                    <Layers3 size={15} />
                    <strong>{row.model}</strong>
                  </td>
                  <td>{row.utility}</td>
                  <td>{row.allFields}</td>
                  <td>{row.latency}</td>
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
