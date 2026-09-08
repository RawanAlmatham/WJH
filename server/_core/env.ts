export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  publicUrl: (
    process.env.PUBLIC_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://athr.aidept.io"
      : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  isProduction: process.env.NODE_ENV === "production",
};
