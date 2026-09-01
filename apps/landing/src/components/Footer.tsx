export default function Footer() {
  return (
    <footer className="py-12 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">
              PGKhata
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
              Free PG management software for modern PG owners.
            </p>
          </div>

          <div className="flex gap-8">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                Product
              </h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>
                  <a
                    href="#features"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
                Company
              </h4>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>
                  <a
                    href="/about"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="hover:text-[var(--color-text)]"
                    style={{ transition: "color 150ms ease-out" }}
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)]">
            2026 PGKhata. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
