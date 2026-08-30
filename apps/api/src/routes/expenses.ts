import { Router } from "express";
import { z } from "zod";
import { db, expense, expenseCategory } from "@pgkhata/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";
import { requireProperty } from "../middleware/property";
import { param } from "../lib/http";
import { decideExpense, summarizeExpenses } from "../lib/expenses";

/** Walks a wrapped driver error's cause chain to find the Postgres SQLSTATE code. */
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as { code?: string; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

const router = Router({ mergeParams: true });

const categorySchema = z.object({ name: z.string().min(1).max(50) });

const createExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().int().min(1),
  description: z.string().min(1).max(200),
  date: z.string().transform((str) => new Date(str)).optional(),
  notes: z.string().optional(),
});

router.use(requireAuth, requireOwner, requireProperty);

async function ownedCategory(propertyId: string, categoryId: string) {
  const [c] = await db
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(and(eq(expenseCategory.id, categoryId), eq(expenseCategory.propertyId, propertyId)))
    .limit(1);
  return c;
}

// --- Categories ---

router.get("/categories", async (req: AuthenticatedRequest, res) => {
  try {
    const categories = await db
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.propertyId, req.propertyId!))
      .orderBy(expenseCategory.name);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expense categories" });
  }
});

router.post("/categories", async (req: AuthenticatedRequest, res) => {
  try {
    const body = categorySchema.parse(req.body);

    const [created] = await db
      .insert(expenseCategory)
      .values({ propertyId: req.propertyId!, name: body.name })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (pgErrorCode(error) === "23505") {
      return res.status(409).json({ error: "A category with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create expense category" });
  }
});

router.delete("/categories/:categoryId", async (req: AuthenticatedRequest, res) => {
  try {
    const categoryId = param(req, "categoryId");
    if (!(await ownedCategory(req.propertyId!, categoryId))) {
      return res.status(404).json({ error: "Category not found" });
    }

    await db.delete(expenseCategory).where(eq(expenseCategory.id, categoryId));
    res.status(204).send();
  } catch (error) {
    if (pgErrorCode(error) === "23001" || pgErrorCode(error) === "23503") {
      return res.status(409).json({ error: "This category has expenses recorded against it" });
    }
    res.status(500).json({ error: "Failed to delete expense category" });
  }
});

// --- Expenses ---

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({ expense, categoryName: expenseCategory.name })
      .from(expense)
      .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(eq(expense.propertyId, req.propertyId!))
      .orderBy(desc(expense.date));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.get("/summary", async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({
        categoryId: expense.categoryId,
        categoryName: expenseCategory.name,
        amount: expense.amount,
        status: expense.status,
        date: expense.date,
      })
      .from(expense)
      .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
      .where(eq(expense.propertyId, req.propertyId!));

    res.json(summarizeExpenses(rows));
  } catch (error) {
    res.status(500).json({ error: "Failed to build expense summary" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const body = createExpenseSchema.parse(req.body);

    if (!(await ownedCategory(req.propertyId!, body.categoryId))) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [created] = await db
      .insert(expense)
      .values({
        propertyId: req.propertyId!,
        categoryId: body.categoryId,
        amount: body.amount,
        description: body.description,
        date: body.date,
        notes: body.notes,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record expense" });
  }
});

async function decide(req: AuthenticatedRequest, res: import("express").Response, decision: "approve" | "reject") {
  try {
    const expenseId = param(req, "expenseId");

    const [row] = await db
      .select()
      .from(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.propertyId, req.propertyId!)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Expense not found" });

    const result = decideExpense(row, decision);
    if (!result.ok) {
      return res.status(409).json({ error: "This expense has already been decided" });
    }

    const [updated] = await db
      .update(expense)
      .set({
        status: result.newStatus,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(expense.id, expenseId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: `Failed to ${decision} expense` });
  }
}

router.post("/:expenseId/approve", (req: AuthenticatedRequest, res) => decide(req, res, "approve"));
router.post("/:expenseId/reject", (req: AuthenticatedRequest, res) => decide(req, res, "reject"));

export default router;
