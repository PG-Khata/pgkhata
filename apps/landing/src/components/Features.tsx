const features = [
  {
    title: "Multi-Property Management",
    description:
      "Manage multiple PG properties from a single dashboard. Track occupancy, rooms, and beds across all locations.",
  },
  {
    title: "Tenant Management",
    description:
      "Approval workflow, KYC documents, emergency contacts, and complete tenant lifecycle management.",
  },
  {
    title: "Auto Bill Generation",
    description:
      "Generate monthly bills automatically with line-item billing. Rent, electricity, and other charges calculated automatically.",
  },
  {
    title: "WhatsApp Notifications",
    description:
      "Send bill notifications and payment reminders via WhatsApp automatically. No more manual follow-ups.",
  },
  {
    title: "Expense Tracking",
    description:
      "Track expenses with categories, approval workflow, and detailed reports. Know where your money goes.",
  },
  {
    title: "Police Verification",
    description:
      "Track tenant verification status for compliance. Generate police verification forms automatically.",
  },
  {
    title: "Staff Management",
    description:
      "Role-based permissions and module-level access control. Manage wardens, cleaners, and other staff.",
  },
  {
    title: "Reports and Analytics",
    description:
      "Dashboard with charts, due rent list, aging buckets, and profit/loss reports. Make data-driven decisions.",
  },
  {
    title: "QR Code Signup",
    description:
      "Generate QR codes for your PG. Tenants scan to instantly open a pre-linked signup form.",
  },
  {
    title: "Document Storage",
    description:
      "Store KYC documents, agreements, and other files securely in the cloud with Cloudflare R2.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Everything You Need
            <br />
            to Manage Your PG
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            All features included, no hidden charges. Manage your PG like a pro.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors"
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
