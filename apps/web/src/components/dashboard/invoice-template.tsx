"use client"

import { formatCurrency, formatDateShort } from "@/lib/utils"
import { StatusBadge } from "@/components/dashboard/status-badge"

interface InvoiceLineItem {
  code: string
  name: string
  amount: number
}

interface InvoiceProps {
  businessName: string
  businessAddress?: string
  tenantName: string
  tenantPhone?: string
  tenantAddress?: string
  roomNumber?: string
  invoiceNo: string
  issueDate: string
  dueDate?: string | null
  billMonth: string
  lineItems: InvoiceLineItem[]
  totalAmount: number
  paidAmount: number
  balance: number
  status: string
}

export function InvoiceTemplate({
  businessName,
  businessAddress,
  tenantName,
  tenantPhone,
  tenantAddress,
  roomNumber,
  invoiceNo,
  issueDate,
  dueDate,
  billMonth,
  lineItems,
  totalAmount,
  paidAmount,
  balance,
  status,
}: InvoiceProps) {
  return (
    <div className="mx-auto bg-white p-10 text-[11px] leading-relaxed text-[#0A0A0A]" style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 595, minHeight: 842 }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[17px] font-semibold tracking-tight">{businessName}</p>
          {businessAddress && (
            <p className="mt-1 text-[10px] leading-relaxed text-[#494949]">{businessAddress}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-[#494949]">INVOICE</p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#F6F6F6] px-2.5 py-1">
            <span className="text-[9px] font-medium uppercase tracking-widest">{status}</span>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-8 flex items-start justify-between">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-widest text-[#494949]">Billed to</p>
          <p className="mt-1.5 text-[11px] font-medium">{tenantName}</p>
          <div className="mt-1 text-[10px] leading-relaxed text-[#494949]">
            {tenantPhone && <p>{tenantPhone}</p>}
            {roomNumber && <p>Room {roomNumber}</p>}
            {tenantAddress && <p>{tenantAddress}</p>}
          </div>
        </div>
        <div className="space-y-2.5 text-right">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-widest text-[#494949]">Invoice no.</p>
            <p className="mt-1 text-[11px]">{invoiceNo}</p>
          </div>
          <div>
            <p className="text-[9px] font-medium uppercase tracking-widest text-[#494949]">Issue date</p>
            <p className="mt-1 text-[11px]">{formatDateShort(issueDate)}</p>
          </div>
          <div>
            <p className="text-[9px] font-medium uppercase tracking-widest text-[#494949]">Due date</p>
            <p className="mt-1 text-[11px]">{dueDate ? formatDateShort(dueDate) : "-"}</p>
          </div>
        </div>
      </div>

      {/* Line items table */}
      <div className="mt-8">
        {/* Header */}
        <div className="flex border-b border-[#E3E3E3] pb-2">
          <p className="flex-1 text-[9px] font-medium uppercase tracking-widest text-[#494949]">Description</p>
          <p className="w-[75px] text-right text-[9px] font-medium uppercase tracking-widest text-[#494949]">Qty</p>
          <p className="w-[75px] text-right text-[9px] font-medium uppercase tracking-widest text-[#494949]">Rate</p>
          <p className="w-[75px] text-right text-[9px] font-medium uppercase tracking-widest text-[#494949]">Amount</p>
        </div>

        {/* Rows */}
        {lineItems.map((item, i) => (
          <div key={i} className="flex border-b border-[#F0F0F0] py-2.5">
            <div className="flex-1">
              <p className="text-[11px] font-medium">{item.name}</p>
              <p className="text-[10px] text-[#494949]">{item.code}</p>
            </div>
            <p className="w-[75px] text-right text-[11px]">1</p>
            <p className="w-[75px] text-right text-[11px]">{formatCurrency(item.amount)}</p>
            <p className="w-[75px] text-right text-[11px] font-medium">{formatCurrency(item.amount)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-[207px]">
          <div className="flex items-center justify-between py-2">
            <p className="text-[11px] text-[#242424]">Subtotal</p>
            <p className="text-[11px]">{formatCurrency(totalAmount)}</p>
          </div>
          {paidAmount > 0 && (
            <div className="flex items-center justify-between py-2">
              <p className="text-[11px] text-[#242424]">Paid</p>
              <p className="text-[11px] text-emerald-600">-{formatCurrency(paidAmount)}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[#0A0A0A] pt-3 pb-1">
            <p className="text-[11px] font-medium">Total due</p>
            <p className="text-[13px] font-semibold">{formatCurrency(balance)}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-[#E3E3E3] pt-4">
        <p className="text-[9px] font-medium uppercase tracking-widest text-[#494949]">Payment details</p>
        <div className="mt-2 space-y-0.5 text-[10px]">
          <div className="flex gap-3">
            <span className="w-[75px] text-[#494949]">Bill month</span>
            <span>{billMonth}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-[75px] text-[#494949]">Total</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-[75px] text-[#494949]">Balance</span>
            <span>{formatCurrency(balance)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#E3E3E3] pt-3">
        <p className="text-[9.5px] text-[#494949]">
          Thank you for your stay. For any questions, please contact the property manager.
        </p>
      </div>
    </div>
  )
}
