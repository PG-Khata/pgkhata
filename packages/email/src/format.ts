const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Indian grouping: 242000 -> "₹2,42,000". Never "INR" or "Rs". */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Owner-supplied values (tenant and property names) reach tenant inboxes, so
 * every interpolation into an email template must be escaped.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
