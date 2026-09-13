const adminEmails = Array.from(
  new Set(
    [process.env.ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS ?? "").split(",")]
      .map(email => email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  )
);

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail: adminEmails[0] ?? "",
  adminEmails,
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
  publicUrl: (
    process.env.PUBLIC_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://wjh.ralmatham.ai"
      : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  isProduction: process.env.NODE_ENV === "production",
};

export function isConfiguredAdminEmail(email: string | null | undefined) {
  return Boolean(email && ENV.adminEmails.includes(email.trim().toLowerCase()));
}
