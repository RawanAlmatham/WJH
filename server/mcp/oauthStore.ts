import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  oauthAuthorizationCodes,
  oauthClients,
  oauthTokens,
} from "../../drizzle/schema";
import { getDb } from "../db";

export const MCP_READ_SCOPE = "athr:read";
export const MCP_WRITE_SCOPE = "athr:write";
export const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function hashOAuthSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function accessToken() {
  return `athr_at_${nanoid(56)}`;
}

function refreshToken() {
  return `athr_rt_${nanoid(64)}`;
}

export function normalizeOAuthScopes(value: unknown) {
  const requested =
    typeof value === "string"
      ? value
          .split(/\s+/)
          .map(scope => scope.trim())
          .filter(Boolean)
      : [];
  const scopes = requested.length ? requested : [...MCP_SCOPES];
  const unique = Array.from(new Set(scopes));
  if (
    unique.some(
      scope => !MCP_SCOPES.includes(scope as (typeof MCP_SCOPES)[number])
    )
  )
    throw new Error("توجد صلاحية OAuth غير مدعومة");
  return unique;
}

export async function registerOAuthClient(input: {
  clientName: string;
  redirectUris: string[];
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const clientId = `athr_client_${nanoid(40)}`;
  await database.insert(oauthClients).values({
    clientId,
    clientName: input.clientName.trim().slice(0, 180) || "MCP client",
    redirectUris: input.redirectUris,
    tokenEndpointAuthMethod: "none",
  });
  return {
    client_id: clientId,
    client_name: input.clientName.trim().slice(0, 180) || "MCP client",
    redirect_uris: input.redirectUris,
    token_endpoint_auth_method: "none" as const,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_id_issued_at: Math.floor(Date.now() / 1000),
  };
}

export async function getOAuthClient(clientId: string) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAuthorizationCode(input: {
  userId: number;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const code = `athr_code_${nanoid(56)}`;
  await database.insert(oauthAuthorizationCodes).values({
    codeHash: hashOAuthSecret(code),
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scopes: input.scopes,
    resource: input.resource,
    expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
  });
  return code;
}

export async function consumeAuthorizationCode(code: string) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  return database.transaction(async transaction => {
    const rows = await transaction
      .select()
      .from(oauthAuthorizationCodes)
      .where(
        and(
          eq(oauthAuthorizationCodes.codeHash, hashOAuthSecret(code)),
          isNull(oauthAuthorizationCodes.usedAt),
          gt(oauthAuthorizationCodes.expiresAt, new Date())
        )
      )
      .limit(1);
    const authorizationCode = rows[0];
    if (!authorizationCode) return null;
    const updated = await transaction
      .update(oauthAuthorizationCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(oauthAuthorizationCodes.id, authorizationCode.id),
          isNull(oauthAuthorizationCodes.usedAt)
        )
      );
    return updated[0].affectedRows ? authorizationCode : null;
  });
}

export async function issueOAuthTokens(input: {
  userId: number;
  clientId: string;
  scopes: string[];
  resource: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rawAccessToken = accessToken();
  const rawRefreshToken = refreshToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await database.insert(oauthTokens).values({
    accessTokenHash: hashOAuthSecret(rawAccessToken),
    refreshTokenHash: hashOAuthSecret(rawRefreshToken),
    userId: input.userId,
    clientId: input.clientId,
    scopes: input.scopes,
    resource: input.resource,
    expiresAt,
    refreshExpiresAt,
  });
  return {
    accessToken: rawAccessToken,
    refreshToken: rawRefreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scopes: input.scopes,
  };
}

export async function verifyOAuthAccessToken(rawAccessToken: string) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.accessTokenHash, hashOAuthSecret(rawAccessToken)),
        isNull(oauthTokens.revokedAt),
        gt(oauthTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  const token = rows[0];
  if (!token) return null;
  await database
    .update(oauthTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthTokens.id, token.id));
  return token;
}

export async function rotateOAuthTokens(input: {
  rawRefreshToken: string;
  clientId: string;
  resource?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const nextAccessToken = accessToken();
  const nextRefreshToken = refreshToken();
  return database.transaction(async transaction => {
    const rows = await transaction
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(
            oauthTokens.refreshTokenHash,
            hashOAuthSecret(input.rawRefreshToken)
          ),
          eq(oauthTokens.clientId, input.clientId),
          isNull(oauthTokens.revokedAt),
          gt(oauthTokens.refreshExpiresAt, new Date())
        )
      )
      .limit(1);
    const token = rows[0];
    if (!token || (input.resource && token.resource !== input.resource))
      return null;
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const updated = await transaction
      .update(oauthTokens)
      .set({
        accessTokenHash: hashOAuthSecret(nextAccessToken),
        refreshTokenHash: hashOAuthSecret(nextRefreshToken),
        expiresAt,
        refreshExpiresAt,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(oauthTokens.id, token.id),
          eq(
            oauthTokens.refreshTokenHash,
            hashOAuthSecret(input.rawRefreshToken)
          )
        )
      );
    if (!updated[0].affectedRows) return null;
    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scopes: token.scopes,
      userId: token.userId,
      resource: token.resource,
    };
  });
}

export async function revokeOAuthToken(rawToken: string) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const tokenHash = hashOAuthSecret(rawToken);
  await database
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      or(
        eq(oauthTokens.accessTokenHash, tokenHash),
        eq(oauthTokens.refreshTokenHash, tokenHash)
      )
    );
}

export async function revokeAllOAuthTokensForUser(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await database
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.userId, userId), isNull(oauthTokens.revokedAt)));
  return { success: true as const };
}

export async function listOAuthConnections(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rows = await database
    .select({
      id: oauthTokens.id,
      clientId: oauthTokens.clientId,
      clientName: oauthClients.clientName,
      createdAt: oauthTokens.createdAt,
      lastUsedAt: oauthTokens.lastUsedAt,
      expiresAt: oauthTokens.expiresAt,
      refreshExpiresAt: oauthTokens.refreshExpiresAt,
    })
    .from(oauthTokens)
    .leftJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.clientId))
    .where(
      and(
        eq(oauthTokens.userId, userId),
        isNull(oauthTokens.revokedAt),
        gt(oauthTokens.refreshExpiresAt, new Date())
      )
    )
    .orderBy(desc(oauthTokens.lastUsedAt), desc(oauthTokens.createdAt));
  return rows.map(row => ({
    ...row,
    clientName: row.clientName ?? "مساعد ذكي",
  }));
}
