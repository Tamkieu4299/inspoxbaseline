import { Link } from "react-router-dom";
import Icon from "./Icon";
import type { CategoryMenuNode } from "../categoryNav";

/** Desktop category list with nested flyout panels (Gusport-style). */
export default function CategoryFlyoutMenu({ nodes }: { nodes: CategoryMenuNode[] }) {
  return (
    <ul className="py-2 min-w-[240px]">
      {nodes.map((node) => (
        <li key={node.to} className="relative group/cat">
          <Link
            to={node.to}
            className="flex items-center justify-between gap-3 px-4 py-2.5 font-label text-label-caps uppercase text-secondary hover:text-forest-green hover:bg-surface-container-low transition-colors"
          >
            <span>{node.label}</span>
            {node.children?.length ? (
              <Icon name="chevron_right" className="text-[18px] shrink-0 opacity-60" aria-hidden />
            ) : null}
          </Link>
          {node.children?.length ? (
            <div className="absolute left-full top-0 hidden group-hover/cat:block pl-1 z-20">
              <ul className="bg-surface-container-lowest border border-outline-variant shadow-lg min-w-[240px] py-2">
                {node.children.map((child) => (
                  <li key={child.to}>
                    <Link
                      to={child.to}
                      className="block px-4 py-2.5 font-label text-label-caps uppercase text-secondary hover:text-forest-green hover:bg-surface-container-low transition-colors whitespace-nowrap"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
