/* Halol o'yin nazorati: savol ochiq turganda ilova yoki oyna fokusni yo'qotsa (boshqa ilova, AI yordamchi — Gemini/Jarvis oynasi,
   kompyuterda boshqa oyna, Telegram'da boshqa chat) — qancha vaqt chiqib turgani hisoblanadi.
   Telefon: visibilitychange; Android'da ekran ustiga chiqadigan AI oynasi: blur; Telegram: deactivated/activated. */
import { W } from "./tg";

export const AWAY_MS = 3000;      // shundan uzoq chiqish — savol xato (duelda — qulf). 2026-10-20: 1,5 s → 3 s (bildirishnoma, tasodifiy bosish)
export const AWAY_LOG_MS = 400;   // shundan uzoq har bir chiqish serverga yoziladi (admin ko'radi)

/* st — komponent qayta chizilsa ham chiqish vaqti yo'qolmasligi uchun (useRef obyekti) */
export function watchAway(active: () => boolean, onBack: (ms: number) => void, st: { at: number } = { at: 0 }) {
  const leave = () => { if (!st.at && active()) st.at = Date.now(); };
  const back = () => { if (!st.at) return; const ms = Date.now() - st.at; st.at = 0; onBack(ms); };
  const vis = () => (document.hidden ? leave() : back());
  document.addEventListener("visibilitychange", vis);
  window.addEventListener("blur", leave); window.addEventListener("focus", back);
  window.addEventListener("pagehide", leave); window.addEventListener("pageshow", back);
  try { W?.onEvent?.("deactivated", leave); W?.onEvent?.("activated", back); } catch { /* eski Telegram */ }
  return () => {
    document.removeEventListener("visibilitychange", vis);
    window.removeEventListener("blur", leave); window.removeEventListener("focus", back);
    window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", back);
    try { W?.offEvent?.("deactivated", leave); W?.offEvent?.("activated", back); } catch { /* */ }
  };
}
