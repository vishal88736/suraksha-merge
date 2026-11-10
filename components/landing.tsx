"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Fingerprint,
  FolderLock,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useI18n } from "../lib/i18n/provider.tsx";

type Destination = "desk" | "pipeline" | "benchmarks" | "policy";

function SecurityIllustration({ label }: { label: string }) {
  return (
    <svg
      className="security-illustration"
      viewBox="0 0 680 590"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="pink-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f86fbd" />
          <stop offset="1" stopColor="#f5e6ed" />
        </linearGradient>
        <linearGradient id="yellow-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffda30" />
          <stop offset="1" stopColor="#fff8d8" />
        </linearGradient>
      </defs>
      <g transform="rotate(9 356 181)">
        <path d="M145 50H570V310H145Z" fill="#f3f3f1" />
        <path d="M145 50H570V60H145Z" fill="url(#yellow-edge)" />
        <rect x="158" y="69" width="398" height="225" fill="#fff" />
        <circle cx="424" cy="55" r="4" fill="#fff" />
        <circle cx="441" cy="55" r="4" fill="#fff" />
        <circle cx="458" cy="55" r="4" fill="#fff" />
        <rect x="183" y="95" width="150" height="7" fill="#e8e8e7" />
        <rect x="183" y="113" width="109" height="5" fill="#eee" />
        <rect x="183" y="130" width="130" height="5" fill="#eee" />
      </g>
      <path d="M55 135H510V365H55Z" fill="#e6e7e4" />
      <path d="M55 135H510V148H55Z" fill="url(#pink-edge)" />
      <rect x="68" y="162" width="429" height="185" fill="white" />
      <circle cx="399" cy="142" r="4" fill="#fff" />
      <circle cx="416" cy="142" r="4" fill="#fff" />
      <circle cx="433" cy="142" r="4" fill="#fff" />
      <rect x="87" y="181" width="64" height="7" fill="#e2e3e0" />
      <rect x="87" y="196" width="36" height="4" fill="#eff0ed" />
      <rect x="86" y="224" width="109" height="6" fill="#e6e7e4" />
      <rect x="111" y="240" width="84" height="5" fill="#e6e7e4" />
      <rect x="96" y="256" width="99" height="5" fill="#e6e7e4" />
      <rect x="125" y="273" width="70" height="5" fill="#e6e7e4" />
      <rect x="86" y="290" width="109" height="5" fill="#e6e7e4" />
      <rect x="106" y="307" width="89" height="5" fill="#e6e7e4" />
      <g fill="#e5e6e3">
        <rect x="215" y="224" width="6" height="6" />
        <rect x="215" y="240" width="6" height="6" />
        <rect x="215" y="256" width="6" height="6" />
        <rect x="215" y="273" width="6" height="6" />
        <rect x="215" y="290" width="6" height="6" />
        <rect x="215" y="307" width="6" height="6" />
      </g>
      <circle cx="376" cy="236" r="41" fill="#e8e9e7" />
      <circle cx="376" cy="222" r="11" fill="#fff" />
      <path d="M355 255l8-19h26l8 19z" fill="#fff" />
      <rect x="321" y="291" width="111" height="5" fill="#e8e9e7" />
      <rect x="341" y="305" width="71" height="5" fill="#e8e9e7" />
      <path
        d="M540 344v190q0 13 13 13h13q12 0 12-13V404h14v130q0 13 12 13h13q13 0 13-13V344Z"
        fill="#80cff5"
      />
      <path d="M548 363l-130-2q-19 0-21-15t18-16l145 6z" fill="#80cff5" />
      <path
        d="M530 169c22-1 49 14 58 36 9 25-5 55-30 67s-61 7-77-16c-14-23-13-49 4-67 11-12 26-19 45-20z"
        fill="#80cff5"
      />
      <path
        d="M543 157c-43-11-75 4-77 23-2 20 28 30 50 24 16-4 24-12 28-21"
        fill="none"
        stroke="#242332"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M501 145c50-17 94 13 102 54 5 27-7 50-22 65"
        fill="none"
        stroke="#242332"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M489 220h13m27 0h13m-25-4v25h7m-19 10q6 8 16 5"
        fill="none"
        stroke="#253349"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M506 405l47-101q9-19 19 0l53 101q23 43-19 46h-78q-44-1-22-46z"
        fill="#050606"
      />
      <path
        d="M553 336q0-16 13-16t13 16v98q0 10-13 10t-13-10z"
        fill="#80cff5"
      />
      <path
        d="M326 333v-19c0-24 16-40 38-40s38 16 38 40v19"
        fill="none"
        stroke="#80cff5"
        strokeWidth="11"
      />
      <rect x="301" y="323" width="126" height="113" rx="20" fill="#040505" />
      <circle cx="364" cy="364" r="14" fill="#fff" />
      <rect x="358" y="369" width="12" height="29" rx="5" fill="#fff" />
      <path d="M467 548h196" stroke="#252b35" strokeWidth="1.4" />
      <path d="M655 548q3-38-13-56-11-12-18-16 2 30 17 39" fill="#e4e6e3" />
      <path d="M649 546q7-27 5-47" fill="none" stroke="#fff" />
    </svg>
  );
}

export function Landing({
  onNavigate,
}: {
  onNavigate: (view: Destination) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="landing-logo" href="/" aria-label={t("nav.brandHome")}>
          <span className="gradient-dot" />
          SURAKSHA<span>DESK</span>
        </Link>
        <nav aria-label={t("landing.home")}>
          <a className="selected" href="#home">
            {t("landing.home")}
          </a>
          <button onClick={() => onNavigate("pipeline")}>
            {t("landing.howItWorks")}
          </button>
          <a href="#features">{t("landing.features")}</a>
          <a href="#questions">{t("landing.faq")}</a>
        </nav>
        <div className="landing-nav-actions">
          <a
            href="https://github.com/vishal88736/suraksha-merge"
            target="_blank"
            rel="noreferrer"
          >
            {t("landing.github")} <ArrowUpRight size={12} />
          </a>
          <button onClick={() => onNavigate("desk")}>
            {t("landing.openDesk")} <ArrowRight size={14} />
          </button>
        </div>
      </header>
      <main className="landing-main" id="home">
        <svg
          className="contour-lines"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <path
              key={index}
              d={`M-100 ${160 + index * 72} C 140 ${-20 + index * 72}, 390 ${-20 + index * 72}, 585 ${220 + index * 72} S 1050 ${800 + index * 38}, 1540 ${580 + index * 48}`}
              fill="none"
              stroke="#d3e3e4"
              strokeWidth=".8"
            />
          ))}
        </svg>
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="next-level">
              <ShieldCheck size={16} />
              <span>{t("landing.heroEyebrow")}</span>
            </span>
            <h1 id="hero-title">
              {t("landing.heroTitleLine1")}
              <br />
              <span>
                {t("landing.heroTitleLine2")}{" "}
                <span className="fingerprint-pill">
                  <Fingerprint strokeWidth={1.6} />
                </span>
              </span>
            </h1>
            <p className="hero-description">
              {t("landing.heroDescriptionLine1")}
              <br />
              {t("landing.heroDescriptionLine2")}
            </p>
            <button className="hero-cta" onClick={() => onNavigate("desk")}>
              {t("landing.heroCta")} <ArrowRight size={29} strokeWidth={1.2} />
            </button>
            <div className="hero-mode">
              <span />
              {t("landing.heroMode")}{" "}
              <span className="mode-separator">/</span> {t("landing.heroModeDivider")}
            </div>
            <div className="unique-features" id="features">
              <h2>{t("landing.featuresTitle")}</h2>
              <div className="feature-tiles">
                <button onClick={() => onNavigate("desk")}>
                  <span className="feature-square cyan-square">
                    <Fingerprint size={65} strokeWidth={1.5} />
                  </span>
                  <strong>{t("landing.feature1Title")}</strong>
                  <small>{t("landing.feature1Body")}</small>
                </button>
                <button onClick={() => onNavigate("pipeline")}>
                  <span className="feature-square grey-square">
                    <FolderLock size={64} strokeWidth={1.5} />
                  </span>
                  <strong>{t("landing.feature2Title")}</strong>
                  <small>{t("landing.feature2Body")}</small>
                </button>
                <button onClick={() => onNavigate("benchmarks")}>
                  <span className="feature-square lavender-square">
                    <span className="star-ring">
                      <Star size={40} strokeWidth={1.7} />
                    </span>
                  </span>
                  <strong>{t("landing.feature3Title")}</strong>
                  <small>{t("landing.feature3Body")}</small>
                </button>
              </div>
            </div>
          </div>
          <div className="hero-art">
            <SecurityIllustration label={t("landing.illustrationLabel")} />
            <div className="art-caption">
              <span className="caption-stars">
                <ShieldCheck size={17} />
                <Fingerprint size={17} />
                <Braces size={17} />
              </span>
              <div>
                <strong>{t("landing.artTitle")}</strong>
                <span>{t("landing.artCaption")}</span>
              </div>
              <button
                aria-label={t("landing.artButton")}
                onClick={() => onNavigate("pipeline")}
              >
                <ArrowUpRight size={22} />
              </button>
            </div>
          </div>
        </section>
        <section className="landing-explainer">
          <div>
            <span className="landing-kicker">
              {t("landing.approachKicker")}
            </span>
            <h2>
              {t("landing.approachTitleLine1")}
              <br />
              {t("landing.approachTitleLine2")}
            </h2>
          </div>
          <div>
            <p>{t("landing.approachBody1")}</p>
            <p>{t("landing.approachBody2")}</p>
            <button
              className="text-link"
              onClick={() => onNavigate("pipeline")}
            >
              {t("landing.followPipeline")} <ArrowRight size={19} />
            </button>
          </div>
        </section>
        <section className="landing-faq" id="questions">
          <div>
            <span className="landing-kicker">
              {t("landing.contextKicker")}
            </span>
            <h2>
              {t("landing.faqTitleLine1")}
              <br />
              {t("landing.faqTitleLine2")}
            </h2>
          </div>
          <div className="faq-items">
            <details>
              <summary>
                {t("landing.faq1Question")}
                <span>+</span>
              </summary>
              <p>{t("landing.faq1Answer")}</p>
            </details>
            <details>
              <summary>
                {t("landing.faq2Question")}
                <span>+</span>
              </summary>
              <p>{t("landing.faq2Answer")}</p>
            </details>
            <details>
              <summary>
                {t("landing.faq3Question")}
                <span>+</span>
              </summary>
              <p>
                {t("landing.faq3Answer")}{" "}
                <button onClick={() => onNavigate("policy")}>
                  {t("landing.policyLink")}
                </button>
              </p>
            </details>
            <details>
              <summary>
                {t("landing.faq4Question")}
                <span>+</span>
              </summary>
              <p>{t("landing.faq4Answer")}</p>
            </details>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" className="landing-logo">
          <span className="gradient-dot" />
          SURAKSHA<span>DESK</span>
        </Link>
        <span>{t("landing.footerTagline")}</span>
        <button onClick={() => onNavigate("desk")}>
          {t("landing.openWorkspace")} <ArrowUpRight size={15} />
        </button>
      </footer>
    </div>
  );
}
