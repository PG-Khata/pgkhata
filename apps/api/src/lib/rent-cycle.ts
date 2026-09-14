import { parseDateOnly } from "./due-date";

export const RENT_CYCLE_MODES = ["calendar_month", "joining_anniversary"] as const;
export type RentCycleMode = (typeof RENT_CYCLE_MODES)[number];

export interface RentPeriod {
  billable: boolean;
  start: Date;
  end: Date;
  proration: number;
}

function monthBounds(billMonth: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(billMonth);
  if (!match) throw new Error("Invalid bill month");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Invalid bill month");
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function anchoredDate(year: number, monthIndex: number, anchorDay: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(anchorDay, lastDay)));
}

/** Resolves the rent service period represented by a YYYY-MM billing bucket. */
export function resolveRentPeriod(
  joiningDate: Date | string,
  billMonth: string,
  mode: RentCycleMode,
): RentPeriod {
  const joining = parseDateOnly(joiningDate);
  const { start: monthStart, end: monthEnd } = monthBounds(billMonth);
  if (!Number.isFinite(joining.getTime()) || joining >= monthEnd) {
    return { billable: false, start: monthStart, end: monthEnd, proration: 0 };
  }

  if (mode === "calendar_month") {
    const start = joining > monthStart ? joining : monthStart;
    const monthMs = monthEnd.getTime() - monthStart.getTime();
    return {
      billable: true,
      start,
      end: monthEnd,
      proration: (monthEnd.getTime() - start.getTime()) / monthMs,
    };
  }

  const anchorDay = joining.getUTCDate();
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const start = anchoredDate(year, monthIndex, anchorDay);
  if (start < joining) {
    return { billable: false, start, end: anchoredDate(year, monthIndex + 1, anchorDay), proration: 0 };
  }
  return {
    billable: true,
    start,
    end: anchoredDate(year, monthIndex + 1, anchorDay),
    proration: 1,
  };
}
