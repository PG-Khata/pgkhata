const features = [
  {
    title: "Multi-property management",
    description:
      "Manage multiple PG properties from a single dashboard. Track occupancy, rooms, and beds across all locations.",
    size: "large",
  },
  {
    title: "Tenant management",
    description:
      "Approval workflow, KYC documents, emergency contacts, and complete tenant lifecycle management.",
    size: "small",
  },
  {
    title: "Auto bill generation",
    description:
      "Generate monthly bills automatically with line-item billing. Rent, electricity, and other charges calculated automatically.",
    size: "small",
  },
  {
    title: "WhatsApp notifications",
    description:
      "Send bill notifications and payment reminders via WhatsApp automatically. No more manual follow-ups.",
    size: "medium",
  },
  {
    title: "Expense tracking",
    description:
      "Track expenses with categories, approval workflow, and detailed reports. Know where your money goes.",
    size: "medium",
  },
  {
    title: "Police verification",
    description:
      "Track tenant verification status for compliance. Generate police verification forms automatically.",
    size: "small",
  },
  {
    title: "Staff management",
    description:
      "Role-based permissions and module-level access control. Manage wardens, cleaners, and other staff.",
    size: "small",
  },
  {
    title: "Reports and analytics",
    description:
      "Dashboard with charts, due rent list, aging buckets, and profit/loss reports. Make data-driven decisions.",
    size: "large",
  },
  {
    title: "QR code signup",
    description:
      "Generate QR codes for your PG. Tenants scan to instantly open a pre-linked signup form.",
    size: "small",
  },
  {
    title: "Document storage",
    description:
      "Store KYC documents, agreements, and other files securely in the cloud with Cloudflare R2.",
    size: "small",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
            Everything you need
            <br />
            to manage your PG
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
            All features included, no hidden charges.
          </p>
        </div>

        {/* Bento grid - varied sizes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const isLarge = feature.size === "large";
            const isMedium = feature.size === "medium";

            return (
              <div
                key={feature.title}
                className={`bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-5 ${
                  isLarge ? "md:col-span-2" : ""
                } ${isMedium ? "lg:col-span-1" : ""}`}
              >
                <h3 className="text-base font-semibold text-[var(--color-text)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
