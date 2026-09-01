export default function CTA() {
  return (
    <section className="py-20 bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[var(--color-text)] rounded-lg p-8 md:p-12">
          <div className="max-w-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to manage your PG
              <br />
              for free?
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Join hundreds of PG owners who have switched to PGKhata. No credit
              card required. Setup in 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://app.pgkhata.com/register"
                className="bg-white text-[var(--color-text)] px-6 py-3 rounded-md text-base font-semibold hover:bg-gray-100"
                style={{ transition: "background-color 150ms ease-out" }}
              >
                Start managing your PG
              </a>
              <a
                href="#features"
                className="border border-white text-white px-6 py-3 rounded-md text-base font-semibold hover:bg-white/10"
                style={{ transition: "background-color 150ms ease-out" }}
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
