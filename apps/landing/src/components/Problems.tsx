const problems = [
  {
    title: "Messy Excel Sheets",
    description:
      "Lost data, version confusion, manual updates across dozens of rooms.",
    icon: "📊",
  },
  {
    title: "Chasing Tenants for Rent",
    description:
      "Manual follow-ups, awkward conversations, and delayed payments every month.",
    icon: "💰",
  },
  {
    title: "No Vacancy Visibility",
    description:
      "Never sure which bed is vacant, occupied, or leaving soon.",
    icon: "🏠",
  },
  {
    title: "Manual Bill Generation",
    description:
      "Creating bills manually every month, calculating charges, and sending individually.",
    icon: "📄",
  },
  {
    title: "Paying for Software",
    description:
      "Spending ₹3,600-₹12,000/year on PG management software that should be free.",
    icon: "💸",
  },
  {
    title: "No WhatsApp Integration",
    description:
      "Sending reminders manually via WhatsApp, one by one, every month.",
    icon: "💬",
  },
];

export default function Problems() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-red-400">The Problem</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Stop Managing PGs
            <br />
            <span className="text-gray-500">the Hard Way</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Managing a PG shouldn&apos;t feel like a full-time job. Here&apos;s
            what&apos;s broken.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="group bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all"
            >
              <div className="text-4xl mb-4">{problem.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {problem.title}
              </h3>
              <p className="text-gray-500">{problem.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-full px-6 py-3">
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
            <span className="text-green-400 font-medium">
              PGKhata solves all this — for free
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
