"use client";

import { FadeIn } from "@/components/ui/fade-in";
import { BlurIn } from "@/components/ui/blur-in";

const steps = [
  {
    number: "01",
    title: "Sign up free",
    description:
      "Create your account in under 2 minutes. No credit card required.",
  },
  {
    number: "02",
    title: "Add your property",
    description: "Set up your PG with floors, rooms, and bed configurations.",
  },
  {
    number: "03",
    title: "Add tenants",
    description:
      "Import tenants via CSV or add them one by one. Assign rooms instantly.",
  },
  {
    number: "04",
    title: "Generate bills",
    description:
      "Auto-generate monthly bills with rent, electricity, and other charges.",
  },
  {
    number: "05",
    title: "Send reminders",
    description:
      "WhatsApp reminders sent automatically. No more manual follow-ups.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <BlurIn delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
              Get started in 5 minutes
            </h2>
          </BlurIn>
          <FadeIn delay={0.2} direction="up">
            <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
              From signup to fully operational PG in minutes, not days.
            </p>
          </FadeIn>
        </div>

        <div className="space-y-6 max-w-2xl">
          {steps.map((step, index) => (
            <FadeIn
              key={step.number}
              delay={0.3 + index * 0.1}
              direction="left"
            >
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-[var(--color-text)] rounded-md flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
