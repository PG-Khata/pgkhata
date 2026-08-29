import { Router } from "express";
import { z } from "zod";
import { AuthenticatedRequest, requireAuth, requireOwner } from "../middleware/auth";

const router = Router();

// Plan definitions
const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 0,
    maxProperties: 1,
    maxRooms: 15,
    features: ["Basic billing", "Email reminders"],
  },
  growing: {
    id: "growing",
    name: "Growing",
    price: 499,
    maxProperties: 5,
    maxRooms: 40,
    features: ["WhatsApp reminders", "Reports", "CSV export"],
  },
  scale: {
    id: "scale",
    name: "Scale",
    price: 999,
    maxProperties: 15,
    maxRooms: 200,
    features: ["Priority support", "API access", "Custom branding"],
  },
};

// Get available plans
router.get("/plans", async (req, res) => {
  res.json(Object.values(PLANS));
});

// Get current subscription
router.get("/current", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  // TODO: Fetch from database
  res.json({
    plan: PLANS.starter,
    status: "active",
    expiresAt: null,
  });
});

// Create Razorpay order (placeholder)
router.post("/checkout", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { planId } = z.object({ planId: z.enum(["growing", "scale"]) }).parse(req.body);

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) return res.status(400).json({ error: "Invalid plan" });

    // TODO: Create Razorpay order
    // const order = await razorpay.orders.create({
    //   amount: plan.price * 100,
    //   currency: "INR",
    //   receipt: `plan_${req.ownerId}_${Date.now()}`,
    // });

    res.json({
      orderId: "placeholder_order_id",
      amount: plan.price,
      currency: "INR",
      plan,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

// Verify payment (placeholder)
router.post("/verify", requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId, paymentId, signature } = z
      .object({
        orderId: z.string(),
        paymentId: z.string(),
        signature: z.string(),
      })
      .parse(req.body);

    // TODO: Verify Razorpay signature
    // const isValid = verifyRazorpaySignature(orderId, paymentId, signature);

    res.json({ verified: true, message: "Payment verified" });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

export default router;
