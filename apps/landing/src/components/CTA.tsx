export default function CTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Ready to Manage Your PG for Free?
        </h2>
        <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
          Join hundreds of PG owners who have switched to PGKhata. No credit
          card required. Setup in 2 minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://app.pgkhata.com/register"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-all hover:shadow-lg"
          >
            Get Started Free
          </a>
          <a
            href="#features"
            className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white/10 transition-all"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
