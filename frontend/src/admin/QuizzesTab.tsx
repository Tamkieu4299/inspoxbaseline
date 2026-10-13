import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { Media, Product, QuizStep, ShopQuiz } from "../types";
import { ImageField } from "./MediaLibrary";
import {
  applyOptions,
  emptyProfile,
  mergeGuardrails,
  QUIZ_DIMENSIONS,
  rankProducts,
  type MatchProduct,
  type QuizOptionDef,
} from "../quiz/score";
import { blankQuiz, racquetFinderTemplate } from "../quiz/template";
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
    dimension_weights: d.dimension_weights || {},
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

  const simRanked = useMemo(() => {
    if (!draft?.steps) return [];
    const opts: QuizOptionDef[] = [];
    for (const step of draft.steps) {
      const id = simAnswers[step.id];
      const o = step.options.find((x) => x.id === id);
      if (o) opts.push(o as QuizOptionDef);
    }
    let profile = emptyProfile();
    profile = applyOptions(profile, opts);
    const guardrails = mergeGuardrails(opts);
    const matchProducts: MatchProduct[] = pool.map((p) => ({
      slug: p.slug,
      name: p.name,
      price: p.price,
      image_url: p.images?.find((i) => i.enabled !== false)?.url || p.images?.[0]?.url,
      finder_profile: p.finder_profile,
    }));
    return rankProducts(profile, matchProducts, draft.dimension_weights, guardrails).slice(0, 5);
  }, [draft, simAnswers, pool]);

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
        <ul className="flex flex-col gap-1 max-h-[480px] overflow-y-auto">
          {(quizzes || []).map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setDraft({ ...q });
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

            <Field label={t("admin.quizzes.weights")}>
              <div className="grid grid-cols-5 gap-2">
                {QUIZ_DIMENSIONS.map((d) => (
                  <label key={d} className="flex flex-col gap-1 font-label text-[10px] uppercase">
                    {d}
                    <TextInput
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={String(draft.dimension_weights?.[d] ?? 0.2)}
                      onChange={(e) =>
                        set("dimension_weights", {
                          ...draft.dimension_weights,
                          [d]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </Field>
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

function StepEditor({
  step,
  mediaById,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  step: QuizStep;
  mediaById: Map<number, Media>;
  onChange: (s: QuizStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="border border-surface-container-highest p-4 mb-3 bg-surface-container-lowest">
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
        <div key={opt.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 pl-2 border-l-2 border-primary/30">
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
          <TextInput
            value={String(opt.deltas?.comfort ?? "")}
            placeholder="comfort +35"
            onChange={(e) => {
              const n = Number(e.target.value);
              const options = [...step.options];
              options[oi] = {
                ...opt,
                deltas: { ...opt.deltas, comfort: Number.isFinite(n) ? n : undefined },
              };
              onChange({ ...step, options });
            }}
          />
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
