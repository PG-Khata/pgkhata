"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { AnimatedList } from "@/components/ui/animated-list";

const features = [
  {
    name: "Multi-property management",
    description:
      "Manage multiple PG properties from a single dashboard. Track occupancy, rooms, and beds across all locations.",
    className: "lg:col-span-2",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
    ),
  },
  {
    name: "Tenant management",
    description:
      "Approval workflow, KYC documents, emergency contacts, and complete tenant lifecycle management.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
    ),
  },
  {
    name: "Auto bill generation",
    description:
      "Generate monthly bills automatically with line-item billing. Rent, electricity, and other charges calculated automatically.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
    ),
  },
  {
    name: "WhatsApp notifications",
    description:
      "Send bill notifications and payment reminders via WhatsApp automatically. No more manual follow-ups.",
    className: "lg:col-span-2",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 to-transparent" />
    ),
  },
  {
    name: "Expense tracking",
    description:
      "Track expenses with categories, approval workflow, and detailed reports. Know where your money goes.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent" />
    ),
  },
  {
    name: "Police verification",
    description:
      "Track tenant verification status for compliance. Generate police verification forms automatically.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
    ),
  },
  {
    name: "Staff management",
    description:
      "Role-based permissions and module-level access control. Manage wardens, cleaners, and other staff.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
    ),
  },
  {
    name: "Reports and analytics",
    description:
      "Dashboard with charts, due rent list, aging buckets, and profit/loss reports. Make data-driven decisions.",
    className: "lg:col-span-2",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
    ),
  },
  {
    name: "QR code signup",
    description:
      "Generate QR codes for your PG. Tenants scan to instantly open a pre-linked signup form.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent" />
    ),
  },
  {
    name: "Document storage",
    description:
      "Store KYC documents, agreements, and other files securely in the cloud with Cloudflare R2.",
    className: "lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent" />
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <BlurFade delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
              Everything you need
              <br />
              to manage your PG
            </h2>
          </BlurFade>
          <BlurFade delay={0.2}>
            <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
              All features included, no hidden charges.
            </p>
          </BlurFade>
        </div>

        <BentoGrid className="lg:grid-cols-3">
          {features.map((feature, index) => (
            <BentoCard
              key={feature.name}
              name={feature.name}
              className={feature.className}
              Icon={() => (
                <div className="w-8 h-8 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-[var(--color-accent)]"
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
                </div>
              )}
              description={feature.description}
              href={feature.href}
              cta={feature.cta}
              background={feature.background}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
