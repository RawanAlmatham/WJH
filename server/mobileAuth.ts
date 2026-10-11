import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { Application } from "express";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { mobileLoginTickets } from "../drizzle/schema";
import { authenticateRequest, createSessionToken } from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
export const mobileDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const validMobileChallenge = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const validMobileState = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export async function issueMobileTicket(userId: number, challenge: string) {
  if (!validMobileChallenge(challenge)) throw new Error("Invalid challenge");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const code = randomBytes(32).toString("base64url");
  await db
    .delete(mobileLoginTickets)
    .where(lt(mobileLoginTickets.expiresAt, new Date()));
  await db.insert(mobileLoginTickets).values({
    codeHash: mobileDigest(code),
    userId,
    challenge,
    expiresAt: new Date(Date.now() + 90000),
  });
  return code;
}
export async function consumeMobileTicket(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[a-f0-9]{64}$/.test(verifier))
    throw new Error("Invalid ticket");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const codeHash = mobileDigest(code);
    const [ticket] = await tx
      .select()
      .from(mobileLoginTickets)
      .where(eq(mobileLoginTickets.codeHash, codeHash))
      .for("update");
    if (
      !ticket ||
      ticket.expiresAt.getTime() < Date.now() ||
      !timingSafeEqual(
        Buffer.from(ticket.challenge, "hex"),
        Buffer.from(mobileDigest(verifier), "hex")
      )
    )
      throw new Error("Invalid or expired ticket");
    await tx
      .delete(mobileLoginTickets)
      .where(eq(mobileLoginTickets.codeHash, codeHash));
    return ticket.userId;
  });
}
export function attachMobileAuthRoutes(app: Application) {
  app.get("/auth/mobile/start", (req, res) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const { challenge, state } = req.query;
    if (!validMobileChallenge(challenge) || !validMobileState(state))
      return res
        .status(400)
        .send("تعذر بدء تسجيل الدخول. افتح وجهة من التطبيق مجددًا.");
    const next =
      "/auth/mobile/complete?" + new URLSearchParams({ challenge, state });
    return res.redirect("/auth/google/start?" + new URLSearchParams({ next }));
  });
  app.get("/auth/mobile/complete", async (req, res) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const { challenge, state } = req.query;
    if (!validMobileChallenge(challenge) || !validMobileState(state))
      return res.status(400).send("جلسة غير صالحة");
    try {
      const user = await authenticateRequest(req);
      if (!user) return res.status(401).send("سجّل الدخول من التطبيق مجددًا");
      const code = await issueMobileTicket(user.id, challenge);
      return res.redirect(
        "wijha://auth?" + new URLSearchParams({ code, state })
      );
    } catch {
      return res.status(503).send("تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
    }
  });
  app.post("/auth/mobile/consume", async (req, res) => {
    const origin = req.get("origin");
    if (
      (origin && origin !== new URL(ENV.publicUrl).origin) ||
      req.get("sec-fetch-site") === "cross-site"
    )
      return res.status(403).send("مصدر غير مسموح");
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    try {
      const userId = await consumeMobileTicket(
        String(req.body?.code ?? ""),
        String(req.body?.verifier ?? "")
      );
      res.cookie(COOKIE_NAME, await createSessionToken(userId), {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      return res.redirect(303, "/");
    } catch {
      return res
        .status(401)
        .send("انتهت جلسة الدخول. ارجع إلى التطبيق وأعد المحاولة.");
    }
  });
}
