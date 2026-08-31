const testimonials = [
  {
    name: "Rahul Kumar",
    role: "PG Owner, Noida",
    content:
      "PGKhata has completely transformed how I manage my PG. The WhatsApp integration alone saves me hours every month. I used to spend 2-3 hours daily chasing tenants for rent.",
    rating: 5,
    avatar: "RK",
  },
  {
    name: "Priya Sharma",
    role: "PG Owner, Bangalore",
    content:
      "I was paying ₹3,600/year for another software. PGKhata does everything for free. It's incredible! The police verification feature is a lifesaver for compliance.",
    rating: 5,
    avatar: "PS",
  },
  {
    name: "Amit Patel",
    role: "PG Owner, Mumbai",
    content:
      "The auto bill generation and WhatsApp reminders have reduced my rent collection time by 80%. I can now focus on growing my business instead of chasing payments.",
    rating: 5,
    avatar: "AP",
  },
  {
    name: "Sneha Reddy",
    role: "PG Owner, Hyderabad",
    content:
      "Best PG management software I've used. The dashboard gives me a clear view of all my properties. The QR code signup feature is genius for onboarding new tenants.",
    rating: 5,
    avatar: "SR",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-purple-400">Testimonials</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            What PG Owners Say
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Trusted by PG owners across India.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-400 mb-6">{testimonial.content}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
