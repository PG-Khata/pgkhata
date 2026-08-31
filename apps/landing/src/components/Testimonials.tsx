const testimonials = [
  {
    name: "Rahul Kumar",
    role: "PG Owner, Noida",
    content:
      "PGKhata has completely transformed how I manage my PG. The WhatsApp integration alone saves me hours every month.",
  },
  {
    name: "Priya Sharma",
    role: "PG Owner, Bangalore",
    content:
      "I was paying ₹3,600/year for another software. PGKhata does everything for free. It's incredible!",
  },
  {
    name: "Amit Patel",
    role: "PG Owner, Mumbai",
    content:
      "The police verification feature is a lifesaver. I can track all tenant verifications in one place.",
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What PG Owners Say
          </h2>
          <p className="text-xl text-gray-600">
            Trusted by PG owners across India
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white p-6 rounded-lg shadow-md"
            >
              <p className="text-gray-600 mb-4">"{testimonial.content}"</p>
              <div>
                <div className="font-semibold text-gray-900">
                  {testimonial.name}
                </div>
                <div className="text-sm text-gray-500">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
