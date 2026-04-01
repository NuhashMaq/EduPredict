"use client";

import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { BackgroundBeams, DottedGlowBackground, HoverBorderGradient } from "@/components/aceternity";
import { SessionProvider, type UserPublic } from "@/components/session/SessionProvider";
import { BrandLogo } from "@/components/site/BrandLogo";
import { GlassCard } from "@/components/ui";
import { apiFetchWithRefresh, getApiBaseUrl, logout } from "@/lib/api";

const APP_BG =
  "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=2400";

export default function AppLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = React.useState<UserPublic | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [backendOffline, setBackendOffline] = React.useState<string | null>(null);

  const role = me?.role;

  const navItems = React.useMemo(
    () =>
      [
        {
          label: "Dashboard",
          href: "/dashboard" as Route,
          description: "Overview and quick signals",
          visible: (_r: UserPublic["role"]) => true
        },
        {
          label: "Records",
          href: "/records" as Route,
          description: "Browse and manage entries",
          visible: (_r: UserPublic["role"]) => true
        },
        {
          label: "Import",
          href: "/import" as Route,
          description: "Upload CSV and validate",
          visible: (r: UserPublic["role"]) => r === "teacher" || r === "admin"
        },
        {
          label: "Users",
          href: "/admin/users" as Route,
          description: "Roles and access control",
          visible: (r: UserPublic["role"]) => r === "admin"
        },
        {
          label: "Engine",
          href: "/admin/ml" as Route,
          description: "Model + predictions console",
          visible: (r: UserPublic["role"]) => r === "admin"
        }
      ] as const,
    []
  );

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setBackendOffline(null);
        const user = await apiFetchWithRefresh<UserPublic>("/auth/me");
        if (!alive) return;
        setMe(user);
      } catch {
        if (!alive) return;
        // If the service isn't reachable yet, keep the user here and show a friendly screen.
        // If it's an access problem, send them to login.
        const base = getApiBaseUrl();
        try {
          // We re-run a tiny unauthenticated request to disambiguate network vs access.
          const res = await fetch(`${base.replace(/\/$/, "")}/health`, { method: "GET" });
          if (res.ok) {
            router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
          } else {
            setBackendOffline("The service is not ready yet.");
          }
        } catch (e) {
          setBackendOffline(e instanceof Error ? e.message : "The service is not reachable yet.");
        }
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={APP_BG}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-15"
        />
        <div aria-hidden className="absolute inset-0 bg-[rgba(250,222,221,0.85)]" />
      </div>

      <BackgroundBeams className="opacity-70" />
      <DottedGlowBackground className="opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_18%,rgba(20,65,206,0.12),transparent_60%),radial-gradient(900px_420px_at_78%_22%,rgba(239,127,96,0.14),transparent_60%),radial-gradient(1100px_560px_at_55%_88%,rgba(235,97,95,0.10),transparent_62%)]"
      />

      <SessionProvider value={{ me, loading }}>
        <div className="relative mx-auto w-full max-w-screen-2xl px-3 pb-16 pt-8 sm:px-6">
          <header className="sticky top-0 z-50 -mx-3 mb-2 border-b border-[rgba(20,65,206,0.14)] bg-transparent px-3 py-4 shadow-none sm:-mx-6 sm:px-6">
            <div className="grid gap-8">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                <div className="flex flex-wrap items-center gap-3">
                  <BrandLogo />
                  {loading ? null : me ? (
                    <span className="rounded-full border border-[rgba(20,65,206,0.16)] bg-white/70 px-3 py-1 text-xs text-slate-700">
                      {me.role}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {loading || !me ? null : (
                    <HoverBorderGradient
                      variant="blue"
                      className="h-11 px-5 text-base"
                      onClick={async () => {
                        await logout();
                        router.replace("/login");
                      }}
                    >
                      Sign out
                    </HoverBorderGradient>
                  )}
                </div>
              </div>

              {loading || !me ? null : (
                <nav className="grid grid-flow-col auto-cols-fr gap-3 overflow-x-auto pt-3 pb-2 lg:overflow-visible lg:pb-0">
                  {navItems
                    .filter((i) => i.visible(role!))
                    .map((item) => (
                      <TopNavLink
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        description={item.description}
                        active={Boolean(pathname?.startsWith(item.href))}
                      />
                    ))}
                </nav>
              )}
            </div>
          </header>

          <main className="mt-7 min-h-[calc(100vh-180px)]">
            <GlassCard className="h-full rounded-2xl p-7 sm:p-9">
              {backendOffline ? (
                <div className="grid gap-5">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connection unavailable</h1>
                    <p className="mt-2 text-base text-slate-700">
                      We’re having trouble connecting right now. Please try again shortly.
                    </p>
                  </div>

                  <GlassCard className="rounded-2xl p-6 sm:p-7" lamp={false}>
                    <div className="text-base font-semibold text-slate-900">Try again</div>
                    <div className="mt-2 text-base text-slate-700">
                      If you recently started the system, it may take a moment to become available.
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <HoverBorderGradient variant="blue" onClick={() => window.location.reload()}>
                        Retry
                      </HoverBorderGradient>
                    </div>
                  </GlassCard>
                </div>
              ) : (
                children
              )}
            </GlassCard>
          </main>
        </div>
      </SessionProvider>
    </div>
  );
}

function TopNavLink({
  href,
  title,
  description,
  active
}: {
  href: Route;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "min-w-45 w-full rounded-2xl border px-5 py-4 ring-1 transition-colors " +
        (active
          ? "border-[rgba(239,127,96,0.28)] bg-(--edp-orange) text-white ring-1 ring-[rgba(239,127,96,0.26)]"
          : "border-[rgba(20,65,206,0.14)] bg-white/70 text-slate-800 ring-transparent hover:bg-white")
      }
    >
      <div className="text-lg font-semibold tracking-tight">{title}</div>
      {description ? (
        <div className={"mt-1 text-sm sm:text-base " + (active ? "text-white/90" : "text-slate-600")}>{description}</div>
      ) : null}
    </Link>
  );
}
