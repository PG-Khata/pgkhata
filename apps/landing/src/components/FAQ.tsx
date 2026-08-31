"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How is PGKhata free?",
    answer:
      "We believe every PG owner deserves access to modern management software. Our business model is based on ecosystem services, not software fees.",
  },
  {
    question: "Is there a limit on properties or tenants?",
    answer:
      "No limits. Manage as many properties and tenants as you need, completely free.",
  },
  {
    question: "How does WhatsApp integration work?",
    answer:
      "We use the official WhatsApp Business API to send bill notifications and payment reminders to your tenants.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We use industry-standard encryption and security practices. Your data is stored securely in the cloud.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. PGKhata is a web-based application. Just open your browser and start managing your PG.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. You can export all your data to CSV format at any time.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to know about PGKhata.
          </p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="border border-gray-200 rounded-lg"
            >
              <button
                className="w-full px-6 py-4 text-left flex justify-between items-center"
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              >
                <span className="font-medium text-gray-900">
                  {faq.question}
                </span>
                <span className="text-gray-500">
                  {openIndex === index ? "-" : "+"}
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-600">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
