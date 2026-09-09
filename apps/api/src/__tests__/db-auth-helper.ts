import request from "supertest";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db, user } from "@pgkhata/db";

function isolatedIp(email: string) {
  let hash = 0;
  for (const character of email) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return `2001:db8:${(hash >>> 16).toString(16)}:${(hash & 0xffff).toString(16)}::1`;
}

export async function registerVerifiedUser(
  app: Express,
  input: { name: string; email: string; password: string },
) {
  const ip = isolatedIp(input.email);
  const signUp = await request(app)
    .post("/api/auth/sign-up/email")
    .set("x-forwarded-for", ip)
    .send(input);
  if (signUp.status !== 200) throw new Error(`Test sign-up failed with ${signUp.status}`);

  const [created] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
  if (!created) throw new Error("Test sign-up did not create a user");
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.id));

  const signIn = await request(app)
    .post("/api/auth/sign-in/email")
    .set("x-forwarded-for", ip)
    .send({ email: input.email, password: input.password });
  if (signIn.status !== 200) throw new Error(`Test sign-in failed with ${signIn.status}`);
  const cookie = signIn.headers["set-cookie"] as unknown as string[] | undefined;
  if (!cookie) throw new Error("Test sign-in did not issue a session cookie");
  return { userId: created.id, cookie, signUp };
}
