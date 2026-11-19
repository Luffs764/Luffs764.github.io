// Shared helpers for the TeacherAI relay (Vercel Functions). Keys live in Vercel environment variables, never in the page.
const ALLOWED = ["https://luffs764.github.io"];

function originOk(req) {
  const origin = String(req.headers.origin || "").toLowerCase();
  const host = String(req.headers.host || "").toLowerCase();
  return !!origin && (origin.replace(/^https?:\/\//, "") === host || ALLOWED.includes(origin));
}
// Adds CORS headers for allowed pages; answers preflight requests. Returns true when the request was fully handled.
function cors(req, res) {
  const origin = req.headers.origin;
  if (originOk(req)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-app-password");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}
// Only your pages (or callers with APP_PASSWORD, if you set one) may spend your credits.
function allowed(req) {
  const pass = process.env.APP_PASSWORD;
  if (pass) return req.headers["x-app-password"] === pass;
  return originOk(req);
}
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}
// AI Gateway key: your AI_GATEWAY_API_KEY, or Vercel's automatic project token when deployed on Vercel.
const gatewayKey = (req) => process.env.AI_GATEWAY_API_KEY || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || "";

module.exports = { cors, allowed, send, readBody, gatewayKey };
