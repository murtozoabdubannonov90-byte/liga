/* Tillar: "uz" — o'zbek (lotin), "uzc" — ўзбек (кирилл, lotindan avtomatik), "ru" — русский.
   Matnlar kaliti — o'zbekcha (lotin) matnning o'zi. Rus tarjimalari RU lug'atida. */
import { RU } from "./ru";

export type Lang = "uz" | "uzc" | "ru";
export const LANGS: { id: Lang; name: string; short: string }[] = [
  { id: "uz", name: "O'zbekcha", short: "UZ" },
  { id: "uzc", name: "Ўзбекча", short: "ЎЗ" },
  { id: "ru", name: "Русский", short: "RU" },
];

let cur: Lang = "uz";
export const setLang = (l: Lang) => { cur = l; document.documentElement.lang = l === "ru" ? "ru" : "uz"; };
export const getLang = () => cur;

/* ---------- lotin → kirill ---------- */
const AP = /[ʻʼ‘’`´]/g;
const ONE: Record<string, string> = { a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н",
  o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в" };
const KEEP = new Set(["XP", "QR", "PDF", "ID", "FIFO", "LIFO", "IAS", "IFRS", "EPS", "ECL", "OK", "PIN", "Payme", "Click", "Telegram", "Android", "iPhone", "Excel", "1C"]);
function word(w: string): string {
  if (KEEP.has(w)) return w;
  const s = w.replace(AP, "'"), low = s.toLowerCase();
  let out = "";
  for (let i = 0; i < low.length; i++) {
    const c = low[i], n = low[i + 1], n2 = low[i + 2], prev = out[out.length - 1];
    let r = "";
    if ((c === "o" || c === "g") && n === "'") { r = c === "o" ? "ў" : "ғ"; i++; }
    else if (c === "s" && n === "h") { r = "ш"; i++; }
    else if (c === "c" && n === "h") { r = "ч"; i++; }
    else if (c === "y" && n === "o" && n2 !== "'") { r = "ё"; i++; }
    else if (c === "y" && n === "u") { r = "ю"; i++; }
    else if (c === "y" && n === "a") { r = "я"; i++; }
    else if (c === "y" && n === "e") { r = "е"; i++; }
    else if (c === "e") { r = (i === 0 || (prev !== undefined && "аоиуўеэёюя".includes(prev))) ? "э" : "е"; }
    else if (c === "'") { r = "ъ"; }
    else r = ONE[c] ?? c;
    out += r;
  }
  if (s.length > 1 && s === s.toUpperCase() && /[A-Z]/.test(s)) return out.toUpperCase();
  if (/^[A-Z]/.test(s)) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
/* HTML teglari, {o'zgaruvchi}, @nik, havolalar o'zgarmaydi */
export function cyr(text: string): string {
  if (!text) return text;
  return text.replace(/(<[^>]*>|\{[^}]*\}|@[A-Za-z0-9_]+|https?:\/\/\S+|[A-Za-z][A-Za-z'ʻʼ‘’`]*[A-Za-z]|[A-Za-z])/g, (m) =>
    m[0] === "<" || m[0] === "{" || m[0] === "@" || m.startsWith("http") ? m : word(m));
}

/* ---------- tarjima ---------- */
export function t(uz: string, vars?: Record<string, string | number>): string {
  let s = cur === "ru" ? (RU[uz] ?? uz) : cur === "uzc" ? cyr(uz) : uz;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}
/* ma'lumot matnlari (savollar va h.k.): o'zbekcha bo'lsa kirill uchun o'giriladi */
export const tx = (uz: string) => (cur === "uzc" ? cyr(uz) : uz);
export const missingRu = (keys: string[]) => keys.filter((k) => !(k in RU));
