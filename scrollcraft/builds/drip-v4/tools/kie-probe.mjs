// Prints KIE's raw credit response (status, code, message, data), never the key.
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(path.resolve(import.meta.dirname, "../../../../.env"), "utf8");
const lines = env.split(/\r?\n/).filter((l) => /^\s*KIE_AI_API_KEY\s*=/.test(l));
const raw = lines.at(-1)?.split("=").slice(1).join("=").trim() ?? "";
const KEY = raw.replace(/^["']|["']$/g, "");
console.log("KIE lines in .env:", lines.length, "| quoted:", raw !== KEY, "| length:", KEY.length);
const r = await fetch("https://api.kie.ai/api/v1/chat/credit", { headers: { Authorization: `Bearer ${KEY}` } });
const j = await r.json().catch(() => ({}));
console.log(
  "HTTP",
  r.status,
  "| code",
  j.code,
  "| msg",
  String(j.msg ?? "")
    .split(KEY)
    .join("***"),
  "| data",
  j.data
);
