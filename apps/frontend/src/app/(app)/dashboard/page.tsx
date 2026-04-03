"use client";

import * as React from "react";
import type { EChartsOption } from "echarts";

import { HoverBorderGradient } from "@/components/aceternity";
import { EChart } from "@/components/charts/EChart";
import { useSession } from "@/components/session/SessionProvider";
import { GlassCard, GsapReveal } from "@/components/ui";
import { apiFetchWithRefresh } from "@/lib/api";
import type { AcademicRecordList, AcademicRecordPublic } from "@/lib/academics";
import { fmtDateTime, fmtPct01 } from "@/lib/format";
import type {
  ExplainResponse,
  ModelInfo,
  PredictionResponse,
  TrainResponse
} from "@/lib/ml";
import type { UserPublicAdmin, UsersList } from "@/lib/users";

export default function DashboardPage() {
  const { me } = useSession();

  const [studentPrediction, setStudentPrediction] = React.useState<PredictionResponse | null>(null);
  const [studentExplain, setStudentExplain] = React.useState<ExplainResponse | null>(null);
  const [studentRecords, setStudentRecords] = React.useState<AcademicRecordPublic[]>([]);
  const [studentNotice, setStudentNotice] = React.useState<string | null>(null);

  const [records, setRecords] = React.useState<AcademicRecordPublic[]>([]);
  const [students, setStudents] = React.useState<UserPublicAdmin[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);
  const [selectedPrediction, setSelectedPrediction] = React.useState<PredictionResponse | null>(null);
  const [selectedExplain, setSelectedExplain] = React.useState<ExplainResponse | null>(null);

  const [modelInfo, setModelInfo] = React.useState<ModelInfo | null>(null);

  const [mlNotice, setMlNotice] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const role = me?.role;

  const studentLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) {
      const label = s.full_name ? `${s.full_name} (${s.email})` : s.email;
      m.set(s.id, label);
    }
    return m;
  }, [students]);

  const selectedRecord = React.useMemo(() => {
    if (!selectedRecordId) return null;
    return records.find((r) => r.id === selectedRecordId) ?? null;
  }, [records, selectedRecordId]);

  async function loadStudentPanels() {
    // Student: load their own records + model outputs based on latest record.
    const recs = await apiFetchWithRefresh<AcademicRecordList>("/academics/me?limit=50&offset=0");
    setStudentRecords(recs.items);

    // If there is no academic record yet, ML endpoints correctly return 404.
    // Keep the dashboard friendly: show guidance instead of surfacing as an error.
    if (!recs.items.length) {
      setStudentPrediction(null);
      setStudentExplain(null);
      setStudentNotice(
        "No academic records yet. Ask a teacher or admin to import your records so we can generate predictions."
      );
      return;
    }

    setStudentNotice(null);

    try {
      const pred = await apiFetchWithRefresh<PredictionResponse>("/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      setStudentPrediction(pred);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err?.status === 503) {
        setStudentPrediction(null);
        setStudentNotice(
          "Predictions are temporarily unavailable because no model is trained yet. Ask an admin to train a model."
        );
      } else if (err?.status === 404) {
        // In case the latest record was removed between fetch + predict.
        setStudentPrediction(null);
        setStudentNotice(
          "No academic records were found to run a prediction. Ask a teacher or admin to import your records."
        );
      } else {
        throw e;
      }
    }

    try {
      const exp = await apiFetchWithRefresh<ExplainResponse>("/ml/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top_k: 5 })
      });
      setStudentExplain(exp);
    } catch (e) {
      const err = e as { status?: number };
      if (err?.status === 503) {
        setStudentExplain(null);
        setStudentNotice(
          (prev) =>
            prev ??
            "Explanations are temporarily unavailable because no model is trained yet. Ask an admin to train a model."
        );
      } else if (err?.status === 404) {
        setStudentExplain(null);
      } else {
        throw e;
      }
    }
  }

  async function loadTeacherAdminPanels() {
    // Load students list (teachers are server-limited to students only)
    const users = await apiFetchWithRefresh<UsersList>("/users?role=student&limit=200&offset=0");
    setStudents(users.items);

    // Load records scoped by selected student (or all)
    const qs = new URLSearchParams({ limit: "50", offset: "0" });
    if (selectedStudentId) qs.set("student_user_id", selectedStudentId);
    const recs = await apiFetchWithRefresh<AcademicRecordList>(`/academics?${qs.toString()}`);
    setRecords(recs.items);
    setSelectedRecordId(recs.items[0]?.id ?? null);

    if (role === "admin") {
      try {
        const mi = await apiFetchWithRefresh<ModelInfo>("/ml/model", { method: "GET" });
        setModelInfo(mi);
        setMlNotice(null);
      } catch {
        // ignore (e.g., no model registered yet)
        setModelInfo(null);
        setMlNotice("No model is available yet. Train and register a model first.");
      }
    }
  }

  async function runForRecord(recordId: string) {
    setMlNotice(null);

    try {
      const pred = await apiFetchWithRefresh<PredictionResponse>("/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_record_id: recordId })
      });
      setSelectedPrediction(pred);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err?.status === 503) {
        setSelectedPrediction(null);
        setSelectedExplain(null);
        setMlNotice(
          role === "admin"
            ? "No model is available yet. Train and register a model first."
            : "No model is available yet. Ask an admin to train and register a model."
        );
        return;
      }
      throw e;
    }

    try {
      const exp = await apiFetchWithRefresh<ExplainResponse>("/ml/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_record_id: recordId, top_k: 5 })
      });
      setSelectedExplain(exp);
    } catch (e) {
      const err = e as { status?: number };
      if (err?.status === 503) {
        setSelectedExplain(null);
        setMlNotice(
          role === "admin"
            ? "No model is available yet. Train and register a model first."
            : "No model is available yet. Ask an admin to train and register a model."
        );
        return;
      }
      throw e;
    }
  }

  async function trainModelFromRecords() {
    if (role !== "admin") return;
    setError(null);
    setMlNotice(null);
    setLoading(true);
    try {
      const res = await apiFetchWithRefresh<TrainResponse>("/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "trained-from-dashboard" })
      });

      setModelInfo(res.model);
      setMlNotice(`Model trained successfully (version ${res.model.model_version}).`);

      if (selectedRecordId) {
        await runForRecord(selectedRecordId);
      }
    } catch (e) {
      const err = e as { message?: string };
      setError(err?.message || (e instanceof Error ? e.message : "Failed to train model"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (!role) return;

      try {
        setError(null);
        setLoading(true);

        if (role === "student") {
          await loadStudentPanels();
        } else {
          await loadTeacherAdminPanels();
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, selectedStudentId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedRecordId) return;
      if (!role || role === "student") return;
      try {
        setError(null);
        setLoading(true);
        await runForRecord(selectedRecordId);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to run prediction");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedRecordId, role]);

  function RiskBadge({ pred }: { pred: PredictionResponse }) {
    const risky = pred.classification === "At-Risk";
    return (
      <span
        className={
          "rounded-full border px-3 py-1 text-base font-semibold " +
          (risky
            ? "border-[rgba(235,97,95,0.35)] bg-[rgba(235,97,95,0.14)] text-(--edp-red)"
            : "border-[rgba(20,65,206,0.28)] bg-[rgba(20,65,206,0.10)] text-(--edp-blue)")
        }
      >
        {pred.classification} • {fmtPct01(pred.confidence)} conf
      </span>
    );
  }

  function FactorsPanel({ exp }: { exp: ExplainResponse }) {
    return (
      <div className="grid gap-3">
        <div className="text-base font-semibold text-slate-900">Top factors</div>
        <div className="grid gap-2">
          {exp.factors.map((f) => {
            const positive = f.direction === "increases";
            const w = Math.min(100, Math.round(Math.abs(f.impact) * 100));
            return (
              <div key={f.feature_key} className="grid gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base text-slate-800">{f.feature_label}</div>
                  <div className="text-base text-slate-700">
                    {f.value}
                    {f.unit ? ` ${f.unit}` : ""}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/80">
                  <div
                    className={
                      "h-2 rounded-full " +
                      (positive
                        ? "bg-[rgba(235,97,95,0.78)]"
                        : "bg-[rgba(20,65,206,0.78)]")
                    }
                    style={{ width: `${Math.max(8, w)}%` }}
                  />
                </div>
                <div className="text-sm text-slate-600">
                  {positive ? "Increases risk" : "Decreases risk"} • impact {f.impact.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const gpaSeries = (role === "student" ? studentRecords : records)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const gpaOption: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: 24, right: 18, top: 18, bottom: 24, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: gpaSeries.map((r) => new Date(r.created_at).toLocaleDateString()),
      axisLabel: { color: "rgba(15,23,42,0.60)" },
      axisLine: { lineStyle: { color: "rgba(20,65,206,0.20)" } }
    },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 4,
      axisLabel: { color: "rgba(15,23,42,0.60)" },
      splitLine: { lineStyle: { color: "rgba(20,65,206,0.12)" } }
    },
    series: [
      {
        type: "line" as const,
        smooth: true,
        data: gpaSeries.map((r) => r.gpa),
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: "rgba(20,65,206,0.92)" },
        itemStyle: { color: "rgba(20,65,206,0.92)" },
        areaStyle: { color: "rgba(20,65,206,0.10)" }
      }
    ]
  };

  return (
    <GsapReveal className="grid gap-6">
      <div data-gsap="pop" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-base text-slate-700">
            Predictions, explanations, and trends.
          </p>
        </div>

        <div data-gsap="pop" className="flex flex-wrap items-center gap-2">
          {role ? (
            <span className="rounded-full border border-[rgba(20,65,206,0.18)] bg-white/70 px-3 py-1 text-base font-semibold text-slate-700">
              Role: {role}
            </span>
          ) : null}
          <HoverBorderGradient onClick={() => window.location.reload()}>
            Refresh
          </HoverBorderGradient>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(235,97,95,0.30)] bg-[rgba(235,97,95,0.12)] p-4 text-base text-(--edp-red)">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-base text-slate-700">Loading…</div>
      ) : null}

      {/* Student view */}
      {role === "student" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">Risk prediction</div>
                <div className="mt-1 text-base text-slate-700">Based on your latest academic record</div>
              </div>
              {studentPrediction ? <RiskBadge pred={studentPrediction} /> : null}
            </div>

            <div className="mt-5 border-t border-[rgba(20,65,206,0.16)] pt-4">
              {studentPrediction ? (
                <div className="grid gap-2 text-base text-slate-700">
                  <div>
                    Risk probability: <span className="font-semibold text-slate-900">{fmtPct01(studentPrediction.risk_probability)}</span>
                  </div>
                  <div className="text-base text-slate-700">Model: {studentPrediction.model_version}</div>
                </div>
              ) : (
                <div className="text-base text-slate-700">
                  {studentNotice ?? "No prediction available yet."}
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
            {studentExplain ? (
              <FactorsPanel exp={studentExplain} />
            ) : (
              <div className="text-base text-slate-700">
                {studentNotice ?? "No explanation available yet."}
              </div>
            )}
          </GlassCard>

          <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7 md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">CGPA TREND</div>
                <div className="mt-1 text-base text-slate-700">Your last {studentRecords.length} records</div>
              </div>
              <div className="text-base text-slate-700">
                {studentRecords[0]?.created_at ? `Latest: ${fmtDateTime(studentRecords[0].created_at)}` : ""}
              </div>
            </div>
            <div className="mt-3">
              <EChart option={gpaOption} className="h-64 w-full" />
            </div>
          </GlassCard>
        </div>
      ) : null}

      {/* Teacher/Admin view */}
      {role === "teacher" || role === "admin" ? (
        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
              <div className="text-base font-semibold text-slate-900">Academic records</div>
              <div className="mt-1 text-base text-slate-700">
                Select a record to run prediction + explain.
              </div>

              <div className="mt-4 grid gap-2">
                <label className="text-base font-semibold text-slate-700" htmlFor="student">
                  Student
                </label>
                <select
                  id="student"
                  className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
                  value={selectedStudentId ?? ""}
                  onChange={(e) => setSelectedStudentId(e.target.value || null)}
                >
                  <option value="">All students</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid gap-2">
                <label className="text-base font-semibold text-slate-700" htmlFor="record">
                  Record
                </label>
                <select
                  id="record"
                  className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
                  value={selectedRecordId ?? ""}
                  onChange={(e) => setSelectedRecordId(e.target.value || null)}
                  disabled={!records.length}
                >
                  {records.length ? (
                    records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.term ? `${r.term} • ` : ""}CGPA {r.gpa} • {studentLabelById.get(r.student_user_id) ?? `${r.student_user_id.slice(0, 8)}…`}
                      </option>
                    ))
                  ) : (
                    <option value="">No records available</option>
                  )}
                </select>

                {selectedRecord ? (
                  <div className="mt-3 grid gap-1 text-base text-slate-700">
                    <div>Student: {selectedRecord.student_user_id}</div>
                    <div>Created: {fmtDateTime(selectedRecord.created_at)}</div>
                  </div>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-900">Prediction</div>
                  <div className="mt-1 text-base text-slate-700">From selected record</div>
                </div>
                {selectedPrediction ? <RiskBadge pred={selectedPrediction} /> : null}
              </div>

              {mlNotice ? (
                <div className="mt-4 rounded-2xl border border-[rgba(235,97,95,0.30)] bg-[rgba(235,97,95,0.12)] p-4 text-base text-(--edp-red)">
                  {mlNotice}
                </div>
              ) : null}

              <div className="mt-4">
                {selectedPrediction ? (
                  <div className="grid gap-2 text-base text-slate-700">
                    <div>
                      Risk probability: <span className="font-semibold text-slate-900">{fmtPct01(selectedPrediction.risk_probability)}</span>
                    </div>
                    <div className="text-base text-slate-700">Model: {selectedPrediction.model_version}</div>
                  </div>
                ) : (
                  <div className="text-base text-slate-700">Pick a record to see prediction.</div>
                )}
              </div>
            </GlassCard>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
              {selectedExplain ? (
                <FactorsPanel exp={selectedExplain} />
              ) : (
                <div className="text-base text-slate-700">Pick a record to see explanation.</div>
              )}
            </GlassCard>

            <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
              <div className="text-base font-semibold text-slate-900">CGPA TREND</div>
              <div className="mt-1 text-base text-slate-700">Recent records in your scope</div>
              <div className="mt-3">
                <EChart option={gpaOption} className="h-64 w-full" />
              </div>
            </GlassCard>
          </div>

          {role === "admin" ? (
            <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-900">Model info (admin)</div>
                  <div className="mt-1 text-base text-slate-700">From /ml/model</div>
                </div>

                <HoverBorderGradient
                  className="border border-[#00B300] bg-[#00B300] text-white ring-1 ring-[rgba(0,179,0,0.30)] hover:bg-[#009A00]"
                  onClick={trainModelFromRecords}
                  disabled={loading}
                >
                  Train model
                </HoverBorderGradient>
              </div>

              {modelInfo ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-3 rounded-2xl border border-[rgba(20,65,206,0.16)] bg-[linear-gradient(135deg,rgba(20,65,206,0.10),rgba(56,189,248,0.14))] p-4 sm:p-5">
                    <div className="text-sm font-semibold tracking-[0.06em] text-slate-700">ACTIVE MODEL</div>
                    <div className="flex flex-wrap items-center gap-2 text-base text-slate-800">
                      <span className="rounded-full border border-[rgba(15,23,42,0.14)] bg-white/85 px-3 py-1 font-semibold">
                        {modelInfo.model_version}
                      </span>
                      <span className="rounded-full border border-[rgba(15,23,42,0.14)] bg-white/85 px-3 py-1">
                        {fmtDateTime(String(modelInfo.created_at))}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(modelInfo.metrics ?? {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white/80 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          {k.replace(/_/g, " ")}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{v.toFixed(4)}</div>
                      </div>
                    ))}
                  </div>

                  {modelInfo.notes ? (
                    <div className="rounded-2xl border border-[rgba(20,65,206,0.14)] bg-white/70 p-4 text-base text-slate-700">
                      <span className="font-semibold text-slate-900">Notes:</span> {modelInfo.notes}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-base text-slate-700">
                  No model metadata available yet.
                </div>
              )}
            </GlassCard>
          ) : null}
        </div>
      ) : null}
    </GsapReveal>
  );
}
