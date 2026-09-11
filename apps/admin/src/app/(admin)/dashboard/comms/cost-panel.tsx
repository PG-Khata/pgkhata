"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useDeliverySummary, type DeliveryFilters } from "@/hooks/use-admin-comms";
import { EmptyNote, LoadError, Panel, PanelSkeleton, formatCount } from "./comms-ui";

type Filters = Omit<DeliveryFilters, "page" | "pageSize">;

/**
 * What WhatsApp is costing, by owner.
 *
 * `costUnits` is one per WhatsApp template message that left the building and
 * zero for email, and Meta bills the platform for every one of them — so this
 * is an invoice line, not a vanity metric. It is presented as cost and sorted
 * by cost, because the only reason to open this panel is to find out who is
 * expensive.
 */
export function CostPanel({ filters }: { filters: Filters }) {
  const owners = useDeliverySummary("owner", filters);
  const channels = useDeliverySummary("channel", filters);

  const rows = useMemo(() => owners.data?.rows ?? [], [owners.data]);

  const maxCost = rows.reduce((max, row) => Math.max(max, row.costUnits), 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costUnits, 0);
  const totalMessages = rows.reduce((sum, row) => sum + row.messages, 0);

  return (
    <div className="space-y-4">
      <Panel
        title="WhatsApp cost by owner"
        description={
          <>
            Meta bills per template message. <code>costUnits</code> counts those; email carries no
            cost, so this column is the WhatsApp bill. Ranked by cost and honouring the filters
            above — the summary endpoint takes the same ones as the feed.
          </>
        }
      >
        {owners.isLoading ? (
          <PanelSkeleton />
        ) : owners.isError ? (
          <LoadError
            endpoint="GET /v1/admin/deliveries/summary?groupBy=owner"
            error={owners.error}
          />
        ) : rows.length === 0 ? (
          <EmptyNote>No deliveries in this window, so there is nothing to cost.</EmptyNote>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                WhatsApp conversation cost and message volume per owner
              </caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Owner
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Chargeable messages
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    All messages
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Failed
                  </th>
                  <th scope="col" className="w-32 px-3 py-2 font-medium sr-only">
                    Share of cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.key ?? `platform-${index}`}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {row.key ? (
                        <Link
                          href={`/dashboard/owners/${row.key}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <span className="truncate">{row.label ?? row.key}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </Link>
                      ) : (
                        // A null key is the platform's own traffic: OTPs and
                        // password resets, which belong to no owner.
                        <span className="text-muted-foreground">
                          Platform messages (OTP, password reset)
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">
                      {formatCount(row.costUnits)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {formatCount(row.messages)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {row.failed > 0 ? (
                        <span className="text-red-700 dark:text-red-400">
                          {formatCount(row.failed)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {/* Decorative: the number to its left is the fact. */}
                      <div aria-hidden className="h-1.5 w-full rounded-4xl bg-muted">
                        <div
                          className="h-1.5 rounded-4xl bg-primary/70"
                          style={{
                            width:
                              maxCost > 0 ? `${Math.max(2, (row.costUnits / maxCost) * 100)}%` : "0%",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total across {formatCount(rows.length)} groups</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatCount(totalCost)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatCount(totalMessages)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="By channel"
        description="Where the traffic goes, and which part of it is chargeable."
      >
        {channels.isLoading ? (
          <PanelSkeleton rows={2} />
        ) : channels.isError ? (
          <LoadError
            endpoint="GET /v1/admin/deliveries/summary?groupBy=channel"
            error={channels.error}
          />
        ) : (channels.data?.rows.length ?? 0) === 0 ? (
          <EmptyNote>No deliveries in this window.</EmptyNote>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {channels.data?.rows.map((row, index) => (
              <div key={row.key ?? `channel-${index}`} className="rounded-lg border p-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {row.label ?? "Unknown channel"}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {formatCount(row.messages)}
                </dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  {formatCount(row.failed)} failed · {formatCount(row.costUnits)} chargeable
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}
