import { describe, beforeAll, it, expect } from "vitest";
import { getDb } from "./db";
import { mobileLoginTickets, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  consumeMobileTicket,
  issueMobileTicket,
  mobileDigest,
} from "./mobileAuth";
describe.skipIf(
  process.env.COMMERCE_INTEGRATION_TEST !== "1" ||
    !process.env.DATABASE_URL?.endsWith("/wjh_commerce_test")
)("mobile login handoff", () => {
  let userId: number;
  const verifier = "a".repeat(64);
  const challenge = mobileDigest(verifier);
  beforeAll(async () => {
    const result = await (await getDb())!
      .insert(users)
      .values({ openId: "mobile-login-" + Date.now(), name: "Mobile test" });
    userId = Number(result[0].insertId);
  });
  it("stores only the code hash, binds to verifier and consumes once", async () => {
    const code = await issueMobileTicket(userId, challenge);
    const [stored] = await (await getDb())!
      .select()
      .from(mobileLoginTickets)
      .where(eq(mobileLoginTickets.codeHash, mobileDigest(code)));
    expect(stored.codeHash).not.toBe(code);
    await expect(consumeMobileTicket(code, "b".repeat(64))).rejects.toThrow();
    expect(await consumeMobileTicket(code, verifier)).toBe(userId);
    await expect(consumeMobileTicket(code, verifier)).rejects.toThrow();
  });
  it("rejects expired codes and limits parallel consumption to one session", async () => {
    const expired = await issueMobileTicket(userId, challenge);
    await (await getDb())!
      .update(mobileLoginTickets)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(mobileLoginTickets.codeHash, mobileDigest(expired)));
    await expect(consumeMobileTicket(expired, verifier)).rejects.toThrow();
    const code = await issueMobileTicket(userId, challenge);
    const results = await Promise.allSettled([
      consumeMobileTicket(code, verifier),
      consumeMobileTicket(code, verifier),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
});
