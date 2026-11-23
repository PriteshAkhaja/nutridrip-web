// Read-only check of the Kling key: the account's resource packs. Never prints the key.
// The official API wants a JWT signed from an access key and a secret key; with
// KLING_ACCESS_KEY/KLING_SECRET_KEY set it signs one, otherwise it tries the
// single KLING_AI_API_KEY as a bearer token.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const env = fs.readFileSync(path.resolve(import.meta.dirname, "../../../../.env"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim();
const ak = get("KLING_ACCESS_KEY");
const sk = get("KLING_SECRET_KEY");
const single = get("KLING_AI_API_KEY");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let token;
if (ak && sk) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: ak, exp: now + 1800, nbf: now - 5 });
  const sig = crypto.createHmac("sha256", sk).update(`${head}.${body}`).digest("base64url");
  token = `${head}.${body}.${sig}`;
  console.log("signing a JWT from KLING_ACCESS_KEY/KLING_SECRET_KEY");
} else {
  token = single;
  console.log("trying KLING_AI_API_KEY as a bearer token");
}
const secrets = [ak, sk, single, token].filter(Boolean);
const scrub = (s) => secrets.reduce((a, k) => a.split(k).join("***"), String(s));
const end = Date.now();
for (const host of ["https://api-singapore.klingai.com", "https://api.klingai.com"]) {
  const url = `${host}/account/costs?start_time=${end - 30 * 864e5}&end_time=${end}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const t = await r.text();
    console.log(host, "HTTP", r.status, scrub(t).slice(0, 400));
  } catch (e) {
    console.log(host, "failed:", scrub(e.message));
  }
}
