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

export function BlocksField({
  blocks,
  onChange,
  mediaById,
}: {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  mediaById: Map<number, Media>;
}) {
  const { t } = useLanguage();
  function update(index: number, block: PageBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }

  function updateData(index: number, data: Record<string, any>) {
    update(index, { ...blocks[index], data });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-label text-label-caps text-secondary uppercase">{t("admin.contentBlocks")}</span>
      </div>
      {blocks.length === 0 && (
        <p className="font-body text-body-md text-secondary">{t("admin.noBlocks")}</p>
      )}
      {blocks.map((block, index) => {
        const d = block.data || {};
        return (
          <div key={index} className="border border-surface-container-highest p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Select
                  value={block.block_type}
                  onChange={(e) => update(index, { ...block, block_type: e.target.value })}
                  className="w-40"
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </Select>
                <span className="font-label text-label-caps text-secondary">{t("admin.pos")} {index + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <SecondaryButtonSmall onClick={() => {
                  const next = [...blocks];
                  if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  onChange(next);
                }}>
                  ↑
                </SecondaryButtonSmall>
                <SecondaryButtonSmall onClick={() => {
                  const next = [...blocks];
                  if (index < blocks.length - 1) [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  onChange(next);
                }}>
                  ↓
                </SecondaryButtonSmall>
                <DangerButton onClick={() => onChange(blocks.filter((_, i) => i !== index))}>
                  {t("admin.remove")}
                </DangerButton>
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
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => onChange([...blocks, blankBlock(t)])}
            className="border border-surface-container-highest px-3 py-1.5 font-label text-label-caps text-primary hover:border-forest-green hover:text-forest-green transition-colors"
          >
            + {t.toUpperCase()}
          </button>
        ))}
      </div>
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
