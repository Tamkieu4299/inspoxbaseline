import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";
import { useLanguage } from "../i18n";
import type { AnalyticsDashboard, AnalyticsSummary } from "../types";
import { SecondaryButton, Select } from "./ui";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-surface-container-highest bg-white p-4 flex flex-col gap-1 min-w-[140px] flex-1">
      <p className="font-label text-[10px] uppercase tracking-wider text-secondary">{label}</p>
      <p className="font-headline text-2xl text-primary tabular-nums">{value}</p>
      {sub ? <p className="font-body text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function SummaryGrid({ t, s, prefix }: { t: (k: string) => string; s: AnalyticsSummary; prefix: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard label={t(`${prefix}.pageViews`)} value={fmt(s.page_views)} />
      <KpiCard label={t(`${prefix}.visitors`)} value={fmt(s.unique_visitors)} />
      <KpiCard label={t(`${prefix}.sessions`)} value={fmt(s.sessions)} />
      <KpiCard label={t(`${prefix}.productViews`)} value={fmt(s.product_views)} />
      <KpiCard label={t(`${prefix}.orders`)} value={fmt(s.orders)} />
    </div>
  );
}

function DailyChart({
  daily,
  t,
}: {
  daily: AnalyticsDashboard["daily"];
  t: (k: string) => string;
}) {
  const max = Math.max(1, ...daily.map((d) => d.page_views));
  if (!daily.length) {
    return <p className="text-secondary text-sm font-body">{t("admin.analytics.noData")}</p>;
  }
  return (
    <div className="flex items-end gap-1 h-36 w-full overflow-x-auto pb-1">
      {daily.map((d) => (
        <div key={d.date} className="flex flex-col items-center gap-1 min-w-[28px] flex-1 max-w-[48px] h-full">
          <div
            className="w-full bg-forest-green/85 rounded-t min-h-[4px] flex-1"
            style={{ maxHeight: `${(d.page_views / max) * 100}%` }}
            title={`${d.date}: ${d.page_views} PV`}
          />
          <span className="font-mono text-[8px] text-secondary truncate w-full text-center">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsTab() {
  const { t } = useLanguage();
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => adminApi.getAnalytics(days),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return <p className="font-body text-body-md text-secondary">{t("admin.loading")}</p>;
  }

  const deviceTotal = Object.values(data.devices).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-headline text-headline-md text-primary uppercase">{t("admin.analytics.title")}</h3>
          <p className="font-body text-body-sm text-secondary mt-1">{t("admin.analytics.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="min-w-[120px]">
            <option value="7">{t("admin.analytics.range7")}</option>
            <option value="30">{t("admin.analytics.range30")}</option>
            <option value="90">{t("admin.analytics.range90")}</option>
          </Select>
          <SecondaryButton type="button" onClick={() => refetch()} disabled={isFetching}>
            {t("admin.analytics.refresh")}
          </SecondaryButton>
        </div>
      </div>

      <section>
        <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
          {t("admin.analytics.periodSummary", { days: String(data.range_days) })}
        </h4>
        <SummaryGrid t={t} s={data.summary} prefix="admin.analytics.kpi" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-surface-container-highest bg-white p-4">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
            {t("admin.analytics.today")}
          </h4>
          <SummaryGrid t={t} s={data.today} prefix="admin.analytics.kpi" />
        </div>
        <div className="rounded-lg border border-surface-container-highest bg-white p-4">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
            {t("admin.analytics.yesterday")}
          </h4>
          <SummaryGrid t={t} s={data.yesterday} prefix="admin.analytics.kpi" />
        </div>
      </section>

      <section className="rounded-lg border border-surface-container-highest bg-white p-4">
        <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
          {t("admin.analytics.dailyChart")}
        </h4>
        <DailyChart daily={data.daily} t={t} />
      </section>

      <section className="rounded-lg border border-surface-container-highest bg-white p-4">
        <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
          {t("admin.analytics.funnel")}
        </h4>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-body text-sm">
          <li className="p-3 bg-surface-container-lowest rounded">
            {t("admin.analytics.funnelViews")}: <strong>{pct(data.conversion.view_to_product_pct)}</strong>
          </li>
          <li className="p-3 bg-surface-container-lowest rounded">
            {t("admin.analytics.funnelCart")}: <strong>{pct(data.conversion.product_to_cart_pct)}</strong>
          </li>
          <li className="p-3 bg-surface-container-lowest rounded">
            {t("admin.analytics.funnelCheckout")}: <strong>{pct(data.conversion.cart_to_checkout_pct)}</strong>
          </li>
          <li className="p-3 bg-surface-container-lowest rounded">
            {t("admin.analytics.funnelOrders")}: <strong>{pct(data.conversion.checkout_to_order_pct)}</strong>
          </li>
        </ul>
        <p className="text-xs text-muted mt-2 font-body">{t("admin.analytics.funnelNote")}</p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-surface-container-highest bg-white overflow-hidden">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary px-4 pt-4 pb-2">
            {t("admin.analytics.topProducts")}
          </h4>
          {!data.top_products.length ? (
            <p className="px-4 pb-4 text-secondary text-sm">{t("admin.analytics.noData")}</p>
          ) : (
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container-low font-label text-[10px] uppercase tracking-wider text-secondary">
                <tr>
                  <th className="text-left px-4 py-2">{t("admin.analytics.colProduct")}</th>
                  <th className="text-right px-4 py-2">{t("admin.analytics.colViews")}</th>
                  <th className="text-right px-4 py-2">{t("admin.analytics.colUniques")}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((row, i) => (
                  <tr key={row.product_id} className="border-t border-surface-container-high">
                    <td className="px-4 py-2">
                      <span className="text-muted mr-2">{i + 1}.</span>
                      <Link to={`/products/${row.slug}`} className="text-primary hover:underline" target="_blank">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(row.views)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(row.unique_visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-surface-container-highest bg-white overflow-hidden">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary px-4 pt-4 pb-2">
            {t("admin.analytics.topPages")}
          </h4>
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container-low font-label text-[10px] uppercase tracking-wider text-secondary">
              <tr>
                <th className="text-left px-4 py-2">{t("admin.analytics.colPath")}</th>
                <th className="text-right px-4 py-2">{t("admin.analytics.colViews")}</th>
              </tr>
            </thead>
            <tbody>
              {data.top_paths.map((row) => (
                <tr key={row.path} className="border-t border-surface-container-high">
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-[220px]">{row.path || "/"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(row.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-surface-container-highest bg-white p-4">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
            {t("admin.analytics.referrers")}
          </h4>
          {!data.top_referrers.length ? (
            <p className="text-secondary text-sm">{t("admin.analytics.noReferrers")}</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {data.top_referrers.map((r) => (
                <li key={r.host} className="flex justify-between gap-2">
                  <span className="truncate">{r.host}</span>
                  <span className="tabular-nums text-secondary">{fmt(r.views)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-surface-container-highest bg-white p-4">
          <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
            {t("admin.analytics.devices")}
          </h4>
          <ul className="space-y-2 font-body text-sm">
            {Object.entries(data.devices).map(([kind, count]) => (
              <li key={kind}>
                <div className="flex justify-between mb-1">
                  <span className="uppercase text-xs font-label">{kind}</span>
                  <span className="tabular-nums">{fmt(count)}</span>
                </div>
                <div className="h-1.5 bg-surface-container rounded overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(count / deviceTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-surface-container-highest bg-white p-4">
        <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
          {t("admin.analytics.engagement")}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label={t("admin.analytics.addToCart")} value={fmt(data.summary.add_to_cart)} />
          <KpiCard label={t("admin.analytics.checkouts")} value={fmt(data.summary.checkout_starts)} />
          <KpiCard label={t("admin.analytics.searches")} value={fmt(data.summary.searches)} />
          <KpiCard label={t("admin.analytics.totalEvents")} value={fmt(data.summary.total_events)} />
        </div>
      </section>

      <section className="rounded-lg border border-surface-container-highest bg-white p-4">
        <h4 className="font-label text-label-caps uppercase tracking-wider text-secondary mb-3">
          {t("admin.analytics.recent")}
        </h4>
        <ul className="max-h-64 overflow-y-auto font-mono text-[11px] space-y-1 text-secondary">
          {data.recent_events.map((e, i) => (
            <li key={`${e.occurred_at}-${i}`} className="flex flex-wrap gap-2">
              <span>{e.occurred_at.replace("T", " ").slice(0, 19)}</span>
              <span className="text-primary">{e.event_type}</span>
              <span className="truncate flex-1">{e.path}</span>
              {e.referrer_host ? <span className="text-muted">← {e.referrer_host}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="font-body text-xs text-muted border-t border-surface-container-high pt-4">
        {t("admin.analytics.privacyNote")}
      </p>
    </div>
  );
}