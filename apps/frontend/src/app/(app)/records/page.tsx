"use client";

import * as React from "react";

import { HoverBorderGradient } from "@/components/aceternity";
import { useSession } from "@/components/session/SessionProvider";
import { GlassCard, GsapReveal } from "@/components/ui";
import { apiFetchWithRefresh } from "@/lib/api";
import type { AcademicRecordList, AcademicRecordPublic } from "@/lib/academics";
import type { UserPublicAdmin, UsersList, UserRole } from "@/lib/users";
import { fmtDateTime } from "@/lib/format";

type AcademicRecordCreate = {
  student_user_id: string;
  attendance_pct: number;
  assignments_pct: number;
  quizzes_pct: number;
  exams_pct: number;
  gpa: number;
  term?: string | null;
};

type AcademicRecordUpdate = Partial<AcademicRecordCreate>;

export default function RecordsPage() {
  const { me } = useSession();
  const role = me?.role;

  const isAdmin = role === "admin";

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [importing, setImporting] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = React.useState<AcademicRecordPublic[]>([]);
  const [students, setStudents] = React.useState<UserPublicAdmin[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);

  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);

  const [selectedRecordIds, setSelectedRecordIds] = React.useState<Set<string>>(() => new Set());

  const [createForm, setCreateForm] = React.useState<AcademicRecordCreate>({
    student_user_id: "",
    attendance_pct: 90,
    assignments_pct: 90,
    quizzes_pct: 90,
    exams_pct: 90,
    gpa: 3.0,
    term: null
  });

  const selectedRecord = React.useMemo(() => {
    if (!selectedRecordId) return null;
    return records.find((r) => r.id === selectedRecordId) ?? null;
  }, [records, selectedRecordId]);

  const visibleRecordIds = React.useMemo(() => records.map((r) => r.id), [records]);
  const allVisibleSelected = React.useMemo(() => {
    if (!visibleRecordIds.length) return false;
    for (const id of visibleRecordIds) {
      if (!selectedRecordIds.has(id)) return false;
    }
    return true;
  }, [selectedRecordIds, visibleRecordIds]);

  const someVisibleSelected = React.useMemo(() => {
    if (!visibleRecordIds.length) return false;
    let count = 0;
    for (const id of visibleRecordIds) {
      if (selectedRecordIds.has(id)) count += 1;
    }
    return count > 0 && count < visibleRecordIds.length;
  }, [selectedRecordIds, visibleRecordIds]);

  const selectAllRef = React.useRef<HTMLInputElement | null>(null);

  const [editForm, setEditForm] = React.useState<AcademicRecordUpdate>({});

  const studentLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) {
      const label = s.full_name ? `${s.full_name} (${s.email})` : s.email;
      m.set(s.id, label);
    }
    return m;
  }, [students]);

  React.useEffect(() => {
    // Keep "select all" checkbox indeterminate state in sync.
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  React.useEffect(() => {
    // If list changes (filter/refresh), drop selections that are no longer visible.
    if (!isAdmin) {
      if (selectedRecordIds.size) setSelectedRecordIds(new Set());
      return;
    }

    if (!selectedRecordIds.size) return;
    const visible = new Set(visibleRecordIds);
    const next = new Set<string>();
    for (const id of selectedRecordIds) {
      if (visible.has(id)) next.add(id);
    }
    if (next.size !== selectedRecordIds.size) setSelectedRecordIds(next);
  }, [isAdmin, records, selectedRecordIds, visibleRecordIds]);

  function canManage(role: UserRole | undefined) {
    return role === "teacher" || role === "admin";
  }

  async function load() {
    if (!role) return;

    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (role === "student") {
        const res = await apiFetchWithRefresh<AcademicRecordList>("/academics/me?limit=200&offset=0");
        setRecords(res.items);
        setSelectedRecordId(res.items[0]?.id ?? null);
        return;
      }

      // teacher/admin
      const users = await apiFetchWithRefresh<UsersList>("/users?role=student&limit=200&offset=0");
      setStudents(users.items);

      const qs = new URLSearchParams({ limit: "200", offset: "0" });
      if (selectedStudentId) qs.set("student_user_id", selectedStudentId);
      const res = await apiFetchWithRefresh<AcademicRecordList>(`/academics?${qs.toString()}`);
      setRecords(res.items);
      setSelectedRecordId(res.items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, selectedStudentId]);

  React.useEffect(() => {
    // When selection changes, prime edit form.
    if (!selectedRecord) {
      setEditForm({});
      return;
    }

    setEditForm({
      attendance_pct: selectedRecord.attendance_pct,
      assignments_pct: selectedRecord.assignments_pct,
      quizzes_pct: selectedRecord.quizzes_pct,
      exams_pct: selectedRecord.exams_pct,
      gpa: selectedRecord.gpa,
      term: selectedRecord.term ?? null
    });
  }, [selectedRecord]);

  async function createRecord() {
    setError(null);
    setNotice(null);

    if (!canManage(role)) {
      setError("Forbidden");
      return;
    }

    if (!createForm.student_user_id) {
      setError("Please select a student.");
      return;
    }

    setLoading(true);
    try {
      await apiFetchWithRefresh<AcademicRecordPublic>("/academics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm)
      });

      // Refresh list
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create record");
    } finally {
      setLoading(false);
    }
  }

  async function updateRecord() {
    if (!selectedRecord) return;
    setError(null);

    if (!canManage(role)) {
      setError("Forbidden");
      return;
    }

    setLoading(true);
    try {
      await apiFetchWithRefresh<AcademicRecordPublic>(`/academics/${selectedRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update record");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord() {
    if (!selectedRecord) return;
    setError(null);

    if (role !== "admin") {
      setError("Only admins can delete records.");
      return;
    }

    setLoading(true);
    try {
      await apiFetchWithRefresh<void>(`/academics/${selectedRecord.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete record");
    } finally {
      setLoading(false);
    }
  }

  function toggleRowSelected(recordId: string) {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    if (!isAdmin) return;
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleRecordIds) next.delete(id);
      } else {
        for (const id of visibleRecordIds) next.add(id);
      }
      return next;
    });
  }

  async function deleteSelectedRecords() {
    setError(null);

    if (!isAdmin) {
      setError("Only admins can delete records.");
      return;
    }

    const ids = Array.from(selectedRecordIds);
    if (!ids.length) return;

    const ok = window.confirm(`Delete ${ids.length} record${ids.length === 1 ? "" : "s"}?`);
    if (!ok) return;

    setLoading(true);
    try {
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await apiFetchWithRefresh<void>(`/academics/${id}`, { method: "DELETE" });
        } catch {
          failed.push(id);
        }
      }

      if (failed.length) {
        setError(`Failed to delete ${failed.length} of ${ids.length} record(s).`);
      }

      setSelectedRecordIds(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete selected records");
    } finally {
      setLoading(false);
    }
  }

  type AcademicImportResponse = {
    created: number;
    updated: number;
    skipped: number;
    invalid_rows: number;
    errors?: Array<{ row: number; message: string }>;
  };

  async function importRecordsCsv(file: File) {
    if (!role || role === "student") return;
    setError(null);
    setNotice(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // dry_run defaults false server-side; keep simple.

      const res = await apiFetchWithRefresh<AcademicImportResponse>("/academics/import", {
        method: "POST",
        body: fd
      });

      const base = `Import complete: created=${res.created}, updated=${res.updated}, skipped=${res.skipped}, invalid=${res.invalid_rows}`;
      if (res.errors?.length) {
        setError(`${base}. First error (row ${res.errors[0].row}): ${res.errors[0].message}`);
      } else {
        setNotice(base);
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import records");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <GsapReveal className="grid gap-6">
      <div data-gsap="pop" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Academic records</h1>
          <p className="mt-2 text-base text-slate-700">
            {role === "student"
              ? "Your academic history."
              : "Manage student records (create, edit, and—admins—delete)."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role && role !== "student" ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) void importRecordsCsv(f);
                }}
              />
              <HoverBorderGradient
                variant="blue"
                onClick={() => importInputRef.current?.click()}
                disabled={loading || importing}
              >
                {importing ? "Importing…" : "Import CSV"}
              </HoverBorderGradient>
            </>
          ) : null}

          <HoverBorderGradient onClick={load} disabled={loading}>
            Refresh
          </HoverBorderGradient>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[rgba(235,97,95,0.30)] bg-[rgba(235,97,95,0.12)] p-4 text-base text-(--edp-red)">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-base text-emerald-800">
          {notice}
        </div>
      ) : null}

      {role && role !== "student" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
            <div className="text-base font-semibold text-slate-900">Create record</div>
            <div className="mt-1 text-sm text-slate-700">Teachers/Admins only</div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="student">
                  Student
                </label>
                <select
                  id="student"
                  className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
                  value={createForm.student_user_id}
                  onChange={(e) =>
                    setCreateForm((s) => ({ ...s, student_user_id: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumberField
                  label="Attendance %"
                  value={createForm.attendance_pct}
                  min={0}
                  max={100}
                  onChange={(v) => setCreateForm((s) => ({ ...s, attendance_pct: v }))}
                />
                <NumberField
                  label="Assignments %"
                  value={createForm.assignments_pct}
                  min={0}
                  max={100}
                  onChange={(v) => setCreateForm((s) => ({ ...s, assignments_pct: v }))}
                />
                <NumberField
                  label="Quizzes %"
                  value={createForm.quizzes_pct}
                  min={0}
                  max={100}
                  onChange={(v) => setCreateForm((s) => ({ ...s, quizzes_pct: v }))}
                />
                <NumberField
                  label="Exams %"
                  value={createForm.exams_pct}
                  min={0}
                  max={100}
                  onChange={(v) => setCreateForm((s) => ({ ...s, exams_pct: v }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumberField
                  label="CGPA (0-4)"
                  value={createForm.gpa}
                  min={0}
                  max={4}
                  step={0.1}
                  onChange={(v) => setCreateForm((s) => ({ ...s, gpa: v }))}
                />
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="term">
                    Term (optional)
                  </label>
                  <input
                    id="term"
                    className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
                    placeholder="Fall 2025"
                    value={createForm.term ?? ""}
                    onChange={(e) => setCreateForm((s) => ({ ...s, term: e.target.value || null }))}
                  />
                </div>
              </div>

              <HoverBorderGradient onClick={createRecord} disabled={loading}>
                Create
              </HoverBorderGradient>
            </div>
          </GlassCard>

          <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
            <div className="text-base font-semibold text-slate-900">Edit selected record</div>
            <div className="mt-1 text-sm text-slate-700">
              {selectedRecord ? `Record ${selectedRecord.id.slice(0, 8)}…` : "Select a record below"}
            </div>

            {!selectedRecord ? (
              <div className="mt-4 text-base text-slate-700">No record selected.</div>
            ) : (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Attendance %"
                    value={Number(editForm.attendance_pct ?? 0)}
                    min={0}
                    max={100}
                    onChange={(v) => setEditForm((s) => ({ ...s, attendance_pct: v }))}
                  />
                  <NumberField
                    label="Assignments %"
                    value={Number(editForm.assignments_pct ?? 0)}
                    min={0}
                    max={100}
                    onChange={(v) => setEditForm((s) => ({ ...s, assignments_pct: v }))}
                  />
                  <NumberField
                    label="Quizzes %"
                    value={Number(editForm.quizzes_pct ?? 0)}
                    min={0}
                    max={100}
                    onChange={(v) => setEditForm((s) => ({ ...s, quizzes_pct: v }))}
                  />
                  <NumberField
                    label="Exams %"
                    value={Number(editForm.exams_pct ?? 0)}
                    min={0}
                    max={100}
                    onChange={(v) => setEditForm((s) => ({ ...s, exams_pct: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="CGPA (0-4)"
                    value={Number(editForm.gpa ?? 0)}
                    min={0}
                    max={4}
                    step={0.1}
                    onChange={(v) => setEditForm((s) => ({ ...s, gpa: v }))}
                  />
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="term-edit">
                      Term
                    </label>
                    <input
                      id="term-edit"
                      className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
                      value={(editForm.term ?? "") as string}
                      onChange={(e) => setEditForm((s) => ({ ...s, term: e.target.value || null }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <HoverBorderGradient
                    onClick={updateRecord}
                    disabled={loading}
                    className="border border-[#00B300] bg-[#00B300] text-white ring-1 ring-[rgba(0,179,0,0.30)] hover:bg-[#009A00]"
                  >
                    Save changes
                  </HoverBorderGradient>
                  {role === "admin" ? (
                    <HoverBorderGradient
                      className="border border-[#E60000] bg-[#E60000] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C40000]"
                      onClick={deleteRecord}
                      disabled={loading}
                    >
                      Delete
                    </HoverBorderGradient>
                  ) : null}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      ) : null}

      {role && role !== "student" ? (
        <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">Records</div>
              <div className="mt-1 text-sm text-slate-700">Click a row to select for editing</div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {isAdmin ? (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={loading || !records.length}
                      className="h-4 w-4 rounded border-slate-300 text-[rgba(235,97,95,1)] focus:ring-[rgba(235,97,95,0.25)]"
                      aria-label="Select all visible records"
                    />
                    Select all
                  </label>

                  <HoverBorderGradient
                    className="border border-[#E60000] bg-[#E60000] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C40000]"
                    onClick={deleteSelectedRecords}
                    disabled={loading || selectedRecordIds.size === 0}
                  >
                    Delete selected ({selectedRecordIds.size})
                  </HoverBorderGradient>
                </div>
              ) : null}

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="filter-student">
                  Filter by student
                </label>
                <select
                  id="filter-student"
                  className="h-10 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
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
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl bg-white/70 shadow-[0_12px_36px_rgba(20,65,206,0.10)]">
            <div className="min-w-220">
              <div
                className={
                  (isAdmin ? "grid-cols-13 " : "grid-cols-12 ") +
                  "grid gap-3 border-b border-[rgba(20,65,206,0.16)] bg-[rgba(20,65,206,0.04)] px-4 py-3 text-sm font-semibold text-slate-700"
                }
              >
                {isAdmin ? <div className="col-span-1">Select</div> : null}
                <div className={isAdmin ? "col-span-3" : "col-span-3"}>Student</div>
                <div className="col-span-2">CGPA</div>
                <div className="col-span-2">Term</div>
                <div className="col-span-3">Created</div>
                <div className="col-span-2">Signals</div>
              </div>

              {records.map((r) => {
                const checked = isAdmin ? selectedRecordIds.has(r.id) : false;
                const isEditingSelected = r.id === selectedRecordId;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className={
                      (isAdmin ? "grid-cols-13 " : "grid-cols-12 ") +
                      "grid w-full cursor-pointer items-center gap-3 border-b border-[rgba(20,65,206,0.10)] px-4 py-3 text-left text-base text-slate-800 transition-colors last:border-b-0 hover:bg-[rgba(250,222,221,0.55)] " +
                      (isEditingSelected ? "bg-[rgba(20,65,206,0.08)] " : "") +
                      (checked && !isEditingSelected ? "bg-[rgba(250,222,221,0.35)]" : "")
                    }
                    onClick={() => setSelectedRecordId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedRecordId(r.id);
                    }}
                  >
                    {isAdmin ? (
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRowSelected(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={loading}
                          className="h-4 w-4 rounded border-slate-300 text-[rgba(235,97,95,1)] focus:ring-[rgba(235,97,95,0.25)]"
                          aria-label={`Select record ${r.id}`}
                        />
                      </div>
                    ) : null}

                    <div className={isAdmin ? "col-span-3 truncate" : "col-span-3 truncate"}>
                      {studentLabelById.get(r.student_user_id) ?? `${r.student_user_id.slice(0, 8)}…`}
                    </div>
                    <div className="col-span-2 font-semibold text-slate-900">{r.gpa.toFixed(2)}</div>
                    <div className="col-span-2 truncate text-slate-700">{r.term ?? "—"}</div>
                    <div className="col-span-3 truncate text-slate-600">{fmtDateTime(r.created_at)}</div>
                    <div className="col-span-2 truncate text-slate-600">
                      {r.attendance_pct}/{r.assignments_pct}/{r.quizzes_pct}/{r.exams_pct}
                    </div>
                  </div>
                );
              })}

              {!records.length ? (
                <div className="px-4 py-6 text-base text-slate-700">No records found.</div>
              ) : null}
            </div>
          </div>
        </GlassCard>
      ) : null}

      {role === "student" ? (
        <GlassCard data-gsap="pop" className="rounded-2xl p-6 sm:p-7">
          <div className="text-base font-semibold text-slate-900">Your records</div>
          <div className="mt-1 text-sm text-slate-700">Read-only</div>

          <div className="mt-4 overflow-x-auto rounded-2xl bg-white/70 shadow-[0_12px_36px_rgba(20,65,206,0.10)]">
            <div className="min-w-180">
              <div className="grid grid-cols-12 gap-3 border-b border-[rgba(20,65,206,0.16)] bg-[rgba(20,65,206,0.04)] px-4 py-3 text-sm font-semibold text-slate-700">
                <div className="col-span-2">CGPA</div>
                <div className="col-span-3">Term</div>
                <div className="col-span-4">Created</div>
                <div className="col-span-3">Signals</div>
              </div>

              {records.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 items-center gap-3 border-b border-[rgba(20,65,206,0.10)] px-4 py-3 text-base text-slate-800 last:border-b-0"
                >
                  <div className="col-span-2 font-semibold text-slate-900">{r.gpa.toFixed(2)}</div>
                  <div className="col-span-3 truncate text-slate-700">{r.term ?? "—"}</div>
                  <div className="col-span-4 truncate text-slate-600">{fmtDateTime(r.created_at)}</div>
                  <div className="col-span-3 truncate text-slate-600">
                    {r.attendance_pct}/{r.assignments_pct}/{r.quizzes_pct}/{r.exams_pct}
                  </div>
                </div>
              ))}

              {!records.length ? (
                <div className="px-4 py-6 text-base text-slate-700">No records yet.</div>
              ) : null}
            </div>
          </div>
        </GlassCard>
      ) : null}

      {loading ? <div className="text-base text-slate-700">Loading…</div> : null}
    </GsapReveal>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-[rgba(20,65,206,0.20)] bg-white/80 px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[rgba(20,65,206,0.40)] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
      />
    </div>
  );
}
