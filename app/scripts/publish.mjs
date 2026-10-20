// Yangi ilovani (app/dist) sayt ildiziga joylaydi. Eski ilova v1/ papkada zaxira sifatida qoladi.
// Ishlatish: cd app && npm run build && npm run deploy   (keyin git commit + push)
import fs from "node:fs"; import path from "node:path";
const app = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."), root = path.resolve(app, ".."), dist = path.join(app, "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) { console.error("Avval: npm run build"); process.exit(1); }
const v1 = path.join(root, "v1");
// 1) eski ilova — v1/ (bir marta). O'z service worker'ini ro'yxatdan o'tkazmaydi (yangi kesh bilan to'qnashmasin)
if (!fs.existsSync(path.join(v1, "index.html"))) {
  const old = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (old.includes("hisobchi-liga-v1") && !old.includes('id="root"')) {
    fs.mkdirSync(v1, { recursive: true });
    fs.writeFileSync(path.join(v1, "index.html"), old.replace(/if\("serviceWorker" in navigator\) navigator\.serviceWorker\.register\("sw\.js"\)\.catch\(\(\)=>\{\}\);/, "/* v1: service worker o'chirilgan */"));
    for (const f of ["manifest.json", "icon-192.png", "icon-512.png"]) fs.copyFileSync(path.join(root, f), path.join(v1, f));
    console.log("eski ilova → v1/");
  }
}
// 2) yangi build fayllarini nusxalash. Oldingi 3 ta versiya fayllari saqlanadi: telefon keshidagi eski sahifa
//    o'chirilgan faylni so'rasa, oq ekran bo'lib qolardi. Undan eskilari o'chiriladi (ro'yxat: assets/builds.json).
const adir = path.join(root, "assets"), bj = path.join(adir, "builds.json");
let builds = [];
try { builds = JSON.parse(fs.readFileSync(bj, "utf8")); } catch { builds = []; }
if (!builds.length && fs.existsSync(adir)) builds = [fs.readdirSync(adir).filter((f) => f !== "builds.json")];   // birinchi marta: hozirgilari — bitta oldingi versiya
const fresh = fs.readdirSync(path.join(dist, "assets"));
builds.push(fresh); builds = builds.slice(-4);
const keep = new Set(builds.flat());
fs.cpSync(dist, root, { recursive: true });
for (const f of fs.readdirSync(adir)) if (f !== "builds.json" && !keep.has(f)) fs.rmSync(path.join(adir, f), { force: true });
fs.writeFileSync(bj, JSON.stringify(builds));
// GitHub Pages: Jekyll'siz (assets/_ fayllar uchun)
fs.writeFileSync(path.join(root, ".nojekyll"), "");
console.log("tayyor:", fs.readdirSync(dist).join(", "));
