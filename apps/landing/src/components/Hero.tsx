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
    <section className="relative min-h-screen flex items-center bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
              Stop paying for
              <br />
              PG management
            </h1>

            <p className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
              PGKhata is the only free, open-source PG management software in
              India. Manage properties, tenants, billing, and WhatsApp
              notifications, all for zero rupees.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <a
                href="https://app.pgkhata.com/register"
                className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Started Free
              </a>
              <a
                href="#features"
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                See Features
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Product Preview */}
          <div className="relative">
            {/* Browser chrome */}
            <div className="bg-gray-100 rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-200 border-b border-gray-300">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 bg-white rounded-md px-3 py-1">
                    <span className="text-xs text-gray-500">
                      app.pgkhata.com/dashboard
                    </span>
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 bg-white">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-gray-900 font-semibold">
                      Good morning, Mukund
                    </h3>
                    <p className="text-sm text-gray-500">
                      Here is what is happening with your PGs
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-300" />
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Properties", value: "12", change: "+2" },
                    { label: "Active Tenants", value: "156", change: "+8" },
                    { label: "Rent Collected", value: "8.4L", change: "+12%" },
                    { label: "Occupancy", value: "94%", change: "+3%" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {stat.label}
                      </div>
                      <div className="text-xs text-green-600">
                        {stat.change} this month
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart area */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-900">
                      Rent Collection Trend
                    </span>
                    <div className="flex gap-2">
                      {["1W", "1M", "3M", "1Y"].map((period) => (
                        <button
                          key={period}
                          className={`px-3 py-1 text-xs rounded-md ${
                            period === "1M"
                              ? "bg-gray-900 text-white"
                              : "text-gray-500 hover:text-gray-900"
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
                          className="flex-1 bg-gray-900 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-900 mb-3">
                    Recent Activity
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        name: "Rahul Kumar",
                        action: "paid rent",
                        amount: "8,000",
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
                        className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                            {activity.name[0]}
                          </div>
                          <div>
                            <span className="text-sm text-gray-900">
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
                            <div className="text-sm font-medium text-green-600">
                              {activity.amount}
                            </div>
                          )}
                          <div className="text-xs text-gray-400">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
