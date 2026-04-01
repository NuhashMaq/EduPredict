"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { apiFetchWithRefresh, loginWithPassword } from "@/lib/api";
import { HoverBorderGradient, MultiStepLoader } from "@/components/aceternity";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type FormState = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>({ email: "", password: "" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(0);

    // Normalize common user input issues (copy/paste whitespace, email casing).
    const normalized: FormState = {
      email: form.email.trim().toLowerCase(),
      password: form.password.trim()
    };

    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      setError("Please enter a valid email and password.");
      return;
    }

    try {
      setSubmitting(true);
      setStep(0);
      await loginWithPassword(parsed.data.email, parsed.data.password);
      // Validate tokens immediately so users get a clear error if the session can't be established.
      await apiFetchWithRefresh("/auth/me");
      setStep(1);
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <MultiStepLoader
        visible={submitting}
        steps={["Signing in", "Opening dashboard"]}
        activeIndex={step}
      />
      <h1 className="text-4xl font-semibold tracking-tight">
        <span className="bg-linear-to-r from-(--edp-blue) via-(--edp-orange) to-(--edp-red) bg-clip-text text-transparent">
          Sign in
        </span>
      </h1>
      <p className="mt-2 text-xl leading-8 text-slate-600">Welcome back. Let’s get you to your dashboard.</p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@school.edu"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            className="h-13 w-full rounded-2xl border border-[rgba(20,65,206,0.18)] bg-white/70 px-5 text-lg text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1441CE] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            className="h-13 w-full rounded-2xl border border-[rgba(20,65,206,0.18)] bg-white/70 px-5 text-lg text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1441CE] focus:ring-4 focus:ring-[rgba(20,65,206,0.14)]"
          />
        </div>

        {error ? <div className="text-base text-[#EB615F]">{error}</div> : null}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <HoverBorderGradient type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </HoverBorderGradient>
          <Link href="/register" className="text-base text-slate-600 hover:text-(--edp-blue)">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
