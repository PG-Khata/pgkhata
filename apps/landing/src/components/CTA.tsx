"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export default function CTA() {
  return (
    <section className="py-20 bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <BlurFade delay={0.1}>
          <div className="relative bg-[var(--color-text)] rounded-lg p-8 md:p-12 overflow-hidden">
            {/* Dot pattern background */}
            <DotPattern
              className={cn(
                "absolute inset-0 opacity-10",
                "[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
              )}
            />

            <BorderBeam
              size={300}
              duration={15}
              borderWidth={2}
              colorFrom="#3b82f6"
              colorTo="#8b5cf6"
            />
            <div className="max-w-lg relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to manage your PG
                <br />
                for free?
              </h2>
              <p className="text-lg text-gray-400 mb-8">
                Join hundreds of PG owners who have switched to PGKhata. No
                credit card required. Setup in 2 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <ShimmerButton>
                  <a href="https://app.pgkhata.com/register">
                    Start managing your PG
                  </a>
                </ShimmerButton>
                <a
                  href="#features"
                  className="border border-white text-white px-6 py-3 rounded-md text-base font-semibold hover:bg-white/10"
                  style={{ transition: "background-color 150ms ease-out" }}
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
