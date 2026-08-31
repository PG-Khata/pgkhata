const competitors = [
  { name: "PG Manager", price: "Rs.3,600/year" },
  { name: "My PG Manager", price: "Rs.159/month" },
  { name: "RentOk", price: "Custom pricing" },
  { name: "BTRoomer", price: "Custom pricing" },
  { name: "PG Master", price: "Custom pricing" },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            100% Free Forever
          </h2>
          <p className="text-lg text-gray-600">
            No hidden charges, no premium tiers, no per-tenant fees.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-blue-600 text-white p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-2">PGKhata</h3>
            <div className="text-5xl font-bold mb-4">Rs.0</div>
            <p className="text-lg mb-6">forever</p>
            <ul className="space-y-3 mb-8">
              <li>All features included</li>
              <li>Unlimited properties</li>
              <li>Unlimited tenants</li>
              <li>WhatsApp integration</li>
              <li>Police verification</li>
            </ul>
            <a
              href="https://app.pgkhata.com/register"
              className="bg-white text-blue-600 px-6 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors inline-block"
            >
              Get Started Free
            </a>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              How We Compare
            </h3>
            <div className="space-y-3">
              {competitors.map((competitor) => (
                <div
                  key={competitor.name}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-900">
                    {competitor.name}
                  </span>
                  <span className="text-red-600 font-semibold">
                    {competitor.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
