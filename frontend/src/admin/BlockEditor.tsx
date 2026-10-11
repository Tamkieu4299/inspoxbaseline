import type { ReactNode } from "react";
import type { Media, PageBlock } from "../types";
import { useLanguage } from "../i18n";
import { ImageField } from "./MediaLibrary";
import { DangerButton, Field, Select, TextArea, TextInput } from "./ui";

export const BLOCK_TYPES = ["heading", "text", "image", "quote", "list", "cta"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export function blankBlock(type: BlockType = "text"): PageBlock {
  return { id: 0, block_type: type, position: 0, data: {} };
}

const BLOCK_STUDIO_META: Record<BlockType, { icon: string; labelKey: string }> = {
  heading: { icon: "title", labelKey: "admin.blockTypeHeading" },
  text: { icon: "format_align_left", labelKey: "admin.blockTypeText" },
  image: { icon: "image", labelKey: "admin.blockTypeImage" },
  quote: { icon: "format_quote", labelKey: "admin.blockTypeQuote" },
  list: { icon: "list", labelKey: "admin.blockTypeList" },
  cta: { icon: "smart_button", labelKey: "admin.blockTypeCta" },
};

export function BlocksField({
  blocks,
  onChange,
  mediaById,
  variant = "default",
}: {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  mediaById: Map<number, Media>;
  variant?: "default" | "studio";
}) {
  const { t } = useLanguage();
  const studio = variant === "studio";
  function update(index: number, block: PageBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }

  function updateData(index: number, data: Record<string, any>) {
    update(index, { ...blocks[index], data });
  }

  const quickAddBar = (
    <div
      className={
        studio
          ? "p-3 bg-surface-container-low rounded-lg flex flex-wrap items-center gap-2"
          : "flex flex-wrap gap-2"
      }
    >
      {studio ? (
        <span className="font-label text-[10px] uppercase text-secondary font-bold mr-1">{t("admin.pagesStudio.appendBlock")}</span>
      ) : null}
      {BLOCK_TYPES.map((bt) => (
        <button
          key={bt}
          type="button"
          onClick={() => onChange([...blocks, blankBlock(bt)])}
          className={
            studio
              ? "px-3 py-1.5 rounded bg-surface-container-lowest text-primary font-label text-[11px] uppercase tracking-wider hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1 shadow-sm"
              : "border border-surface-container-highest px-3 py-1.5 font-label text-label-caps text-primary hover:border-forest-green hover:text-forest-green transition-colors"
          }
        >
          {studio ? (
            <span className="material-symbols-outlined text-[14px]">{BLOCK_STUDIO_META[bt].icon}</span>
          ) : null}
          + {studio ? t(BLOCK_STUDIO_META[bt].labelKey as "admin.blockTypeHeading") : bt.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {!studio ? (
        <div className="flex items-center justify-between">
          <span className="font-label text-label-caps text-secondary uppercase">{t("admin.contentBlocks")}</span>
        </div>
      ) : null}
      {studio ? quickAddBar : null}
      {blocks.length === 0 && (
        <p className="font-body text-body-md text-secondary">{t("admin.noBlocks")}</p>
      )}
      {blocks.map((block, index) => {
        const d = block.data || {};
        const shellClass = studio
          ? "p-5 rounded-lg bg-surface-container-low shadow-sm flex flex-col gap-3 group transition-all hover:bg-surface-container"
          : "border border-surface-container-highest p-3 flex flex-col gap-3";
        return (
          <div key={index} className={shellClass}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {studio ? (
                  <>
                    <span className="w-6 h-6 rounded bg-primary text-on-primary flex items-center justify-center font-label text-[11px] font-mono shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-label text-[11px] uppercase font-bold text-primary tracking-wider truncate">
                      {t("admin.pagesStudio.blockType")}: {block.block_type.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <>
                    <Select
                      value={block.block_type}
                      onChange={(e) => update(index, { ...block, block_type: e.target.value })}
                      className="w-40"
                    >
                      {BLOCK_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt.toUpperCase()}
                        </option>
                      ))}
                    </Select>
                    <span className="font-label text-label-caps text-secondary">
                      {t("admin.pos")} {index + 1}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {studio ? (
                  <>
                    <button
                      type="button"
                      className="p-1 text-secondary hover:text-primary transition-colors"
                      onClick={() => {
                        const next = [...blocks];
                        if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        onChange(next);
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      className="p-1 text-secondary hover:text-primary transition-colors"
                      onClick={() => {
                        const next = [...blocks];
                        if (index < blocks.length - 1) [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        onChange(next);
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      className="p-1 text-secondary hover:text-error transition-colors ml-1"
                      onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <Select
                      value={block.block_type}
                      onChange={(e) => update(index, { ...block, block_type: e.target.value })}
                      className="w-28 ml-1 text-xs"
                      aria-label={t("admin.pagesStudio.blockType")}
                    >
                      {BLOCK_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </Select>
                  </>
                ) : (
                  <>
                    <SecondaryButtonSmall
                      onClick={() => {
                        const next = [...blocks];
                        if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        onChange(next);
                      }}
                    >
                      ↑
                    </SecondaryButtonSmall>
                    <SecondaryButtonSmall
                      onClick={() => {
                        const next = [...blocks];
                        if (index < blocks.length - 1) [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        onChange(next);
                      }}
                    >
                      ↓
                    </SecondaryButtonSmall>
                    <DangerButton onClick={() => onChange(blocks.filter((_, i) => i !== index))}>{t("admin.remove")}</DangerButton>
                  </>
                )}
              </div>
            </div>

            {block.block_type === "heading" && (
              <div className="flex flex-col gap-2">
                <Field label={t("admin.blockHeading")}>
                  <TextInput value={d.text || ""} onChange={(e) => updateData(index, { text: e.target.value })} />
                </Field>
                <Field label={`VI · ${t("admin.blockHeading")}`}>
                  <TextInput value={d.text_vi || ""} onChange={(e) => updateData(index, { ...d, text_vi: e.target.value })} />
                </Field>
              </div>
            )}
            {block.block_type === "text" && (
              <div className="flex flex-col gap-2">
                <Field label={t("admin.blockBody")}>
                  <TextArea rows={3} value={d.body || ""} onChange={(e) => updateData(index, { body: e.target.value })} />
                </Field>
                <Field label={`VI · ${t("admin.blockBody")}`}>
                  <TextArea rows={3} value={d.body_vi || ""} onChange={(e) => updateData(index, { ...d, body_vi: e.target.value })} />
                </Field>
              </div>
            )}
            {block.block_type === "image" && (
              <div className="flex flex-col gap-3">
                <ImageField
                  label={t("admin.image")}
                  value={d.media_id ? mediaById.get(d.media_id) || null : null}
                  onChange={(m) => updateData(index, m ? { url: m.url, media_id: m.id, caption: d.caption || m.filename } : { caption: d.caption || "" })}
                />
                <Field label={t("admin.blockCaption")}>
                  <TextInput value={d.caption || ""} onChange={(e) => updateData(index, { ...d, caption: e.target.value })} />
                </Field>
                <Field label={`VI · ${t("admin.blockCaption")}`}>
                  <TextInput value={d.caption_vi || ""} onChange={(e) => updateData(index, { ...d, caption_vi: e.target.value })} />
                </Field>
              </div>
            )}
            {block.block_type === "quote" && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={t("admin.blockQuote")}>
                    <TextArea rows={2} value={d.quote || ""} onChange={(e) => updateData(index, { ...d, quote: e.target.value })} />
                  </Field>
                  <Field label={t("admin.author")}>
                    <TextInput value={d.author || ""} onChange={(e) => updateData(index, { ...d, author: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={`VI · ${t("admin.blockQuote")}`}>
                    <TextArea rows={2} value={d.quote_vi || ""} onChange={(e) => updateData(index, { ...d, quote_vi: e.target.value })} />
                  </Field>
                  <Field label={`VI · ${t("admin.author")}`}>
                    <TextInput value={d.author_vi || ""} onChange={(e) => updateData(index, { ...d, author_vi: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}
            {block.block_type === "list" && (
              <div className="flex flex-col gap-2">
                {(d.items || []).map((item: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <TextInput
                      value={item}
                      placeholder={`${t("admin.itemPlaceholder")} ${i + 1}`}
                      className="flex-1"
                      onChange={(e) => {
                        const items = [...(d.items || [])];
                        items[i] = e.target.value;
                        updateData(index, { items });
                      }}
                    />
                    <DangerButton
                      onClick={() => updateData(index, { items: (d.items || []).filter((_: string, x: number) => x !== i) })}
                    >
                      {t("admin.remove")}
                    </DangerButton>
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  {(d.items_vi || []).map((item: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput
                        value={item}
                        placeholder={`VI · ${t("admin.itemPlaceholder")} ${i + 1}`}
                        className="flex-1"
                        onChange={(e) => {
                          const items = [...(d.items_vi || [])];
                          items[i] = e.target.value;
                          updateData(index, { ...d, items_vi: items });
                        }}
                      />
                      <DangerButton
                        onClick={() => updateData(index, { ...d, items_vi: (d.items_vi || []).filter((_: string, x: number) => x !== i) })}
                      >
                        {t("admin.remove")}
                      </DangerButton>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateData(index, { ...d, items: [...(d.items || []), ""] })}
                    className="font-label text-label-caps text-forest-green hover:underline uppercase"
                  >
                    {t("admin.addItem")}
                  </button>
                  <button
                    onClick={() => updateData(index, { ...d, items_vi: [...(d.items_vi || []), ""] })}
                    className="font-label text-label-caps text-forest-green hover:underline uppercase"
                  >
                    VI · {t("admin.addItem")}
                  </button>
                </div>
              </div>
            )}
            {block.block_type === "cta" && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={t("admin.blockLabel")}>
                    <TextInput value={d.label || ""} onChange={(e) => updateData(index, { ...d, label: e.target.value })} />
                  </Field>
                  <Field label={t("admin.blockUrl")}>
                    <TextInput value={d.url || ""} onChange={(e) => updateData(index, { ...d, url: e.target.value })} />
                  </Field>
                </div>
                <Field label={`VI · ${t("admin.blockLabel")}`}>
                  <TextInput value={d.label_vi || ""} onChange={(e) => updateData(index, { ...d, label_vi: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        );
      })}
      {!studio ? quickAddBar : null}
    </div>
  );
}

function SecondaryButtonSmall({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border border-surface-container-highest px-2 py-1 font-label text-label-caps text-primary hover:border-forest-green hover:text-forest-green transition-colors"
    >
      {children}
    </button>
  );
}
