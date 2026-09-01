"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Globe } from "@/components/ui/globe";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 bg-[var(--color-bg)] overflow-hidden">
      {/* Dot pattern background */}
      <DotPattern
        className={cn(
          "[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
        )}
      />

      {/* Background globe */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] opacity-10 pointer-events-none">
        <Globe />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          {/* Left: Copy (3/5) */}
          <div className="lg:col-span-3">
            <BlurFade delay={0.1}>
              <div className="inline-flex items-center gap-2 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-full px-3 py-1 mb-6">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                <span className="text-xs font-medium text-[var(--color-accent)]">
                  Free forever
                </span>
              </div>
            </BlurFade>

            <BlurFade delay={0.2}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-text)] mb-6 leading-tight tracking-tight">
                Stop paying for
                <br />
                PG management
              </h1>
            </BlurFade>

            <BlurFade delay={0.4}>
              <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-8 max-w-lg leading-relaxed">
                PGKhata is the only free, open-source PG management software in
                India. Manage properties, tenants, billing, and WhatsApp
                notifications, all for zero rupees.
              </p>
            </BlurFade>

            <BlurFade delay={0.5}>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <ShimmerButton>
                  <a href="https://app.pgkhata.com/register">
                    Start managing your PG
                  </a>
                </ShimmerButton>
                <a
                  href="#features"
                  className="border border-[var(--color-border)] text-[var(--color-text)] px-6 py-3 rounded-md text-base font-semibold hover:bg-[var(--color-surface)]"
                  style={{ transition: "background-color 150ms ease-out" }}
                >
                  See what it does
                </a>
              </div>
            </BlurFade>

            {/* Stats */}
            <BlurFade delay={0.6}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6" data-tabular>
                {[
                  { label: "Properties", value: 147, suffix: "" },
                  { label: "Tenants", value: 2341, suffix: "" },
                  { label: "Bills sent", value: 14892, suffix: "" },
                  { label: "Collection rate", value: 97, suffix: "%" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-2xl font-bold text-[var(--color-text)] mb-1">
                      <NumberTicker value={stat.value} />
                      {stat.suffix}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>

          {/* Right: Product Preview (2/5) */}
          <BlurFade delay={0.3} className="lg:col-span-2">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-lg">
              {/* Dashboard content */}
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-[var(--color-text)] font-semibold text-sm">
                      Good morning, Mukund
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Here is what is happening with your PGs
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[var(--color-border)]" />
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Properties", value: 12, change: "+2" },
                    { label: "Tenants", value: 156, change: "+8" },
                    { label: "Collected", value: "8.4L", change: "+12%" },
                    { label: "Occupancy", value: "94%", change: "+3%" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-3"
                    >
                      <div
                        className="text-lg font-bold text-[var(--color-text)] mb-1"
                        data-tabular
                      >
                        {stat.value}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                        {stat.label}
                      </div>
                      <div className="text-xs text-green-600">{stat.change}</div>
                    </div>
                  ))}
                </div>

                {/* Chart area */}
                <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-3 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[var(--color-text)]">
                      Rent collection
                    </span>
                    <div className="flex gap-1">
                      {["1W", "1M", "3M"].map((period) => (
                        <button
                          key={period}
                          className={`px-2 py-0.5 text-xs rounded ${
                            period === "1M"
                              ? "bg-[var(--color-text)] text-white"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-32 flex items-end justify-between gap-1">
                    {[65, 78, 52, 89, 72, 95, 68, 82, 91, 76, 88, 94].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-[var(--color-text)] rounded-t opacity-80"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-3">
                  <div className="text-xs font-medium text-[var(--color-text)] mb-2">
                    Recent activity
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        name: "Rahul Kumar",
                        action: "paid rent",
                        amount: "8,000",
                        time: "2h ago",
                      },
                      {
                        name: "Priya Sharma",
                        action: "checked in",
                        amount: "",
                        time: "5h ago",
                      },
                      {
                        name: "Amit Patel",
                        action: "raised complaint",
                        amount: "",
                        time: "1d ago",
                      },
                    ].map((activity, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                            {activity.name[0]}
                          </div>
                          <div>
                            <span className="text-xs text-[var(--color-text)]">
                              {activity.name}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {" "}
                              {activity.action}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          {activity.amount && (
                            <div
                              className="text-xs font-medium text-green-600"
                              data-tabular
                            >
                              {activity.amount}
                            </div>
                          )}
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
