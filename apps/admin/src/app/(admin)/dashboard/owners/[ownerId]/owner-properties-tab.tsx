"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2 } from "lucide-react";
import type { OwnerOverview } from "@/hooks/use-owner-overview";
import { EmptyNote, formatCount, formatPercent, LinkRow, MissingData, Panel } from "./owner-ui";

const ELECTRICITY_LABELS: Record<string, string> = {
  flat: "Flat electricity",
  metered: "Metered electricity",
  submeter: "Sub-metered electricity",
};

/**
 * The portfolio as a support agent needs it: how full each property is, and the
 * two settings that decide whether a bill can even reach a tenant — the
 * electricity mode (which drives the line items) and whether a UPI VPA exists
 * (which decides if the pay button works).
 */
export function OwnerPropertiesTab({ overview }: { overview: OwnerOverview | undefined }) {
  const portfolio = overview?.portfolio;

  return (
    <Panel title="Properties">
      {portfolio === undefined ? (
        <MissingData what="a portfolio breakdown" />
      ) : portfolio.length === 0 ? (
        <EmptyNote>This owner has not added a property yet.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {portfolio.map((property) => {
            const beds = property.beds;
            return (
              <LinkRow key={property.id} href={`/dashboard/properties/${property.id}`}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{property.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {property.city ?? "No city on file"}
                      {property.electricityMode
                        ? ` · ${ELECTRICITY_LABELS[property.electricityMode] ?? property.electricityMode}`
                        : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        {formatCount(beds?.occupied)}/{formatCount(beds?.total)} beds
                      </Badge>
                      <Badge variant="outline">{formatPercent(property.occupancyRate)} full</Badge>
                      <Badge variant="outline">
                        {formatCount(property.activeTenants)} active tenants
                      </Badge>
                      {typeof beds?.maintenance === "number" && beds.maintenance > 0 ? (
                        <Badge variant="secondary">{beds.maintenance} in maintenance</Badge>
                      ) : null}
                      {property.hasUpiVpa === false ? (
                        <Badge variant="destructive">No UPI VPA</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </LinkRow>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
