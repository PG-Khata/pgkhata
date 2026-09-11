import { Router } from "express";
import { z } from "zod";
import {
  activePlatformAdmin,
  findUserByEmail,
  setInitialPassword,
  userHasPassword,
} from "../lib/admin-provisioning";

/**
 * First-login password setup for console-created platform admins.
 *
 * Unauthenticated by necessity — the person has no session yet. It does exactly
 * one thing: let a *pre-created, still-passwordless platform admin* set their
 * first password. Nothing else is claimable through it:
 *   - the email must already resolve to an active `platform_admin`, so only
 *     accounts a super admin deliberately created can be claimed;
 *   - only while no credential exists, so it closes the moment a password is set;
 *   - never touches owner accounts.
 *
 * The residual risk is deliberate and matches the requested flow: whoever first
 * follows a handed-out admin email claims it. Blast radius is the admin emails a
 * super admin chose to create. Once claimed, further changes go through normal
 * password reset.
 */
const router = Router();

const emailSchema = z.object({ email: z.string().trim().email() });
const setPasswordSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

/**
 * Tells the login page which form to show. Answers `needsPassword: false` for
 * anything that is not a claimable admin — an ordinary admin with a password, a
 * non-admin, an unknown email — so it never reveals which emails are admins.
 */
router.post("/status", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return res.json({ needsPassword: false });

  const target = await findUserByEmail(parsed.data.email);
  if (!target) return res.json({ needsPassword: false });

  const admin = await activePlatformAdmin(target.id);
  if (!admin) return res.json({ needsPassword: false });

  const hasPassword = await userHasPassword(target.id);
  res.json({ needsPassword: !hasPassword });
});

router.post("/set-password", async (req, res) => {
  const parsed = setPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const target = await findUserByEmail(parsed.data.email);
  if (!target) return res.status(404).json({ error: "No account for that email" });

  const admin = await activePlatformAdmin(target.id);
  if (!admin) return res.status(403).json({ error: "This account cannot set a password here" });

  if (await userHasPassword(target.id)) {
    return res.status(409).json({
      error: "This account already has a password. Sign in, or reset it if you have forgotten it.",
    });
  }

  await setInitialPassword(target.id, parsed.data.password);
  res.json({ ok: true });
});

export default router;
