import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import * as db from "../db";
import { ENV } from "./env";

type SessionPayload = { userId: number };

function secret() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(userId: number) {
  return new SignJWT({ userId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secret());
}

export async function authenticateRequest(req: Request) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "number") return null;
    const user = await db.getUserById(payload.userId);
    return user ? await db.ensureConfiguredAdmin(user) : null;
  } catch {
    return null;
  }
}
