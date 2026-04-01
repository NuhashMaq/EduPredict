"use client";

import * as React from "react";
import Papa from "papaparse";

import { HoverBorderGradient } from "@/components/aceternity";
import { GlassCard, GsapReveal } from "@/components/ui";
import { useSession } from "@/components/session/SessionProvider";
import { apiFetchWithRefresh } from "@/lib/api";

type ImportRowError = {
  row: number;
  message: string;
  raw?: Record<string, string> | null;
};

type ImportResponse = {
  dry_run: boolean;
  total_rows: number;
  created: number;
  errors: ImportRowError[];
};

export default function ImportPage() {
  const { me } = useSession();

  const [file, setFile] = React.useState<File | null>(null);
  const [dryRun, setDryRun] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [csvPreview, setCsvPreview] = React.useState<Array<Record<string, string>>>([]);
  const [csvParseError, setCsvParseError] = React.useState<string | null>(null);

  const requiredEither = ["student_user_id", "student_email"] as const;
  const requiredSummary = [
    "attendance_pct",
    "assignments_pct",
    "quizzes_pct",
    "exams_pct",
    "gpa"
  ] as const;

  // RUET-style per-course marks (server aggregates per term)
  const requiredRuet = [
    "credits",
    "grade_point_4",
    "attendance_10",
    "assignments_10",
    "final_60"
  ] as const;

  function validateHeaders(headers: string[]) {
    const h = new Set(headers.map((x) => x.trim()));
    const hasEither = requiredEither.some((k) => h.has(k));
    const hasTerm = h.has("term") || h.has("semester");

    const hasSummary = requiredSummary.every((k) => h.has(k));
    const hasRuet = requiredRuet.every((k) => h.has(k)) && hasTerm;

    const missing: string[] = [];
    if (!hasEither) missing.push("student_user_id OR student_email");

    if (hasEither && (hasSummary || hasRuet)) {
      return { missing, hasEither };
    }

    // Show a helpful combined error when format isn't satisfied.
    if (!hasTerm) missing.push("term OR semester");
    for (const k of requiredSummary) {
      if (!h.has(k)) missing.push(k);
    }
    for (const k of requiredRuet) {
      if (!h.has(k)) missing.push(k);
    }

    // De-dup
    return { missing: Array.from(new Set(missing)), hasEither };
  }

  function downloadTemplate() {
    // RUET-style template (per-course marks).
    // The server will aggregate multiple rows into one record per student+term.
    const csv =
      "student_email,term,course_code,credits,attendance_10,assignments_10,ct_20,final_60,grade_point_4\n" +
      "student@example.com,1-1,1101,3,8,9,16,47,3.50\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edupredict-academic-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onPickFile(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setError(null);
    setCsvParseError(null);
    setCsvHeaders([]);
    setCsvPreview([]);

    if (!nextFile) return;

    Papa.parse<Record<string, unknown>>(nextFile, {
      header: true,
      skipEmptyLines: true,
      preview: 8,
      complete: (results) => {
        const fields = (results.meta.fields ?? []).filter(Boolean) as string[];
        setCsvHeaders(fields);

        if (results.errors?.length) {
          // Show first parser error (keep it simple)
          const e = results.errors[0];
          setCsvParseError(`${e.code}: ${e.message}`);
        }

        const rows = (results.data ?? []).filter(Boolean).map((row) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(row ?? {})) {
            if (!k) continue;
            out[k] = v == null ? "" : String(v);
          }
          return out;
        });
        setCsvPreview(rows);
      }
    });
  }

  const role = me?.role;
  const allowed = role === "teacher" || role === "admin";

  async function submit() {
    if (!file) {
      setError("Please choose a CSV file.");
      return;
    }

    const { missing } = validateHeaders(csvHeaders);
    if (csvHeaders.length && missing.length) {
      setError(`CSV is missing required columns: ${missing.join(", ")}.`);
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("dry_run", String(dryRun));

      const res = await apiFetchWithRefresh<ImportResponse>("/academics/import", {
        method: "POST",
        body: form
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GsapReveal>
      <div className="grid gap-6">
        <div data-gsap="pop">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Import academic records
          </h1>
          <p className="mt-2 text-base text-slate-700">
            Upload a CSV with either:
            <span className="font-semibold text-slate-800"> summary columns</span> (attendance_pct, assignments_pct,
            quizzes_pct, exams_pct, cgpa (column name: gpa), term) or
            <span className="font-semibold text-slate-800"> RUET marks columns</span> (attendance_10, assignments_10,
            ct_20, final_60, credits, grade_point_4, semester/term). In both cases provide
            <span className="font-semibold text-slate-800"> student_user_id</span> or
            <span className="font-semibold text-slate-800"> student_email</span>.
          </p>
        </div>

        {!allowed ? (
          <div
            data-gsap="pop"
            className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-base text-rose-700"
          >
            This page is only available to teachers and admins.
          </div>
        ) : (
          <GlassCard data-gsap="pop" className="grid gap-7 p-7 sm:p-9" tone="cyan">
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-slate-700" htmlFor="file">
                CSV file
              </label>
              <input
                id="file"
                type="file"
                accept={".csv,text/csv"}
                className="block w-full text-base text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-[rgba(20,65,206,0.10)] file:px-4 file:py-3 file:text-base file:font-semibold file:text-(--edp-blue) hover:file:bg-[rgba(20,65,206,0.14)]"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-base text-slate-700">
                <HoverBorderGradient
                  variant="orange"
                  className="h-9 px-4 text-sm"
                  onClick={downloadTemplate}
                >
                  Download template CSV
                </HoverBorderGradient>
                <span className="leading-6">Excel tip: export as CSV UTF-8 if possible.</span>
              </div>
            </div>

            <div className="py-2">
              <label className="flex items-center gap-2 text-base text-slate-700">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-4 w-4 rounded border border-slate-300 bg-white accent-(--edp-blue)"
                />
                Preview only (no changes)
              </label>
            </div>

            {file ? (
              <div className="grid gap-3 rounded-2xl bg-white/55 p-4 shadow-[0_10px_40px_rgba(20,65,206,0.10)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">CSV preview</div>
                  <span className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-sm text-slate-700">
                    {file.name}
                  </span>
                </div>

                {csvParseError ? (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-base text-rose-700">
                    Notice: {csvParseError}
                  </div>
                ) : null}

                {csvHeaders.length ? (
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-slate-700">Detected headers</div>
                    <div className="flex flex-wrap gap-2">
                      {csvHeaders.map((h) => (
                        <span
                          key={h}
                          className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-sm text-slate-700"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    {(() => {
                      const { missing } = validateHeaders(csvHeaders);
                      return missing.length ? (
                        <div className="mt-2 text-sm text-rose-700">Missing: {missing.join(", ")}</div>
                      ) : (
                        <div className="mt-2 text-sm text-emerald-700">Headers look good.</div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-base text-slate-700">No header row detected yet.</div>
                )}

                {csvPreview.length ? (
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-slate-700">First rows</div>
                    <div className="max-h-56 overflow-auto rounded-xl border border-slate-200/70 bg-white/70">
                      <table className="w-full border-collapse text-left text-sm text-slate-700">
                        <thead className="sticky top-0 bg-white/90 backdrop-blur">
                          <tr>
                            {csvHeaders.slice(0, 8).map((h) => (
                              <th key={h} className="border-b border-slate-200/70 px-3 py-2 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.slice(0, 8).map((row, i) => (
                            <tr key={i} className="border-b border-slate-200/40 last:border-b-0">
                              {csvHeaders.slice(0, 8).map((h) => (
                                <td key={h} className="px-3 py-2">
                                  {row[h] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-slate-600">
                      Preview shows up to 8 columns and 8 rows.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <HoverBorderGradient
                  variant="blue"
                  className={
                    "h-9 px-4 text-sm " +
                    (dryRun
                      ? ""
                      : "border border-[#00B300] bg-[#00B300] text-white ring-1 ring-[rgba(0,179,0,0.30)] hover:bg-[#009A00]")
                  }
                  onClick={submit}
                  disabled={loading}
                >
                  {loading ? "Uploading…" : dryRun ? "Check" : "Save"}
                </HoverBorderGradient>
              </div>
              <div className="pt-1 text-base leading-7 text-slate-700">
                Tip: start with preview to confirm formatting. Turning it off will save the records.
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-base text-rose-700">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="grid gap-3 rounded-2xl bg-white/55 p-4 shadow-[0_10px_40px_rgba(239,127,96,0.10)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">Result</div>
                  <span className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-sm text-slate-700">
                    {result.dry_run ? "preview" : "saved"}
                  </span>
                </div>

                <div className="grid gap-1 text-base text-slate-700">
                  <div>Total rows: {result.total_rows}</div>
                  <div>
                    {result.dry_run ? "Valid rows" : "Created"}: {result.created}
                  </div>
                  <div>Issues: {result.errors.length}</div>
                </div>

                {result.errors.length ? (
                  <div className="mt-2 grid gap-2">
                    <div className="text-sm font-semibold text-slate-700">Row notes</div>
                    <div className="max-h-64 overflow-auto rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-700">
                      {result.errors.map((er) => (
                        <div key={`${er.row}-${er.message}`} className="py-1">
                          <span className="font-semibold text-slate-800">Row {er.row}:</span> {er.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </GlassCard>
        )}
      </div>
    </GsapReveal>
  );
}
