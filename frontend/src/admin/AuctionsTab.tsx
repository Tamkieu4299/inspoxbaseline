import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { AuctionLotAdmin, Product } from "../types";
import { Checkbox, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "./ui";

const STATUS_OPTIONS = ["draft", "live", "ended", "sold", "cancelled"];

function blankLot(productId: number): Record<string, unknown> {
  return {
    product_id: productId,
    starting_bid: 1_000_000,
    min_increment: 100_000,
    reserve_price: null,
    ends_at: null,
    status: "draft",
    is_published: false,
    headline: null,
    headline_vi: null,
  };
}

export default function AuctionsTab() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: site } = useQuery({ queryKey: ["admin-site"], queryFn: adminApi.getSite });
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: adminApi.getProducts });
  const { data: lots, isLoading } = useQuery({
    queryKey: ["admin-auctions"],
    queryFn: adminApi.getAuctionLots,
    enabled: Boolean(site?.bidding_enabled),
  });

  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [newProductId, setNewProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const lotProductIds = useMemo(
    () => new Set((lots || []).map((lot) => lot.product_id)),
    [lots],
  );

  const auctionEligible = useMemo(() => {
    const slugs = new Set(["rackets", "used-rackets", "custom-rackets"]);
    return (products || []).filter((p: Product) => {
      if (!p.is_active) return false;
      if (lotProductIds.has(p.id)) return false;
      const inCat = (p.categories || []).some((c) => slugs.has(c.slug));
      const primary = p.category?.slug;
      return inCat || (primary != null && slugs.has(primary));
    });
  }, [products, lotProductIds]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return auctionEligible;
    return auctionEligible.filter((p) => {
      const hay = [p.name, p.name_vi, p.slug, p.brand, p.subtitle, String(p.id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [auctionEligible, productSearch]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      if (selectedLotId) return adminApi.updateAuctionLot(selectedLotId, draft);
      return adminApi.createAuctionLot(draft);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-auctions"] });
      setDraft(null);
      setSelectedLotId(null);
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: number) => adminApi.closeAuctionLot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-auctions"] }),
  });

  const { data: bids } = useQuery({
    queryKey: ["admin-auction-bids", selectedLotId],
    queryFn: () => adminApi.getAuctionBids(selectedLotId!),
    enabled: selectedLotId != null,
  });

  if (!site?.bidding_enabled) {
    return (
      <div className="max-w-2xl bg-white border border-surface-container-highest p-6">
        <p className="font-body text-body-md text-secondary">{t("admin.auctions.enableHint")}</p>
      </div>
    );
  }

  function editLot(lot: AuctionLotAdmin) {
    setSelectedLotId(lot.id);
    setDraft({
      product_id: lot.product_id,
      starting_bid: lot.starting_bid,
      min_increment: lot.min_increment,
      reserve_price: lot.reserve_price,
      ends_at: lot.ends_at ? lot.ends_at.slice(0, 16) : null,
      status: lot.status,
      is_published: lot.is_published,
      headline: lot.headline,
      headline_vi: lot.headline_vi,
    });
  }

  function startCreate() {
    const pid = Number(newProductId);
    if (!pid) return;
    setSelectedLotId(null);
    setDraft(blankLot(pid));
  }

  const form = draft;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <section className="flex-1 min-w-0 bg-white border border-surface-container-highest p-6">
        <h3 className="font-headline text-headline-md uppercase text-primary mb-4">{t("admin.auctions.lots")}</h3>
        {isLoading && <p className="text-secondary">{t("admin.loading")}</p>}
        <ul className="flex flex-col gap-2">
          {(lots || []).map((lot) => (
            <li key={lot.id} className="border border-surface-container-highest p-3 flex justify-between gap-2 items-start">
              <div>
                <p className="font-body text-body-md font-medium">{lot.product_name}</p>
                <p className="font-label text-label-caps text-secondary uppercase text-xs">
                  {lot.status} · {lot.bid_count} bids · {lot.is_published ? "published" : "hidden"}
                </p>
              </div>
              <span className="flex gap-2 shrink-0">
                <SecondaryButton onClick={() => editLot(lot)}>{t("admin.edit")}</SecondaryButton>
                {lot.status === "live" && (
                  <SecondaryButton onClick={() => closeMutation.mutate(lot.id)} disabled={closeMutation.isPending}>
                    {t("admin.auctions.close")}
                  </SecondaryButton>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-6 border-t border-surface-container-highest flex flex-col gap-3">
          <Field label={t("admin.auctions.pickProduct")}>
            <TextInput
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t("admin.auctions.searchProduct")}
            />
            <p className="font-body text-body-sm text-secondary mt-1">
              {t("admin.auctions.searchProductHint", {
                shown: String(filteredProducts.length),
                total: String(auctionEligible.length),
              })}
            </p>
            <ul className="mt-2 max-h-56 overflow-y-auto border border-surface-container-highest divide-y divide-surface-container-highest">
              {filteredProducts.length === 0 ? (
                <li className="p-3 font-body text-body-sm text-secondary">{t("admin.auctions.noProductMatch")}</li>
              ) : (
                filteredProducts.slice(0, 80).map((p) => {
                  const selected = newProductId === String(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setNewProductId(String(p.id))}
                        className={`w-full text-left px-3 py-2 font-body text-body-sm hover:bg-surface-container-low transition-colors ${
                          selected ? "bg-surface-container-low border-l-2 border-forest-green" : ""
                        }`}
                      >
                        <span className="block text-primary font-medium truncate">{p.name}</span>
                        <span className="block text-secondary text-xs truncate">
                          {p.slug}
                          {p.brand ? ` · ${p.brand}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {filteredProducts.length > 80 ? (
              <p className="font-body text-body-sm text-secondary">{t("admin.auctions.searchRefine")}</p>
            ) : null}
          </Field>
          <SecondaryButton onClick={startCreate} disabled={!newProductId}>
            {t("admin.auctions.newLot")}
          </SecondaryButton>
        </div>
      </section>

      {form && (
        <section className="w-full lg:w-[420px] bg-white border border-surface-container-highest p-6 flex flex-col gap-3">
          <h3 className="font-headline text-headline-sm uppercase text-primary">
            {selectedLotId ? t("admin.auctions.editLot") : t("admin.auctions.newLot")}
          </h3>
          <Field label={t("admin.auctions.startingBid")}>
            <TextInput
              type="number"
              value={String(form.starting_bid ?? "")}
              onChange={(e) => setDraft({ ...form, starting_bid: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("admin.auctions.minIncrement")}>
            <TextInput
              type="number"
              value={String(form.min_increment ?? "")}
              onChange={(e) => setDraft({ ...form, min_increment: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("admin.auctions.reserve")}>
            <TextInput
              type="number"
              value={form.reserve_price == null ? "" : String(form.reserve_price)}
              onChange={(e) =>
                setDraft({
                  ...form,
                  reserve_price: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </Field>
          <Field label={t("admin.auctions.endsAt")}>
            <TextInput
              type="datetime-local"
              value={(form.ends_at as string) || ""}
              onChange={(e) => setDraft({ ...form, ends_at: e.target.value || null })}
            />
          </Field>
          <Field label={t("admin.auctions.status")}>
            <Select
              value={String(form.status)}
              onChange={(e) => setDraft({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={Boolean(form.is_published)}
              onChange={(e) => setDraft({ ...form, is_published: e.target.checked })}
            />
            <span className="font-body text-body-sm">{t("admin.auctions.published")}</span>
          </label>
          <Field label={t("admin.auctions.headline")}>
            <TextInput
              value={String(form.headline ?? "")}
              onChange={(e) => setDraft({ ...form, headline: e.target.value || null })}
            />
          </Field>
          <Field label={t("admin.auctions.headlineVi")}>
            <TextInput
              value={String(form.headline_vi ?? "")}
              onChange={(e) => setDraft({ ...form, headline_vi: e.target.value || null })}
            />
          </Field>
          <PrimaryButton onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {t("admin.save")}
          </PrimaryButton>

          {selectedLotId && bids && (
            <div className="mt-4">
              <h4 className="font-label text-label-caps uppercase text-secondary mb-2">{t("admin.auctions.bids")}</h4>
              <div className="max-h-48 overflow-auto text-xs font-mono border border-surface-container-highest">
                {bids.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    className="block w-full text-left px-2 py-1 border-b border-surface-container-highest hover:bg-surface-container-low"
                    onClick={() =>
                      /* see bid detail in native alert for quick copy */
                      navigator.clipboard?.writeText(`${b.bidder_name}\t${b.bidder_phone}\t${b.amount}`)
                    }
                    title={t("admin.auctions.copyBid")}
                  >
                    {b.amount.toLocaleString()} — {b.bidder_name} — {b.bidder_phone}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}