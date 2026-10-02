/* Ishga tushirish: til, mavzu, hafta, server, havola parametrlari */
import { S, persist } from "./engine/state";
import { setLang, t } from "./lib/i18n";
import { setSound, sfx } from "./lib/fx";
import { tgInit, tgDark, startParam, inTelegram } from "./lib/tg";
import { sweepDays, checkWeek, setAwardHandler, ACH, recalcWeek } from "./engine/score";
import { setLigaStart } from "./engine/time";
import { joinServer, pull, linkTelegram, rpc, tgLogin } from "./engine/server";
import { startTopic } from "./engine/run";
import { bump } from "./engine/state";
import { toast, go, nativeBack } from "./lib/nav";

export function applyTheme() {
  const pref = S.theme || "auto";
  const dark = pref === "dark" || (pref === "auto" && (tgDark() || (!(window as any).Telegram?.WebApp?.initData && matchMedia("(prefers-color-scheme: dark)").matches)));
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  tgInit(dark);
}
/* havola: ?g=KOD, ?r=TAKLIF, ?d=DUEL, ?t=TEST, ?v=SERTIFIKAT yoki Telegram start_param g_/r_/d_/t_/v_ */
export const entry: { g?: string; r?: string; d?: string; t?: string; v?: string; tp?: string } = {};
function readEntry() {
  const qs = new URLSearchParams(location.search);
  for (const k of ["g", "r", "d", "t", "v"] as const) { const v = qs.get(k); if (v) entry[k] = v.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  const sp = startParam(); const m = /^([grdtv])_([A-Za-z0-9]+)$/.exec(sp || "");
  if (m) (entry as any)[m[1]] = m[2].toUpperCase();
  const tp = qs.get("tp"); if (tp && /^[a-z]{2,12}$/.test(tp)) entry.tp = tp;
  if (entry.r && !S.pid) { S.ref = entry.r; persist(); }
}
export function boot() {
  nativeBack();
  readEntry();
  S.tgTry = false;
  if (S.lang) setLang(S.lang);
  setSound(S.sound !== false);
  applyTheme();
  setLigaStart(S.group?.start);
  recalcWeek(); sweepDays();
  setAwardHandler((id) => { const a = ACH.find((x) => x.id === id); if (a) { toast("🏅 " + t("Yangi yutuq") + ": " + t(a.n) + " (+60 XP)"); sfx("coin"); } });
  if (checkWeek()) setTimeout(() => go("weekEnd"), 400);
  /* Telegram ichida: hisob Telegram ID orqali topiladi (yangi telefon/kompyuter — qayta ro'yxatsiz) */
  if (inTelegram && (!S.pid || !S.token)) {
    S.tgTry = true;
    tgLogin().then((ok) => {
      S.tgTry = false; bump();
      if (!ok && S.user.first && (!S.pid || (!S.token && !S.tokenLost))) joinServer().then(() => pull(true)); else pull(true);
    });
  } else if (S.user.first && (!S.pid || (!S.token && !S.tokenLost))) joinServer().then(() => pull(true)); else pull(true);
  /* soliq taqvimi eslatmasidan: ?tp=qqs — o'sha yo'nalish mashqi */
  if (entry.tp && S.user.first) setTimeout(() => { const r = startTopic(entry.tp!); entry.tp = undefined; if (typeof r !== "string") go("quiz", { run: r }); }, 600);
  linkTelegram();
  flushFinal();
  /* ilova ochiq turganda juma 12:00 o'tsa — hafta yangilanadi (eski hafta bali yangi haftaga o'tib ketmaydi) */
  const tick = () => { if (checkWeek()) { go("weekEnd"); pull(true); } };
  setInterval(() => { if (document.visibilityState === "visible") { tick(); pull(); } }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { tick(); pull(); } });
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch { /* */ }
  try { (window as any).Telegram?.WebApp?.onEvent?.("themeChanged", applyTheme); } catch { /* */ }
}
/* final ilova yopilib qolgan bo'lsa — natija yuboriladi */
export async function flushFinal() {
  const fr = S.finRun; if (!fr || fr.sent || !S.pid || !S.token) return;
  try { await rpc("liga_final_submit", { p_id: S.pid, p_token: S.token, p_score: fr.right * 20, p_ms: fr.ms }); fr.sent = true; persist(); }
  catch (e) { if (/final_closed|not_qualified/.test(String((e as any).message))) { fr.sent = true; persist(); } }
}
