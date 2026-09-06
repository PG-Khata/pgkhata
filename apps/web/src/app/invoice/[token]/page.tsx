"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateShort, formatMonth } from "@/lib/utils"

type PublicInvoice = { invoice: { month: string; lineItems: Array<{ code: string; name: string; amount: number }>; totalAmount: number; paidAmount: number; balance: number; status: string; dueDate?: string | null; tenantName: string; propertyName: string; roomNumber?: string | null; upiVpa?: string | null } }

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useQuery({ queryKey: ["public-invoice", token], queryFn: () => api.get<PublicInvoice>(`/public/invoice/${token}`), enabled: !!token })
  if (isLoading) return <main className="mx-auto max-w-lg p-6 text-sm text-muted-foreground">Loading invoice…</main>
  if (isError || !data) return <main className="mx-auto max-w-lg p-6"><h1 className="text-lg font-semibold">Invoice unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This link is invalid or the invoice is no longer available.</p></main>
  const { invoice } = data
  return <main className="mx-auto min-h-screen max-w-lg bg-background p-4 sm:p-8"><section className="rounded-xl border p-5 sm:p-7"><div className="flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-sm text-muted-foreground">{invoice.propertyName}</p><h1 className="mt-1 text-xl font-semibold">Monthly invoice</h1><p className="mt-1 text-sm text-muted-foreground">{formatMonth(invoice.month)} · Room {invoice.roomNumber || "—"}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">{invoice.status}</span></div><div className="py-5"><p className="font-medium">{invoice.tenantName}</p><dl className="mt-4 space-y-2 text-sm">{invoice.lineItems.map((line, i) => <div key={`${line.code}-${i}`} className="flex justify-between gap-4 text-muted-foreground"><dt>{line.name}</dt><dd className="text-foreground">{formatCurrency(line.amount)}</dd></div>)}</dl></div><div className="space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Total billed</span><span>{formatCurrency(invoice.totalAmount)}</span></div><div className="flex justify-between"><span>Paid</span><span>{formatCurrency(invoice.paidAmount)}</span></div><div className="flex justify-between text-base font-semibold"><span>Balance due</span><span>{formatCurrency(invoice.balance)}</span></div></div><div className="mt-5 border-t pt-4 text-sm text-muted-foreground"><p>Due date: {invoice.dueDate ? formatDateShort(invoice.dueDate) : "—"}</p>{invoice.upiVpa && <p className="mt-1">Pay by UPI: <span className="font-medium text-foreground">{invoice.upiVpa}</span></p>}</div></section></main>
}
