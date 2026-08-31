const competitors = [
  { name: "PG Manager", price: "₹3,600/year" },
  { name: "My PG Manager", price: "₹159/month" },
  { name: "RentOk", price: "Custom pricing" },
  { name: "BTRoomer", price: "Custom pricing" },
  { name: "PG Master", price: "Custom pricing" },
];

export default function Pricing() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            100% Free Forever
          </h2>
          <p className="text-xl text-gray-600">
            No hidden charges, no premium tiers, no per-tenant fees
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl shadow-xl">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">PGKhata</h3>
              <div className="text-6xl font-bold mb-4">₹0</div>
              <p className="text-xl mb-6">forever</p>
              <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  All features included
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Unlimited properties
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Unlimited tenants
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  WhatsApp integration
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Police verification
                </li>
              </ul>
              <a
                href="https://app.pgkhata.com/register"
                className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-50 transition-colors inline-block"
              >
                Get Started Free
              </a>
            </div>
          </div>
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              How We Compare
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.map((competitor) => (
                <div
                  key={competitor.name}
                  className="bg-gray-50 p-4 rounded-lg"
                >
                  <div className="font-semibold text-gray-900">
                    {competitor.name}
                  </div>
                  <div className="text-red-600 font-bold">
                    {competitor.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
