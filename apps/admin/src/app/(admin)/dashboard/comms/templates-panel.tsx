"use client";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useSyncWhatsappTemplates,
  useWhatsappTemplates,
  type TemplateApproval,
  type WhatsappTemplate,
} from "@/hooks/use-admin-comms";
import { useAdminSession } from "@/components/admin-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyNote, LoadError, Panel, PanelSkeleton, formatCount } from "./comms-ui";

const APPROVAL_ORDER: TemplateApproval[] = ["rejected", "pending", "other", "approved"];

const APPROVAL_LABELS: Record<TemplateApproval, string> = {
  rejected: "Rejected",
  pending: "Pending review",
  other: "Other state",
  approved: "Approved",
};

const APPROVAL_STYLES: Record<TemplateApproval, string> = {
  rejected: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  other: "bg-muted text-muted-foreground",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
};

/**
 * Template approval state, straight from Meta.
 *
 * Rejected first, approved last. An approved template is not news; a rejected
 * one is the most common single cause of a WhatsApp failure spike, and it is
 * invisible from inside the product until somebody looks here.
 */
export function TemplatesPanel() {
  const { role } = useAdminSession();
  const { data, isLoading, isError, error } = useWhatsappTemplates();
  const sync = useSyncWhatsappTemplates();

  const templates = data ?? [];
  const buckets = APPROVAL_ORDER.map((approval) => ({
    approval,
    items: templates.filter((t) => t.approval === approval),
  })).filter((bucket) => bucket.items.length > 0);

  function handleSync() {
    sync.mutate(undefined, {
      onSuccess: (result) => {
        // A 200 does not mean every template landed: Meta accepts some and
        // refuses others, and `success: false` arrives on a 200 when it does.
        const failed = result.results?.filter((r) => !r.success) ?? [];
        if (result.success && failed.length === 0) {
          toast.success(result.message || "Templates created");
          return;
        }
        toast.error(
          failed.length > 0
            ? `${failed.length} of ${result.results.length} failed: ${failed
                .map((r) => `${r.name} (${r.error ?? "no reason given"})`)
                .join("; ")}`
            : result.message || "Some templates failed to create",
        );
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Could not sync templates"),
    });
  }

  return (
    <Panel
      title="WhatsApp templates"
      description="Approval state as Meta reports it. A rejected template fails every message that uses it. These live on the platform's own WhatsApp Business account and are shared by every owner."
      action={
        // Cosmetic gate. `requireSuperAdminRole` on the route is the real one.
        role === "super_admin" ? (
          <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />
            {sync.isPending ? "Syncing…" : "Sync templates"}
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <PanelSkeleton rows={4} />
      ) : isError ? (
        <LoadError endpoint="GET /v1/admin/whatsapp/templates" error={error} />
      ) : templates.length === 0 ? (
        <EmptyNote>Meta returned no templates for this WhatsApp Business account.</EmptyNote>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {APPROVAL_ORDER.map((approval) => (
              <div key={approval} className="rounded-lg border p-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {APPROVAL_LABELS[approval]}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {formatCount(templates.filter((t) => t.approval === approval).length)}
                </dd>
              </div>
            ))}
          </dl>

          {buckets.map((bucket) => (
            <div key={bucket.approval}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {APPROVAL_LABELS[bucket.approval]}
              </h3>
              <ul className="space-y-1.5">
                {bucket.items.map((template) => (
                  <TemplateRow key={template.id} template={template} />
                ))}
              </ul>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Meta&apos;s rejection reason is not in this payload — the API projects id, name, status
            and category only. Open the template in Meta Business Manager to see why one was
            refused.
          </p>
        </div>
      )}
    </Panel>
  );
}

function TemplateRow({ template }: { template: WhatsappTemplate }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">{template.name}</p>
        <p className="text-xs text-muted-foreground">{template.category || "—"}</p>
      </div>
      <span
        className={cn(
          "w-fit shrink-0 rounded-4xl px-2 py-0.5 text-xs font-medium",
          APPROVAL_STYLES[template.approval],
        )}
      >
        {/* Meta's own string, not our bucket name — PAUSED and DISABLED both
            land in "other" and must stay distinguishable. */}
        {template.status || "unknown"}
      </span>
    </li>
  );
}
