import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return "-"
  return format(d, "d MMM yyyy")
}

export function formatDateShort(date: string | Date): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return "-"
  return format(d, "d MMM")
}

export function formatMonth(month: string): string {
  // "2026-08" → "Aug 2026"
  const [year, m] = month.split("-")
  const date = new Date(parseInt(year), parseInt(m) - 1, 1)
  return format(date, "MMM yyyy")
}

export function formatPhone(phone: string): string {
  if (phone.length === 10) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`
  }
  return phone
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}
