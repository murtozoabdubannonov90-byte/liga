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
// 2) eski build fayllarini tozalash va yangisini nusxalash
fs.rmSync(path.join(root, "assets"), { recursive: true, force: true });
fs.cpSync(dist, root, { recursive: true });
// GitHub Pages: Jekyll'siz (assets/_ fayllar uchun)
fs.writeFileSync(path.join(root, ".nojekyll"), "");
console.log("tayyor:", fs.readdirSync(dist).join(", "));
