const problems = [
  {
    title: "Messy Excel Sheets",
    description:
      "Lost data, version confusion, manual updates across dozens of rooms.",
  },
  {
    title: "Chasing Tenants for Rent",
    description:
      "Manual follow-ups, awkward conversations, and delayed payments every month.",
  },
  {
    title: "No Vacancy Visibility",
    description:
      "Never sure which bed is vacant, occupied, or leaving soon.",
  },
  {
    title: "Manual Bill Generation",
    description:
      "Creating bills manually every month, calculating charges, and sending individually.",
  },
  {
    title: "Paying for Software",
    description:
      "Spending 3,600 to 12,000 rupees per year on PG management software that should be free.",
  },
  {
    title: "No WhatsApp Integration",
    description:
      "Sending reminders manually via WhatsApp, one by one, every month.",
  },
];

export default function Problems() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Stop Managing PGs
            <br />
            the Hard Way
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Managing a PG should not feel like a full-time job. Here is what is
            broken.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {problem.title}
              </h3>
              <p className="text-gray-600">{problem.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 rounded-full px-6 py-3">
            <svg
              className="w-5 h-5 text-green-600"
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
            <span className="text-green-700 font-medium">
              PGKhata solves all this, for free
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
