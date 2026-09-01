"use client";

import { FadeIn } from "@/components/ui/fade-in";
import { BlurIn } from "@/components/ui/blur-in";

const problems = [
  {
    title: "Messy Excel sheets",
    description:
      "Lost data, version confusion, manual updates across dozens of rooms.",
  },
  {
    title: "Chasing tenants for rent",
    description:
      "Manual follow-ups, awkward conversations, and delayed payments every month.",
  },
  {
    title: "No vacancy visibility",
    description:
      "Never sure which bed is vacant, occupied, or leaving soon.",
  },
  {
    title: "Manual bill generation",
    description:
      "Creating bills manually every month, calculating charges, and sending individually.",
  },
  {
    title: "Paying for software",
    description:
      "Spending 3,600 to 12,000 rupees per year on PG management software that should be free.",
  },
  {
    title: "No WhatsApp integration",
    description:
      "Sending reminders manually via WhatsApp, one by one, every month.",
  },
];

export default function Problems() {
  return (
    <section className="py-20 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <BlurIn delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
              Stop managing PGs
              <br />
              the hard way
            </h2>
          </BlurIn>
          <FadeIn delay={0.2} direction="up">
            <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
              Managing a PG should not feel like a full-time job. Here is what
              is broken.
            </p>
          </FadeIn>
        </div>

        {/* Icon list instead of cards */}
        <div className="space-y-4 max-w-2xl">
          {problems.map((problem, index) => (
            <FadeIn key={problem.title} delay={0.3 + index * 0.1} direction="left">
              <div className="flex gap-4 items-start">
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] mt-2 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] mb-1">
                    {problem.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {problem.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.8} direction="up">
          <div className="mt-12">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-4 py-2">
              <svg
                className="w-4 h-4 text-green-600"
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
              <span className="text-sm text-green-700 font-medium">
                PGKhata solves all this, for free
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
