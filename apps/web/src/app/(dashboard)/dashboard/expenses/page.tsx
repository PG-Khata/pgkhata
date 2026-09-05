"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2, Check, X } from "lucide-react"
import { useProperties } from "@/hooks/use-properties"
import {
  useExpenses,
  useExpenseSummary,
  useExpenseCategories,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useCreateExpense,
  useApproveExpense,
  useRejectExpense,
} from "@/hooks/use-expenses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/dashboard/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { ApiError } from "@/lib/api-client"

const expenseSchema = z.object({
  categoryId: z.string().min(1, "Select a category"),
  amount: z.preprocess((v) => Number(v), z.number().min(1, "Amount must be positive")),
  description: z.string().min(1, "Description is required").max(200),
  notes: z.string().optional(),
})
type ExpenseFormData = z.infer<typeof expenseSchema>

const categorySchema = z.object({ name: z.string().min(1, "Name is required").max(50) })
type CategoryFormData = z.infer<typeof categorySchema>

export default function ExpensesPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const activeProperty = propertyId || properties?.[0]?.id || ""
  const { data: expenses, isLoading } = useExpenses(activeProperty)
  const { data: summary } = useExpenseSummary(activeProperty)
  const { data: categories } = useExpenseCategories(activeProperty)
  const createExpense = useCreateExpense(activeProperty)
  const approveExpense = useApproveExpense(activeProperty)
  const rejectExpense = useRejectExpense(activeProperty)
  const createCategory = useCreateExpenseCategory(activeProperty)
  const deleteCategory = useDeleteExpenseCategory(activeProperty)

  const expenseForm = useForm<ExpenseFormData>({ resolver: zodResolver(expenseSchema) as never })
  const categoryForm = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) as never })

  function onCreateExpense(data: ExpenseFormData) {
    createExpense.mutate(data, {
      onSuccess: () => {
        toast.success("Expense recorded")
        expenseForm.reset()
        setAddOpen(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to record expense"),
    })
  }

  function onCreateCategory(data: CategoryFormData) {
    createCategory.mutate(data, {
      onSuccess: () => {
        toast.success(`${data.name} added`)
        categoryForm.reset()
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to add category"),
    })
  }

  function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category ${name}?`)) return
    deleteCategory.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to delete category"),
    })
  }

  function handleApprove(id: string) {
    approveExpense.mutate(id, {
      onSuccess: () => toast.success("Expense approved"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to approve expense"),
    })
  }

  function handleReject(id: string) {
    rejectExpense.mutate(id, {
      onSuccess: () => toast.success("Expense rejected"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to reject expense"),
    })
  }

  // Pending-first: pending expenses need a decision, so they lead; everything
  // else follows, most recent first.
  const sorted = expenses
    ? [...expenses].sort((a, b) => {
        if (a.expense.status === "pending" && b.expense.status !== "pending") return -1
        if (a.expense.status !== "pending" && b.expense.status === "pending") return 1
        return new Date(b.expense.date).getTime() - new Date(a.expense.date).getTime()
      })
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Expenses</h1>
          <p className="text-xs text-muted-foreground">
            Spend recorded against the property, approved or rejected by the owner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {properties && properties.length > 1 && (
            <select
              value={activeProperty}
              onChange={(event) => setPropertyId(event.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)} disabled={!activeProperty}>
            Categories
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!activeProperty}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Expense
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Approved spend</p>
            <p className="font-mono text-lg font-semibold">{formatCurrency(summary.total)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="font-mono text-lg font-semibold">
              {formatCurrency(summary.pendingTotal)}
            </p>
          </div>
          {summary.byCategory.slice(0, 2).map((c) => (
            <div key={c.categoryId} className="rounded-md border p-3">
              <p className="truncate text-xs text-muted-foreground">{c.categoryName}</p>
              <p className="font-mono text-lg font-semibold">{formatCurrency(c.total)}</p>
            </div>
          ))}
        </div>
      )}

      {propertiesLoading || isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !activeProperty ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Add a property first.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ expense, categoryName }) => (
                  <tr key={expense.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 font-medium">{expense.description}</td>
                    <td className="py-2.5 text-muted-foreground">{categoryName}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {formatDateShort(expense.date)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={expense.status} />
                    </td>
                    <td className="py-2.5 text-right">
                      {expense.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Approve"
                            className="h-7 w-7 text-muted-foreground hover:text-emerald-700"
                            onClick={() => handleApprove(expense.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Reject"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleReject(expense.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {sorted.map(({ expense, categoryName }) => (
              <div key={expense.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{expense.description}</span>
                  <span className="font-mono font-medium">{formatCurrency(expense.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{categoryName}</span>
                  <StatusBadge status={expense.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateShort(expense.date)}</span>
                  {expense.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Approve"
                        className="h-7 w-7 text-muted-foreground hover:text-emerald-700"
                        onClick={() => handleApprove(expense.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reject"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReject(expense.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
            <DialogDescription>Recorded as pending until approved.</DialogDescription>
          </DialogHeader>

          <form onSubmit={expenseForm.handleSubmit(onCreateExpense)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category *</label>
              <select
                {...expenseForm.register("categoryId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {expenseForm.formState.errors.categoryId && (
                <p className="text-xs text-destructive">
                  {expenseForm.formState.errors.categoryId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description *</label>
              <Input placeholder="Plumbing repair" {...expenseForm.register("description")} />
              {expenseForm.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {expenseForm.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹) *</label>
              <Input type="number" placeholder="1500" {...expenseForm.register("amount")} />
              {expenseForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {expenseForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Optional" {...expenseForm.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createExpense.isPending}>
                Record expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Expense categories</DialogTitle>
            <DialogDescription>Group spend for the summary — Maintenance, Utilities, and so on.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            {categories?.length ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span>{c.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${c.name}`}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            )}
          </div>

          <form
            onSubmit={categoryForm.handleSubmit(onCreateCategory)}
            className="flex items-end gap-2"
          >
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">New category</label>
              <Input placeholder="Utilities" {...categoryForm.register("name")} />
              {categoryForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {categoryForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={createCategory.isPending}>
              Add
            </Button>
          </form>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
