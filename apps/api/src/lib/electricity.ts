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
  reading: number;
}

export interface ReadingPair<T extends ReadingCandidate = ReadingCandidate> {
  first: T;
  second: T;
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

/**
 * Returns the two meter readings that define consumption for a month.
 *
 * The first reading is only a baseline; the second reading closes the
 * consumption period. Keeping the pair (rather than trusting a cached
 * `units` value) means a bill generated late still uses the same real meter
 * interval and can fairly account for a tenant who joined during it.
 */
export function readingPairForMonth<T extends ReadingCandidate>(
  readings: T[],
  billMonth: string,
): ReadingPair<T> | undefined {
  const second = readingForMonth(readings, billMonth);
  if (!second) return undefined;

  const secondTime = new Date(second.readingDate).getTime();
  const first = readings
    .filter((reading) => new Date(reading.readingDate).getTime() < secondTime)
    .reduce<T | undefined>(
      (latest, candidate) =>
        !latest || new Date(candidate.readingDate) > new Date(latest.readingDate) ? candidate : latest,
      undefined,
    );

  if (!first || second.reading < first.reading) return undefined;
  return { first, second, units: second.reading - first.reading };
}

/**
 * The share of a meter interval that a tenant occupied. The interval is
 * start-inclusive and end-exclusive, so a tenant joining on the second
 * reading date correctly receives no charge for earlier usage.
 */
export function occupiedDaysInReadingPeriod(
  joiningDate: Date | string,
  firstReadingDate: Date | string,
  secondReadingDate: Date | string,
  vacatingDate?: Date | string | null,
): number {
  const joining = new Date(joiningDate).getTime();
  const first = new Date(firstReadingDate).getTime();
  const second = new Date(secondReadingDate).getTime();
  if (!Number.isFinite(joining) || !Number.isFinite(first) || !Number.isFinite(second) || second <= first) {
    return 0;
  }

  const vacating = vacatingDate ? new Date(vacatingDate).getTime() : second;
  const occupiedEnd = Number.isFinite(vacating) ? Math.min(second, vacating) : second;
  return Math.max(0, occupiedEnd - Math.max(first, joining)) / (24 * 60 * 60 * 1000);
}

/** Integer allocation whose results always reconcile exactly to total. */
export function allocateExactAmount<T extends { key: string; weight: number }>(
  total: number,
  shares: T[],
): Map<string, number> {
  const safeTotal = Math.max(0, Math.round(total));
  const positive = shares.filter((share) => Number.isFinite(share.weight) && share.weight > 0);
  const result = new Map(shares.map((share) => [share.key, 0]));
  const totalWeight = positive.reduce((sum, share) => sum + share.weight, 0);
  if (safeTotal === 0 || totalWeight === 0) return result;

  const ranked = positive.map((share) => {
    const exact = (safeTotal * share.weight) / totalWeight;
    const base = Math.floor(exact);
    result.set(share.key, base);
    return { ...share, remainder: exact - base };
  });
  const remaining = safeTotal - [...result.values()].reduce((sum, value) => sum + value, 0);
  ranked.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  for (let index = 0; index < remaining; index += 1) {
    const share = ranked[index % ranked.length]!;
    result.set(share.key, (result.get(share.key) ?? 0) + 1);
  }
  return result;
}

/** Fraction of a calendar month's rent owed after a tenant moves in. */
export function rentProrationForMonth(joiningDate: Date | string, billMonth: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(billMonth);
  if (!match) return 1;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = Date.UTC(year, monthIndex, 1);
  const end = Date.UTC(year, monthIndex + 1, 1);
  const joining = new Date(joiningDate).getTime();
  if (!Number.isFinite(joining)) return 1;
  if (joining <= start) return 1;
  if (joining >= end) return 0;
  return (end - joining) / (end - start);
}

function monthOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
