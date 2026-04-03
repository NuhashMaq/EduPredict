"use client";

import * as React from "react";

import { HoverBorderGradient } from "@/components/aceternity";
import { useSession } from "@/components/session/SessionProvider";
import { GlassCard, GsapReveal } from "@/components/ui";
import { apiFetchWithRefresh } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type {
  ModelInfo,
  ModelListResponse,
  PromoteResponse,
  TrainRequest,
  TrainResponse
} from "@/lib/ml";

function ModelInfoPanel({ title, model }: { title: string; model: ModelInfo }) {
  const metricsEntries = Object.entries(model.metrics ?? {});

  return (
    <GlassCard className="p-6 sm:p-7" tone="default">
      <div className="rounded-2xl border border-[rgba(20,65,206,0.16)] bg-[linear-gradient(135deg,rgba(20,65,206,0.10),rgba(56,189,248,0.14))] p-4 sm:p-5">
        <div className="text-sm font-semibold tracking-[0.06em] text-slate-700">{title.toUpperCase()}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span className="rounded-full border border-[rgba(15,23,42,0.14)] bg-white/85 px-3 py-1 font-semibold text-slate-900">
            {model.model_version}
          </span>
          <span className="rounded-full border border-[rgba(15,23,42,0.14)] bg-white/85 px-3 py-1">
            {fmtDateTime(String(model.created_at))}
          </span>
        </div>
      </div>

      {model.notes ? (
        <div className="mt-4 rounded-2xl border border-[rgba(20,65,206,0.14)] bg-white/70 p-4 text-base text-slate-700">
          <span className="font-semibold text-slate-900">Notes:</span> {model.notes}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white/55 p-4">
          <div className="text-sm font-semibold text-slate-700">Metrics</div>
          {metricsEntries.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {metricsEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {k.replace(/_/g, " ")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{Number(v).toFixed(4)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-base text-slate-600">No metrics available.</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/55 p-4">
          <div className="text-sm font-semibold text-slate-700">Features</div>
          {model.feature_names?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {model.feature_names.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-sm text-slate-700"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-base text-slate-600">No feature names available.</div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export default function AdminMlPage() {
  const { me } = useSession();
  const role = me?.role;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [modelInfo, setModelInfo] = React.useState<ModelInfo | null>(null);
  const [trainedInfo, setTrainedInfo] = React.useState<ModelInfo | null>(null);
  const [models, setModels] = React.useState<ModelListResponse | null>(null);

  const [notes, setNotes] = React.useState<string>("");
  const [minRows, setMinRows] = React.useState<number>(20);

  async function loadModelInfo() {
    try {
      const mi = await apiFetchWithRefresh<ModelInfo>("/ml/model", { method: "GET" });
      setModelInfo(mi);
    } catch {
      setModelInfo(null);
    }
  }

  async function loadModels() {
    try {
      const res = await apiFetchWithRefresh<ModelListResponse>("/ml/models?limit=200", {
        method: "GET"
      });
      setModels(res);
    } catch {
      setModels(null);
    }
  }

  React.useEffect(() => {
    if (role === "admin") {
      void loadModelInfo();
      void loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function promote(version: string) {
    setError(null);
    setLoading(true);
    try {
      await apiFetchWithRefresh<PromoteResponse>(`/ml/models/${encodeURIComponent(version)}/promote`, {
        method: "POST"
      });
      await loadModelInfo();
      await loadModels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setLoading(false);
    }
  }

  async function train() {
    setError(null);
    setLoading(true);
    try {
      const body: TrainRequest = { notes, min_rows: minRows };
      const res = await apiFetchWithRefresh<TrainResponse>("/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      setTrainedInfo(res.model);
      await loadModelInfo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Training failed");
    } finally {
      setLoading(false);
    }
  }

  if (role !== "admin") {
    return (
      <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-base text-rose-700">
        This page is only available to admins.
      </div>
    );
  }

  return (
    <GsapReveal>
      <div className="grid gap-6">
        <div data-gsap="pop" className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Admin · Engine</h1>
            <p className="mt-2 text-base text-slate-600">Update predictions using stored academic records.</p>
          </div>

          <div className="flex items-center gap-2">
            <HoverBorderGradient
              onClick={async () => {
                await loadModelInfo();
                await loadModels();
              }}
              disabled={loading}
            >
              Refresh
            </HoverBorderGradient>
          </div>
        </div>

        {error ? (
          <div data-gsap="pop" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-base text-rose-700">
            {error}
          </div>
        ) : null}

        <GlassCard data-gsap="pop" className="p-6 sm:p-7" tone="cyan">
          <div className="text-base font-semibold tracking-[0.04em] text-slate-900">Run an update</div>
          <div className="mt-1 text-sm text-slate-600">
            This runs right away; for large datasets you’ll want a background job later.
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="minRows">
                Minimum rows
              </label>
              <input
                id="minRows"
                type="number"
                min={5}
                max={10000}
                value={Number.isFinite(minRows) ? minRows : 20}
                onChange={(e) => setMinRows(Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200/70 bg-white/70 px-3 text-base text-slate-900 outline-none focus:border-(--edp-blue) focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
              />
              <div className="text-sm text-slate-600">
                The update will be rejected if there are fewer than this many academic records.
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. After importing Q1 2026 dataset"
                className="w-full resize-none rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-base text-slate-900 outline-none focus:border-(--edp-blue) focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
              />
              <div className="text-sm text-slate-600">Saved with this version.</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <HoverBorderGradient
              disabled={loading}
              onClick={train}
              className={
                loading
                  ? "bg-white text-slate-500 border-slate-200 ring-slate-200/70"
                  : "bg-[rgba(20,65,206,0.10)] text-(--edp-blue) border-[rgba(20,65,206,0.18)] ring-[rgba(20,65,206,0.18)]"
              }
            >
              {loading ? "Working…" : "Run update"}
            </HoverBorderGradient>
            <div className="text-sm text-slate-600">Tip: add a note so you can track when/why this was updated.</div>
          </div>
        </GlassCard>

        {trainedInfo ? (
          <div data-gsap="pop">
            <ModelInfoPanel title="Just trained" model={trainedInfo} />
          </div>
        ) : null}

        <GlassCard data-gsap="pop" className="p-6 sm:p-7" tone="default">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold tracking-[0.04em] text-slate-900">Versions</div>
              <div className="mt-1 text-sm text-slate-600">Make a previous version the active one.</div>
            </div>
            <div className="text-sm text-slate-600">
              Latest: <span className="font-semibold text-slate-800">{models?.latest_version ?? "—"}</span>
            </div>
          </div>

          {models?.items?.length ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/60">
              <div className="min-w-220">
                <div className="grid grid-cols-12 gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-600">
                  <div className="col-span-4">Version</div>
                  <div className="col-span-3">Created</div>
                  <div className="col-span-3">Notes</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {models.items.map((m) => {
                  const isLatest = models.latest_version === m.model_version;
                  return (
                    <div
                      key={m.model_version}
                      className="grid grid-cols-12 items-center gap-3 border-b border-slate-200/70 px-4 py-3 text-base text-slate-800 last:border-b-0"
                    >
                      <div className="col-span-4 truncate font-mono text-sm text-slate-700">
                        {m.model_version}
                        {isLatest ? (
                          <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            latest
                          </span>
                        ) : null}
                      </div>
                      <div className="col-span-3 truncate text-sm text-slate-600">
                        {fmtDateTime(String(m.created_at))}
                      </div>
                      <div className="col-span-3 truncate text-sm text-slate-600">{m.notes || "—"}</div>
                      <div className="col-span-2 flex justify-end">
                        <HoverBorderGradient
                          className={
                            "px-3 py-2 text-sm inline-flex items-center justify-center min-w-28 whitespace-nowrap " +
                            (loading
                              ? "bg-white text-slate-500 border-slate-200 ring-slate-200/70"
                              : isLatest
                                ? "bg-[#FFD400] text-[#1B1400] border-[#E6BF00] ring-[#E6BF00]"
                                : "bg-[#00B300] text-white border-[#009A00] ring-[#009A00]")
                          }
                          disabled={isLatest || loading}
                          onClick={() => promote(m.model_version)}
                        >
                          {isLatest ? "LATEST" : loading ? "Working…" : "Promote"}
                        </HoverBorderGradient>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-base text-slate-600">No versions found yet.</div>
          )}
        </GlassCard>

        {modelInfo ? (
          <div data-gsap="pop">
            <ModelInfoPanel title="Active version" model={modelInfo} />
          </div>
        ) : (
          <GlassCard data-gsap="pop" className="p-6 sm:p-7" tone="default">
            <div className="text-base font-semibold text-slate-900">Active version</div>
            <div className="mt-2 text-base text-slate-600">No active version yet.</div>
          </GlassCard>
        )}
      </div>
    </GsapReveal>
  );
}
