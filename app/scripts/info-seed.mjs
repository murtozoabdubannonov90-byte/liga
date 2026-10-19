// «Buxgalter ma'lumotnomasi» (src/data/malumot.ts) ni bazaga yuklash uchun SQL yasaydi.
// Ishlatish:  node scripts/info-seed.mjs "Izoh: nima o'zgardi"  > /tmp/info.sql
// Keyin SQL ni Supabase'da bajaring (select public.liga_info_set_sys(...)). Mazmun o'zgarmagan bo'lsa,
// "Yangilandi" sanasi o'zgarmaydi, faqat "Tekshirildi" sanasi yangilanadi.
import { transform } from "esbuild";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/data/malumot.ts", import.meta.url), "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const items = mod.INFO;
if (!Array.isArray(items) || items.length < 3) throw new Error("INFO bo'sh");
for (const x of items) if (!x.id || !x.title?.uz || !x.title?.ru || !Array.isArray(x.rows)) throw new Error("Noto'g'ri bo'lim: " + x.id);
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const note = process.argv[2] ?? null;
process.stdout.write(`select public.liga_info_set_sys(${q(JSON.stringify(items))}::jsonb, ${note ? q(note) : "null"});\n`);
