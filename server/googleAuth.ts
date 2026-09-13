import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Application, Request, Response } from "express";
import { createSessionToken } from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./_core/env";
import * as db from "./db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPES = "openid email profile";
const GOOGLE_REDIRECT_ENV = "GOOGLE_REDIRECT_URI";
const GOOGLE_STATE_TTL_MS = 30 * 60 * 1000;

class ExpiredGoogleStateError extends Error {
  constructor(readonly next: string) {
    super("انتهت صلاحية جلسة الدخول");
  }
}

function redirectUri(req: Request) {
  const configured = process.env[GOOGLE_REDIRECT_ENV]?.trim();
  if (configured) return configured;
  return `${ENV.publicUrl}/auth/google/callback`;
}

function sanitizeNext(raw: string | null | undefined) {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}

function googleConfigMissing() {
  return !ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret;
}

function createState(next: string) {
  const payload = {
    next,
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = createHmac("sha256", ENV.cookieSecret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyState(input: string) {
  const parts = input.split(".");
  if (parts.length !== 2) {
    throw new Error("رمز الحالة غير صحيح");
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = createHmac("sha256", ENV.cookieSecret)
    .update(encodedPayload)
    .digest("base64url");

  if (signature.length !== expectedSignature.length) {
    throw new Error("رمز الحالة غير صحيح");
  }

  const payloadMatches = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!payloadMatches) {
    throw new Error("رمز الحالة غير صحيح");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8")
  ) as {
    next: string;
    issuedAt: number;
    nonce: string;
  };

  if (!payload?.next || !payload.nonce || !payload.issuedAt) {
    throw new Error("بيانات الحالة غير مكتملة");
  }

  const next = sanitizeNext(payload.next);
  if (Date.now() - payload.issuedAt > GOOGLE_STATE_TTL_MS) {
    throw new ExpiredGoogleStateError(next);
  }

  return next;
}

async function exchangeGoogleCode(code: string, req: Request) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
    }),
  });

  const bodyText = await response.text();
  const payload = (bodyText ? JSON.parse(bodyText) : null) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ??
        payload?.error ??
        "تعذر تأكيد جلسة تسجيل الدخول في Google"
    );
  }

  return payload.access_token;
}

async function getGoogleUser(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  } | null;

  if (!response.ok || !payload?.sub || !payload?.email) {
    throw new Error("تعذر استرجاع معلومات المستخدم من Google");
  }

  if (payload.email_verified === false) {
    throw new Error("يرجى استخدام بريد Google موثّق");
  }

  return {
    googleSubject: payload.sub,
    name: payload.name ?? "",
    email: payload.email,
  };
}

function safeRedirect(res: Response, next = "/", message?: string) {
  const url = new URL(`${res.req.protocol}://${res.req.get("host")}/login`);
  url.searchParams.set("next", next);
  if (message) url.searchParams.set("error", message);
  return url;
}

export function attachGoogleAuthRoutes(app: Application) {
  app.get("/auth/google/start", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (googleConfigMissing()) {
      const url = safeRedirect(
        res,
        sanitizeNext(req.query.next as string | undefined)
      );
      url.searchParams.set("error", "إعداد Google OAuth غير مكتمل");
      return res.redirect(url.toString());
    }

    const next = sanitizeNext(req.query.next as string | undefined);
    const state = createState(next);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", ENV.googleClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri(req));
    authUrl.searchParams.set("scope", GOOGLE_SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("prompt", "select_account");

    res.redirect(authUrl.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const next = sanitizeNext(req.query.next as string | undefined);
    try {
      if (googleConfigMissing()) {
        throw new Error("إعداد Google OAuth غير مكتمل");
      }

      if (req.query.error) {
        throw new Error(
          req.query.error_description
            ? String(req.query.error_description)
            : "حدث خطأ أثناء تسجيل الدخول"
        );
      }

      const code = req.query.code;
      const state = req.query.state;
      if (typeof code !== "string" || !code.trim()) {
        throw new Error("رمز المصادقة مفقود");
      }
      if (typeof state !== "string" || !state) {
        throw new Error("رمز الجلسة مفقود");
      }

      const callbackNext = verifyState(state);
      const accessToken = await exchangeGoogleCode(code, req);
      const { googleSubject, name, email } = await getGoogleUser(accessToken);

      const user = await db.getOrCreateGoogleUser({
        googleSubject,
        name,
        email,
      });
      if (!user?.id) {
        throw new Error("تعذر إنشاء حساب Google");
      }

      const token = await createSessionToken(user.id);
      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      const redirectTo = sanitizeNext(callbackNext || next);
      return res.redirect(redirectTo.toString());
    } catch (error) {
      if (error instanceof ExpiredGoogleStateError) {
        const restartUrl = new URL(
          `${req.protocol}://${req.get("host")}/auth/google/start`
        );
        restartUrl.searchParams.set("next", error.next);
        return res.redirect(restartUrl.toString());
      }
      const message =
        error instanceof Error ? error.message : "تعذر تسجيل الدخول عبر Google";
      const redirectTo = safeRedirect(res, next || "/", message);
      return res.redirect(redirectTo.toString());
    }
  });
}
