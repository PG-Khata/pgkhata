const steps = [
  {
    number: "01",
    title: "Sign Up Free",
    description: "Create your account in under 2 minutes. No credit card required.",
  },
  {
    number: "02",
    title: "Add Your Property",
    description: "Set up your PG with floors, rooms, and bed configurations.",
  },
  {
    number: "03",
    title: "Add Tenants",
    description: "Import tenants via CSV or add them one by one. Assign rooms instantly.",
  },
  {
    number: "04",
    title: "Generate Bills",
    description: "Auto-generate monthly bills with rent, electricity, and other charges.",
  },
  {
    number: "05",
    title: "Send Reminders",
    description: "WhatsApp reminders sent automatically. No more manual follow-ups.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Get Started in 5 Minutes
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From signup to fully operational PG in minutes, not days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-blue-200 -translate-x-8"></div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
