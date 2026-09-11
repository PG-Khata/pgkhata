"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/**
 * `GET /v1/admin/search?q=` — the palette's only data source.
 *
 * The query is sent exactly as the agent typed it. The server classifies it by
 * shape (phone, email, UUID, public token, a whole pasted URL containing one,
 * otherwise a name), so any client-side "cleaning" here would destroy the
 * signal the classifier needs. Pasting a full invoice URL is the case that
 * matters most on a call, and it only works if the URL arrives intact.
 */
export interface AdminSearchResult {
  type: string;
  id: string;
  label: string;
  sublabel?: string | null;
  href: string;
  /** Every result carries its owner so one click reaches Owner 360. */
  ownerId?: string | null;
  ownerName?: string | null;
}

export interface AdminSearchGroup {
  type: string;
  results: AdminSearchResult[];
}

/**
 * The endpoint is "grouped by type" but the wire encoding of that grouping was
 * not pinned down in the contract, so this accepts the three encodings it could
 * reasonably be — a flat list, `{ groups: [...] }`, or an object keyed by type
 * — and normalises them. Anything else yields no groups rather than a crash in
 * the middle of a support call.
 */
type AdminSearchResponse =
  | AdminSearchResult[]
  | { results?: AdminSearchResult[]; groups?: AdminSearchGroup[]; interpretedAs?: string }
  | Record<string, unknown>;

/** Most-likely-intended first: a phone or a pasted link should land at the top. */
const TYPE_ORDER = ["bill", "tenant", "owner", "property", "payment"];

export const TYPE_LABELS: Record<string, string> = {
  owner: "Owners",
  property: "Properties",
  tenant: "Tenants",
  bill: "Bills",
  payment: "Payments",
};

function isResult(value: unknown): value is AdminSearchResult {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<AdminSearchResult>;
  return typeof row.id === "string" && typeof row.href === "string" && typeof row.label === "string";
}

function sortGroups(groups: AdminSearchGroup[]): AdminSearchGroup[] {
  const rank = (type: string) => {
    const i = TYPE_ORDER.indexOf(type);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  return groups.filter((g) => g.results.length > 0).sort((a, b) => rank(a.type) - rank(b.type));
}

function groupFlat(results: AdminSearchResult[]): AdminSearchGroup[] {
  const byType = new Map<string, AdminSearchResult[]>();
  for (const row of results) {
    const type = row.type ?? "result";
    const bucket = byType.get(type);
    if (bucket) bucket.push(row);
    else byType.set(type, [row]);
  }
  return sortGroups([...byType].map(([type, rows]) => ({ type, results: rows })));
}

export function normalizeSearchResponse(payload: AdminSearchResponse): AdminSearchGroup[] {
  if (Array.isArray(payload)) return groupFlat(payload.filter(isResult));
  if (typeof payload !== "object" || payload === null) return [];

  const body = payload as { results?: unknown; groups?: unknown };

  if (Array.isArray(body.groups)) {
    const groups = body.groups.flatMap((group) => {
      if (typeof group !== "object" || group === null) return [];
      const g = group as { type?: unknown; results?: unknown };
      if (!Array.isArray(g.results)) return [];
      const type = typeof g.type === "string" ? g.type : "result";
      return [{ type, results: g.results.filter(isResult) }];
    });
    return sortGroups(groups);
  }

  if (Array.isArray(body.results)) return groupFlat(body.results.filter(isResult));

  // `{ tenants: [...], bills: [...] }` — the key is the group name, and a
  // result's own `type` still wins so hrefs and labels stay authoritative.
  const groups = Object.entries(payload).flatMap(([key, value]) => {
    if (!Array.isArray(value)) return [];
    const results = value.filter(isResult);
    if (results.length === 0) return [];
    return [{ type: results[0].type ?? key.replace(/s$/, ""), results }];
  });
  return sortGroups(groups);
}

/**
 * How the server classified the query, shown in the palette footer so an agent
 * can see that a pasted invoice link was actually understood as a link rather
 * than matched as text. The API reports this as `kind`; `interpretedAs` is
 * accepted too so the palette keeps working if that ever changes.
 */
const KIND_LABEL: Record<string, string> = {
  phone: "phone number",
  email: "email address",
  uuid: "record ID",
  token: "invoice or signup link",
  text: "name",
};

function readInterpretedAs(payload: AdminSearchResponse): string | undefined {
  if (Array.isArray(payload) || typeof payload !== "object" || payload === null) return undefined;
  const body = payload as { interpretedAs?: unknown; kind?: unknown };
  if (typeof body.interpretedAs === "string") return body.interpretedAs;
  if (typeof body.kind === "string") return KIND_LABEL[body.kind];
  return undefined;
}

/** Below this a name search matches most of the database and helps nobody. */
export const MIN_SEARCH_LENGTH = 2;

export function useAdminSearch(query: string) {
  const q = query.trim();
  const enabled = q.length >= MIN_SEARCH_LENGTH;

  return useQuery({
    queryKey: ["admin", "search", q],
    queryFn: async () => {
      const payload = await api.get<AdminSearchResponse>(
        `/v1/admin/search?q=${encodeURIComponent(q)}`,
      );
      return {
        groups: normalizeSearchResponse(payload),
        interpretedAs: readInterpretedAs(payload),
      };
    },
    enabled,
    // Keeps the previous matches on screen while the next keystroke resolves,
    // so the list does not blank out under the agent's cursor.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}
