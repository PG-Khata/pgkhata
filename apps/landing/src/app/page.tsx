import Navigation from "@/components/Navigation";
import { HeroShowcase } from "@/components/ui/smoothui/header-3";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <HeroShowcase
        heading="Stop paying for PG management"
        description="PGKhata is the only free, open-source PG management software in India. Manage properties, tenants, billing, and WhatsApp notifications, all for zero rupees."
        buttons={{
          primary: {
            text: "Start managing your PG",
            url: "https://app.pgkhata.com/register",
          },
          secondary: {
            text: "See what it does",
            url: "#features",
          },
        }}
        reviews={{
          avatars: [
            { alt: "Rahul", src: "https://api.dicebear.com/7.x/avataaars/svg?seed=rahul" },
            { alt: "Priya", src: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya" },
            { alt: "Amit", src: "https://api.dicebear.com/7.x/avataaars/svg?seed=amit" },
            { alt: "Sneha", src: "https://api.dicebear.com/7.x/avataaars/svg?seed=sneha" },
            { alt: "Vikram", src: "https://api.dicebear.com/7.x/avataaars/svg?seed=vikram" },
          ],
          count: 147,
          rating: 4.8,
        }}
      />
      <main>
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
