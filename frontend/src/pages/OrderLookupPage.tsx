import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLanguage } from "../i18n";
import { useStoreCurrency } from "../useStoreCurrency";

export default function OrderLookupPage() {
  const { t } = useLanguage();
  const { formatPrice } = useStoreCurrency();
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitted, setSubmitted] = useState<{ phone: string; orderNumber: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-lookup", submitted?.phone, submitted?.orderNumber],
    queryFn: () => api.lookupOrder(submitted!.phone, submitted!.orderNumber),
    enabled: !!submitted,
  });

  return (
    <main className="px-4 sm:px-8 lg:px-stack-xl py-12 max-w-lg mx-auto">
      <h1 className="font-headline text-headline-lg text-primary uppercase mb-2">{t("order.trackTitle")}</h1>
      <p className="font-body text-body-md text-secondary mb-8">{t("order.trackHint")}</p>
      <form
        className="flex flex-col gap-4 mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ phone: phone.trim(), orderNumber: orderNumber.trim() });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-label text-label-caps uppercase">{t("checkout.phone")}</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border border-outline-variant px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-label-caps uppercase">{t("order.orderNumber")}</span>
          <input
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="border border-outline-variant px-3 py-2"
            placeholder="20251030-0001"
          />
        </label>
        <button type="submit" className="bg-forest-green text-white font-label text-label-caps py-3 uppercase">
          {t("order.trackSubmit")}
        </button>
      </form>
      {submitted && isLoading ? <p className="text-secondary">{t("admin.loading")}</p> : null}
      {submitted && isError ? <p className="text-status-danger">{t("order.trackNotFound")}</p> : null}
      {data ? (
        <div className="border border-outline-variant p-6 bg-white">
          <p className="font-headline text-headline-md uppercase mb-1">{data.order_number}</p>
          <p className="font-body text-body-sm text-secondary mb-4">
            {t("order.status")}:{" "}
            {(
              {
                new: t("order.status.new"),
                confirmed: t("order.status.confirmed"),
                shipped: t("order.status.shipped"),
                cancelled: t("order.status.cancelled"),
              } as Record<string, string>
            )[data.status] ?? data.status}
          </p>
          <ul className="flex flex-col gap-2 mb-4">
            {data.lines.map((line) => (
              <li key={line.id} className="font-body text-body-sm flex justify-between gap-2">
                <span>
                  {line.product_name} × {line.quantity}
                </span>
                <span>{formatPrice(line.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="font-label text-label-caps uppercase">{formatPrice(data.total)}</p>
        </div>
      ) : null}
    </main>
  );
}
