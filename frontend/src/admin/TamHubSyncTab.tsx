import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type TamHubSyncStatus } from "../api";
import { PrimaryButton, SecondaryButton } from "./ui";
import { useLanguage } from "../i18n";

const PRESET_MINUTES = [5, 10, 15, 30, 60];

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function TamHubSyncTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tamhub-sync"],
    queryFn: adminApi.getTamHubSync,
    refetchInterval: (q) => (q.state.data?.running ? 3000 : 15000),
  });

  const [enabled, setEnabled] = useState(true);
  const [inventory, setInventory] = useState(true);
  const [minutes, setMinutes] = useState(10);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setInventory(data.sync_inventory_to_inspo);
    setMinutes(Math.round(data.interval_seconds / 60));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      adminApi.updateTamHubSync({
        enabled,
        sync_inventory_to_inspo: inventory,
        interval_seconds: minutes * 60,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tamhub-sync"] }),
  });

  const runMutation = useMutation({
    mutationFn: () => adminApi.runTamHubSync(),
    onSuccess: () => {
      void refetch();
    },
  });

  if (isLoading && !data) {
    return <p className="text-muted text-sm">{t("admin.loading")}</p>;
  }
  if (isError || !data) {
    return <p className="text-error text-sm">{t("admin.tamhubSync.loadError")}</p>;
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section className="border border-surface-container-highest bg-white p-6">
        <h2 className="font-headline text-lg uppercase text-charcoal mb-4">{t("admin.tamhubSync.settings")}</h2>
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-forest-green"
          />
          <span className="text-sm">{t("admin.tamhubSync.enabled")}</span>
        </label>
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={inventory}
            onChange={(e) => setInventory(e.target.checked)}
            className="w-4 h-4 accent-forest-green"
          />
          <span className="text-sm">{t("admin.tamhubSync.pullInventory")}</span>
        </label>
        <div className="mb-4">
          <span className="font-label text-label-caps text-muted uppercase text-xs block mb-2">
            {t("admin.tamhubSync.interval")}
          </span>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`px-3 py-1.5 text-xs font-label uppercase border ${
                  minutes === m
                    ? "border-forest-green bg-forest-green text-white"
                    : "border-surface-container-highest text-secondary hover:border-forest-green"
                }`}
              >
                {m} {t("admin.tamhubSync.minutes")}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 border border-surface-container-highest px-2 py-1"
            />
            <span>{t("admin.tamhubSync.minutes")}</span>
          </label>
        </div>
        <PrimaryButton onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t("admin.saving") : t("admin.save")}
        </PrimaryButton>
      </section>

      <section className="border border-surface-container-highest bg-white p-6">
        <StatusBlock data={data} t={t} />
        <div className="mt-4 flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => runMutation.mutate()} disabled={data.running || runMutation.isPending}>
            {data.running ? t("admin.tamhubSync.running") : t("admin.tamhubSync.runNow")}
          </PrimaryButton>
          <SecondaryButton onClick={() => refetch()}>{t("admin.tamhubSync.refresh")}</SecondaryButton>
        </div>
      </section>

      {data.recent_errors?.length ? (
        <section className="border border-error/30 bg-white p-6">
          <h2 className="font-headline text-lg uppercase text-charcoal mb-3">{t("admin.tamhubSync.errors")}</h2>
          <ul className="text-sm space-y-3 max-h-64 overflow-y-auto">
            {data.recent_errors
              .slice()
              .reverse()
              .map((err, i) => (
                <li key={i} className="border-l-2 border-error pl-3">
                  <p className="text-muted text-xs">{err.at}</p>
                  <p className="text-error">{err.message}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatusBlock({ data, t }: { data: TamHubSyncStatus; t: (k: string) => string }) {
  const statusLabel =
    data.running
      ? t("admin.tamhubSync.statusRunning")
      : data.last_status === "ok"
        ? t("admin.tamhubSync.statusOk")
        : data.last_status === "error"
          ? t("admin.tamhubSync.statusError")
          : t("admin.tamhubSync.statusIdle");

  return (
    <>
      <h2 className="font-headline text-lg uppercase text-charcoal mb-4">{t("admin.tamhubSync.status")}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <StatusRow label={t("admin.tamhubSync.fieldStatus")} value={statusLabel} />
        <StatusRow label={t("admin.tamhubSync.fieldLastRun")} value={data.last_run_at ?? "—"} />
        <StatusRow label={t("admin.tamhubSync.fieldFinished")} value={data.last_finished_at ?? "—"} />
        <StatusRow label={t("admin.tamhubSync.fieldDuration")} value={formatDuration(data.last_duration_ms)} />
        <StatusRow label={t("admin.tamhubSync.fieldReason")} value={data.last_reason ?? "—"} />
      </dl>
      {data.last_error ? (
        <p className="mt-4 text-sm text-error border-l-2 border-error pl-3 whitespace-pre-wrap">{data.last_error}</p>
      ) : null}
      {data.tenants && Object.keys(data.tenants).length > 0 ? (
        <div className="mt-4">
          <p className="font-label text-label-caps text-muted uppercase text-xs mb-2">{t("admin.tamhubSync.tenants")}</p>
          <ul className="text-sm space-y-1">
            {Object.entries(data.tenants).map(([slug, info]) => (
              <li key={slug}>
                <span className="font-mono">{slug}</span>
                {" — "}
                {info.status}
                {info.message ? `: ${info.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs uppercase font-label">{label}</dt>
      <dd className="text-charcoal mt-0.5">{value}</dd>
    </div>
  );
}
