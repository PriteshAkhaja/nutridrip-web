// Gemini image generation for the drip page's step 3. Local script only: the
// key is read from ../../../../.env and never printed.
//   node gemini.mjs models
//   node gemini.mjs edit <model> <out.png> <prompt.txt> <ref1.png> [ref2.png ...]
import fs from "node:fs";
import path from "node:path";

const env = fs.readFileSync(path.resolve(import.meta.dirname, "../../../../.env"), "utf8");
const KEY = env.match(/^GEMINI_AI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!KEY) throw new Error("GEMINI_AI_API_KEY is not set in .env");
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const scrub = (s) => String(s).split(KEY).join("***");

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "models") {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": KEY } });
  const j = await r.json();
  if (!r.ok) throw new Error(scrub(JSON.stringify(j).slice(0, 400)));
  for (const m of j.models ?? []) {
    if (/image|imagen|banana/i.test(m.name + m.displayName))
      console.log(m.name, "|", m.displayName, "|", (m.supportedGenerationMethods ?? []).join(","));
  }
} else if (cmd === "edit") {
  const [model, out, promptFile, ...refs] = args;
  const prompt = fs.readFileSync(promptFile, "utf8");
  const mime = (f) => (f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg");
  const parts = [
    ...refs.map((f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString("base64") } })),
    { text: prompt },
  ];
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "16:9" } },
  };
  const t0 = Date.now();
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) {
    console.log("HTTP", r.status, scrub(JSON.stringify(j.error ?? j).slice(0, 600)));
    process.exit(1);
  }
  const got = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  const text = (j.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ");
  if (!got) {
    console.log("no image.", "finish:", j.candidates?.[0]?.finishReason, "text:", scrub(text).slice(0, 300));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(got.inlineData.data, "base64"));
  console.log("ok", out, `${((Date.now() - t0) / 1000).toFixed(1)}s`, "usage:", JSON.stringify(j.usageMetadata ?? {}));
} else {
  console.log("usage: models | edit <model> <out> <prompt.txt> <refs...>");
}
