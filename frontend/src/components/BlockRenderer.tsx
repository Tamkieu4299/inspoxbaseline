import { Link } from "react-router-dom";
import { useLanguage } from "../i18n";

interface Block {
  block_type?: string;
  type?: string;
  data: Record<string, any>;
}

export default function BlockRenderer({ block }: { block: Block }) {
  const { t } = useLanguage();
  const type = block.block_type || block.type || "text";
  const d = block.data || {};

  switch (type) {
    case "heading":
      return (
        <h2 className="font-headline text-headline-lg text-primary uppercase tracking-tight">
          {d.text || ""}
        </h2>
      );
    case "text":
      return (
        <p className="font-body text-body-md sm:text-body-lg text-secondary max-w-3xl leading-relaxed whitespace-pre-line">
          {d.body || ""}
        </p>
      );
    case "image":
      return (
        <figure className="space-y-2">
          {d.url && <img src={d.url} alt={d.caption || ""} className="w-full max-h-[560px] object-cover" />}
          {d.caption && <figcaption className="font-label text-label-caps text-secondary">{d.caption}</figcaption>}
        </figure>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-forest-green pl-6 space-y-2">
          <p className="font-display text-headline-lg text-primary uppercase leading-none tracking-tighter">
            {d.quote || ""}
          </p>
          {d.author && <footer className="font-label text-label-caps text-secondary">{d.author}</footer>}
        </blockquote>
      );
    case "list":
      return (
        <ul className="space-y-4 max-w-3xl">
          {(d.items || []).map((item: string, i: number) => (
            <li
              key={i}
              className="font-body text-body-md sm:text-body-lg text-secondary leading-relaxed flex items-start gap-3"
            >
              <span className="mt-2.5 w-2 h-2 shrink-0 bg-forest-green inline-block" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "cta":
      return (
        <Link
          to={d.url || "/collections"}
          className="inline-flex items-center justify-center px-8 py-4 bg-primary text-on-primary font-label text-label-caps uppercase rounded-none hover:bg-forest-green transition-colors"
        >
          {d.label || t("block.shop")}
        </Link>
      );
    case "pricing_table": {
      const cols = d.columns || {};
      const serviceHead = cols.service || t("block.pricingService");
      const priceHead = cols.price || t("block.pricingPrice");
      const noteHead = cols.note || t("block.pricingNote");
      const rows = d.rows || [];
      return (
        <div className="w-full max-w-3xl space-y-3">
          {d.title ? (
            <h3 className="font-headline text-headline-md text-primary uppercase tracking-tight">{d.title}</h3>
          ) : null}
          {d.note ? <p className="font-body text-body-sm text-secondary whitespace-pre-line">{d.note}</p> : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto border border-surface-container-high">
              <table className="w-full min-w-[280px] border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="text-left font-label text-label-caps text-secondary px-4 py-2 uppercase">{serviceHead}</th>
                    <th className="text-left font-label text-label-caps text-secondary px-4 py-2 uppercase whitespace-nowrap">
                      {priceHead}
                    </th>
                    {noteHead ? (
                      <th className="text-left font-label text-label-caps text-secondary px-4 py-2 uppercase hidden sm:table-cell">
                        {noteHead}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: Record<string, string>, i: number) => (
                    <tr key={i} className="border-t border-surface-container-high">
                      <td className="font-body text-body-md text-primary px-4 py-3 align-top">{row.service || ""}</td>
                      <td className="font-body text-body-md text-primary px-4 py-3 align-top whitespace-nowrap">{row.price || ""}</td>
                      {noteHead ? (
                        <td className="font-body text-body-sm text-secondary px-4 py-3 align-top hidden sm:table-cell">
                          {row.note || ""}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {d.footer ? <p className="font-label text-label-caps text-secondary text-sm">{d.footer}</p> : null}
        </div>
      );
    }
    default:
      return null;
  }
}
