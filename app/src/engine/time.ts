/* Vaqt — Toshkent (UTC+5). Bosqichlar ish kunlari bo'yicha, har biri o'z kunida 09:00–17:00. */
export const OPEN_H = 9, CLOSE_H = 17, STAGE_N = 12;
export const DEF_START = "2026-09-28";
export function ymd(str: string) { const [y, m, d] = String(str).split("-").map(Number); return new Date(y, m - 1, d); }
export const dkey = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const isWd = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
export function tzNow() { const t = new Date(Date.now() + 5 * 3600e3); return { day: t.toISOString().slice(0, 10), h: t.getUTCHours() + t.getUTCMinutes() / 60, wd: t.getUTCDay() }; }
export const today = () => new Date().toISOString().slice(0, 10);
export function addWorkdays(d0: Date, n: number) { const d = new Date(d0); while (!isWd(d)) d.setDate(d.getDate() + 1); while (n > 0) { d.setDate(d.getDate() + 1); if (isWd(d)) n--; } return d; }
export function workdaysBefore(start: Date, end: Date) { let n = 0; const d = new Date(start); while (d < end) { if (isWd(d)) n++; d.setDate(d.getDate() + 1); } return n; }

let startStr = DEF_START;
export const setLigaStart = (s?: string | null) => { startStr = s || DEF_START; };
export const ligaStart = () => ymd(startStr);
export function season() { const st = ligaStart(), t = ymd(tzNow().day); if (t <= st) return 0; return Math.floor(workdaysBefore(st, t) / STAGE_N); }
export const stageDate = (i: number) => addWorkdays(ligaStart(), season() * STAGE_N + i);
export type SState = "future" | "open" | "closed";
export function stageState(i: number): SState {
  const n = tzNow(), k = dkey(stageDate(i));
  if (k > n.day || (k === n.day && n.h < OPEN_H)) return "future";
  if (k === n.day && n.h < CLOSE_H) return "open";
  return "closed";
}
export const stageOpen = (i: number) => stageState(i) === "open";
export const unlocked = (i: number) => stageState(i) !== "future";
export function todayStage(): number | null { const d = tzNow().day; for (let i = 0; i < STAGE_N; i++) if (dkey(stageDate(i)) === d) return i; return null; }
export const isWeekend = () => { const d = new Date().getDay(); return d === 0 || d === 6; };

/* hafta: juma 12:00 da tugaydi */
export function weekEnd(d?: Date) { const t = new Date(d || new Date()), f = new Date(t); f.setHours(12, 0, 0, 0); f.setDate(f.getDate() + ((5 - t.getDay() + 7) % 7)); if (f <= t) f.setDate(f.getDate() + 7); return f; }
export const weekId = (d?: Date) => weekEnd(d).toISOString().slice(0, 16);
export function weekendNow() { const n = new Date(), d = n.getDay(); return d === 6 || d === 0 || (d === 5 && n.getHours() >= 12); }
/* joriy hafta kunlari (Du..Ju) — sanalar */
export function weekDays(): Date[] { const n = ymd(tzNow().day), wd = n.getDay(); const mon = new Date(n); mon.setDate(n.getDate() - ((wd + 6) % 7)); if (wd === 6 || wd === 0) mon.setDate(mon.getDate() + 7); return [0, 1, 2, 3, 4].map((k) => { const d = new Date(mon); d.setDate(mon.getDate() + k); return d; }); }
export function stageOfDate(d: Date): number | null { const st = ligaStart(); if (!isWd(d) || d < st) return null; return workdaysBefore(st, d) % STAGE_N; }
export function msLeft(toH: number) { const n = tzNow(); return Math.max(0, (toH - n.h) * 3600e3); }
export function hm(ms: number) { const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60000); return { h, m }; }
export const fmtD = (v?: string | null) => { if (!v) return ""; const d = ymd(String(v).slice(0, 10)); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); };
export const curMonth = () => tzNow().day.slice(0, 7);
import { t } from "../lib/i18n";
const WDN = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export function stageDay(i: number) { const d = stageDate(i); return t(WDN[d.getDay()]) + ", " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0"); }
