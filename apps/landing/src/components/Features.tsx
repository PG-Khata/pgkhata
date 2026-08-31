const features = [
  {
    title: "Multi-Property Management",
    description: "Manage multiple PG properties from a single dashboard.",
  },
  {
    title: "Tenant Management",
    description: "Approval workflow, KYC documents, emergency contacts.",
  },
  {
    title: "Auto Bill Generation",
    description: "Generate monthly bills with line-item billing.",
  },
  {
    title: "WhatsApp Notifications",
    description: "Send bill notifications and reminders via WhatsApp.",
  },
  {
    title: "Expense Tracking",
    description: "Track expenses with categories and approval workflow.",
  },
  {
    title: "Reports and Analytics",
    description: "Dashboard with charts, due rent list, aging buckets.",
  },
  {
    title: "Police Verification",
    description: "Track tenant verification status for compliance.",
  },
  {
    title: "Staff Management",
    description: "Role-based permissions and module-level access.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Manage Your PG
          </h2>
          <p className="text-lg text-gray-600">
            All features included, no hidden charges.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white p-6 rounded-lg border border-gray-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
