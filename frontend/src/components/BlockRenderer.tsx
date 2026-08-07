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
      return <p className="font-body text-body-lg text-secondary max-w-2xl">{d.body || ""}</p>;
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
        <ul className="space-y-2">
          {(d.items || []).map((item: string, i: number) => (
            <li key={i} className="font-label text-label-caps text-primary flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-forest-green inline-block" />
              {item}
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
    default:
      return null;
  }
}
