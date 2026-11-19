// Tells the TeacherAI page what this relay can do (no secrets are returned).
const { cors, send, gatewayKey } = require("./_lib");
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  send(res, 200, {
    teacherai: 1,
    ai: !!gatewayKey(req),
    tts: { fish: !!process.env.FISH_API_KEY, eleven: !!process.env.ELEVENLABS_API_KEY, azure: !!process.env.AZURE_SPEECH_KEY },
    password: !!process.env.APP_PASSWORD,
  });
};
