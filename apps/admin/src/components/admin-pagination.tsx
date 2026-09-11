"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiPage } from "@/lib/api-client";

interface AdminPaginationProps<T> {
  /** The page the API actually returned, or `undefined` while the first load runs. */
  page: ApiPage<T> | undefined;
  /** The page number the UI is asking for; survives `page` being undefined. */
  currentPage: number;
  onPageChange: (page: number) => void;
  /** True while a page change is in flight, to stop double-advancing. */
  isFetching?: boolean;
  /** Plural noun for the summary line, e.g. "owners". */
  noun: string;
}

/**
 * Pager shared by the five platform-wide admin lists.
 *
 * `X-Total-Count` is optional on purpose: when the endpoint sends it we can say
 * "1-50 of 312" and "page 1 of 7", and when it does not we say only what
 * `X-Has-More` proves. We never divide a guessed total to fake a page count.
 */
export function AdminPagination<T>({
  page,
  currentPage,
  onPageChange,
  isFetching,
  noun,
}: AdminPaginationProps<T>) {
  const rowCount = page?.rows.length ?? 0;
  const hasMore = page?.hasMore ?? false;

  // Nothing to page through, and no page to go back to.
  if (currentPage === 1 && !hasMore) return null;

  const pageSize = page?.pageSize || rowCount;
  const total = page?.total;
  const first = (currentPage - 1) * pageSize + 1;
  const last = first + rowCount - 1;
  const pageCount =
    total !== undefined && pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {rowCount === 0 ? (
          <>No {noun} on this page</>
        ) : total !== undefined ? (
          <>
            Showing {first}&ndash;{last} of {total} {noun}
          </>
        ) : (
          <>
            Showing {rowCount} {noun}
          </>
        )}
        {" · "}
        {pageCount !== undefined ? (
          <>
            page {currentPage} of {pageCount}
          </>
        ) : (
          <>page {currentPage}</>
        )}
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || isFetching}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
