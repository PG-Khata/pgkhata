"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MIN_SEARCH_LENGTH,
  TYPE_LABELS,
  useAdminSearch,
  type AdminSearchResult,
} from "@/hooks/use-admin-search";
import {
  Building2,
  CreditCard,
  CornerDownLeft,
  Receipt,
  Search,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

const DEBOUNCE_MS = 250;

const TYPE_ICONS: Record<string, LucideIcon> = {
  owner: Users,
  property: Building2,
  tenant: User,
  bill: Receipt,
  payment: CreditCard,
};

function resultKey(result: AdminSearchResult): string {
  return `${result.type}:${result.id}`;
}

/**
 * `navigator` cannot be read during render without tripping the purity rules,
 * and reading it in an effect would mean setting state in an effect. The
 * external-store hook is the sanctioned third option: it renders the server
 * snapshot (`false`) during hydration and settles on the real value after,
 * with no mismatch and no effect.
 */
const neverChanges = () => () => {};

function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => /mac|iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );
}

function ShortcutHint({ isMac, className }: { isMac: boolean; className?: string }) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 shrink-0 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {isMac ? "⌘" : "Ctrl"} K
    </kbd>
  );
}

function ResultRow({
  id,
  result,
  active,
  onActivate,
  onHover,
}: {
  id: string;
  result: AdminSearchResult;
  active: boolean;
  onActivate: (result: AdminSearchResult) => void;
  onHover: (result: AdminSearchResult) => void;
}) {
  const Icon = TYPE_ICONS[result.type] ?? Search;
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      data-active={active || undefined}
      onClick={() => onActivate(result)}
      onPointerMove={() => onHover(result)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{result.label}</span>
        {result.sublabel ? (
          <span className="block truncate text-xs text-muted-foreground">{result.sublabel}</span>
        ) : null}
      </span>
      {result.ownerName ? (
        <span className="hidden max-w-36 shrink-0 truncate text-xs text-muted-foreground sm:block">
          {result.ownerName}
        </span>
      ) : null}
      {active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

/**
 * The palette a support agent opens while the owner is still talking. It takes
 * whatever is on the clipboard — a phone number, an email, an id, or a whole
 * invoice URL — and hands it to the API untouched: classifying the query is the
 * server's job, and trimming a pasted URL down to "what looks like a token"
 * here is exactly how the paste case would start failing silently.
 */
export function AdminSearchPalette() {
  const router = useRouter();
  const isMac = useIsApplePlatform();
  const listboxId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushNextChangeRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data, isFetching, error } = useAdminSearch(debounced);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const flat = useMemo(() => groups.flatMap((group) => group.results), [groups]);

  // Derived, not stored: when results change under the cursor the highlight
  // falls back to the first row on its own, so no effect has to reset it.
  const foundIndex = activeKey === null ? -1 : flat.findIndex((r) => resultKey(r) === activeKey);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const activeResult: AdminSearchResult | undefined = flat[activeIndex];
  const activeRowKey = activeResult ? resultKey(activeResult) : null;

  // Only tears down the pending debounce on unmount. No state is set here.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Global shortcut. The state changes happen inside the event handler, which
  // is where they belong; the effect body only wires the listener up. The reset
  // is inlined rather than shared with `handleOpenChange` so this effect needs
  // no dependencies and the listener is attached exactly once.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setQuery("");
      setDebounced("");
      setActiveKey(null);
      setOpen((previous) => !previous);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keeps the highlighted row in view during arrow-key navigation. Reads a ref
  // and touches the DOM only.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeRowKey]);

  function cancelPending() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  /** Opening and closing both start from an empty box — a half-typed phone
   *  number left over from the previous call is never what the agent wants. */
  function handleOpenChange(next: boolean) {
    cancelPending();
    setQuery("");
    setDebounced("");
    setActiveKey(null);
    setOpen(next);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    cancelPending();

    // A paste is a complete thought — a link, or a number read off a screen —
    // so it skips the debounce rather than costing the agent 250ms.
    if (flushNextChangeRef.current) {
      flushNextChangeRef.current = false;
      setDebounced(value);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDebounced(value);
    }, DEBOUNCE_MS);
  }

  function openResult(result: AdminSearchResult) {
    handleOpenChange(false);
    router.push(result.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveKey(resultKey(flat[(activeIndex + 1) % flat.length]));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveKey(resultKey(flat[(activeIndex - 1 + flat.length) % flat.length]));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeResult) openResult(activeResult);
    }
  }

  const trimmed = debounced.trim();
  const tooShort = trimmed.length < MIN_SEARCH_LENGTH;

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label="Search owners, tenants, properties and bills"
        className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:w-72"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left md:inline">Search or paste a link</span>
        <ShortcutHint isMac={isMac} className="hidden md:inline-flex" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          initialFocus={inputRef}
          className="top-[12%] max-w-[calc(100%-2rem)] -translate-y-0 gap-0 p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search the platform</DialogTitle>

          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onPaste={() => {
                flushNextChangeRef.current = true;
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-activedescendant={activeRowKey ? `${listboxId}-${activeRowKey}` : undefined}
              aria-label="Search by phone, email, name or id, or paste a link"
              placeholder="Phone, email, name, id — or paste an invoice link"
              className="h-8 border-0 bg-transparent px-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
            {isFetching ? (
              <span className="shrink-0 text-xs text-muted-foreground">Searching…</span>
            ) : null}
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            className="max-h-[min(24rem,60vh)] overflow-y-auto p-2"
          >
            {error ? (
              <p className="px-2.5 py-6 text-center text-sm text-destructive">
                {error instanceof Error ? error.message : "Search failed"}
              </p>
            ) : tooShort ? (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Paste a phone number, an email, a tenant or property name, an id — or a whole
                invoice link.
              </p>
            ) : flat.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                {isFetching ? "Searching…" : `No matches for “${trimmed}”.`}
              </p>
            ) : (
              groups.map((group) => (
                <div
                  key={group.type}
                  role="group"
                  aria-label={TYPE_LABELS[group.type] ?? group.type}
                  className="mb-1 last:mb-0"
                >
                  <p className="px-2.5 py-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    {TYPE_LABELS[group.type] ?? group.type}
                  </p>
                  {group.results.map((result) => (
                    <ResultRow
                      key={resultKey(result)}
                      id={`${listboxId}-${resultKey(result)}`}
                      result={result}
                      active={activeRowKey === resultKey(result)}
                      onActivate={openResult}
                      onHover={(r) => setActiveKey(resultKey(r))}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {data?.interpretedAs
                ? `Matched by ${data.interpretedAs}`
                : "↑ ↓ to move · ↵ to open · esc to close"}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <ShortcutHint isMac={isMac} /> to toggle
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
