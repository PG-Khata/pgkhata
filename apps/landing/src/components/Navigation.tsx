"use client";

import { useState, useEffect } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 ${
        scrolled
          ? "bg-[var(--color-bg)] border-b border-[var(--color-border)]"
          : "bg-transparent"
      }`}
      style={{ transition: "background-color 200ms ease-out, border-color 200ms ease-out" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="text-xl font-bold text-[var(--color-text)]">
            PGKhata
          </a>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                style={{ transition: "color 150ms ease-out" }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://app.pgkhata.com/register"
              className="bg-[var(--color-accent)] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
              style={{ transition: "background-color 150ms ease-out" }}
            >
              Start free
            </a>
          </div>

          <button
            className="md:hidden p-2 text-[var(--color-text)]"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-[var(--color-border)]">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://app.pgkhata.com/register"
                className="bg-[var(--color-accent)] text-white px-4 py-2 rounded-md text-sm font-semibold text-center"
              >
                Start free
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
