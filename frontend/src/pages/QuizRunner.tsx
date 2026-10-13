import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Icon from "../components/Icon";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import {
  applyOptions,
  emptyProfile,
  mergeGuardrails,
  rankProducts,
  type MatchProduct,
  type QuizOptionDef,
} from "../quiz/score";
import type { QuizStep, QuizStepOption, ShopQuizPublic } from "../types";

function pickText(lang: string, en?: string | null, vi?: string | null) {
  if (lang === "vi" && vi?.trim()) return vi;
  return en || "";
}

export default function QuizRunner() {
  const { slug = "" } = useParams();
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", slug, lang],
    queryFn: () => api.getQuiz(slug, lang),
    enabled: Boolean(slug),
  });

  const steps = quiz?.steps || [];
  const current = steps[stepIndex];
  const progress = steps.length ? Math.round(((finished ? steps.length : stepIndex) / steps.length) * 100) : 0;

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

  const liveRanked = useMemo(() => {
    if (!quiz) return [];
    let profile = emptyProfile();
    profile = applyOptions(profile, selectedOptions);
    const guardrails = mergeGuardrails(selectedOptions);
    const pool: MatchProduct[] = (quiz.match_products || []).map((p) => ({
      slug: p.slug,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      finder_profile: p.finder_profile,
    }));
    return rankProducts(profile, pool, quiz.dimension_weights, guardrails).slice(0, 5);
  }, [quiz, selectedOptions]);

  const finalRanked = useMemo(() => {
    if (!quiz || !finished) return liveRanked;
    return liveRanked;
  }, [quiz, finished, liveRanked]);

  if (isLoading || !quiz) {
    return (
      <main className="pt-24 px-8 max-w-[1440px] mx-auto">
        <p className="font-body text-body-md text-secondary">{t("loading")}</p>
      </main>
    );
  }

  function selectOption(step: QuizStep, opt: QuizStepOption) {
    setAnswers((a) => ({ ...a, [step.id]: opt.id }));
  }

  function next() {
    if (stepIndex >= steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function back() {
    if (finished) {
      setFinished(false);
      setStepIndex(steps.length - 1);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const canNext = current?.required ? Boolean(answers[current.id]) : true;

  return (
    <main className="w-full pt-20 bg-surface">
      <div className="w-full bg-surface-container-high h-1">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <section className="py-16 px-6 md:px-margin-desktop max-w-[1440px] mx-auto">
        <p className="font-label text-label-caps text-secondary uppercase tracking-wider mb-2">
          {pickText(lang, quiz.hero_kicker, quiz.hero_kicker_vi)}
        </p>
        <h1 className="font-display text-display-lg-mobile md:text-display-lg uppercase text-primary tracking-tight mb-4">
          {pickText(lang, quiz.title, quiz.title_vi)}
        </h1>
        <p className="font-body text-body-lg text-secondary max-w-2xl mb-6">
          {pickText(lang, quiz.subtitle, quiz.subtitle_vi)}
        </p>
        <div className="flex flex-wrap gap-2 mb-10">
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
      </section>

      <section className="bg-surface-container-low py-12 px-6 md:px-margin-desktop">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            {!finished && current ? (
              <div className="bg-surface-container-lowest p-8 shadow-sm">
                <p className="font-label text-label-caps text-secondary uppercase mb-2">
                  {t("quiz.stepOf", { current: stepIndex + 1, total: steps.length })}
                </p>
                <h2 className="font-headline text-headline-lg uppercase text-primary mb-2">
                  {pickText(lang, current.title, current.title_vi)}
                </h2>
                {pickText(lang, current.subtitle, current.subtitle_vi) ? (
                  <p className="font-body text-body-md text-secondary mb-6 italic">
                    {pickText(lang, current.subtitle, current.subtitle_vi)}
                  </p>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {current.options.map((opt) => {
                    const active = answers[current.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => selectOption(current, opt)}
                        className={`text-left p-6 border-2 transition-all flex flex-col gap-2 ${
                          active
                            ? "border-primary bg-surface-container ring-2 ring-primary"
                            : "border-outline-variant bg-surface-container-low hover:border-primary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {opt.badge ? (
                            <span className="font-label text-[10px] uppercase bg-primary text-on-primary px-2 py-0.5">
                              {pickText(lang, opt.badge, opt.badge)}
                            </span>
                          ) : (
                            <span />
                          )}
                          {opt.icon ? <Icon name={opt.icon} className="text-primary text-[22px]" /> : null}
                        </div>
                        <h3 className="font-headline text-headline-md text-primary uppercase">
                          {pickText(lang, opt.title, opt.title_vi)}
                        </h3>
                        {pickText(lang, opt.subtitle, opt.subtitle_vi) ? (
                          <p className="font-body text-body-sm text-secondary italic">
                            {pickText(lang, opt.subtitle, opt.subtitle_vi)}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap justify-between gap-4 mt-8">
                  <button
                    type="button"
                    onClick={back}
                    disabled={stepIndex === 0 && !finished}
                    className="px-6 py-3 font-label text-label-caps uppercase border border-outline disabled:opacity-40"
                  >
                    {t("quiz.back")}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!canNext}
                    className="px-8 py-3 font-label text-label-caps uppercase bg-primary text-on-primary disabled:opacity-40"
                  >
                    {stepIndex >= steps.length - 1 ? t("quiz.seeResults") : t("quiz.next")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-8 shadow-sm">
                <h2 className="font-headline text-headline-lg uppercase text-primary mb-6">{t("quiz.yourMatches")}</h2>
                <ul className="flex flex-col gap-4">
                  {finalRanked.map((row) => (
                    <li
                      key={row.slug}
                      className="flex items-center gap-4 border border-outline-variant p-4 bg-surface-container-low"
                    >
                      {row.product.image_url ? (
                        <img src={row.product.image_url} alt="" className="w-20 h-24 object-cover bg-white" />
                      ) : (
                        <div className="w-20 h-24 bg-surface-container" />
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
                  {finalRanked.length === 0 ? (
                    <p className="font-body text-body-md text-secondary">{t("quiz.noMatches")}</p>
                  ) : null}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setStepIndex(0);
                    setFinished(false);
                  }}
                  className="mt-8 font-label text-label-caps uppercase underline text-primary"
                >
                  {t("quiz.retake")}
                </button>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4">
            <div className="bg-surface-container-lowest p-6 shadow-sm sticky top-24">
              <h3 className="font-headline text-headline-md uppercase text-primary mb-4">{t("quiz.liveShortlist")}</h3>
              <ul className="flex flex-col gap-3">
                {liveRanked.map((row) => (
                  <li key={row.slug} className="flex items-center gap-3 text-sm">
                    <span className="font-label text-label-caps text-primary w-12">{row.match}%</span>
                    <span className="font-body text-body-md truncate flex-1">{row.product.name}</span>
                  </li>
                ))}
                {liveRanked.length === 0 ? (
                  <p className="font-body text-body-sm text-secondary">{t("quiz.answerToSee")}</p>
                ) : null}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {quiz.faq?.length > 0 ? (
        <section className="py-16 px-6 md:px-margin-desktop max-w-[1440px] mx-auto">
          <h2 className="font-headline text-headline-lg uppercase text-primary mb-8">{t("quiz.faq")}</h2>
          <div className="flex flex-col gap-4">
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
