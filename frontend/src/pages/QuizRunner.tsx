import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import { dimensionIdsFromQuiz } from "../quiz/dimensions";
import {
  applyOptions,
  emptyProfile,
  mergeGuardrails,
  rankProducts,
  type MatchProduct,
  type QuizOptionDef,
} from "../quiz/score";
import type { QuizStep, QuizStepOption } from "../types";

function pickText(lang: string, en?: string | null, vi?: string | null) {
  if (lang === "vi" && vi?.trim()) return vi;
  return en || "";
}

type Phase = "intro" | "slides" | "results";

export default function QuizRunner() {
  const { slug = "" } = useParams();
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data: quiz, isLoading, isError } = useQuery({
    queryKey: ["quiz", slug, lang],
    queryFn: () => api.getQuiz(slug, lang),
    enabled: Boolean(slug),
  });

  const steps = quiz?.steps || [];
  const current = steps[stepIndex];
  const slideProgress = steps.length ? ((phase === "results" ? steps.length : stepIndex + 1) / steps.length) * 100 : 0;

  const selectedOptions = useMemo(() => {
    if (!quiz) return [] as QuizOptionDef[];
    const opts: QuizOptionDef[] = [];
    for (const step of quiz.steps) {
      const choiceId = answers[step.id];
      if (!choiceId) continue;
      const opt = step.options.find((o) => o.id === choiceId);
      if (opt) opts.push(opt as QuizOptionDef);
    }
    return opts;
  }, [quiz, answers]);

  const ranked = useMemo(() => {
    if (!quiz) return [];
    const dimIds = dimensionIdsFromQuiz(quiz);
    let profile = emptyProfile(dimIds);
    profile = applyOptions(profile, selectedOptions, dimIds);
    const guardrails = mergeGuardrails(selectedOptions);
    const pool: MatchProduct[] = (quiz.match_products || []).map((p) => ({
      slug: p.slug,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      finder_profile: p.finder_profile,
    }));
    return rankProducts(profile, pool, quiz.dimension_weights, guardrails, dimIds);
  }, [quiz, selectedOptions]);

  const topMatches = ranked.slice(0, 5);

  if (isLoading) {
    return (
      <main className="pt-24 px-8 max-w-[1440px] mx-auto min-h-[60vh]">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  if (isError || !quiz) {
    return (
      <main className="pt-24 px-8 max-w-[1440px] mx-auto min-h-[60vh]">
        <p className="font-body text-body-md text-secondary">{t("quiz.notFound")}</p>
      </main>
    );
  }

  function selectOption(step: QuizStep, opt: QuizStepOption) {
    setAnswers((a) => ({ ...a, [step.id]: opt.id }));
  }

  function goNext() {
    if (!current) return;
    if (current.required && !answers[current.id]) return;
    if (stepIndex >= steps.length - 1) {
      setPhase("results");
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (phase === "results") {
      setPhase("slides");
      setStepIndex(steps.length - 1);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const canNext = current?.required ? Boolean(answers[current?.id ?? ""]) : true;

  return (
    <main className="w-full pt-20 bg-surface min-h-screen flex flex-col">
      <div className="w-full bg-surface-container-high h-1 shrink-0">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${phase === "intro" ? 0 : slideProgress}%` }}
        />
      </div>

      {phase === "intro" ? (
        <section className="flex-1 flex flex-col justify-center py-16 px-6 md:px-margin-desktop max-w-[1440px] mx-auto w-full">
          <p className="font-label text-label-caps text-secondary uppercase tracking-wider mb-2">
            {pickText(lang, quiz.hero_kicker, quiz.hero_kicker_vi)}
          </p>
          <h1 className="font-display text-display-lg-mobile md:text-display-lg uppercase text-primary tracking-tight mb-4">
            {pickText(lang, quiz.title, quiz.title_vi)}
          </h1>
          <p className="font-body text-body-lg text-secondary max-w-2xl mb-8">
            {pickText(lang, quiz.subtitle, quiz.subtitle_vi)}
          </p>
          <div className="flex flex-wrap gap-2 mb-12">
            {(quiz.hero_badges || []).map((b, i) => (
              <span
                key={i}
                className="bg-surface-container-lowest px-4 py-2 rounded-full flex items-center gap-2 shadow-sm font-label text-label-caps uppercase text-xs"
              >
                {b.icon ? <Icon name={b.icon} className="text-[16px] text-primary" /> : null}
                {pickText(lang, b.label, b.label_vi)}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPhase("slides");
              setStepIndex(0);
            }}
            className="self-start px-10 py-4 bg-primary text-on-primary font-label text-label-caps uppercase tracking-widest"
          >
            {t("quiz.start")}
          </button>
        </section>
      ) : null}

      {phase === "slides" && current ? (
        <section className="flex-1 flex flex-col py-8 md:py-12 px-6 md:px-margin-desktop max-w-[1440px] mx-auto w-full">
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="font-label text-label-caps text-secondary uppercase">
              {t("quiz.stepOf", { current: String(stepIndex + 1), total: String(steps.length) })}
            </p>
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i <= stepIndex ? "bg-primary" : "bg-surface-container-high"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[420px]">
            {current.image_url ? (
              <div className="lg:col-span-5 bg-surface-container-low overflow-hidden min-h-[240px] lg:min-h-0">
                <img src={current.image_url} alt="" className="w-full h-full object-cover min-h-[240px]" />
              </div>
            ) : null}
            <div className={`flex flex-col ${current.image_url ? "lg:col-span-7" : "lg:col-span-12"}`}>
              <h2 className="font-headline text-headline-lg-mobile md:text-headline-lg uppercase text-primary mb-3 tracking-tight">
                {pickText(lang, current.title, current.title_vi)}
              </h2>
              {pickText(lang, current.subtitle, current.subtitle_vi) ? (
                <p className="font-body text-body-md text-secondary mb-6 max-w-xl">
                  {pickText(lang, current.subtitle, current.subtitle_vi)}
                </p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 content-start">
                {current.options.map((opt) => {
                  const active = answers[current.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectOption(current, opt)}
                      className={`text-left p-5 border-2 transition-all flex flex-col gap-2 min-h-[120px] ${
                        active
                          ? "border-primary bg-surface-container-lowest shadow-md ring-2 ring-primary ring-offset-2"
                          : "border-outline-variant bg-surface-container-lowest hover:border-primary hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        {opt.badge ? (
                          <span className="font-label text-[10px] uppercase bg-primary text-on-primary px-2 py-0.5">
                            {opt.badge}
                          </span>
                        ) : (
                          <span />
                        )}
                        {active ? (
                          <Icon name="check_circle" className="text-primary text-[22px]" />
                        ) : opt.icon ? (
                          <Icon name={opt.icon} className="text-secondary text-[22px]" />
                        ) : null}
                      </div>
                      {opt.image_url ? (
                        <img src={opt.image_url} alt="" className="w-full h-24 object-cover rounded-sm mb-1" />
                      ) : null}
                      <h3 className="font-headline text-headline-md text-primary uppercase leading-snug">
                        {pickText(lang, opt.title, opt.title_vi)}
                      </h3>
                      {pickText(lang, opt.subtitle, opt.subtitle_vi) ? (
                        <p className="font-body text-body-sm text-secondary">{pickText(lang, opt.subtitle, opt.subtitle_vi)}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-4 mt-10 pt-6 border-t border-outline-variant">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="px-8 py-3 font-label text-label-caps uppercase border border-outline disabled:opacity-40 flex items-center gap-2"
            >
              <Icon name="arrow_back" className="text-[18px]" />
              {t("quiz.back")}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="px-10 py-3 font-label text-label-caps uppercase bg-primary text-on-primary disabled:opacity-40 flex items-center gap-2"
            >
              {stepIndex >= steps.length - 1 ? t("quiz.seeResults") : t("quiz.next")}
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>

          {topMatches.length > 0 ? (
            <div className="mt-8 p-4 bg-surface-container-low border border-outline-variant">
              <p className="font-label text-label-caps text-xs uppercase text-secondary mb-2">{t("quiz.liveShortlist")}</p>
              <div className="flex flex-wrap gap-4">
                {topMatches.map((row) => (
                  <span key={row.slug} className="font-body text-body-sm">
                    <span className="font-label text-primary">{row.match}%</span> {row.product.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "results" ? (
        <section className="flex-1 py-12 px-6 md:px-margin-desktop max-w-[1440px] mx-auto w-full">
          <h2 className="font-headline text-headline-lg uppercase text-primary mb-8">{t("quiz.yourMatches")}</h2>
          <ul className="flex flex-col gap-4 max-w-3xl">
            {ranked.slice(0, 10).map((row) => (
              <li
                key={row.slug}
                className="flex items-center gap-4 border border-outline-variant p-4 bg-surface-container-lowest"
              >
                {row.product.image_url ? (
                  <img src={row.product.image_url} alt="" className="w-20 h-24 object-cover bg-white shrink-0" />
                ) : (
                  <div className="w-20 h-24 bg-surface-container shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-label text-label-caps text-primary">{row.match}% {t("quiz.match")}</p>
                  <p className="font-headline text-headline-md uppercase truncate">{row.product.name}</p>
                  <p className="font-body text-body-md text-secondary">{formatPrice(row.product.price)}</p>
                </div>
                <Link
                  to={`/products/${row.slug}`}
                  className="font-label text-label-caps uppercase bg-primary text-on-primary px-4 py-2 shrink-0"
                >
                  {t("quiz.viewProduct")}
                </Link>
              </li>
            ))}
            {ranked.length === 0 ? (
              <p className="font-body text-body-md text-secondary">{t("quiz.noMatches")}</p>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-4 mt-10">
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setStepIndex(0);
                setPhase("slides");
              }}
              className="font-label text-label-caps uppercase underline text-primary"
            >
              {t("quiz.retake")}
            </button>
            <button
              type="button"
              onClick={() => setPhase("intro")}
              className="font-label text-label-caps uppercase text-secondary"
            >
              {t("quiz.backToIntro")}
            </button>
          </div>
        </section>
      ) : null}

      {quiz.faq?.length > 0 && phase === "results" ? (
        <section className="py-16 px-6 md:px-margin-desktop max-w-[1440px] mx-auto w-full border-t border-outline-variant">
          <h2 className="font-headline text-headline-lg uppercase text-primary mb-8">{t("quiz.faq")}</h2>
          <div className="flex flex-col gap-4 max-w-3xl">
            {quiz.faq.map((item, i) => (
              <details key={i} className="border border-outline-variant p-4 bg-surface-container-lowest">
                <summary className="font-headline text-headline-md cursor-pointer uppercase">
                  {pickText(lang, item.q, item.q_vi)}
                </summary>
                <p className="font-body text-body-md text-secondary mt-3">{pickText(lang, item.a, item.a_vi)}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
