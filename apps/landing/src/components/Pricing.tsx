const competitors = [
  { name: "PG Manager", price: "3,600/year", properties: "Limited" },
  { name: "My PG Manager", price: "159/month", properties: "Unlimited" },
  { name: "RentOk", price: "Custom", properties: "Limited" },
  { name: "BTRoomer", price: "Custom", properties: "Limited" },
  { name: "PG Master", price: "Custom", properties: "Limited" },
];

const includedFeatures = [
  "Unlimited properties",
  "Unlimited tenants",
  "WhatsApp integration",
  "Police verification",
  "Staff management",
  "Reports and analytics",
  "Document storage",
  "QR code signup",
  "Expense tracking",
  "Auto bill generation",
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
            100% free forever
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-lg">
            No hidden charges, no premium tiers, no per-tenant fees. Everything
            included.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* PGKhata Card */}
          <div className="bg-[var(--color-text)] rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">PGKhata</h3>
              <div className="text-5xl font-bold text-white mb-1">0</div>
              <p className="text-sm text-gray-400">rupees, forever</p>
            </div>

            <ul className="space-y-2 mb-6">
              {includedFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-400 flex-shrink-0"
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
                  <span className="text-sm text-white">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="https://app.pgkhata.com/register"
              className="block w-full bg-white text-[var(--color-text)] text-center py-3 rounded-md font-semibold hover:bg-gray-100"
              style={{ transition: "background-color 150ms ease-out" }}
            >
              Start free
            </a>
          </div>

          {/* Comparison Table */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              How we compare
            </h3>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--color-text-secondary)]">
                      Software
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--color-text-secondary)]">
                      Price
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--color-text-secondary)]">
                      Properties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-green-50 border-b border-green-200">
                    <td className="py-3 px-4 font-semibold text-green-700 text-sm">
                      PGKhata
                    </td>
                    <td className="py-3 px-4 font-bold text-green-700 text-sm" data-tabular>
                      0
                    </td>
                    <td className="py-3 px-4 text-green-700 text-sm">Unlimited</td>
                  </tr>
                  {competitors.map((competitor) => (
                    <tr
                      key={competitor.name}
                      className="border-b border-[var(--color-border)]"
                    >
                      <td className="py-3 px-4 text-[var(--color-text)] text-sm">
                        {competitor.name}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-medium text-sm" data-tabular>
                        {competitor.price}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] text-sm">
                        {competitor.properties}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Why pay 3,600 to 12,000 rupees per year when you can get everything for free?
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
