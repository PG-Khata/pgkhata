"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, TriangleAlert } from "lucide-react";
import {
  useDeliverySummary,
  useFailedDeliveries,
  useWhatsappTemplates,
  DELIVERIES_PAGE_SIZE,
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  type DeliveryChannel,
  type DeliveryFilters,
  type DeliveryStatus,
} from "@/hooks/use-admin-comms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CostPanel } from "./cost-panel";
import { DeliveriesPanel } from "./deliveries-panel";
import { FailuresPanel } from "./failures-panel";
import { TemplatesPanel } from "./templates-panel";
import { formatCount } from "./comms-ui";

/**
 * Comms — deliverability.
 *
 * The console answers two questions and is laid out in that order: did the
 * message actually go out, and what is WhatsApp costing. Failures come first
 * and grouped, because the useful unit is "one Meta rejection that hit 400
 * recipients", not four hundred rows that scroll past as noise.
 */
export default function CommsPage() {
  const [channel, setChannel] = useState<DeliveryChannel | "">("");
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [sinceDate, setSinceDate] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwnerId(ownerDraft.trim());
      // The page number belongs to the old filter, not the new one. Set in the
      // debounce callback, never in the effect body.
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [ownerDraft]);

  /** Filters that apply to every panel on the page. */
  const sharedFilters = useMemo(
    () => ({
      channel: channel || undefined,
      ownerId: ownerId || undefined,
      since: sinceDate ? new Date(`${sinceDate}T00:00:00`).toISOString() : undefined,
    }),
    [channel, ownerId, sinceDate],
  );

  const feedFilters: DeliveryFilters = useMemo(
    () => ({
      ...sharedFilters,
      status: status || undefined,
      page,
      pageSize: DELIVERIES_PAGE_SIZE,
    }),
    [sharedFilters, status, page],
  );

  // Same arguments as the panels below, so React Query serves each from one
  // request rather than fetching twice.
  const failures = useFailedDeliveries(sharedFilters);
  const channelSummary = useDeliverySummary("channel", sharedFilters);
  const templates = useWhatsappTemplates();

  // `/deliveries` sends no `X-Total-Count`, so a full page means "at least
  // this many". The tile says so rather than printing the sample as a total.
  const failureRows = failures.data?.rows.length ?? null;
  const failuresCapped = failures.data?.hasMore ?? false;

  const costUnits =
    channelSummary.data?.rows.reduce((sum, row) => sum + row.costUnits, 0) ?? null;

  const rejectedTemplates = templates.data
    ? templates.data.filter((t) => t.approval === "rejected").length
    : null;

  const hasFilters = !!channel || !!ownerId || !!sinceDate || !!status;

  /**
   * Relative windows are computed here, in a click handler. `Date.now()` during
   * render is impure and two renders would disagree about where "30 days ago"
   * starts.
   */
  function selectWindow(days: number) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    setSinceDate(from.toISOString().slice(0, 10));
    setPage(1);
  }

  function clearFilters() {
    setChannel("");
    setStatus("");
    setSinceDate("");
    setOwnerDraft("");
    setOwnerId("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Comms</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Did the message actually go out, and what is WhatsApp costing. Every bill, reminder and
          OTP the platform tried to send.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HeadlineTile
          icon={TriangleAlert}
          label="Failures in window"
          value={
            failureRows === null
              ? "—"
              : failuresCapped
                ? `${formatCount(failureRows)}+`
                : formatCount(failureRows)
          }
          tone={failureRows && failureRows > 0 ? "bad" : "neutral"}
          note={
            failures.isError
              ? "deliveries endpoint unavailable"
              : failuresCapped
                ? "at least this many; the feed sends no total"
                : undefined
          }
        />
        <HeadlineTile
          icon={MessageSquare}
          label="Chargeable messages"
          value={formatCount(costUnits)}
          note={
            channelSummary.isError
              ? "summary endpoint unavailable"
              : "WhatsApp template messages Meta bills us for"
          }
        />
        <HeadlineTile
          icon={Send}
          label="Rejected templates"
          value={formatCount(rejectedTemplates)}
          tone={rejectedTemplates && rejectedTemplates > 0 ? "bad" : "neutral"}
          note={templates.isError ? "templates endpoint unavailable" : undefined}
        />
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="comms-channel" className="mb-1 block text-xs text-muted-foreground">
            Channel
          </label>
          <select
            id="comms-channel"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as DeliveryChannel | "");
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any channel</option>
            {DELIVERY_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="comms-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="comms-owner"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            placeholder="Paste an owner ID"
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="comms-since" className="mb-1 block text-xs text-muted-foreground">
            Since
          </label>
          <Input
            id="comms-since"
            type="date"
            value={sinceDate}
            onChange={(e) => {
              setSinceDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => selectWindow(7)}>
              7d
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectWindow(30)}>
              30d
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectWindow(90)}>
              90d
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!hasFilters}>
            Clear
          </Button>
        </div>

        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
          The deliveries endpoint takes a lower bound only, so there is no &ldquo;until&rdquo;
          filter to offer. An empty Since means every delivery on record.
        </p>
      </div>

      <Tabs defaultValue="failures" className="gap-4">
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          <TabsTrigger value="failures">Failures</TabsTrigger>
          <TabsTrigger value="feed">All deliveries</TabsTrigger>
          <TabsTrigger value="cost">WhatsApp cost</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="failures">
          <FailuresPanel filters={sharedFilters} />
        </TabsContent>

        <TabsContent value="feed">
          <div className="space-y-3">
            <div className="w-full sm:w-56">
              <label htmlFor="comms-status" className="mb-1 block text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="comms-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as DeliveryStatus | "");
                  setPage(1);
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">Any status</option>
                {DELIVERY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <DeliveriesPanel filters={feedFilters} page={page} onPageChange={setPage} />
          </div>
        </TabsContent>

        <TabsContent value="cost">
          <CostPanel filters={sharedFilters} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeadlineTile({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "bad";
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight${
          tone === "bad" ? " text-red-700 dark:text-red-400" : ""
        }`}
      >
        {value}
      </p>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
