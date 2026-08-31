export default function Footer() {
  return (
    <footer className="py-16 bg-[#0a0a0a] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">PGKhata</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Free PG management software for modern PG owners. Manage your
              properties, tenants, and billing completely free.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><a href="https://app.pgkhata.com" className="hover:text-white transition-colors">Login</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="/about" className="hover:text-white transition-colors">About</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li><a href="mailto:support@pgkhata.com" className="hover:text-white transition-colors">support@pgkhata.com</a></li>
              <li><a href="https://wa.me/918294495929" className="hover:text-white transition-colors">WhatsApp Support</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">2026 PGKhata. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
