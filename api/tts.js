// Speaks text with Fish Audio (or ElevenLabs / Microsoft if their keys are set) and returns MP3 audio.
const { cors, allowed, send, readBody } = require("./_lib");
const NAMES = { fish: "Fish Audio", eleven: "ElevenLabs", azure: "Microsoft" };

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  if (!allowed(req)) return send(res, 403, { error: "This relay only answers your TeacherAI page." });
  const b = await readBody(req);
  const provider = String(b.provider || "fish"), voice = String(b.voice || ""), text = String(b.text || "").slice(0, 3000);
  const speed = Math.min(1.3, Math.max(0.6, Number(b.speed) || 1));
  if (!voice || !text) return send(res, 400, { error: "Missing voice or text." });
  let r;
  try {
    if (provider === "fish") {
      const key = process.env.FISH_API_KEY; if (!key) return send(res, 500, { error: "Add FISH_API_KEY in your Vercel project settings, then redeploy." });
      const call = (model) => fetch("https://api.fish.audio/v1/tts", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", model }, body: JSON.stringify({ text, reference_id: voice, format: "mp3", mp3_bitrate: 128, latency: "normal", normalize: true, prosody: { speed } }) });
      r = await call("s2.1-pro");
      if (!r.ok && ![401, 402, 403, 429].includes(r.status)) r = await call("s1");
    } else if (provider === "eleven") {
      const key = process.env.ELEVENLABS_API_KEY; if (!key) return send(res, 500, { error: "Add ELEVENLABS_API_KEY in your Vercel project settings." });
      r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" }, body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.8 } }) });
    } else if (provider === "azure") {
      const key = process.env.AZURE_SPEECH_KEY, region = (process.env.AZURE_SPEECH_REGION || "eastus").toLowerCase();
      if (!key) return send(res, 500, { error: "Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in your Vercel project settings." });
      const x = (t) => t.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
      r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3" }, body: `<speak version="1.0" xml:lang="${voice.slice(0, 5)}"><voice name="${voice}"><prosody rate="${Math.round((speed - 1) * 100)}%">${x(text)}</prosody></voice></speak>` });
    } else return send(res, 400, { error: "Unknown voice service." });
  } catch (e) { return send(res, 502, { error: `Could not reach ${NAMES[provider] || provider}: ${e.message}` }); }
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    return send(res, 502, { error: `${NAMES[provider]} answered ${r.status}${r.status === 401 || r.status === 403 ? " (the key was rejected)" : r.status === 402 ? " (out of credit)" : ""}. ${detail}`.trim() });
  }
  res.statusCode = 200;
  res.setHeader("content-type", "audio/mpeg");
  res.setHeader("cache-control", "no-store");
  res.end(Buffer.from(await r.arrayBuffer()));
};
