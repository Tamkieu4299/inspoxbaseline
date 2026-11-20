import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import ProductGallery from "../components/ProductGallery";
import { ProductDescription, ProductTechSpecList } from "../components/ProductStoryAndSpecs";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";
import type { AuctionBidPublic } from "../types";
import { AuctionLiveBadge, AuctionLiveCardGlow, AuctionLiveDot } from "../components/AuctionLiveBadge";

export default function AuctionDetail() {
  const { slug = "" } = useParams();
  const { lang, t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const queryClient = useQueryClient();
  const { data: lot, isLoading, error } = useQuery({
    queryKey: ["auction", slug, lang],
    queryFn: () => api.getAuction(slug, lang),
    enabled: Boolean(slug),
    refetchInterval: 30_000,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const bidMutation = useMutation({
    mutationFn: () =>
      api.placeBid(slug, {
        amount: Number(amount.replace(/\D/g, "")),
        bidder_name: name.trim(),
        bidder_phone: phone.trim(),
        bidder_email: email.trim() || null,
      }),
    onSuccess: (res) => {
      setFormMsg(lang === "vi" ? res.message_vi : res.message);
      setAmount(String(Math.round(res.min_next_bid)));
      queryClient.invalidateQueries({ queryKey: ["auction", slug] });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
    },
    onError: (e: Error) => setFormMsg(e.message),
  });

  const endsLabel = useMemo(() => {
    if (!lot?.ends_at) return null;
    try {
      return new Date(lot.ends_at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB");
    } catch {
      return lot.ends_at;
    }
  }, [lot?.ends_at, lang]);

  if (isLoading) {
    return (
      <main className="pt-20 md:pt-24 px-4 pb-24 font-body text-body-md text-secondary">
        {t("admin.loading")}
      </main>
    );
  }
  if (error || !lot) {
    return (
      <main className="pt-20 md:pt-24 px-4 pb-24 max-w-lg mx-auto text-center">
        <p className="font-body text-body-md text-secondary">{t("auctions.notFound")}</p>
        <Link to="/auctions" className="text-forest-green underline mt-4 inline-block">
          {t("auctions.back")}
        </Link>
      </main>
    );
  }

  const live = lot.state === "live";

  return (
    <main className="flex-grow pt-20 md:pt-24 max-w-[1440px] mx-auto px-4 md:px-8 pb-10 md:pb-16">
      <Link to="/auctions" className="font-label text-label-caps text-secondary hover:text-primary uppercase mb-6 inline-block">
        ← {t("auctions.back")}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        <ProductGallery
          images={lot.images}
          name={lot.product_name}
          layout="slideshow"
          activeIndex={0}
          onImageClick={() => {}}
        />

        <div className="flex flex-col gap-6">
          <AuctionHeader
            title={lot.headline || lot.product_name}
            subtitle={lot.subtitle}
            live={live}
            endsLabel={endsLabel}
            t={t}
          />

          <AuctionLiveCardGlow active={live}>
          <div className={`border p-5 bg-surface-container-lowest grid grid-cols-2 gap-4 ${live ? "border-red-500/35" : "border-surface-container-highest"}`}>
            <Stat label={t("auctions.starting")} value={formatPrice(lot.starting_bid)} />
            <Stat
              label={t("auctions.current")}
              value={formatPrice(lot.current_bid ?? lot.starting_bid)}
              highlight={live}
            />
            <Stat label={t("auctions.minNext")} value={formatPrice(lot.min_next_bid)} />
            <Stat label={t("auctions.bidCount")} value={String(lot.bid_count)} />
          </div>
          </AuctionLiveCardGlow>

          {!lot.reserve_met && (
            <p className="font-body text-body-sm text-secondary border-l-2 border-amber-600 pl-3">
              {t("auctions.reserveOpen")}
            </p>
          )}

          {live ? (
            <form
              className="border border-red-500/25 p-5 flex flex-col gap-3 bg-white motion-safe:animate-auction-live-border"
              onSubmit={(e) => {
                e.preventDefault();
                setFormMsg(null);
                bidMutation.mutate();
              }}
            >
              <h2 className="font-headline text-headline-sm uppercase text-primary">{t("auctions.placeBid")}</h2>
              <p className="font-body text-body-sm text-secondary">{t("auctions.codDisclaimer")}</p>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps text-secondary uppercase">{t("checkout.name")}</span>
                <input
                  className="border border-surface-container-highest px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps text-secondary uppercase">{t("checkout.phone")}</span>
                <input
                  className="border border-surface-container-highest px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps text-secondary uppercase">{t("checkout.email")}</span>
                <input
                  type="email"
                  className="border border-surface-container-highest px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-caps text-secondary uppercase">{t("auctions.yourBid")}</span>
                <input
                  className="border border-surface-container-highest px-3 py-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(Math.round(lot.min_next_bid))}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={bidMutation.isPending}
                className="inline-flex items-center justify-center gap-2 bg-primary text-white font-label text-label-caps uppercase py-3 hover:bg-forest-green transition-colors w-full"
              >
                {!bidMutation.isPending && <AuctionLiveDot className="h-2 w-2 [&_span]:h-2 [&_span]:w-2" />}
                {bidMutation.isPending ? t("checkout.placing") : t("auctions.submit")}
              </button>
              {formMsg && <p className="font-body text-body-sm text-primary whitespace-pre-wrap">{formMsg}</p>}
            </form>
          ) : (
            <p className="font-body text-body-md text-secondary border border-surface-container-highest p-4">
              {t("auctions.ended")}
            </p>
          )}

          <ProductDescription description={lot.description} />
          <ProductTechSpecList techSpecs={lot.tech_specs} />
        </div>
      </div>

      <section className="mt-16">
        <h2 className="font-headline text-headline-md uppercase text-primary mb-4">{t("auctions.bidTable")}</h2>
        <BidTable bids={lot.recent_bids} formatPrice={formatPrice} t={t} />
      </section>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p
        className={`font-label text-label-caps uppercase text-xs flex items-center gap-1.5 ${highlight ? "text-red-700/90" : "text-secondary"}`}
      >
        {highlight ? <AuctionLiveDot className="h-2 w-2 [&_span]:h-2 [&_span]:w-2" /> : null}
        {label}
      </p>
      <p className={`font-headline text-headline-sm ${highlight ? "text-red-800" : "text-primary"}`}>{value}</p>
    </div>
  );
}

function AuctionHeader({
  title,
  subtitle,
  live,
  endsLabel,
  t,
}: {
  title: string;
  subtitle?: string | null;
  live: boolean;
  endsLabel: string | null;
  t: (k: string) => string;
}) {
  return (
    <div>
      {live ? (
        <AuctionLiveBadge label={t("auctions.live")} className="mb-2" />
      ) : (
        <span className="font-label text-label-caps text-secondary uppercase">{t("auctions.ended")}</span>
      )}
      <h1 className="font-headline text-headline-lg text-primary uppercase mt-1">{title}</h1>
      {subtitle ? <p className="font-body text-body-md text-secondary mt-2">{subtitle}</p> : null}
      {endsLabel ? (
        <p className="font-body text-body-sm text-secondary mt-2">
          {t("auctions.ends")}: {endsLabel}
        </p>
      ) : null}
    </div>
  );
}

function BidTable({
  bids,
  formatPrice,
  t,
}: {
  bids: AuctionBidPublic[];
  formatPrice: (n: number) => string;
  t: (k: string) => string;
}) {
  if (!bids.length) {
    return <p className="font-body text-body-md text-secondary">{t("auctions.noBids")}</p>;
  }
  return (
    <div className="overflow-x-auto border border-surface-container-highest">
      <table className="w-full text-left font-body text-body-sm">
        <thead className="bg-surface-container-low font-label text-label-caps uppercase text-secondary text-xs">
          <tr>
            <th className="p-3">{t("auctions.colBidder")}</th>
            <th className="p-3">{t("auctions.colAmount")}</th>
            <th className="p-3">{t("auctions.colTime")}</th>
            <th className="p-3">{t("auctions.colStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((b) => (
            <tr key={b.id} className="border-t border-surface-container-highest">
              <td className="p-3">{b.bidder_name}</td>
              <td className="p-3 font-medium">{formatPrice(b.amount)}</td>
              <td className="p-3 text-secondary">
                {new Date(b.created_at).toLocaleString()}
              </td>
              <td className="p-3 uppercase text-xs">{b.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}