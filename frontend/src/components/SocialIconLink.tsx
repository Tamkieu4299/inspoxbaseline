import type { ReactNode } from "react";
import type { SocialNetwork } from "../footerContact";

const LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook social link",
  instagram: "Instagram social link",
  threads: "Threads social link",
  youtube: "YouTube social link",
  tiktok: "TikTok social link",
  zalo: "Zalo social link",
};

/** Woodmart el-social-icons brand hues (hover accent). */
const BRAND_HOVER: Record<SocialNetwork, string> = {
  facebook: "hover:text-[#365493]",
  instagram: "hover:text-[#774430]",
  threads: "hover:text-[#0A0A0A]",
  youtube: "hover:text-[#CB2027]",
  tiktok: "hover:text-[#010101]",
  zalo: "hover:text-[#0068FF]",
};

function IconSvg({ network }: { network: SocialNetwork }) {
  const cls = "w-[22px] h-[22px] lg:w-6 lg:h-6 fill-current";
  switch (network) {
    case "facebook":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "threads":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.295-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.908-2.031 1.768-1.593 2.888-4.189 2.83-7.433H12.01v-2.89h7.875c.076 1.517-.264 3.315-1.015 4.916-.842 1.793-2.088 3.235-3.708 4.291-1.724 1.116-3.988 1.734-6.876 1.734z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v11.01c-.01 2.92-2.01 5.49-4.94 5.49-1.34 0-2.61-.52-3.56-1.47-1.95-1.95-1.95-5.12 0-7.07.72-.72 1.62-1.19 2.59-1.45v4.24c-.43.13-.83.36-1.17.7-.65.65-.65 1.71 0 2.36.32.32.75.5 1.2.5 1.38 0 2.5-1.12 2.5-2.5V.02h3.49z" />
        </svg>
      );
    case "zalo":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8l3.2 3.2c.3.3.8.1.8-.35V17h4.5A1.5 1.5 0 0 0 18 15.5v-11A1.5 1.5 0 0 0 16.5 3h-12zm2.2 4.1h1.6l1.4 2.6 1.4-2.6h1.6l-2.3 3.9 2.4 4H11l-1.5-2.5L8 15.5H6.4l2.4-4-2.1-3.4z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SocialIconLink({ network, href }: { network: SocialNetwork; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={LABELS[network]}
      className={`social-icon social-${network} inline-flex h-12 w-12 lg:h-[60px] lg:w-[60px] shrink-0 items-center justify-center rounded-full text-black/60 transition-colors ${BRAND_HOVER[network]}`}
    >
      <span className="inline-flex items-center justify-center" aria-hidden>
        <IconSvg network={network} />
      </span>
    </a>
  );
}

/** Woodmart-style row: wd-social-icons wd-size-large wd-shape-circle color-scheme-dark */
export function SocialIconsRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center text-left gap-0 pt-1">{children}</div>
  );
}
