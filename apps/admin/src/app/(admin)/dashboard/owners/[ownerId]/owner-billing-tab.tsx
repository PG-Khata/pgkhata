"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { OwnerOverview } from "@/hooks/use-owner-overview";
import { Field, formatMoney, formatPercent, formatRelative, MissingData, Panel } from "./owner-ui";

/**
 * The money view. Current month first — that is the bill the owner is holding
 * while they talk — then how old the unpaid balance is, because "60 days" and
 * "3 days" are two completely different conversations.
 */
export function OwnerBillingTab({
  overview,
  asOf,
}: {
  overview: OwnerOverview | undefined;
  asOf: number;
}) {
  const billing = overview?.billing;
  const aging = billing?.aging;

  const agingRows = [
    { label: "Under 30 days", value: aging?.current },
    { label: "30–59 days", value: aging?.days30 },
    { label: "60–89 days", value: aging?.days60 },
    { label: "90+ days", value: aging?.days90Plus },
  ];

  return (
    <div className="space-y-5">
      <Panel title={`Current month${billing?.month ? ` · ${billing.month}` : ""}`}>
        {!billing ? (
          <MissingData what="billing health" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Billed">
              <span className="font-mono">{formatMoney(billing.billed)}</span>
            </Field>
            <Field label="Collected">
              <span className="font-mono text-emerald-700">{formatMoney(billing.collected)}</span>
            </Field>
            <Field label="Outstanding">
              <span
                className={cn(
                  "font-mono",
                  typeof billing.outstanding === "number" &&
                    billing.outstanding > 0 &&
                    "text-red-600",
                )}
              >
                {formatMoney(billing.outstanding)}
              </span>
            </Field>
            <Field label="Collection rate">
              <span className="font-mono">{formatPercent(billing.collectionRate)}</span>
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Outstanding by age">
        {!aging ? (
          <MissingData what="ageing buckets" />
        ) : (
          <dl className="space-y-2">
            {agingRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd
                  className={cn(
                    "font-mono",
                    typeof row.value === "number" && row.value > 0 && "font-medium",
                  )}
                >
                  {formatMoney(row.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel title="Billing activity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last bill generated">{formatRelative(billing?.lastBillAt, asOf)}</Field>
          <Field label="Last payment recorded">
            {formatRelative(billing?.lastPaymentAt, asOf)}
          </Field>
        </div>
        <Link
          href="/dashboard/billing"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open the bills list
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Panel>
    </div>
  );
}
