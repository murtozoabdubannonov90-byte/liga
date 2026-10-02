// Ilovadagi tarjima qilinadigan barcha o'zbekcha matnlarni yig'adi.
// Ishlatish: node scripts/i18n-keys.mjs  → scripts/i18n-keys.json, va RU lug'atida yo'qlarini ko'rsatadi
import fs from "node:fs"; import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../src");
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "data") walk(p); } else if (/\.(tsx?|mjs)$/.test(f) && !/(ru|i18n)\.ts$/.test(f)) files.push(p); } })(root);
// string literal tokenizer (izohlarni o'tkazib yuboradi)
function literals(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1, s = "", dyn = false;
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") { const n = src[j + 1]; s += n === "n" ? "\n" : n; j += 2; continue; } if (c === "`" && src[j] === "$" && src[j + 1] === "{") dyn = true; s += src[j]; j++; }
      out.push({ s, at: i, dyn, q: c }); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
const keys = new Set();
const looksText = (s) => /[A-Za-zʻʼ']/.test(s) && (/\s/.test(s.trim()) || /^[A-ZÀ-ÿ«—⛔✅]/.test(s) || /[a-z]'[a-z]/.test(s)) && !/^[a-z0-9_-]+( [a-z0-9_-]+)*$/.test(s) && !/[{};]\s*$/.test(s.trim()) && !/^(https?:|\.|\/|#|var\(|M\d|rgba|data:)/.test(s) && !/^[A-Z_]+$/.test(s);
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const L of literals(src)) {
    if (L.dyn) continue;
    const before = src.slice(Math.max(0, L.at - 12), L.at);
    const isT = /(^|[^A-Za-z_.])t\($/.test(before) || /(^|[^A-Za-z_.])t\(\s*$/.test(before);
    const attr = /(className|style|id|key|role|aria-hidden|type|inputMode|autoComplete|href|src|rel|target|data-[a-z]+)=\s*\{?$/.test(before) || /rpc(<[^>]*>)?\($/.test(before) || /(import|from)\s*$/.test(before);
    if (isT || (!attr && looksText(L.s))) keys.add(L.s);
  }
}
const JUNK = /^.{0,2}$|^[A-Z]-$|^VS$|px|var\(|Manrope|JetBrains|prefers-|^Content-Type$|^Bearer|^Enter$|^BX12AB$|_bot$|^Payme$|^Click$|^Hisobchi Liga$|stroke-|^O'zbekcha$|^Tilni tanlang · /;
const list = [...keys].filter((k) => k.trim() && !JUNK.test(k) && /[A-Za-z]/.test(k.replace(/XP|\{[a-z]+\}/g, ""))).sort();
fs.writeFileSync(path.join(root, "../scripts/i18n-keys.json"), JSON.stringify(list, null, 1));
const ruSrc = fs.readFileSync(path.join(root, "lib/ru.ts"), "utf8");
let RU = {}; try { RU = Function(ruSrc.replace(/^[\s\S]*?=\s*/, "return ").replace(/;\s*$/, ""))(); } catch (e) { console.error("ru.ts o'qilmadi", e.message); }
const miss = list.filter((k) => !(k in RU));
console.log("kalitlar:", list.length, "| RU da yo'q:", miss.length);
if (miss.length) { console.log(miss.slice(0, 20).join("\n")); process.exitCode = 1; }
if (process.argv[2] === "--miss") fs.writeFileSync(path.join(root, "../scripts/i18n-missing.json"), JSON.stringify(miss, null, 1));
