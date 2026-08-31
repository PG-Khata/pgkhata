const competitors = [
  { name: "PG Manager", price: "₹3,600/year", properties: "Limited", tenants: "Limited" },
  { name: "My PG Manager", price: "₹159/month", properties: "Unlimited", tenants: "Unlimited" },
  { name: "RentOk", price: "Custom", properties: "Limited", tenants: "Limited" },
  { name: "BTRoomer", price: "Custom", properties: "Limited", tenants: "Limited" },
  { name: "PG Master", price: "Custom", properties: "Limited", tenants: "Limited" },
];

const includedFeatures = [
  "Unlimited Properties",
  "Unlimited Tenants",
  "WhatsApp Integration",
  "Police Verification",
  "Staff Management",
  "Reports & Analytics",
  "Document Storage",
  "QR Code Signup",
  "Expense Tracking",
  "Auto Bill Generation",
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            100% Free Forever
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            No hidden charges, no premium tiers, no per-tenant fees. Everything
            included.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 rounded-2xl">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">PGKhata</h3>
              <div className="text-6xl font-bold mb-2">₹0</div>
              <p className="text-blue-200">forever</p>
            </div>

            <ul className="space-y-3 mb-8">
              {includedFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-green-300 flex-shrink-0"
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
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="https://app.pgkhata.com/register"
              className="block w-full bg-white text-blue-600 text-center py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Get Started Free
            </a>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              How We Compare
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Software
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Price
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Properties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-50 border-b border-green-200">
                    <td className="py-3 px-4 font-semibold text-green-700">
                      PGKhata
                    </td>
                    <td className="py-3 px-4 font-bold text-green-700">₹0</td>
                    <td className="py-3 px-4 text-green-700">Unlimited</td>
                  </tr>
                  {competitors.map((competitor) => (
                    <tr
                      key={competitor.name}
                      className="border-b border-gray-100"
                    >
                      <td className="py-3 px-4 text-gray-900">
                        {competitor.name}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-medium">
                        {competitor.price}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {competitor.properties}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-medium">
                Why pay ₹3,600-₹12,000/year when you can get everything for
                free?
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
