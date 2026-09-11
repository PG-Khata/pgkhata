"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminOwners,
  OWNERS_PAGE_SIZE,
  type AdminOwnerFilters,
} from "@/hooks/use-admin-owners";
import { AdminPagination } from "@/components/admin-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, ExternalLink } from "lucide-react";

export default function OwnersPage() {
  // `searchDraft` is what the admin is typing; `search` is what we have
  // actually asked the API for. Debounced so a name is one request, not eight.
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      // Page reset belongs in the debounce callback, not the effect body: page 4
      // of the old result set is meaningless against the new one.
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const filters: AdminOwnerFilters = useMemo(
    () => ({
      q: search || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      order,
      page,
      pageSize: OWNERS_PAGE_SIZE,
    }),
    [search, createdFrom, createdTo, order, page],
  );

  const { data, isLoading, isFetching, isError, error } = useAdminOwners(filters);
  const owners = data?.rows ?? [];

  // `order` is excluded: sorting differently is not filtering, and an empty
  // list under a sort is still "no owners".
  const hasFilters = !!search || !!createdFrom || !!createdTo;

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setCreatedFrom("");
    setCreatedTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Owners</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All registered PG owners on the platform.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="owner-q" className="mb-1 block text-xs text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="owner-q"
              placeholder="Name, email, or phone..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="owner-from" className="mb-1 block text-xs text-muted-foreground">
              Joined from
            </label>
            <Input
              id="owner-from"
              type="date"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(e) => {
                setCreatedFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="owner-to" className="mb-1 block text-xs text-muted-foreground">
              Joined to
            </label>
            <Input
              id="owner-to"
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(e) => {
                setCreatedTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="owner-order" className="mb-1 block text-xs text-muted-foreground">
              Sort
            </label>
            <select
              id="owner-order"
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as "asc" | "desc");
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
            Clear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load owners."}
          </p>
        </div>
      ) : owners.length > 0 ? (
        <div
          className={`rounded-xl border bg-card shadow-xs${isFetching ? " opacity-60 transition-opacity" : ""}`}
        >
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">OWNER</th>
                  <th className="px-4 py-3 font-medium">EMAIL</th>
                  <th className="px-4 py-3 font-medium">PHONE</th>
                  <th className="px-4 py-3 font-medium">JOINED</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.email}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{o.phone || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/owners/${o.id}`}>
                        <Button variant="outline" size="sm">
                          View
                          <ExternalLink className="ml-1.5 h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {owners.map((o) => (
              <div key={o.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{o.name}</p>
                  <Link href={`/dashboard/owners/${o.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">{o.email}</p>
                <p className="text-sm text-muted-foreground font-mono">{o.phone || "-"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {hasFilters ? "No owners match these filters" : "No owners yet"}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      <AdminPagination
        page={data}
        currentPage={page}
        onPageChange={setPage}
        isFetching={isFetching}
        noun="owners"
      />
    </div>
  );
}
