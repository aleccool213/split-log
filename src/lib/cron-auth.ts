import { timingSafeEqual } from "node:crypto";

/** Fallback when Vercel has not injected CRON_SECRET. Server-only — never import from UI. */
const FALLBACK = "sln_8f2c41e90b6a47d3";

function secret(): string {
  return process.env.CRON_SECRET?.trim() || FALLBACK;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True for Vercel cron, or a bearer/query key. Browser visitors never pass this. */
export function isAuthorizedCron(request: Request): boolean {
  // Scripted browser calls (the old public button, fetch/XHR) always send this.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "none") return false;

  const expected = secret();
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && safeEqual(token, expected)) return true;
  }

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") ?? url.searchParams.get("token") ?? "";
    if (key && safeEqual(key, expected)) return true;
  } catch {
    // ignore malformed URL
  }

  const ua = request.headers.get("user-agent") ?? "";
  if (ua.toLowerCase().includes("vercel-cron")) return true;

  return false;
}
