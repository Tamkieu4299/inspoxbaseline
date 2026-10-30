import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { FooterFloatingLink } from "../types";

function ZaloIcon() {
  return (
    <svg className="w-7 h-7 fill-white" viewBox="0 0 48 48" aria-hidden>
      <path d="M24 4C12.954 4 4 11.82 4 21.5c0 5.9 3.2 11.15 8.2 14.65L10 44l8.8-4.6c1.65.45 3.4.7 5.2.7 11.046 0 20-7.82 20-17.5S35.046 4 24 4zm-4.4 22.1h-3.3v-6.3h3.3v6.3zm5.2 0h-3.3v-6.3h3.3v6.3zm5.2 0h-3.3v-6.3h3.3v6.3z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg className="w-7 h-7 fill-white" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.447 5.502 3.708 7.17V22l3.858-2.126c1.03.285 2.122.44 3.252.44 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm.995 12.563-2.55-2.72-4.985 2.72 5.488-5.832 2.613 2.72 4.922-2.72-5.488 5.832z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
    </svg>
  );
}

function FloatingButton({
  href,
  label,
  className,
  children,
  external,
  pulse,
}: {
  href: string;
  label: string;
  className: string;
  children: ReactNode;
  external?: boolean;
  pulse?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={label}
      className={`ft-contact-icon flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 ${pulse ? "motion-safe:animate-[ft-contact-pulse_2.4s_ease-in-out_infinite]" : ""} ${className}`}
    >
      {children}
    </a>
  );
}

function FloatingLinkButton({ link }: { link: FooterFloatingLink }) {
  const { t } = useLanguage();
  switch (link.icon) {
    case "zalo":
      return (
        <FloatingButton href={link.url} label={t("floatingContact.zalo")} className="bg-[#0068FF]" external>
          <ZaloIcon />
        </FloatingButton>
      );
    case "messenger":
      return (
        <FloatingButton
          href={link.url}
          label={t("floatingContact.messenger")}
          className="bg-gradient-to-br from-[#A334FA] to-[#0078FF]"
          external
        >
          <MessengerIcon />
        </FloatingButton>
      );
    case "phone":
      return (
        <FloatingButton href={link.url} label={t("floatingContact.phone")} className="bg-[#22c55e]" pulse>
          <PhoneIcon />
        </FloatingButton>
      );
    default:
      return null;
  }
}

export default function FloatingContactBar() {
  const { lang, t } = useLanguage();
  const { data: site } = useQuery({
    queryKey: ["site", lang],
    queryFn: () => api.getSite(lang),
    staleTime: 60_000,
  });
  const links = site?.footer_contact?.floating_contact_links ?? [];
  if (links.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes ft-contact-pulse {
          0%, 100% { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.15); }
          50% { box-shadow: 0 10px 25px -3px rgb(0 0 0 / 0.28); }
        }
      `}</style>
      <div
        id="ft-contact-icons-out-m"
        className="fixed bottom-6 right-4 z-[500] flex flex-col gap-3 pointer-events-none sm:bottom-8 sm:right-6"
        aria-label={t("floatingContact.groupLabel")}
      >
        {links.map((link, index) => (
          <div key={`${link.icon}-${index}`} className="pointer-events-auto">
            <FloatingLinkButton link={link} />
          </div>
        ))}
      </div>
    </>
  );
}
