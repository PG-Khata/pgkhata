const features = [
  {
    title: "Multi-Property Management",
    description: "Manage multiple PG properties from a single dashboard",
    icon: "🏢",
  },
  {
    title: "Tenant Management",
    description: "Approval workflow, KYC documents, emergency contacts",
    icon: "👥",
  },
  {
    title: "Auto Bill Generation",
    description: "Generate monthly bills with line-item billing",
    icon: "📄",
  },
  {
    title: "WhatsApp Notifications",
    description: "Send bill notifications and reminders via WhatsApp",
    icon: "💬",
  },
  {
    title: "Expense Tracking",
    description: "Track expenses with categories and approval workflow",
    icon: "💰",
  },
  {
    title: "Reports & Analytics",
    description: "Dashboard with charts, due rent list, aging buckets",
    icon: "📊",
  },
  {
    title: "Police Verification",
    description: "Track tenant verification status for compliance",
    icon: "🛡️",
  },
  {
    title: "Staff Management",
    description: "Role-based permissions and module-level access",
    icon: "👔",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Manage Your PG
          </h2>
          <p className="text-xl text-gray-600">
            All features included, no hidden charges
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
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
