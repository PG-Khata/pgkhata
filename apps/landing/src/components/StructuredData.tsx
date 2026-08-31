export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PGKhata",
    description:
      "Free PG management software for Indian PG owners. Manage properties, tenants, billing, and WhatsApp notifications.",
    url: "https://pgkhata.com",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    author: {
      "@type": "Organization",
      name: "PGKhata",
      url: "https://pgkhata.com",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "150",
    },
  };

  const localBusinessData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "PGKhata",
    description: "Free PG management software",
    url: "https://pgkhata.com",
    email: "support@pgkhata.com",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessData) }}
      />
    </>
  );
}
