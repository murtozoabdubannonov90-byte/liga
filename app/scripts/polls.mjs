// Bot har kuni 09:00 da guruhlarga yuboradigan Telegram "quiz" so'rovnomalari uchun savollar (public/polls.json).
// Faqat test (mc) savollari, Telegram cheklovlariga mos: savol ≤ 300, variant ≤ 100, izoh ≤ 200 belgi.
// Ishlatish: node scripts/polls.mjs   (npm run build ichida avtomatik)
import { build } from "esbuild"; import fs from "node:fs"; import path from "node:path";
const app = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(app, "node_modules/.cache/polls-entry.mjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
await build({ stdin: { contents: `import { content } from "./src/engine/data"; export const C = { uz: content("uz"), ru: content("ru") };`, resolveDir: app, loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", loader: { ".json": "json" } });
const { C } = await import(out + "?t=" + Date.now());
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
function list(c) {
  const all = [...c.STAGES.flatMap((s) => s.tasks), ...c.TOPICS.flatMap((t) => t.tasks)].filter((t) => t.t === "mc" && t.o && t.o.length >= 2 && t.o.length <= 10);
  return all.filter((t) => t.q.length <= 300 && t.o.every((o) => o.length <= 100)).filter((t) => Number.isInteger(t.a) && t.a >= 0 && t.a < t.o.length)
    .map((t) => ({ id: t.id, q: t.q, o: t.o.map((o) => (/^\d{4}$/.test(o) && c.A[o] ? cut(o + " — " + c.A[o], 100) : o)), a: t.a, e: cut(t.e || "", 200) }));
}
const res = { uz: list(C.uz), ru: list(C.ru) };
// o'zbekcha va ruscha bir xil id bo'yicha mos kelsin
const ruIds = new Set(res.ru.map((x) => x.id)); res.uz = res.uz.filter((x) => ruIds.has(x.id));
const uzIds = new Set(res.uz.map((x) => x.id)); res.ru = res.ru.filter((x) => uzIds.has(x.id));
fs.writeFileSync(path.join(app, "public/polls.json"), JSON.stringify(res));
console.log("polls:", res.uz.length);
