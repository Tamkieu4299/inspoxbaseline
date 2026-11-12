import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useLanguage } from "../i18n";
import type { CategoryMenuNode } from "../categoryNav";

export default function MobileCategoryMenu({
  nodes,
  onNavigate,
}: {
  nodes: CategoryMenuNode[];
  onNavigate: () => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="pb-2">
      {nodes.map((node) =>
        node.children?.length ? (
          <div key={node.to} className="border-b border-outline-variant/40 last:border-0">
            <button
              type="button"
              onClick={() => setExpanded((k) => (k === node.to ? null : node.to))}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 font-label text-label-caps uppercase text-left text-primary"
            >
              <span>{node.label}</span>
              <Icon
                name={expanded === node.to ? "expand_less" : "chevron_right"}
                className="text-[20px] shrink-0 opacity-70"
              />
            </button>
            {expanded === node.to ? (
              <div className="pb-2 pl-3 border-l-2 border-forest-green/30 ml-3">
                <Link
                  to={node.to}
                  onClick={onNavigate}
                  className="block px-3 py-2 font-label text-label-caps uppercase text-sm text-secondary hover:text-forest-green"
                >
                  {t("collection.all")} · {node.label}
                </Link>
                {node.children.map((child) => (
                  <Link
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className="block px-3 py-2 font-label text-label-caps uppercase text-sm text-secondary hover:text-forest-green"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            key={node.to}
            to={node.to}
            onClick={onNavigate}
            className="block px-3 py-2.5 font-label text-label-caps uppercase text-secondary hover:text-forest-green border-b border-outline-variant/40"
          >
            {node.label}
          </Link>
        )
      )}
    </div>
  );
}
