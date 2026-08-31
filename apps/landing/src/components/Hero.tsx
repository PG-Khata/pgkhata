export default function Hero() {
  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Free PG Management Software
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
            Manage your PG properties, tenants, and billing completely free.
            WhatsApp notifications, police verification, expense tracking, and
            more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://app.pgkhata.com/register"
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Get Started Free
            </a>
            <a
              href="#features"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors text-center"
            >
              View Features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
