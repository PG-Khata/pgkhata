/**
 * Selects the reading that represents a given bill month's consumption.
 *
 * Billing previously always used the *latest* reading for a room regardless
 * of which month was being billed, so generating an earlier month (a
 * back-dated run, or catching up a month that was skipped) billed whatever
 * usage happened most recently instead of that month's own usage.
 *
 * A reading's `units` already represents consumption since the previous
 * reading (computed at reading time); this just finds the one reading dated
 * within the target month.
 */
export interface ReadingCandidate {
  readingDate: Date | string;
  units: number;
}

export function readingForMonth<T extends ReadingCandidate>(
  readings: T[],
  billMonth: string,
): T | undefined {
  const matches = readings.filter((reading) => monthOf(reading.readingDate) === billMonth);
  if (matches.length === 0) return undefined;

  // Multiple readings can land in one month (e.g. a correction); the latest
  // one within the month is authoritative, mirroring how the previous
  // "always use the latest reading" behaved, but scoped to the target month.
  return matches.reduce((latest, candidate) =>
    new Date(candidate.readingDate) > new Date(latest.readingDate) ? candidate : latest,
  );
}

function monthOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
