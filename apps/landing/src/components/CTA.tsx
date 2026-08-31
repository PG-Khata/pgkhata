export default function CTA() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
          <div className="relative text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Manage Your PG
              <br />
              for Free?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Join hundreds of PG owners who have switched to PGKhata. No credit
              card required. Setup in 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://app.pgkhata.com/register"
                className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-50 transition-all"
              >
                Get Started Free
              </a>
              <a
                href="#features"
                className="border-2 border-white text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-all"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
