/* «Sovrinli musobaqa» (avval «Mashq zali») — ligadan alohida amaliy o'yinlar (server: liga_px_*).
   Ballari liga baliga, bosqichlarga, duel va kubokka qo'shilmaydi — alohida oylik reyting va sovrin jamg'armasi. */
import { rpc } from "./server";
import { S, persist, bump } from "./state";

export type PxKind = "pv" | "acc" | "side";
export interface PxQ { t: PxKind; q?: string; o: string[]; mode?: "c2n" | "n2c"; ask?: string; code?: string }
export interface PxState { sid: string; kind: PxKind; k: number; score: number; right_n: number; done_n: number; combo: number; left_ms: number; q: PxQ | null; secs?: number; qs?: number; qn?: number }
export interface PxRes extends Partial<PxState> { ok?: boolean; why?: string; ans?: { dt?: string; kt?: string; a?: number; code?: string }; e?: string; got?: number; over?: boolean; stale?: boolean }
export interface PxQuest { id: string; pts: number; need: number; prog: number; done: boolean; got: boolean }
export interface PxAch { id: string; prog: number; need: number }
export interface PxMe {
  mon: string; secs: number; qs?: number; qn?: number; on: boolean; streak: number; eligible: boolean;
  start_at?: string | null; started?: boolean; open_from?: string; open_to?: string; end_day?: string; days_left?: number;
  today: { games: number; pts: number }; month: { pts: number; rank: number | null; n: number };
  total: { games: number; rights: number; answers: number; best: Record<PxKind, number> };
  quests: PxQuest[]; ach: PxAch[]; fund: { amount: number; split: number[]; prizes: number[] };
  pay?: "none" | "check" | "paid" | "cancelled"; price?: number; paid_n?: number;
}
export interface PxRow { pos: number; name: string; pts: number; games: number; me: boolean; ok: boolean }

export const KINDS: PxKind[] = ["pv", "acc", "side"];
export const KIND_TITLE: Record<PxKind, string> = { pv: "Debet ↔ Kredit", acc: "Schyotlar rejasi", side: "Balans bo'limi" };
export const KIND_SUB: Record<PxKind, string> = {
  pv: "Muomalaga Dt va Kt hisobvarag'ini toping",
  acc: "Raqamdan nomni, nomdan raqamni toping",
  side: "Hisobvaraq qaysi bo'limga tegishli?",
};
export const SIDES: Record<string, string> = { a: "Aktiv", l: "Majburiyat", e: "Kapital", r: "Daromad", x: "Xarajat" };
export const QUEST_T: Record<string, string> = {
  play3: "3 ta o'yin o'ynang", right10: "Bitta o'yinda 10 ta to'g'ri javob", all3: "Uchala o'yin turini o'ynang", combo7: "7 ta to'g'ri javob ketma-ket",
};
export const ACH_T: Record<string, [string, string]> = {
  first: ["Birinchi qadam", "Birinchi o'yin"],
  games10: ["Mashq ishqibozi", "10 ta o'yin"],
  games50: ["Temir intizom", "50 ta o'yin"],
  r100: ["Yuzlik", "100 ta to'g'ri javob"],
  r1000: ["Mingtalik", "1000 ta to'g'ri javob"],
  sniper: ["Snayper", "Bitta o'yinda 20 ta to'g'ri"],
  clean: ["Xatosiz", "10+ to'g'ri va birorta xato yo'q"],
  combo10: ["Seriya ustasi", "10 ta to'g'ri ketma-ket"],
  streak3: ["3 kun ketma-ket", "3 kun uzluksiz mashq"],
  streak7: ["Bir hafta to'xtovsiz", "7 kun uzluksiz mashq"],
  master: ["Uch yo'nalish ustasi", "Har bir o'yinda 150+ ball"],
  top3: ["Oy kuchli uchligi", "Oylik reytingda 1–3-o'rin"],
};
export const fmtSum = (n: number) => Number(n || 0).toLocaleString("ru-RU").replace(/\s/g, " ");
export const daysLeftInMonth = () => {
  const d = new Date(Date.now() + 5 * 3600e3); const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate() - d.getUTCDate() + 1;
};

const auth = () => ({ p_id: S.pid, p_token: S.token });
let lastMe = 0;
export async function pxMe(force = false): Promise<PxMe | null> {
  if (!S.pid || !S.token) return null;
  if (!force && S.px && Date.now() - lastMe < 90000) return S.px as PxMe;
  lastMe = Date.now();
  try { const m = await rpc<PxMe>("liga_px_me", auth()); if (m) { S.px = m; persist(); } return m; }
  catch { return (S.px as PxMe) || null; }
}
/* Sovrinli musobaqa faqat telefonda: Telegram Android/iOS, Android ilova yoki telefon brauzeri. Kompyuter (Telegram Desktop, web) — yo'q. */
export function pxPlatform(): string {
  const w = window as any, tg = w.Telegram?.WebApp, ua = navigator.userAgent || "";
  if (w.Capacitor?.isNativePlatform?.()) return "android_app";
  if (tg?.initData) { const p = String(tg.platform || ""); return p === "android" || p === "ios" ? p : "desktop"; }
  const touch = (navigator as any).maxTouchPoints > 0 || "ontouchstart" in window;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) && touch && Math.min(screen.width, screen.height) <= 900 ? "mobile_web" : "desktop";
}
export const pxOnPhone = () => pxPlatform() !== "desktop";
/* avtomatlashtirilgan brauzer (bot/skript) — o'ynatilmaydi */
export const pxAutomated = () => !!(navigator as any).webdriver;
export const pxStart = (kind: PxKind) => rpc<PxState>("liga_px_start", { ...auth(), p_kind: kind, p_platform: pxAutomated() ? "bot" : pxPlatform() });
/* musobaqa to'lovi: chek rasmi ilova ichidan (bot orqali ham bo'ladi: /start px) */
export async function pxReceipt(img: string) {
  const r = await rpc<any>("liga_px_receipt_submit", { ...auth(), p_image: img });
  if (S.px) { S.px = { ...(S.px as any), pay: "check" }; persist(); }
  lastMe = 0; bump();
  return r;
}
export const pxAnswer = (sid: string, k: number, ans: Record<string, unknown>) => rpc<PxRes>("liga_px_answer", { ...auth(), p_sid: sid, p_k: k, p_ans: ans });
export async function pxFinish(sid: string) {
  const r = await rpc<any>("liga_px_finish", { ...auth(), p_sid: sid });
  lastMe = 0; pxMe(true).then(() => bump());
  return r;
}
export const pxBoard = (scope: "month" | "week" | "day") => rpc<PxRow[]>("liga_px_board", { p_id: S.pid || null, p_scope: scope });
export const pxWinners = () => rpc<any[]>("liga_px_winners", { p_id: S.pid || null });
