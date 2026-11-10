"use client";
import { useMemo } from "react";
import { ArrowUpRight, BookOpen, CircleHelp, Search } from "lucide-react";
import { useI18n } from "../../lib/i18n/provider.tsx";
import { pick } from "../../lib/i18n/locales.ts";
import { SOURCES } from "../../lib/policy.ts";

export function PolicyView({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const { t, locale } = useI18n();
  const needle = query.trim().toLowerCase();

  // The filter runs once per query, not twice per render.
  const visible = useMemo(
    () =>
      SOURCES.filter((source) => {
        const title = pick(source.title, locale).toLowerCase();
        const note = pick(source.note, locale).toLowerCase();
        return `${title} ${note}`.includes(needle);
      }),
    [needle, locale],
  );

  return (
    <div className="policy-view">
      <div className="policy-search">
        <Search size={17} />
        <input
          aria-label={t("policy.search")}
          placeholder={t("policy.search")}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
      <div className="policy-grid">
        {visible.map((source, index) => (
          <a
            className="panel policy-card"
            href={source.url}
            key={source.id}
            target="_blank"
            rel="noreferrer"
          >
            <div>
              <span
                className={`stage-icon ${["teal", "blue", "orange", "violet"][index % 4]}`}
              >
                <BookOpen size={19} />
              </span>
              <ArrowUpRight size={18} />
            </div>
            <span className="eyebrow">
              PRIMARY SOURCE ·{" "}
              <time dateTime={source.date}>{source.date}</time>
            </span>
            <h2>{pick(source.title, locale)}</h2>
            <p>{pick(source.note, locale)}</p>
            <span className="source-domain">
              {source.url.replace(/^https?:\/\//, "").split("/")[0]}{" "}
              <ArrowUpRight size={13} />
            </span>
          </a>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="empty-state">
          <Search size={28} />
          <h3>{t("policy.empty")}</h3>
          <button className="button secondary" onClick={() => onQuery("")}>
            {t("policy.clear")}
          </button>
        </div>
      )}
      <div className="review-note">
        <CircleHelp size={17} />
        <div>
          <strong>{t("policy.disclaimerTitle")}</strong>
          <p>{t("policy.disclaimerBody")}</p>
        </div>
      </div>
    </div>
  );
}
