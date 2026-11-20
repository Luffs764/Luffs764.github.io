// Open /api/test on your site: it makes one tiny AI call and says in plain words what works or what is missing.
const { send, gatewayKey } = require("./_lib");
let last = 0;
module.exports = async (req, res) => {
  if (Date.now() - last < 8000) return send(res, 429, { ok: false, say: "Wait a few seconds and reload." });
  last = Date.now();
  const fromEnv = !!process.env.AI_GATEWAY_API_KEY;
  const key = gatewayKey(req);
  const source = fromEnv ? "your AI_GATEWAY_API_KEY setting" : key ? "Vercel's automatic project token (no key needed)" : "nothing";
  if (!key) return send(res, 200, { ok: false, source, say: "No AI key and no automatic token. In Vercel: Project, Settings, Environment Variables, add AI_GATEWAY_API_KEY (create one at vercel.com, AI Gateway, API Keys), then Redeploy." });
  try {
    const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", max_tokens: 12, messages: [{ role: "user", content: "Say OK." }] }) });
    const text = (await r.text()).slice(0, 300);
    if (r.ok) return send(res, 200, { ok: true, source, say: "AI works. Go back to your site and press Make lesson." });
    const why = r.status === 401 || r.status === 403 ? "Vercel rejected the credentials. Create a new key at vercel.com, AI Gateway, API Keys, put it in AI_GATEWAY_API_KEY, and Redeploy." : r.status === 402 || /credit|balance|billing|payment/i.test(text) ? "The AI Gateway has no credit. Open vercel.com, AI Gateway, and use your free monthly credit or add a small amount of credit." : `The AI Gateway answered ${r.status}.`;
    return send(res, 200, { ok: false, source, status: r.status, say: why, detail: text });
  } catch (e) { return send(res, 200, { ok: false, source, say: `Could not reach the AI Gateway: ${e.message}` }); }
};
