"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  Expense,
  ExpenseCategory,
  ExpenseWithCategory,
  ExpenseSummary,
} from "@/types"

export function useExpenseCategories(propertyId: string) {
  return useQuery({
    queryKey: ["expense-categories", propertyId],
    queryFn: () =>
      api.get<ExpenseCategory[]>(`/v1/properties/${propertyId}/expenses/categories`),
    enabled: !!propertyId,
  })
}

export function useExpenses(propertyId: string) {
  return useQuery({
    queryKey: ["expenses", propertyId],
    queryFn: () => api.get<ExpenseWithCategory[]>(`/v1/properties/${propertyId}/expenses`),
    enabled: !!propertyId,
  })
}

export function useExpenseSummary(propertyId: string) {
  return useQuery({
    queryKey: ["expenses", propertyId, "summary"],
    queryFn: () =>
      api.get<ExpenseSummary>(`/v1/properties/${propertyId}/expenses/summary`),
    enabled: !!propertyId,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, propertyId: string) {
  qc.invalidateQueries({ queryKey: ["expenses", propertyId] })
}

export function useCreateExpenseCategory(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<ExpenseCategory>(`/v1/properties/${propertyId}/expenses/categories`, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["expense-categories", propertyId] }),
  })
}

export function useDeleteExpenseCategory(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (categoryId: string) =>
      api.delete(`/v1/properties/${propertyId}/expenses/categories/${categoryId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["expense-categories", propertyId] }),
  })
}

export function useCreateExpense(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      categoryId: string
      amount: number
      description: string
      date?: string
      notes?: string
    }) => api.post<Expense>(`/v1/properties/${propertyId}/expenses`, data),
    onSuccess: () => invalidate(qc, propertyId),
  })
}

export function useApproveExpense(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) =>
      api.post<Expense>(`/v1/properties/${propertyId}/expenses/${expenseId}/approve`),
    onSuccess: () => invalidate(qc, propertyId),
  })
}

export function useRejectExpense(propertyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) =>
      api.post<Expense>(`/v1/properties/${propertyId}/expenses/${expenseId}/reject`),
    onSuccess: () => invalidate(qc, propertyId),
  })
}
