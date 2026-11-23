// Kling image generation from a reference picture (the room). Never prints the key.
//   node kling-image.mjs <model> <out.png> <prompt.txt> <ref.jpg> [fidelity 0-1]
// Auth: with KLING_ACCESS_KEY and KLING_SECRET_KEY set, a JWT signed from them
// (Kling's AK/SK method: HS256, iss = access key, valid 30 minutes); otherwise
// the single KLING_AI_API_KEY as a bearer token.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const env = fs.readFileSync(path.resolve(import.meta.dirname, "../../../../.env"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim();
const AK = get("KLING_ACCESS_KEY");
const SK = get("KLING_SECRET_KEY");
let KEY = get("KLING_AI_API_KEY");
if (AK && SK) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: AK, exp: now + 1800, nbf: now - 5 })}`;
  KEY = `${unsigned}.${crypto.createHmac("sha256", SK).update(unsigned).digest("base64url")}`;
}
if (!KEY) throw new Error("Set KLING_ACCESS_KEY and KLING_SECRET_KEY (or KLING_AI_API_KEY) in .env");
const HOST = "https://api-singapore.klingai.com";
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const secrets = [KEY, AK, SK].filter(Boolean);
const scrub = (s) => secrets.reduce((a, k) => a.split(k).join("***"), String(s));
const [model, out, promptFile, ref, fid] = process.argv.slice(2);

const body = {
  model_name: model,
  prompt: fs.readFileSync(promptFile, "utf8").slice(0, 2500),
  negative_prompt: "text, logo, watermark, name tag, IV bag, tubing, extra fingers, distorted hands, blurry",
  image: fs.readFileSync(ref).toString("base64"),
  image_fidelity: Number(fid ?? 0.7),
  n: 1,
  aspect_ratio: "16:9",
};
const r = await fetch(`${HOST}/v1/images/generations`, { method: "POST", headers: H, body: JSON.stringify(body) });
const j = await r.json().catch(() => ({}));
console.log("submit HTTP", r.status, "code", j.code, scrub(j.message ?? ""));
const id = j.data?.task_id;
if (!id) process.exit(1);
for (let k = 0; k < 90; k++) {
  await new Promise((s) => setTimeout(s, 5000));
  const q = await (await fetch(`${HOST}/v1/images/generations/${id}`, { headers: H })).json();
  const st = q.data?.task_status;
  if (st === "succeed") {
    const url = q.data.task_result?.images?.[0]?.url;
    const img = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, img);
    console.log("ok", out, `${(k + 1) * 5}s`);
    process.exit(0);
  }
  if (st === "failed") {
    console.log("failed:", scrub(q.data?.task_status_msg ?? JSON.stringify(q).slice(0, 300)));
    process.exit(1);
  }
}
console.log("timed out waiting for", id);
