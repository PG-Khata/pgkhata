"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How is PGKhata free?",
    answer:
      "We believe every PG owner deserves access to modern management software. Our business model is based on ecosystem services, not software fees. We plan to monetize through tenant marketplace, financial services, and supplier network in the future.",
  },
  {
    question: "Is there a limit on properties or tenants?",
    answer:
      "No limits at all. Manage as many properties and tenants as you need, completely free. Whether you have 1 PG or 100, everything is included.",
  },
  {
    question: "How does WhatsApp integration work?",
    answer:
      "We use the official WhatsApp Business API to send bill notifications and payment reminders to your tenants. Messages are sent automatically based on your billing schedule.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We use industry-standard encryption and security practices. Your data is stored securely in the cloud with automatic backups. We never share your data with third parties.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. PGKhata is a web-based application that works in any modern browser. Just open your browser and start managing your PG. No app downloads needed.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. You can export all your data to CSV format at any time. This includes tenant lists, billing history, payment records, and expense reports.",
  },
  {
    question: "Do you offer support?",
    answer:
      "Yes. We offer email support for all users. Our team typically responds within 24 hours. We also have comprehensive documentation and video tutorials.",
  },
  {
    question: "Can I use it on mobile?",
    answer:
      "Yes. PGKhata is fully responsive and works great on mobile browsers. You can manage your PG from anywhere, anytime.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-orange-400">FAQ</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-400">
            Everything you need to know about PGKhata.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-white/[0.05] transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-semibold text-white pr-4">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-400">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
