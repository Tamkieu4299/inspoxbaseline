import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, Product, QuizStep, ShopQuiz } from "../types";
import { ImageField } from "./MediaLibrary";
import {
  mergeDimensionWeights,
  resolveQuizDimensions,
  slugifyDimensionId,
  type QuizDimensionDef,
} from "../quiz/dimensions";
import {
  applyOptions,
  emptyProfile,
  mergeGuardrails,
  rankProducts,
  type MatchProduct,
  type QuizOptionDef,
} from "../quiz/score";
import { blankQuiz, racquetFinderTemplate, tennisWarehouseReviewTemplate } from "../quiz/template";
import Icon from "../components/Icon";
import { Checkbox, DangerButton, Field, PrimaryButton, SecondaryButton, TextArea, TextInput } from "./ui";

const HELP_BLOCKS = [
  { title: "admin.quizzes.helpBlock1Title", body: "admin.quizzes.helpBlock1Body" },
  { title: "admin.quizzes.helpBlock2Title", body: "admin.quizzes.helpBlock2Body" },
  { title: "admin.quizzes.helpBlock3Title", body: "admin.quizzes.helpBlock3Body" },
  { title: "admin.quizzes.helpBlock4Title", body: "admin.quizzes.helpBlock4Body" },
  { title: "admin.quizzes.helpBlock5Title", body: "admin.quizzes.helpBlock5Body" },
] as const;

const HELP_FLOW_KEYS = [
  "admin.quizzes.helpFlow1",
  "admin.quizzes.helpFlow2",
  "admin.quizzes.helpFlow3",
] as const;

function quizPayload(d: Partial<ShopQuiz>): unknown {
  return {
    slug: d.slug?.trim(),
    title: d.title?.trim(),
    title_vi: d.title_vi || null,
    subtitle: d.subtitle || null,
    subtitle_vi: d.subtitle_vi || null,
    nav_label: d.nav_label || null,
    nav_label_vi: d.nav_label_vi || null,
    show_in_nav: d.show_in_nav ?? false,
    is_published: d.is_published ?? false,
    hero_kicker: d.hero_kicker || null,
    hero_kicker_vi: d.hero_kicker_vi || null,
    hero_badges: d.hero_badges || [],
    faq: d.faq || [],
    dimensions: d.dimensions?.length ? d.dimensions : resolveQuizDimensions(d as ShopQuiz),
    dimension_weights: mergeDimensionWeights(
      resolveQuizDimensions(d as ShopQuiz),
      d.dimension_weights || {}
    ),
    steps: d.steps || [],
    product_filter: d.product_filter || { category_slugs: [], require_finder_profile: true },
  };
}

function productPool(products: Product[], filter: ShopQuiz["product_filter"], categories: { slug: string }[]) {
  const slugs = new Set(filter?.category_slugs || []);
  const requireProfile = filter?.require_finder_profile !== false;
  return products.filter((p) => {
    if (!p.is_active) return false;
    const fp = p.finder_profile;
    if (requireProfile && !fp?.enabled) return false;
    if (slugs.size) {
      const cs = new Set((p.categories || []).map((c) => c.slug));
      for (const s of slugs) if (cs.has(s)) return true;
      return false;
    }
    return true;
  });
}

export default function QuizzesTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: quizzes, isLoading } = useQuery({ queryKey: ["admin-quizzes"], queryFn: adminApi.getQuizzes });
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: adminApi.getProducts });
  const { data: categories } = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.getCategories });
  const { data: media } = useQuery({ queryKey: ["admin-media"], queryFn: adminApi.getMedia });
  const mediaById = useMemo(() => new Map((media || []).map((m) => [m.id, m])), [media]);

  const [draft, setDraft] = useState<Partial<ShopQuiz> | null>(null);
  const [simAnswers, setSimAnswers] = useState<Record<string, string>>({});
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [weightsHelpOpen, setWeightsHelpOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (d: Partial<ShopQuiz>) =>
      d.id ? adminApi.updateQuiz(d.id, quizPayload(d)) : adminApi.createQuiz(quizPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      setDraft(null);
      setSimAnswers({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quizzes"] });
      setDraft(null);
    },
  });

  function set<K extends keyof ShopQuiz>(key: K, value: ShopQuiz[K]) {
    setDraft((d) => ({ ...(d || blankQuiz()), [key]: value }));
  }

  const pool = useMemo(() => {
    if (!draft || !products) return [] as Product[];
    return productPool(products, draft.product_filter || {}, categories || []);
  }, [draft, products, categories]);

  const dimensionDefs = useMemo(
    () => (draft ? resolveQuizDimensions(draft as ShopQuiz) : []),
    [draft?.dimensions, draft?.dimension_weights]
  );
  const dimensionIds = useMemo(() => dimensionDefs.map((d) => d.id), [dimensionDefs]);

  const simRanked = useMemo(() => {
    if (!draft?.steps) return [];
    const opts: QuizOptionDef[] = [];
    for (const step of draft.steps) {
      const id = simAnswers[step.id];
      const o = step.options.find((x) => x.id === id);
      if (o) opts.push(o as QuizOptionDef);
    }
    let profile = emptyProfile(dimensionIds);
    profile = applyOptions(profile, opts, dimensionIds);
    const guardrails = mergeGuardrails(opts);
    const matchProducts: MatchProduct[] = pool.map((p) => ({
      slug: p.slug,
      name: p.name,
      price: p.price,
      image_url: p.images?.find((i) => i.enabled !== false)?.url || p.images?.[0]?.url,
      finder_profile: p.finder_profile,
    }));
    return rankProducts(profile, matchProducts, draft.dimension_weights, guardrails, dimensionIds).slice(0, 5);
  }, [draft, simAnswers, pool, dimensionIds]);

  if (isLoading) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 border border-surface-container-highest bg-white hover:border-primary font-label text-label-caps uppercase text-primary text-xs tracking-wider"
          aria-label={t("admin.quizzes.helpTitle")}
        >
          <Icon name="help_outline" className="text-[20px]" />
          {t("admin.quizzes.helpButton")}
        </button>
      </div>
      {helpOpen ? <QuizMatchingHelpModal onClose={() => setHelpOpen(false)} /> : null}
      {weightsHelpOpen ? <DimensionWeightsHelpModal onClose={() => setWeightsHelpOpen(false)} /> : null}

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <div className="xl:col-span-3 bg-white border border-surface-container-highest p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-headline text-headline-md uppercase text-primary">{t("admin.quizzes.title")}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="w-9 h-9 flex items-center justify-center border border-surface-container-highest hover:border-primary text-primary"
              aria-label={t("admin.quizzes.helpTitle")}
            >
              <Icon name="help_outline" className="text-[22px]" />
            </button>
            <PrimaryButton
            onClick={() => {
              setDraft(blankQuiz());
              setSimAnswers({});
            }}
          >
            +
          </PrimaryButton>
          </div>
        </div>
        <SecondaryButton onClick={() => setDraft(racquetFinderTemplate())}>{t("admin.quizzes.fromTemplate")}</SecondaryButton>
        <SecondaryButton onClick={() => setDraft(tennisWarehouseReviewTemplate())}>
          {t("admin.quizzes.fromTwTemplate")}
        </SecondaryButton>
        <ul className="flex flex-col gap-1 max-h-[480px] overflow-y-auto">
          {(quizzes || []).map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                const defs = resolveQuizDimensions(q);
                setDraft({
                  ...q,
                  dimensions: q.dimensions?.length ? q.dimensions : defs,
                  dimension_weights: mergeDimensionWeights(defs, q.dimension_weights),
                });
                setSimAnswers({});
              }}
              className={`text-left px-3 py-2 border font-body text-body-md ${
                draft?.id === q.id ? "border-primary bg-surface-container-low" : "border-surface-container-highest"
              }`}
            >
              <span className="block uppercase font-label text-label-caps text-primary truncate">{q.title}</span>
              <span className="text-xs text-secondary font-mono">{q.slug}</span>
            </button>
          ))}
        </ul>
      </div>

      <div className="xl:col-span-6 bg-white border border-surface-container-highest p-6 flex flex-col gap-4">
        {!draft ? (
          <p className="font-body text-body-md text-secondary">{t("admin.quizzes.selectOrCreate")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <h3 className="font-headline text-headline-md uppercase text-primary">
                {draft.id ? t("admin.quizzes.edit") : t("admin.quizzes.new")}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {draft.slug && draft.is_published ? (
                  <Link
                    to={`/quizzes/${draft.slug}`}
                    target="_blank"
                    className="font-label text-label-caps uppercase text-primary underline"
                  >
                    {t("admin.quizzes.preview")}
                  </Link>
                ) : null}
                {draft.id ? (
                  <DangerButton onClick={() => draft.id && deleteMutation.mutate(draft.id)}>
                    {t("admin.delete")}
                  </DangerButton>
                ) : null}
                <PrimaryButton
                  onClick={() => saveMutation.mutate(draft)}
                  disabled={!draft.slug || !draft.title || saveMutation.isPending}
                >
                  {saveMutation.isPending ? t("admin.saving") : t("admin.save")}
                </PrimaryButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("admin.slug")}>
                <TextInput value={draft.slug || ""} onChange={(e) => set("slug", e.target.value)} />
              </Field>
              <Field label={t("admin.quizzes.navLabel")}>
                <TextInput value={draft.nav_label || ""} onChange={(e) => set("nav_label", e.target.value)} />
              </Field>
              <Field label={t("admin.title")}>
                <TextInput value={draft.title || ""} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label={t("admin.pagesStudio.titleVi")}>
                <TextInput value={draft.title_vi || ""} onChange={(e) => set("title_vi", e.target.value)} />
              </Field>
            </div>
            <Field label={t("admin.subtitle")}>
              <TextArea value={draft.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} rows={2} />
            </Field>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 font-body text-body-md">
                <Checkbox checked={draft.is_published ?? false} onChange={(e) => set("is_published", e.target.checked)} />
                {t("admin.quizzes.published")}
              </label>
              <label className="flex items-center gap-2 font-body text-body-md">
                <Checkbox checked={draft.show_in_nav ?? false} onChange={(e) => set("show_in_nav", e.target.checked)} />
                {t("admin.quizzes.showInNav")}
              </label>
            </div>
            <p className="font-body text-body-sm text-secondary">{t("admin.quizzes.navHint")}</p>

            <Field label={t("admin.quizzes.categoryFilter")}>
              <TextInput
                value={(draft.product_filter?.category_slugs || []).join(", ")}
                onChange={(e) =>
                  set("product_filter", {
                    ...draft.product_filter,
                    category_slugs: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    require_finder_profile: draft.product_filter?.require_finder_profile !== false,
                  })
                }
                placeholder="racquets, dresses, polos"
              />
            </Field>
            <label className="flex items-center gap-2 font-body text-body-md">
              <Checkbox
                checked={draft.product_filter?.require_finder_profile !== false}
                onChange={(e) =>
                  set("product_filter", {
                    ...draft.product_filter,
                    category_slugs: draft.product_filter?.category_slugs || [],
                    require_finder_profile: e.target.checked,
                  })
                }
              />
              {t("admin.quizzes.requireProfile")}
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-headline text-headline-md uppercase">{t("admin.quizzes.steps")}</h4>
                <SecondaryButton
                  onClick={() => {
                    const steps = [...(draft.steps || [])];
                    steps.push({
                      id: `step-${steps.length + 1}`,
                      step_key: `0${steps.length + 1}`,
                      title: "New question",
                      title_vi: "",
                      required: true,
                      options: [{ id: "a", title: "Option A", title_vi: "" }],
                    });
                    set("steps", steps);
                  }}
                >
                  {t("admin.quizzes.addStep")}
                </SecondaryButton>
              </div>
              {(draft.steps || []).map((step, si) => (
                <StepEditor
                  key={step.id}
                  step={step}
                  dimensionDefs={dimensionDefs}
                  mediaById={mediaById}
                  onChange={(next) => {
                    const steps = [...(draft.steps || [])];
                    steps[si] = next;
                    set("steps", steps);
                  }}
                  onRemove={() => set("steps", (draft.steps || []).filter((_, i) => i !== si))}
                  onMove={(dir) => {
                    const steps = [...(draft.steps || [])];
                    const j = si + dir;
                    if (j < 0 || j >= steps.length) return;
                    [steps[si], steps[j]] = [steps[j], steps[si]];
                    set("steps", steps);
                  }}
                  canMoveUp={si > 0}
                  canMoveDown={si < (draft.steps?.length || 0) - 1}
                />
              ))}
            </div>

            <DimensionEditor
              defs={dimensionDefs}
              onChange={(nextDefs) => {
                setDraft((d) => {
                  const base = { ...(d || blankQuiz()) };
                  return {
                    ...base,
                    dimensions: nextDefs,
                    dimension_weights: mergeDimensionWeights(nextDefs, base.dimension_weights),
                  };
                });
              }}
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="font-label text-label-caps text-secondary uppercase">{t("admin.quizzes.weights")}</span>
                <button
                  type="button"
                  onClick={() => setWeightsHelpOpen(true)}
                  className="inline-flex items-center justify-center w-7 h-7 border border-surface-container-highest hover:border-primary text-primary"
                  aria-label={t("admin.quizzes.weightsHelpAria")}
                >
                  <Icon name="help_outline" className="text-[18px]" />
                </button>
              </div>
              <p className="text-xs text-secondary mb-2">{t("admin.quizzes.weightsHint")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {dimensionDefs.map((d) => (
                  <label key={d.id} className="flex flex-col gap-1 font-label text-[10px] uppercase">
                    {d.label}
                    <TextInput
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={String(draft.dimension_weights?.[d.id] ?? d.default_weight ?? 0.2)}
                      onChange={(e) =>
                        set("dimension_weights", {
                          ...draft.dimension_weights,
                          [d.id]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="xl:col-span-3 bg-surface-container-low border border-surface-container-highest p-4 sticky top-24 h-fit">
        <h4 className="font-headline text-headline-md uppercase text-primary mb-3">{t("admin.quizzes.simulator")}</h4>
        {!draft?.steps?.length ? (
          <p className="text-secondary text-sm">{t("admin.quizzes.simEmpty")}</p>
        ) : (
          <>
            {(() => {
              const step = draft.steps![Math.min(simStepIndex, draft.steps!.length - 1)];
              if (!step) return null;
              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-label text-label-caps text-xs uppercase">{step.title}</p>
                    <span className="text-xs text-secondary">
                      {simStepIndex + 1}/{draft.steps!.length}
                    </span>
                  </div>
                  {step.image_url ? (
                    <img src={step.image_url} alt="" className="w-full h-24 object-cover mb-2 border" />
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {step.options.map((o) => {
                      const active = simAnswers[step.id] === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setSimAnswers((a) => ({ ...a, [step.id]: o.id }));
                            if (simStepIndex < draft.steps!.length - 1) {
                              setSimStepIndex((i) => i + 1);
                            }
                          }}
                          className={`text-left px-3 py-2 border text-sm ${
                            active ? "border-primary bg-surface-container-low" : "border-outline-variant"
                          }`}
                        >
                          {o.title}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <SecondaryButton
                      onClick={() => setSimStepIndex((i) => Math.max(0, i - 1))}
                      disabled={simStepIndex === 0}
                    >
                      ↑
                    </SecondaryButton>
                    <SecondaryButton
                      onClick={() => setSimStepIndex((i) => Math.min(draft.steps!.length - 1, i + 1))}
                      disabled={simStepIndex >= draft.steps!.length - 1}
                    >
                      ↓
                    </SecondaryButton>
                  </div>
                </div>
              );
            })()}
            <p className="font-label text-label-caps text-xs uppercase text-secondary mb-2">
              {t("admin.quizzes.poolCount", { count: String(pool.length) })}
            </p>
            <ul className="flex flex-col gap-2">
              {simRanked.map((r) => (
                <li key={r.slug} className="flex justify-between gap-2 text-sm font-body">
                  <span className="truncate">{r.product.name}</span>
                  <span className="font-label text-primary shrink-0">{r.match}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
    </>
  );
}

function QuizInlineHelpButton({ ariaLabel, onClick }: { ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-6 h-6 border border-surface-container-highest hover:border-primary text-primary shrink-0"
      aria-label={ariaLabel}
    >
      <Icon name="help_outline" className="text-[16px]" />
    </button>
  );
}

function QuizSectionLabel({ label, ariaLabel, onHelp }: { label: string; ariaLabel: string; onHelp: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-label text-[10px] uppercase text-secondary">{label}</span>
      <QuizInlineHelpButton ariaLabel={ariaLabel} onClick={onHelp} />
    </div>
  );
}

function HelpBulletList({ text }: { text: string }) {
  const items = text.split("\n").filter((line) => line.trim());
  return (
    <ul className="list-disc pl-5 space-y-1 font-body text-body-md text-secondary leading-relaxed">
      {items.map((line) => (
        <li key={line}>{line.replace(/^•\s*/, "")}</li>
      ))}
    </ul>
  );
}

function QuizHelpDialog({
  titleId,
  titleKey,
  onClose,
  children,
}: {
  titleId: string;
  titleKey: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="bg-white border border-surface-container-highest shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Icon name="help_outline" className="text-primary text-[28px]" />
            <h2 id={titleId} className="font-headline text-headline-md uppercase text-primary">
              {t(titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-secondary hover:text-primary"
            aria-label={t("admin.quizzes.helpClose")}
          >
            ×
          </button>
        </div>
        {children}
        <div className="mt-8 flex justify-end">
          <PrimaryButton onClick={onClose}>{t("admin.quizzes.helpClose")}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function DimensionWeightsHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <QuizHelpDialog titleId="quiz-weights-help-title" titleKey="admin.quizzes.weightsHelpTitle" onClose={onClose}>
      <div className="flex flex-col gap-4 font-body text-body-md text-secondary leading-relaxed">
        <p className="text-on-background m-0">{t("admin.quizzes.weightsHelpIntro")}</p>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.weightsHelpExampleTitle")}</h3>
          <p className="m-0 mb-2">{t("admin.quizzes.weightsHelpExampleP1")}</p>
          <p className="m-0 mb-2">{t("admin.quizzes.weightsHelpExampleP2")}</p>
          <p className="m-0 mb-1">{t("admin.quizzes.weightsHelpExampleP3")}</p>
          <HelpBulletList text={t("admin.quizzes.weightsHelpExampleBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.weightsHelpNormalizeTitle")}</h3>
          <p className="m-0 mb-2">{t("admin.quizzes.weightsHelpNormalizeP1")}</p>
          <p className="m-0">{t("admin.quizzes.weightsHelpNormalizeP2")}</p>
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.weightsHelpNotTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.weightsHelpNotBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.weightsHelpTipsTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.weightsHelpTipsBullets")} />
        </section>
        <p className="text-on-background m-0 border-t border-outline-variant pt-4">{t("admin.quizzes.weightsHelpSummary")}</p>
      </div>
    </QuizHelpDialog>
  );
}

function OptionDeltasHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <QuizHelpDialog titleId="quiz-deltas-help-title" titleKey="admin.quizzes.optionDeltasHelpTitle" onClose={onClose}>
      <div className="flex flex-col gap-4 font-body text-body-md text-secondary leading-relaxed">
        <p className="text-on-background m-0">{t("admin.quizzes.optionDeltasHelpIntro")}</p>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionDeltasHelpHowTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionDeltasHelpHowBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionDeltasHelpNotTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionDeltasHelpNotBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionDeltasHelpTipsTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionDeltasHelpTipsBullets")} />
        </section>
        <p className="text-on-background m-0 border-t border-outline-variant pt-4">{t("admin.quizzes.optionDeltasHelpSummary")}</p>
      </div>
    </QuizHelpDialog>
  );
}

function OptionFiltersHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <QuizHelpDialog titleId="quiz-filters-help-title" titleKey="admin.quizzes.optionFiltersHelpTitle" onClose={onClose}>
      <div className="flex flex-col gap-4 font-body text-body-md text-secondary leading-relaxed">
        <p className="text-on-background m-0">{t("admin.quizzes.optionFiltersHelpIntro")}</p>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionFiltersHelpFieldsTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionFiltersHelpFieldsBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionFiltersHelpMergeTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionFiltersHelpMergeBullets")} />
        </section>
        <section>
          <h3 className="font-headline text-headline-md text-primary m-0 mb-2">{t("admin.quizzes.optionFiltersHelpNotTitle")}</h3>
          <HelpBulletList text={t("admin.quizzes.optionFiltersHelpNotBullets")} />
        </section>
        <p className="text-on-background m-0 border-t border-outline-variant pt-4">{t("admin.quizzes.optionFiltersHelpSummary")}</p>
      </div>
    </QuizHelpDialog>
  );
}

function QuizMatchingHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-help-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-surface-container-highest shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Icon name="help_outline" className="text-primary text-[28px]" />
            <h2 id="quiz-help-title" className="font-headline text-headline-md uppercase text-primary">
              {t("admin.quizzes.helpTitle")}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-secondary hover:text-primary" aria-label={t("admin.quizzes.helpClose")}>
            ×
          </button>
        </div>
        <p className="font-body text-body-md text-on-background mb-4 leading-relaxed">{t("admin.quizzes.helpIntro")}</p>
        <div className="bg-surface-container-low border border-outline-variant p-4 mb-6 space-y-2">
          {HELP_FLOW_KEYS.map((key) => (
            <p key={key} className="font-body text-body-md text-primary m-0">
              {t(key)}
            </p>
          ))}
        </div>
        <ol className="flex flex-col gap-5 list-none p-0 m-0">
          {HELP_BLOCKS.map((block, i) => (
            <li key={block.title}>
              <h3 className="font-headline text-headline-md text-primary mb-1">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-on-primary text-sm mr-2 align-middle">
                  {i + 1}
                </span>
                {t(block.title)}
              </h3>
              <p className="font-body text-body-md text-secondary leading-relaxed pl-9">{t(block.body)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex justify-end">
          <PrimaryButton onClick={onClose}>{t("admin.quizzes.helpClose")}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function DimensionEditor({
  defs,
  onChange,
}: {
  defs: QuizDimensionDef[];
  onChange: (next: QuizDimensionDef[]) => void;
}) {
  const { t } = useLanguage();
  const [newLabel, setNewLabel] = useState("");

  function updateRow(i: number, patch: Partial<QuizDimensionDef>) {
    onChange(defs.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  return (
    <div className="border border-surface-container-highest p-4 bg-surface-container-lowest">
      <h4 className="font-headline text-headline-md uppercase text-primary mb-1">{t("admin.quizzes.dimensions")}</h4>
      <p className="font-body text-body-sm text-secondary mb-3">{t("admin.quizzes.dimensionsHint")}</p>
      <div className="flex flex-col gap-2 mb-3">
        {defs.map((d, i) => (
          <div key={d.id + i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-3">
              <span className="font-label text-[10px] uppercase text-secondary">{t("admin.quizzes.dimId")}</span>
              <TextInput value={d.id} readOnly className="font-mono text-xs bg-surface-container-low" />
            </div>
            <div className="md:col-span-4">
              <span className="font-label text-[10px] uppercase text-secondary">{t("admin.quizzes.dimLabel")}</span>
              <TextInput value={d.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <span className="font-label text-[10px] uppercase text-secondary">{t("admin.quizzes.dimLabelVi")}</span>
              <TextInput
                value={d.label_vi || ""}
                onChange={(e) => updateRow(i, { label_vi: e.target.value })}
              />
            </div>
            <div className="md:col-span-1">
              <DangerButton
                type="button"
                onClick={() => onChange(defs.filter((_, j) => j !== i))}
                disabled={defs.length <= 1}
              >
                ×
              </DangerButton>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <TextInput
          value={newLabel}
          placeholder={t("admin.quizzes.dimNewPlaceholder")}
          onChange={(e) => setNewLabel(e.target.value)}
          className="flex-1"
        />
        <SecondaryButton
          type="button"
          onClick={() => {
            const label = newLabel.trim();
            if (!label) return;
            const id = slugifyDimensionId(label);
            if (!id || defs.some((d) => d.id === id)) return;
            onChange([...defs, { id, label, default_weight: 1 / (defs.length + 1) }]);
            setNewLabel("");
          }}
        >
          {t("admin.quizzes.dimAdd")}
        </SecondaryButton>
      </div>
    </div>
  );
}

function StepEditor({
  step,
  dimensionDefs,
  mediaById,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  step: QuizStep;
  dimensionDefs: QuizDimensionDef[];
  mediaById: Map<number, Media>;
  onChange: (s: QuizStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { t } = useLanguage();
  const [optionHelp, setOptionHelp] = useState<"deltas" | "filters" | null>(null);
  return (
    <div className="border border-surface-container-highest p-4 mb-3 bg-surface-container-lowest">
      {optionHelp === "deltas" ? <OptionDeltasHelpModal onClose={() => setOptionHelp(null)} /> : null}
      {optionHelp === "filters" ? <OptionFiltersHelpModal onClose={() => setOptionHelp(null)} /> : null}
      <div className="flex gap-2 mb-2">
        <SecondaryButton onClick={() => onMove(-1)} disabled={!canMoveUp}>
          ↑
        </SecondaryButton>
        <SecondaryButton onClick={() => onMove(1)} disabled={!canMoveDown}>
          ↓
        </SecondaryButton>
        <DangerButton onClick={onRemove}>{t("admin.remove")}</DangerButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <TextInput
          value={step.title}
          placeholder="Question EN"
          onChange={(e) => onChange({ ...step, title: e.target.value })}
        />
        <TextInput
          value={step.title_vi || ""}
          placeholder="Question VI"
          onChange={(e) => onChange({ ...step, title_vi: e.target.value })}
        />
      </div>
      <Field label={t("admin.quizzes.stepImage")}>
        <TextInput
          value={step.image_url || ""}
          placeholder="https://…"
          onChange={(e) => onChange({ ...step, image_url: e.target.value })}
        />
        <p className="text-xs text-secondary mt-1">{t("admin.quizzes.stepImageHint")}</p>
        <ImageField
          label={t("admin.quizzes.pickFromMedia")}
          value={step.image_media_id ? mediaById.get(step.image_media_id) ?? null : null}
          onChange={(m) => {
            onChange({
              ...step,
              image_media_id: m?.id ?? null,
              image_url: m?.url || step.image_url,
            });
          }}
        />
      </Field>
      {step.options.map((opt, oi) => (
        <div key={opt.id} className="mb-3 pl-2 border-l-2 border-primary/30 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <TextInput
              value={opt.title}
              placeholder="Option EN"
              onChange={(e) => {
                const options = [...step.options];
                options[oi] = { ...opt, title: e.target.value };
                onChange({ ...step, options });
              }}
            />
            <TextInput
              value={opt.title_vi || ""}
              placeholder="Option VI"
              onChange={(e) => {
                const options = [...step.options];
                options[oi] = { ...opt, title_vi: e.target.value };
                onChange({ ...step, options });
              }}
            />
          </div>
          <QuizSectionLabel
            label={t("admin.quizzes.optionDeltas")}
            ariaLabel={t("admin.quizzes.optionDeltasHelpAria")}
            onHelp={() => setOptionHelp("deltas")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {dimensionDefs.map((dim) => (
              <label key={dim.id} className="flex flex-col gap-0.5 font-label text-[10px]">
                {dim.label}
                <TextInput
                  type="number"
                  placeholder="0"
                  value={opt.deltas?.[dim.id] != null ? String(opt.deltas[dim.id]) : ""}
                  onChange={(e) => {
                    const n = e.target.value === "" ? undefined : Number(e.target.value);
                    const options = [...step.options];
                    options[oi] = {
                      ...opt,
                      deltas: { ...opt.deltas, [dim.id]: Number.isFinite(n as number) ? n : undefined },
                    };
                    onChange({ ...step, options });
                  }}
                />
              </label>
            ))}
          </div>
          <QuizSectionLabel
            label={t("admin.quizzes.optionFilters")}
            ariaLabel={t("admin.quizzes.optionFiltersHelpAria")}
            onHelp={() => setOptionHelp("filters")}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(
              [
                ["max_ra", t("admin.quizzes.filterMaxRa")],
                ["min_ra", t("admin.quizzes.filterMinRa")],
                ["max_weight_g", t("admin.quizzes.filterMaxWeight")],
                ["min_weight_g", t("admin.quizzes.filterMinWeight")],
                ["max_swing_weight", t("admin.quizzes.filterMaxSwing")],
                ["min_swing_weight", t("admin.quizzes.filterMinSwing")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-0.5 font-label text-[10px]">
                {label}
                <TextInput
                  type="number"
                  value={
                    opt.guardrails?.[key] != null ? String(opt.guardrails[key]) : ""
                  }
                  onChange={(e) => {
                    const n = e.target.value === "" ? undefined : Number(e.target.value);
                    const options = [...step.options];
                    options[oi] = {
                      ...opt,
                      guardrails: {
                        ...opt.guardrails,
                        [key]: Number.isFinite(n as number) ? n : undefined,
                      },
                    };
                    onChange({ ...step, options });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <SecondaryButton
        onClick={() =>
          onChange({
            ...step,
            options: [...step.options, { id: `opt-${step.options.length + 1}`, title: "New option", title_vi: "" }],
          })
        }
      >
        + {t("admin.quizzes.addOption")}
      </SecondaryButton>
    </div>
  );
}
