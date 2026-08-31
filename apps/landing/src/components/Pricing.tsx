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
    <section id="pricing" className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-green-400">Pricing</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            100% Free Forever
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            No hidden charges, no premium tiers, no per-tenant fees. Everything
            included.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* PGKhata Card */}
          <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
            <div className="relative">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">PGKhata</h3>
                <div className="text-7xl font-bold text-white mb-2">₹0</div>
                <p className="text-blue-200">forever</p>
              </div>

              <ul className="space-y-3 mb-8">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="https://app.pgkhata.com/register"
                className="block w-full bg-white text-blue-600 text-center py-4 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
              >
                Get Started Free
              </a>
            </div>
          </div>

          {/* Comparison Table */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-6">
              How We Compare
            </h3>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">
                      Software
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">
                      Price
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">
                      Properties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-500/5 border-b border-green-500/10">
                    <td className="py-4 px-6 font-semibold text-green-400">
                      PGKhata
                    </td>
                    <td className="py-4 px-6 font-bold text-green-400">₹0</td>
                    <td className="py-4 px-6 text-green-400">Unlimited</td>
                  </tr>
                  {competitors.map((competitor) => (
                    <tr key={competitor.name} className="border-b border-white/5">
                      <td className="py-4 px-6 text-white">{competitor.name}</td>
                      <td className="py-4 px-6 text-red-400 font-medium">{competitor.price}</td>
                      <td className="py-4 px-6 text-gray-500">{competitor.properties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400 font-medium">
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
