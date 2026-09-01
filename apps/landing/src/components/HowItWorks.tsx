const steps = [
  {
    number: "01",
    title: "Sign up free",
    description: "Create your account in under 2 minutes. No credit card required.",
  },
  {
    number: "02",
    title: "Add your property",
    description: "Set up your PG with floors, rooms, and bed configurations.",
  },
  {
    number: "03",
    title: "Add tenants",
    description: "Import tenants via CSV or add them one by one. Assign rooms instantly.",
  },
  {
    number: "04",
    title: "Generate bills",
    description: "Auto-generate monthly bills with rent, electricity, and other charges.",
  },
  {
    number: "05",
    title: "Send reminders",
    description: "WhatsApp reminders sent automatically. No more manual follow-ups.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
            Get started in 5 minutes
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
            From signup to fully operational PG in minutes, not days.
          </p>
        </div>

        <div className="space-y-6 max-w-2xl">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4 items-start">
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
          ))}
        </div>
      </div>
    </section>
  );
}
