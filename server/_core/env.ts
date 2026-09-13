export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
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
