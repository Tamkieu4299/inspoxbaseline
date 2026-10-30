import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { OrderAdmin } from "../types";
import { SecondaryButton, Select } from "./ui";

const STATUSES = ["new", "confirmed", "shipped", "cancelled"] as const;

function statusLabel(t: (k: string) => string, status: string) {
  const key = `order.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export default function OrdersTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => adminApi.getOrders(filter || undefined),
  });

  const selected = orders?.find((o) => o.id === selectedId) ?? orders?.[0] ?? null;

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => adminApi.updateOrderStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  async function downloadCsv() {
    const blob = await adminApi.exportOrdersCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.ordersTitle")}</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-w-[140px]">
            <option value="">{t("admin.ordersAllStatuses")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(t, s)}
              </option>
            ))}
          </Select>
          <SecondaryButton type="button" onClick={() => void downloadCsv()}>
            {t("admin.ordersExportCsv")}
          </SecondaryButton>
        </div>
      </div>
      {!orders?.length ? (
        <p className="font-body text-body-md text-secondary">{t("admin.ordersEmpty")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ul className="border border-surface-container-highest divide-y divide-surface-container-highest max-h-[70vh] overflow-y-auto bg-white">
            {orders.map((o: OrderAdmin) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-container-low ${
                    selected?.id === o.id ? "bg-surface-container-low" : ""
                  }`}
                >
                  <p className="font-label text-label-caps text-primary">{o.order_number}</p>
                  <p className="font-body text-body-sm text-secondary">
                    {o.customer_name} · {o.customer_phone}
                  </p>
                  <p className="font-body text-body-sm text-secondary">
                    {statusLabel(t, o.status)} · {new Date(o.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <OrderDetail
              order={selected}
              onStatus={(status) => patchMutation.mutate({ id: selected.id, status })}
              t={t}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  order,
  onStatus,
  t,
}: {
  order: OrderAdmin;
  onStatus: (status: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="border border-surface-container-highest p-6 bg-white flex flex-col gap-4">
      <div>
        <p className="font-headline text-headline-md uppercase">{order.order_number}</p>
        <p className="font-body text-body-sm text-secondary mt-1">
          {new Date(order.created_at).toLocaleString()}
        </p>
      </div>
      <div className="font-body text-body-sm text-secondary flex flex-col gap-1">
        <p>
          <strong>{t("checkout.name")}:</strong> {order.customer_name}
        </p>
        <p>
          <strong>{t("checkout.phone")}:</strong> {order.customer_phone}
        </p>
        {order.customer_email ? (
          <p>
            <strong>{t("checkout.email")}:</strong> {order.customer_email}
          </p>
        ) : null}
        <p>
          <strong>{t("checkout.address")}:</strong> {order.shipping_address}
        </p>
        {order.note ? (
          <p>
            <strong>{t("checkout.note")}:</strong> {order.note}
          </p>
        ) : null}
        <p>
          <strong>{t("checkout.codHint")}</strong>
        </p>
      </div>
      <ul className="border-t border-surface-container-highest pt-3 flex flex-col gap-2">
        {order.lines.map((line) => (
          <li key={line.id} className="font-body text-body-sm flex justify-between gap-2">
            <span>
              {line.product_name}
              {line.color || line.size ? ` (${[line.color, line.size].filter(Boolean).join(", ")})` : ""} ×{" "}
              {line.quantity}
            </span>
            <span>{line.line_total.toLocaleString()} {order.currency_code}</span>
          </li>
        ))}
      </ul>
      <p className="font-headline text-headline-md uppercase">
        {order.total.toLocaleString()} {order.currency_code}
      </p>
      {order.webhook_delivery_status ? (
        <p className="font-body text-body-sm text-secondary">
          Webhook: {order.webhook_delivery_status}
          {order.webhook_last_error ? ` — ${order.webhook_last_error}` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-label text-label-caps uppercase">{t("order.status")}</span>
        <Select
          value={order.status}
          onChange={(e) => onStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(t, s)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
