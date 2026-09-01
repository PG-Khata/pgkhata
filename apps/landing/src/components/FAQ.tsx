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
    <section id="faq" className="py-20 bg-[var(--color-bg)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)]">
            Everything you need to know about PGKhata.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="border border-[var(--color-border)] rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-[var(--color-surface)]"
                style={{ transition: "background-color 150ms ease-out" }}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-semibold text-[var(--color-text)] pr-4 text-sm">
                  {faq.question}
                </span>
                <svg
                  className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ transition: "transform 150ms ease-out" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-4 text-sm text-[var(--color-text-secondary)]">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
