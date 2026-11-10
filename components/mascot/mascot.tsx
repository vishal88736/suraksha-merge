"use client";
import { useState } from "react";
import { pick, type UiLocale } from "../../lib/i18n/locales.ts";
import { useI18n } from "../../lib/i18n/provider.tsx";
import {
  MASCOT_NAME,
  mascotHintFor,
  type MascotHint,
  type MascotMood,
} from "../../lib/content/mascot.ts";
import type { TriageState } from "../../lib/triage-reducer.ts";

/** Eyes and mouth per mood. The character is drawn, never an image asset. */
const FACES: Record<MascotMood, { eyes: string; mouth: string; brows: string }> = {
  idle: {
    eyes: "M18 26v3M32 26v3",
    mouth: "M20 33c2.5 2.5 7.5 2.5 10 0",
    brows: "",
  },
  listening: {
    eyes: "M17 25.5v3.5M33 25.5v3.5",
    mouth: "M22.5 33.5h5",
    brows: "",
  },
  thinking: {
    eyes: "M17.5 26.5l3 2M32.5 26.5l-3 2",
    mouth: "M21 34c2-2 6 2 8 0",
    brows: "",
  },
  found: {
    eyes: "M17 28c1.5-3 4-3 5.5 0M27.5 28c1.5-3 4-3 5.5 0",
    mouth: "M19.5 32.5c3 4 8 4 11 0",
    brows: "",
  },
  warning: {
    eyes: "M18 25v3M32 25v3",
    mouth: "M21 35h8",
    brows: "M15.5 20.5l5 2M34.5 20.5l-5 2",
  },
};

export function Mascot({
  state,
  locale,
  listening = false,
  running = false,
  compact = false,
}: {
  state: TriageState;
  locale: UiLocale;
  listening?: boolean;
  running?: boolean;
  compact?: boolean;
}) {
  const hint = mascotHintFor(state, { listening, running });
  // The key makes a new situation start with a visible hint again.
  return (
    <MascotBody
      key={hint.id}
      hint={hint}
      mood={
        listening ? "listening" : running ? "thinking" : hint.mood
      }
      locale={locale}
      compact={compact}
    />
  );
}

function MascotBody({
  hint,
  mood,
  locale,
  compact,
}: {
  hint: MascotHint;
  mood: MascotMood;
  locale: UiLocale;
  compact: boolean;
}) {
  const face = FACES[mood];
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !compact) return null;

  return (
    <aside
      className={`mascot ${compact ? "mascot-compact" : ""}`}
      aria-live="polite"
      data-mood={mood}
    >
      <div className="mascot-figure" aria-hidden="true">
        <svg viewBox="0 0 50 58" width="46" height="54" focusable="false">
          <path
            d="M25 2 44 8v20c0 12-8 21-19 26C14 49 6 40 6 28V8Z"
            fill="url(#mascot-body)"
            stroke="#2b4a5c"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M25 6 40 11v17c0 10-6.5 17.5-15 22-8.5-4.5-15-12-15-22V11Z"
            fill="none"
            stroke="#bfe6f5"
            strokeWidth="1.4"
          />
          <g
            fill="none"
            stroke="#1d3340"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={face.brows} />
            <path d={face.eyes} />
            <path d={face.mouth} />
          </g>
          {mood === "listening" && (
            <g fill="none" stroke="#2b4a5c" strokeWidth="1.8" strokeLinecap="round">
              <path d="M45 24a7 7 0 0 1 0 8" />
              <path d="M49 20a12 12 0 0 1 0 16" />
            </g>
          )}
          <defs>
            <linearGradient id="mascot-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9fdcf2" />
              <stop offset="1" stopColor="#d9f1fb" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="mascot-bubble">
        <div className="mascot-meta">
          <strong>{MASCOT_NAME}</strong>
          <span className="mascot-mood">{pick(hint.title, locale)}</span>
        </div>
        <p>{pick(hint.body, locale)}</p>
        {!compact && (
          <button
            className="mascot-dismiss"
            onClick={() => setDismissed(true)}
            aria-label={t("mascot.dismissHint")}
          >
            {t("mascot.hideHint")}
          </button>
        )}
      </div>
    </aside>
  );
}
