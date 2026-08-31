"use client";

import { useEffect, useState } from "react";

const stats = [
  { label: "Properties", value: 156, suffix: "+" },
  { label: "Tenants", value: 2400, suffix: "+" },
  { label: "Bills Generated", value: 15000, suffix: "+" },
  { label: "Collection Rate", value: 98, suffix: "%" },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0a]">
      {/* Background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm text-gray-400">
                Trusted by 156+ PG owners across India
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              Stop paying for
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                PG management
              </span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-lg leading-relaxed">
              PGKhata is the only free, open-source PG management software in
              India. Manage properties, tenants, billing, and WhatsApp
              notifications — all for ₹0.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <a
                href="https://app.pgkhata.com/register"
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl overflow-hidden transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]"
              >
                <span className="relative z-10">Get Started Free</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              >
                See Features
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-white mb-1">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Product Preview */}
          <div className="relative">
            {/* Browser chrome */}
            <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 bg-white/5 rounded-md px-3 py-1">
                    <svg
                      className="w-3 h-3 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="text-xs text-gray-500">
                      app.pgkhata.com/dashboard
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 bg-[#0a0a0a]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold">
                      Good morning, Mukund
                    </h3>
                    <p className="text-sm text-gray-500">
                      Here&apos;s what&apos;s happening with your PGs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                  </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: "Total Properties",
                      value: "12",
                      change: "+2",
                      color: "blue",
                    },
                    {
                      label: "Active Tenants",
                      value: "156",
                      change: "+8",
                      color: "green",
                    },
                    {
                      label: "Rent Collected",
                      value: "₹8.4L",
                      change: "+12%",
                      color: "purple",
                    },
                    {
                      label: "Occupancy",
                      value: "94%",
                      change: "+3%",
                      color: "orange",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/5 border border-white/5 rounded-xl p-4"
                    >
                      <div className="text-2xl font-bold text-white mb-1">
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {stat.label}
                      </div>
                      <div className="text-xs text-green-400">
                        {stat.change} this month
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart area */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white">
                      Rent Collection Trend
                    </span>
                    <div className="flex gap-2">
                      {["1W", "1M", "3M", "1Y"].map((period) => (
                        <button
                          key={period}
                          className={`px-3 py-1 text-xs rounded-md ${
                            period === "1M"
                              ? "bg-blue-600 text-white"
                              : "text-gray-500 hover:text-white"
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-48 flex items-end justify-between gap-2">
                    {[65, 78, 52, 89, 72, 95, 68, 82, 91, 76, 88, 94].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="text-sm font-medium text-white mb-3">
                    Recent Activity
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        name: "Rahul Kumar",
                        action: "paid rent",
                        amount: "₹8,000",
                        time: "2 hours ago",
                      },
                      {
                        name: "Priya Sharma",
                        action: "checked in",
                        amount: "",
                        time: "5 hours ago",
                      },
                      {
                        name: "Amit Patel",
                        action: "raised complaint",
                        amount: "",
                        time: "1 day ago",
                      },
                    ].map((activity, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs text-blue-400">
                            {activity.name[0]}
                          </div>
                          <div>
                            <span className="text-sm text-white">
                              {activity.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {" "}
                              {activity.action}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          {activity.amount && (
                            <div className="text-sm font-medium text-green-400">
                              {activity.amount}
                            </div>
                          )}
                          <div className="text-xs text-gray-600">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium text-green-400">
                  WhatsApp sent
                </span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-blue-400">
                  ₹8,000 received
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
