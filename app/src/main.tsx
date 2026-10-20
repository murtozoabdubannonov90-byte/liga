/* Kirish nuqtasi. Telegram skripti endi sahifani to'xtatib turmaydi: Telegram ichida u yuklanguncha (ko'pi bilan 6 s) kutamiz,
   brauzerda/Android ilovada — kutmaymiz. Shundan keyingina ilova kodi yuklanadi (tg.ts Telegram obyektini to'g'ri ko'radi). */
import "@fontsource-variable/golos-text";
import "@fontsource-variable/unbounded";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/app.css";
import { reportErr } from "./lib/report";

const TG_SRC = "https://telegram.org/js/telegram-web-app.js";
export function inTelegramHint(): boolean {
  const w = window as any;
  return /tgWebApp(Data|Platform|Version)/.test(location.hash + location.search) || !!w.TelegramWebviewProxy || !!w.external?.notify && /Telegram/i.test(navigator.userAgent);
}
function loadTelegram(ms = 6000): Promise<void> {
  const w = window as any;
  if (w.Telegram?.WebApp) return Promise.resolve();
  if (!inTelegramHint()) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { clearTimeout(tm); res(); };
    const tm = setTimeout(done, ms);
    const s = document.createElement("script"); s.src = TG_SRC; s.async = true; s.onload = done; s.onerror = () => { reportErr("tg_script_failed"); done(); };
    document.head.appendChild(s);
  });
}

loadTelegram().then(() => import("./start")).then((m) => m.start()).catch((e) => {
  reportErr("start_failed: " + String(e?.message || e), e?.stack);
  (window as any).__ligaFail?.(String(e?.message || e));
});
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
