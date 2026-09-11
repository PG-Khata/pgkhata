export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Green-ish for success, destructive for anything the API refused or broke on. */
export function statusVariant(status: number | null): "secondary" | "destructive" | "outline" {
  if (status === null) return "outline";
  if (status >= 400) return "destructive";
  return "secondary";
}
