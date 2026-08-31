const stats = [
  { value: "100+", label: "Properties Managed" },
  { value: "1,000+", label: "Tenants Connected" },
  { value: "10,000+", label: "Bills Generated" },
  { value: "50,000+", label: "WhatsApp Messages Sent" },
];

export default function Stats() {
  return (
    <section className="py-16 bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
