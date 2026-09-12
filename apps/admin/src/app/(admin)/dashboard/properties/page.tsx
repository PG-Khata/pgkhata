"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminProperties,
  PROPERTIES_PAGE_SIZE,
  type AdminPropertyFilters,
} from "@/hooks/use-admin-properties";
import { AdminPagination } from "@/components/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, ExternalLink, Search } from "lucide-react";

const DASH = "—";

export default function PropertiesPage() {
  const [searchDraft, setSearchDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [committed, setCommitted] = useState({ q: "", city: "", ownerId: "" });
  const [electricityMode, setElectricityMode] = useState("");
  const [hasTenants, setHasTenants] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted({
        q: searchDraft.trim(),
        city: cityDraft.trim(),
        ownerId: ownerDraft.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, cityDraft, ownerDraft]);

  const filters: AdminPropertyFilters = useMemo(
    () => ({
      q: committed.q || undefined,
      city: committed.city || undefined,
      ownerId: committed.ownerId || undefined,
      electricityMode: (electricityMode || undefined) as AdminPropertyFilters["electricityMode"],
      // Tri-state: "" means either, so it must not collapse to false.
      hasTenants: hasTenants === "" ? undefined : hasTenants === "true",
      page,
      pageSize: PROPERTIES_PAGE_SIZE,
    }),
    [committed, electricityMode, hasTenants, page],
  );

  const { data, isLoading, isFetching, isError, error } = useAdminProperties(filters);
  const properties = data?.rows ?? [];

  const hasFilters =
    !!committed.q || !!committed.city || !!committed.ownerId || !!electricityMode || !!hasTenants;

  function clearFilters() {
    setSearchDraft("");
    setCityDraft("");
    setOwnerDraft("");
    setCommitted({ q: "", city: "", ownerId: "" });
    setElectricityMode("");
    setHasTenants("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Properties</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">All properties across all owners.</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label htmlFor="property-q" className="mb-1 block text-xs text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="property-q"
              placeholder="Name, code, or city..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="property-city" className="mb-1 block text-xs text-muted-foreground">
            City
          </label>
          <Input
            id="property-city"
            placeholder="Any city"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
          />
        </div>

        <div>
          {/* Free text rather than a dropdown: there is no owner-options endpoint,
              and a select built from one page of owners would silently hide the rest.
              Support arrives with the id from the owner's detail page URL. */}
          <label htmlFor="property-owner" className="mb-1 block text-xs text-muted-foreground">
            Owner ID
          </label>
          <Input
            id="property-owner"
            placeholder="Paste an owner ID"
            value={ownerDraft}
            onChange={(e) => setOwnerDraft(e.target.value)}
            className="font-mono"
          />
        </div>

        <div>
          <label htmlFor="property-electricity" className="mb-1 block text-xs text-muted-foreground">
            Electricity
          </label>
          <select
            id="property-electricity"
            value={electricityMode}
            onChange={(e) => {
              setElectricityMode(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any mode</option>
            <option value="flat">Flat</option>
            <option value="meter">Metered</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="property-tenants" className="mb-1 block text-xs text-muted-foreground">
              Occupancy
            </label>
            <select
              id="property-tenants"
              value={hasTenants}
              onChange={(e) => {
                setHasTenants(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Has active tenants</option>
              <option value="false">No active tenants</option>
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
            {error instanceof Error ? error.message : "Could not load properties."}
          </p>
        </div>
      ) : properties.length > 0 ? (
        <div
          className={`rounded-xl border bg-card shadow-xs overflow-x-auto${isFetching ? " opacity-60 transition-opacity" : ""}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">PROPERTY</th>
                <th className="px-4 py-3 font-medium">OWNER</th>
                <th className="px-4 py-3 font-medium">LOCATION</th>
                <th className="px-4 py-3 font-medium">BEDS</th>
                <th className="px-4 py-3 font-medium">TENANTS</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.ownerName || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.city || p.address || "-"}</td>
                  <td className="px-4 py-3">
                    {/* A property with no beds really is 0/0; a payload without the
                        counts is unknown. The old `?? 0` rendered both as 0/0. */}
                    {p.totalBeds === undefined || p.occupiedBeds === undefined ? (
                      <span className="text-muted-foreground">{DASH}</span>
                    ) : (
                      <Badge variant="outline">
                        {p.occupiedBeds}/{p.totalBeds}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.activeTenants === undefined ? DASH : p.activeTenants}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/properties/${p.id}`}>
                      <Button variant="outline" size="sm">View <ExternalLink className="ml-1.5 h-3 w-3" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {hasFilters ? "No properties match these filters" : "No properties yet"}
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
        noun="properties"
      />
    </div>
  );
}
