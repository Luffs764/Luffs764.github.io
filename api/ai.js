// Writes lessons through Vercel AI Gateway: the newest Claude Sonnet first, then Grok, then Kimi.
const { cors, allowed, send, readBody, gatewayKey } = require("./_lib");
const BASE = "https://ai-gateway.vercel.sh/v1";
const FALLBACK = ["anthropic/claude-sonnet-5.5", "anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-4.5", "xai/grok-4.3", "xai/grok-4", "moonshotai/kimi-k3"];
let picked = null;
const verOf = (id) => ((id.split("/")[1] || "").match(/\d+(?:\.\d+)*/g) || []).flatMap((x) => x.split(".").map(Number));
const newer = (a, b) => { const x = verOf(a), y = verOf(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0); return 0; };

async function models(key) {
  if (picked) return picked;
  try {
    const r = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
    if (r.ok) {
      const ids = ((await r.json()).data || []).map((m) => m.id).filter((id) => !/haiku|mini|nano|fast|vision|image|embed|audio|realtime|code/i.test(id));
      const best = (re) => ids.filter((id) => re.test(id)).sort(newer)[0];
      const list = [best(/^anthropic\/claude-sonnet/), best(/^xai\/grok/), best(/^moonshotai\/kimi/), best(/^anthropic\/claude-opus/)].filter(Boolean);
      if (list.length) return (picked = list);
    }
  } catch { /* use the fixed list */ }
  return FALLBACK;
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  if (!allowed(req)) return send(res, 403, { error: "This relay only answers your TeacherAI page." });
  const key = gatewayKey(req);
  if (!key) return send(res, 500, { error: "Add AI_GATEWAY_API_KEY in your Vercel project settings, then redeploy." });
  const body = await readBody(req);
  const prompt = String(body.prompt || "").slice(0, 200000);
  if (!prompt) return send(res, 400, { error: "Nothing to write about." });
  const list = body.model ? [String(body.model)] : await models(key);
  let last = "";
  for (const model of list) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, max_tokens: 12000, messages: [{ role: "user", content: prompt }] }) });
      if (r.ok) { const d = await r.json(); return send(res, 200, { text: d.choices?.[0]?.message?.content || "", model }); }
      if (r.status === 401 || r.status === 403) return send(res, 502, { error: "Vercel AI Gateway rejected the key. Check AI_GATEWAY_API_KEY in your Vercel project settings." });
      last = `${model} answered ${r.status}`;
    } catch (e) { last = `${model}: ${e.message}`; }
  }
  send(res, 502, { error: `No AI model answered (${last}).` });
};
