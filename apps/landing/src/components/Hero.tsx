export default function Hero() {
  return (
    <section className="pt-32 pb-20 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            Trusted by 100+ PG owners across India
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
            India&apos;s Only{" "}
            <span className="text-blue-600">Free</span> PG Management
            Software
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Manage your PG properties, tenants, and billing completely free.
            WhatsApp notifications, police verification, expense tracking, and
            more.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="https://app.pgkhata.com/register"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-500/25"
            >
              Get Started Free
            </a>
            <a
              href="#features"
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all"
            >
              See Features
            </a>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 text-center">
                  <span className="text-gray-400 text-sm">
                    app.pgkhata.com
                  </span>
                </div>
              </div>
              <div className="p-8 bg-gradient-to-br from-blue-50 to-white">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-blue-600">12</div>
                    <div className="text-sm text-gray-500">Properties</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-green-600">
                      156
                    </div>
                    <div className="text-sm text-gray-500">Tenants</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-purple-600">
                      98%
                    </div>
                    <div className="text-sm text-gray-500">Rent Collected</div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      Monthly Overview
                    </span>
                    <span className="text-sm text-green-600 font-medium">
                      +12% from last month
                    </span>
                  </div>
                  <div className="h-32 bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg flex items-end justify-around p-4">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="w-8 bg-blue-500 rounded-t"
                        style={{ height: `${h}%` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-blue-200 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple-200 rounded-full blur-3xl opacity-50"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
