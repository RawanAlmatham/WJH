export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
export const startLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
};
