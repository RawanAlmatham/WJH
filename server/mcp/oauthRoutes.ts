import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { authenticateRequest } from "../_core/auth";
import { ENV } from "../_core/env";
import {
  consumeAuthorizationCode,
  createAuthorizationCode,
  getOAuthClient,
  issueOAuthTokens,
  MCP_SCOPES,
  MCP_WRITE_SCOPE,
  normalizeOAuthScopes,
  registerOAuthClient,
  revokeOAuthToken,
  rotateOAuthTokens,
} from "./oauthStore";

export const MCP_RESOURCE_URL = `${ENV.publicUrl}/mcp`;
export const MCP_PROTECTED_RESOURCE_METADATA_URL = `${ENV.publicUrl}/.well-known/oauth-protected-resource/mcp`;
const OAUTH_ISSUER = ENV.publicUrl;

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  state: string;
};

type OAuthClientDescriptor = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
};

type ClientIdMetadataDocument = {
  client_id?: unknown;
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  token_endpoint_auth_methods_supported?: unknown;
};

const OPENAI_CIMD_ORIGIN = "https://chatgpt.com";
const OPENAI_CIMD_PATH =
  /^\/oauth\/(?:client|[A-Za-z0-9_-]{1,200}\/client)\.json$/;
const CLAUDE_CIMD_ORIGIN = "https://claude.ai";
const CLAUDE_CIMD_PATH = "/oauth/mcp-oauth-client-metadata";
const CLIENT_METADATA_TIMEOUT_MS = 5_000;
const OAUTH_FORM_ACTION_ORIGIN = new URL(OAUTH_ISSUER).origin;

function single(value: unknown) {
  return typeof value === "string" ? value : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isAllowedOAuthRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function isAllowedOAuthClientMetadataUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      !url.search &&
      !url.hash &&
      ((url.origin === OPENAI_CIMD_ORIGIN &&
        OPENAI_CIMD_PATH.test(url.pathname)) ||
        (url.origin === CLAUDE_CIMD_ORIGIN &&
          url.pathname === CLAUDE_CIMD_PATH))
    );
  } catch {
    return false;
  }
}

export function parseOAuthClientMetadataDocument(
  clientId: string,
  document: ClientIdMetadataDocument
): OAuthClientDescriptor {
  if (!isAllowedOAuthClientMetadataUrl(clientId))
    throw new Error("رابط تعريف عميل OAuth غير مدعوم");
  if (document.client_id !== clientId)
    throw new Error("معرّف عميل OAuth لا يطابق وثيقة التعريف");

  const redirectUris = Array.isArray(document.redirect_uris)
    ? document.redirect_uris.filter(
        (uri): uri is string => typeof uri === "string"
      )
    : [];
  if (
    !redirectUris.length ||
    redirectUris.length > 10 ||
    redirectUris.some(uri => !isAllowedOAuthRedirectUri(uri))
  )
    throw new Error("وثيقة عميل OAuth لا تحتوي رابط عودة صالحًا");

  const grantTypes = Array.isArray(document.grant_types)
    ? document.grant_types
    : [];
  const responseTypes = Array.isArray(document.response_types)
    ? document.response_types
    : [];
  const authMethods = Array.isArray(
    document.token_endpoint_auth_methods_supported
  )
    ? document.token_endpoint_auth_methods_supported
    : [document.token_endpoint_auth_method];
  if (
    !grantTypes.includes("authorization_code") ||
    !responseTypes.includes("code") ||
    !authMethods.includes("none")
  )
    throw new Error("وثيقة عميل OAuth لا تدعم Authorization Code وPKCE");

  return {
    clientId,
    clientName:
      typeof document.client_name === "string"
        ? document.client_name.trim().slice(0, 180) || "مساعد MCP"
        : "مساعد MCP",
    redirectUris,
    tokenEndpointAuthMethod: "none",
  };
}

async function resolveOAuthClient(
  clientId: string
): Promise<OAuthClientDescriptor | null> {
  const registeredClient = await getOAuthClient(clientId);
  if (registeredClient) return registeredClient;
  if (!isAllowedOAuthClientMetadataUrl(clientId)) return null;

  const response = await fetch(clientId, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(CLIENT_METADATA_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("تعذر قراءة وثيقة عميل MCP");
  return parseOAuthClientMetadataDocument(
    clientId,
    (await response.json()) as ClientIdMetadataDocument
  );
}

function oauthError(
  response: Response,
  status: number,
  error: string,
  description: string
) {
  response
    .status(status)
    .set("Cache-Control", "no-store")
    .json({ error, error_description: description });
}

function redirectWithOAuthResult(
  redirectUri: string,
  input: Record<string, string | undefined>
) {
  const url = new URL(redirectUri);
  Object.entries(input).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function validateAuthorizationRequest(
  input: Record<string, unknown>
): Promise<AuthorizationRequest> {
  if (single(input.response_type) !== "code")
    throw new Error("نوع الاستجابة المطلوب غير مدعوم");
  const clientId = single(input.client_id);
  const redirectUri = single(input.redirect_uri);
  const codeChallenge = single(input.code_challenge);
  if (!clientId || !redirectUri) throw new Error("بيانات العميل غير مكتملة");
  const client = await resolveOAuthClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri))
    throw new Error("العميل أو رابط العودة غير مسجل");
  if (single(input.code_challenge_method) !== "S256")
    throw new Error("يلزم استخدام PKCE بطريقة S256");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge))
    throw new Error("قيمة PKCE غير صالحة");
  const resource = single(input.resource) || MCP_RESOURCE_URL;
  if (resource !== MCP_RESOURCE_URL) throw new Error("عنوان مورد MCP غير صحيح");
  return {
    clientId,
    redirectUri,
    codeChallenge,
    scopes: normalizeOAuthScopes(input.scope),
    resource,
    state: single(input.state),
  };
}

function consentPage(
  input: AuthorizationRequest,
  clientName: string,
  user: {
    name: string | null;
    email: string | null;
  }
) {
  const canWrite = input.scopes.includes(MCP_WRITE_SCOPE);
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>ربط وجهة بالمساعد الذكي</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f9fc;color:#26364a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}.card{width:min(460px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 12px 40px rgba(38,54,74,.08)}.brand{color:#52769f;font-weight:800;font-size:15px}h1{font-size:24px;margin:10px 0 8px}.muted{color:#718096;font-size:14px;line-height:1.8}.box{margin:20px 0;padding:15px;border-radius:12px;background:#f6f9fc;border:1px solid #e5edf5;font-size:14px;line-height:1.8}.permissions{margin:16px 0 22px;padding:0 20px;color:#52657a;font-size:14px;line-height:2}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}button{height:44px;border-radius:10px;border:1px solid #d9e2ec;background:#fff;color:#52657a;font-size:14px;font-weight:700;cursor:pointer}.primary{background:#52769f;border-color:#52769f;color:#fff}.primary:hover{background:#46698f}
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">وجهة</div>
      <h1>ربط حسابك بالمساعد الذكي</h1>
      <p class="muted">يريد <strong>${escapeHtml(clientName)}</strong> الوصول إلى حساب وجهة باسمك.</p>
      <div class="box"><strong>${escapeHtml(user.name || "مستخدم وجهة")}</strong><br>${escapeHtml(user.email || "")}</div>
      <ul class="permissions">
        <li>قراءة اللوحات والمشاريع والمهام المتاحة لحسابك.</li>
        <li>${canWrite ? "تنفيذ الإضافة والتعديل والحذف ضمن صلاحيتك الحالية فقط." : "هذا الربط للقراءة فقط ولا يسمح بتنفيذ الإضافة أو التعديل أو الحذف."}</li>
        <li>لن يحصل المشاهد على صلاحيات الكتابة، ولن يرى العضو المشاريع المحجوبة عنه.</li>
      </ul>
      <form method="post" action="${OAUTH_FORM_ACTION_ORIGIN}/oauth/authorize">
        ${hidden("client_id", input.clientId)}
        ${hidden("redirect_uri", input.redirectUri)}
        ${hidden("response_type", "code")}
        ${hidden("code_challenge", input.codeChallenge)}
        ${hidden("code_challenge_method", "S256")}
        ${hidden("scope", input.scopes.join(" "))}
        ${hidden("resource", input.resource)}
        ${hidden("state", input.state)}
        <div class="actions">
          <button class="primary" name="decision" value="approve" type="submit">ربط الحساب</button>
          <button name="decision" value="deny" type="submit">إلغاء</button>
        </div>
      </form>
    </main>
  </body>
</html>`;
}

export function verifyPkceChallenge(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(challenge);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createOAuthRouter() {
  const router = Router();

  const authorizationMetadata = {
    issuer: OAUTH_ISSUER,
    authorization_response_iss_parameter_supported: true,
    authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
    token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
    client_id_metadata_document_supported: true,
    registration_endpoint: `${OAUTH_ISSUER}/oauth/register`,
    revocation_endpoint: `${OAUTH_ISSUER}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...MCP_SCOPES],
  };
  const protectedResourceMetadata = {
    resource: MCP_RESOURCE_URL,
    authorization_servers: [OAUTH_ISSUER],
    scopes_supported: [...MCP_SCOPES],
    resource_name: "وجهة لإدارة الأعمال",
    resource_documentation: `${OAUTH_ISSUER}/support`,
  };

  router.use((_request, response, next) => {
    response.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "WWW-Authenticate",
    });
    next();
  });

  router.get(
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/mcp",
    ],
    (_request, response) => response.json(authorizationMetadata)
  );
  router.get(
    [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
    ],
    (_request, response) => response.json(protectedResourceMetadata)
  );

  router.post("/oauth/register", async (request, response) => {
    try {
      const redirectUris: string[] = Array.isArray(request.body?.redirect_uris)
        ? (request.body.redirect_uris as unknown[]).filter(
            (uri: unknown): uri is string => typeof uri === "string"
          )
        : [];
      if (
        !redirectUris.length ||
        redirectUris.length > 10 ||
        redirectUris.some((uri: string) => !isAllowedOAuthRedirectUri(uri))
      )
        return oauthError(
          response,
          400,
          "invalid_redirect_uri",
          "يجب تسجيل رابط عودة HTTPS صالح"
        );
      const requestedMethod = single(request.body?.token_endpoint_auth_method);
      if (requestedMethod && requestedMethod !== "none")
        return oauthError(
          response,
          400,
          "invalid_client_metadata",
          "تدعم وجهة عملاء OAuth العامة باستخدام PKCE"
        );
      const client = await registerOAuthClient({
        clientName:
          single(request.body?.client_name).trim().slice(0, 180) ||
          "ChatGPT / Claude",
        redirectUris,
      });
      response.status(201).set("Cache-Control", "no-store").json(client);
    } catch (error) {
      oauthError(
        response,
        500,
        "server_error",
        error instanceof Error ? error.message : "تعذر تسجيل العميل"
      );
    }
  });

  router.get("/oauth/authorize", async (request: Request, response) => {
    try {
      const input = await validateAuthorizationRequest(request.query);
      const user = await authenticateRequest(request);
      if (!user) {
        const next = request.originalUrl.startsWith("/")
          ? request.originalUrl
          : "/oauth/authorize";
        return response.redirect(`/login?next=${encodeURIComponent(next)}`);
      }
      const client = await resolveOAuthClient(input.clientId);
      const oauthRedirectOrigin = new URL(input.redirectUri).origin;
      response
        .status(200)
        .set({
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${OAUTH_FORM_ACTION_ORIGIN} ${oauthRedirectOrigin}; base-uri 'none'; frame-ancestors 'none'`,
          "X-Frame-Options": "DENY",
        })
        .send(consentPage(input, client?.clientName ?? "مساعد ذكي", user));
    } catch (error) {
      oauthError(
        response,
        400,
        "invalid_request",
        error instanceof Error ? error.message : "طلب الربط غير صالح"
      );
    }
  });

  router.post("/oauth/authorize", async (request: Request, response) => {
    let input: AuthorizationRequest;
    try {
      input = await validateAuthorizationRequest(request.body ?? {});
    } catch (error) {
      return oauthError(
        response,
        400,
        "invalid_request",
        error instanceof Error ? error.message : "طلب الربط غير صالح"
      );
    }
    if (single(request.body?.decision) !== "approve")
      return response.redirect(
        redirectWithOAuthResult(input.redirectUri, {
          error: "access_denied",
          error_description: "ألغى المستخدم ربط حساب وجهة",
          state: input.state,
          iss: OAUTH_ISSUER,
        })
      );
    const user = await authenticateRequest(request);
    if (!user)
      return oauthError(
        response,
        401,
        "login_required",
        "انتهت جلسة وجهة. أعد بدء الربط وسجل الدخول"
      );
    try {
      const code = await createAuthorizationCode({
        userId: user.id,
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        scopes: input.scopes,
        resource: input.resource,
      });
      response.redirect(
        redirectWithOAuthResult(input.redirectUri, {
          code,
          state: input.state,
          iss: OAUTH_ISSUER,
        })
      );
    } catch (error) {
      response.redirect(
        redirectWithOAuthResult(input.redirectUri, {
          error: "server_error",
          error_description:
            error instanceof Error ? error.message : "تعذر إكمال الربط",
          state: input.state,
          iss: OAUTH_ISSUER,
        })
      );
    }
  });

  router.post("/oauth/token", async (request, response) => {
    try {
      response.set("Cache-Control", "no-store");
      const grantType = single(request.body?.grant_type);
      const clientId = single(request.body?.client_id);
      const client = clientId ? await resolveOAuthClient(clientId) : null;
      if (!client)
        return oauthError(
          response,
          401,
          "invalid_client",
          "عميل OAuth غير معروف"
        );
      if (grantType === "authorization_code") {
        const code = single(request.body?.code);
        const redirectUri = single(request.body?.redirect_uri);
        const verifier = single(request.body?.code_verifier);
        if (!code || !redirectUri || !verifier)
          return oauthError(
            response,
            400,
            "invalid_request",
            "بيانات استبدال رمز التفويض غير مكتملة"
          );
        const authorizationCode = await consumeAuthorizationCode(code);
        if (
          !authorizationCode ||
          authorizationCode.clientId !== clientId ||
          authorizationCode.redirectUri !== redirectUri ||
          !verifyPkceChallenge(verifier, authorizationCode.codeChallenge)
        )
          return oauthError(
            response,
            400,
            "invalid_grant",
            "رمز التفويض أو PKCE غير صالح"
          );
        const resource =
          single(request.body?.resource) || authorizationCode.resource;
        if (resource !== authorizationCode.resource)
          return oauthError(
            response,
            400,
            "invalid_target",
            "مورد OAuth لا يطابق مورد التفويض"
          );
        const tokens = await issueOAuthTokens({
          userId: authorizationCode.userId,
          clientId,
          scopes: authorizationCode.scopes,
          resource,
        });
        return response.json({
          access_token: tokens.accessToken,
          token_type: "Bearer",
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: tokens.scopes.join(" "),
        });
      }
      if (grantType === "refresh_token") {
        const rotated = await rotateOAuthTokens({
          rawRefreshToken: single(request.body?.refresh_token),
          clientId,
          resource: single(request.body?.resource) || undefined,
        });
        if (!rotated)
          return oauthError(
            response,
            400,
            "invalid_grant",
            "رمز التحديث غير صالح أو منتهي"
          );
        return response.json({
          access_token: rotated.accessToken,
          token_type: "Bearer",
          expires_in: rotated.expiresIn,
          refresh_token: rotated.refreshToken,
          scope: rotated.scopes.join(" "),
        });
      }
      return oauthError(
        response,
        400,
        "unsupported_grant_type",
        "نوع التفويض غير مدعوم"
      );
    } catch (error) {
      return oauthError(
        response,
        500,
        "server_error",
        error instanceof Error ? error.message : "تعذر إصدار رمز الوصول"
      );
    }
  });

  router.post("/oauth/revoke", async (request, response) => {
    try {
      const token = single(request.body?.token);
      if (token) await revokeOAuthToken(token);
      response.status(200).end();
    } catch (error) {
      oauthError(
        response,
        500,
        "server_error",
        error instanceof Error ? error.message : "تعذر إلغاء رمز الوصول"
      );
    }
  });

  return router;
}
