import Link from "next/link";
import Image from "next/image";

import {
  HoverBorderGradient,
  LampSectionHeader,
  CardSpotlight
} from "@/components/aceternity";

import { RandomReveal } from "@/components/motion/RandomReveal";
import { LandingHeader } from "@/components/site/LandingHeader";
import { ShowcaseSection } from "@/components/site/ShowcaseSection";

const HERO_BG =
  "https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=2400";

const FEATURE_IMPORT =
  "https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?auto=compress&cs=tinysrgb&w=1600";

const FEATURE_INSIGHTS =
  "https://images.pexels.com/photos/6802042/pexels-photo-6802042.jpeg?auto=compress&cs=tinysrgb&w=1600";

const FEATURE_ADMIN =
  "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1600";

const SLIDE_DASHBOARD =
  "https://images.pexels.com/photos/669610/pexels-photo-669610.jpeg?auto=compress&cs=tinysrgb&w=2400";
const SLIDE_RECORDS =
  "https://images.pexels.com/photos/4098220/pexels-photo-4098220.jpeg?auto=compress&cs=tinysrgb&w=2400";
const SLIDE_ADMIN =
  "https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg?auto=compress&cs=tinysrgb&w=2400";

export default function HomePage() {
  // Button text size is standardized in HoverBorderGradient; keep only layout/padding tweaks here.
  const heroDashboardCtaClassName = "px-5";
  const heroCtaRounded = "rounded-full";

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={HERO_BG}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover opacity-16 brightness-110 saturate-110"
        />
        <div aria-hidden className="absolute inset-0 bg-[rgba(248,250,252,0.92)]" />
      </div>

      <LandingHeader />

  <div className="relative mx-auto w-full max-w-screen-2xl flex-1 px-3 pb-14 pt-6 sm:px-6 sm:pb-16 sm:pt-10">

        <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch">
          <RandomReveal className="min-w-0 w-full lg:col-span-7">
            <div className="grid gap-7">
              <LampSectionHeader
                align="left"
                eyebrow="FOCUS · INSIGHTS · ACTION"
                showDivider={false}
                title={
                  <>
                    Predict with confidence.
                    <span className="mt-2 block">
                      <span className="edp-blink-2s bg-linear-to-r from-[#1441CE] via-[#EF7F60] to-[#EB615F] bg-clip-text text-transparent">
                        Understand what matters
                      </span>
                    </span>
                  </>
                }
                subtitle={
                  <>
                    Monitor progress, identify risk early, and review the factors behind each outcome.
                  </>
                }
              >
                <div className="grid gap-4">
                  <div className="flex w-full flex-col gap-3 sm:max-w-md sm:flex-row sm:items-center">
                    <Link href="/login" className="block sm:flex-1">
                      <HoverBorderGradient
                        interactive
                        className={
                          "w-full " +
                          heroDashboardCtaClassName +
                          " bg-(--edp-orange) text-white border-[rgba(239,127,96,0.25)] ring-1 ring-[rgba(239,127,96,0.20)] " +
                          "hover:shadow-[0_0_0_1px_rgba(239,127,96,0.25),0_18px_70px_rgba(239,127,96,0.26),0_14px_52px_rgba(235,97,95,0.18)]"
                        }
                        roundedClassName={heroCtaRounded}
                      >
                        Open Dashboard
                      </HoverBorderGradient>
                    </Link>
                    <Link href="/register" className="inline-flex w-fit">
                      <HoverBorderGradient
                        interactive
                        className=""
                        roundedClassName={heroCtaRounded}
                      >
                        Sign up
                      </HoverBorderGradient>
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                    {[
                      "Proactive monitoring",
                      "Explainable insights",
                      "Collaborative access",
                      "Quick onboarding"
                    ].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[rgba(20,65,206,0.14)] bg-white/70 px-4 py-1.5"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </LampSectionHeader>
            </div>
          </RandomReveal>

          <div className="min-w-0 grid gap-6 lg:col-span-5">
            <RandomReveal delay={0.05}>
            <CardSpotlight interactive={false} className="edp-float-soft h-full p-7 sm:p-8 flex flex-col">
              <div className="text-xl font-semibold text-slate-900">Get started</div>
              <div className="mt-2 text-lg leading-8 text-slate-700">A straightforward path from data to insights.</div>
              <ol className="mt-5 grid gap-3 text-lg text-slate-700">
                {[
                  "Sign up",
                  "Upload academic records",
                  "Collaborate with your team",
                  "Review predictions and key factors",
                  "Track progress over time"
                ].map((s, i) => (
                  <li key={s} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(20,65,206,0.14)] bg-white/70 text-sm font-semibold text-slate-800">
                      {i + 1}
                    </span>
                    <span className="text-slate-800">{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto pt-6 text-base text-slate-600">
                Start with a small dataset, then expand as your workflow matures.
              </div>
            </CardSpotlight>
            </RandomReveal>
          </div>
        </div>

        <RandomReveal>
        <section id="features" className="mt-14 scroll-mt-24 grid gap-8">
          <LampSectionHeader
            eyebrow="FEATURES"
            title={<>Built for education teams</>}
            subtitle={<>A focused toolkit for importing records, reviewing insights, and managing access.</>}
          />

          <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
            <RandomReveal>
            <CardSpotlight className="h-full p-7 sm:p-8 flex flex-col">
              <div className="overflow-hidden rounded-2xl border border-[rgba(20,65,206,0.14)] bg-white/70">
                <Image
                  src={FEATURE_IMPORT}
                  alt="Import academic records"
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-36 w-full object-cover brightness-110 saturate-110"
                />
              </div>
              <div className="mt-5 text-base font-semibold text-slate-900">Import records</div>
              <div className="mt-2 text-base leading-7 text-slate-700">
                Upload academic data and validate formatting before saving.
              </div>
              <div className="mt-auto pt-6 text-sm text-slate-600">Data</div>
            </CardSpotlight>
            </RandomReveal>

            <RandomReveal delay={0.05}>
            <CardSpotlight className="h-full p-7 sm:p-8 flex flex-col">
              <div className="overflow-hidden rounded-2xl border border-[rgba(20,65,206,0.14)] bg-white/70">
                <Image
                  src={FEATURE_INSIGHTS}
                  alt="Insights and drivers"
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-36 w-full object-cover brightness-110 saturate-110"
                />
              </div>
              <div className="mt-5 text-base font-semibold text-slate-900">Insights</div>
              <div className="mt-2 text-base leading-7 text-slate-700">
                Review the factors that influence outcomes to support informed decisions.
              </div>
              <div className="mt-auto pt-6 text-sm text-slate-600">Clarity</div>
            </CardSpotlight>
            </RandomReveal>

            <RandomReveal delay={0.1}>
            <CardSpotlight className="h-full p-7 sm:p-8 flex flex-col">
              <div className="overflow-hidden rounded-2xl border border-[rgba(20,65,206,0.14)] bg-white/70">
                <Image
                  src={FEATURE_ADMIN}
                  alt="Admin tools"
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-36 w-full object-cover brightness-110 saturate-110"
                />
              </div>
              <div className="mt-5 text-base font-semibold text-slate-900">Team tools</div>
              <div className="mt-2 text-base leading-7 text-slate-700">
                Manage users and roles with clear controls and audit-friendly screens.
              </div>
              <div className="mt-auto pt-6 text-sm text-slate-600">Admin</div>
            </CardSpotlight>
            </RandomReveal>
          </div>
        </section>
        </RandomReveal>

        <RandomReveal>
          <ShowcaseSection
            productSlides={[
              {
                title: "Dashboard overview",
                subtitle: "Signals, confidence, and decision-ready context",
                imageSrc: SLIDE_DASHBOARD,
                backgroundClassName: "bg-white"
              },
              {
                title: "Record explorer",
                subtitle: "Filter, review, and track updates with confidence",
                imageSrc: SLIDE_RECORDS,
                backgroundClassName: "bg-white"
              },
              {
                title: "Admin controls",
                subtitle: "Users, roles, and operational settings",
                imageSrc: SLIDE_ADMIN,
                backgroundClassName: "bg-white"
              }
            ]}
            conceptSlides={[
              {
                title: "System concept",
                subtitle: "Academic signals → risk prediction → explainable drivers",
                imageSrc: "/tour/01-concept.svg",
                backgroundClassName: "bg-white"
              },
              {
                title: "Data flow",
                subtitle: "Import, store, and predict from academic records",
                imageSrc: "/tour/02-data-flow.svg",
                backgroundClassName: "bg-white"
              },
              {
                title: "Explainability",
                subtitle: "Ranked drivers behind each prediction",
                imageSrc: "/tour/03-explainability.svg",
                backgroundClassName: "bg-white"
              },
              {
                title: "From insight to action",
                subtitle: "Use drivers to plan interventions and track progress",
                imageSrc: "/tour/04-interventions.svg",
                backgroundClassName: "bg-white"
              }
            ]}
          />
        </RandomReveal>

        <RandomReveal>
        <section id="get-started" className="mt-14 scroll-mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-[rgba(20,65,206,0.14)] bg-white/70 p-7 sm:p-9">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_15%_10%,rgba(20,65,206,0.10),transparent_62%),radial-gradient(700px_360px_at_85%_20%,rgba(239,127,96,0.12),transparent_62%)]" />
            <div className="relative">
              <div className="text-xs font-semibold tracking-[0.22em] text-slate-600">GET STARTED</div>
              <div className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Build your dataset. Review outcomes. Take action.
              </div>
              <div className="mt-4 text-base leading-7 text-slate-700 sm:text-lg">
                Sign up to begin, or sign in to continue where you left off.
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/register" className="block">
                  <HoverBorderGradient interactive roundedClassName={heroCtaRounded}>
                    Sign up
                  </HoverBorderGradient>
                </Link>
                <Link href="/login" className="block">
                  <HoverBorderGradient
                    interactive
                    className={
                      "h-14 px-8 text-xl font-semibold bg-[rgba(239,127,96,0.95)] text-white " +
                      "border-[rgba(239,127,96,0.25)] ring-1 ring-[rgba(239,127,96,0.20)] " +
                      "hover:shadow-[0_0_0_1px_rgba(239,127,96,0.25),0_18px_70px_rgba(239,127,96,0.26),0_14px_52px_rgba(235,97,95,0.18)]"
                    }
                    roundedClassName={heroCtaRounded}
                  >
                    Sign in
                  </HoverBorderGradient>
                </Link>
              </div>
            </div>
          </div>
        </section>
        </RandomReveal>

      </div>
    </main>
  );
}
