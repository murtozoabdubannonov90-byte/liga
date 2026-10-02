/* Ball qoidalari — eski ilova va server bilan bir xil:
   liga bali = bu haftadagi bosqichlar yig'indisi (har bosqich ≤ 450); kunlik mashq, blits, bonus — alohida. */
import { S, persist } from "./state";
import { dkey, stageDate, stageOpen, today, isWd, weekId, STAGE_N, ymd, tzNow, closeH } from "./time";
import { content } from "./data";

export const RANKS: [number, string][] = [[0, "Stajyor"], [200, "Kichik hisobchi"], [500, "Hisobchi"], [900, "Bosh hisobchi o'rinbosari"], [1400, "Bosh buxgalter"], [2000, "Moliya direktori"], [2800, "Provodka ustozi"]];
export function rankOf(xp: number) { let c = RANKS[0], n: [number, string] | null = null; RANKS.forEach((r, k) => { if (xp >= r[0]) { c = r; n = RANKS[k + 1] || null; } }); return { cur: c, next: n }; }
export const WEEK_GOAL = 600;
export const TIERS = ["Bronza", "Kumush", "Oltin", "Olmos"];
export const ACH = [
  { id: "first", n: "Birinchi bosqich", d: "Bitta bosqichni yakunlash" },
  { id: "perfect", n: "Xatosiz", d: "Bosqichni 3 yulduz bilan o'tish" },
  { id: "combo5", n: "5 ketma-ket", d: "5 ta to'g'ri javob ketma-ket" },
  { id: "combo10", n: "10 ketma-ket", d: "10 ta to'g'ri javob ketma-ket" },
  { id: "streak3", n: "3 kun", d: "3 kunlik seriya" },
  { id: "streak7", n: "7 kun", d: "7 kunlik seriya" },
  { id: "lead", n: "Yetakchi", d: "Reytingda 1-o'rin" },
  { id: "half", n: "Yarim yo'l", d: "4 ta bosqich" },
  { id: "daily5", n: "Mashqchi", d: "5 marta kunlik mashq" },
  { id: "comeback", n: "Qaytish", d: "Yiqilgan bosqichni qayta o'tish" },
  { id: "all", n: "Bosh buxgalter", d: "Barcha 12 bosqich" },
  { id: "league", n: "Liga g'olibi", d: "Haftalik ligada 1-o'rin" },
  { id: "duel", n: "Duelchi", d: "Duelda g'alaba" },
  { id: "balance", n: "Balans ustasi", d: "Balansni xatosiz yig'ish" },
];
let onAward: ((id: string) => void) | null = null;
export const setAwardHandler = (f: (id: string) => void) => { onAward = f; };

export function addXP(n: number, cat?: "stage" | "daily" | "blitz" | "bonus") {
  if (!n) return;
  const P = S.week.part;
  if (cat === "blitz") { P.blitz = (P.blitz || 0) + n; S.blitzXP = (S.blitzXP || 0) + n; return; }
  S.xp += n;
  if (cat === "stage") { S.week.my += n; P.stage = (P.stage || 0) + n; return; }
  const c = cat || "bonus"; (P as any)[c] = ((P as any)[c] || 0) + n;
}
export function recalcWeek() {
  const st = S.week.stages; if (!st || !Object.keys(st).length) return;
  let tot = 0; Object.keys(st).forEach((k) => { st[k] = Math.max(0, Math.min(450, st[k] || 0)); tot += st[k]; });
  S.week.my = tot; S.week.part.stage = tot;
}
export function addStageXP(si: number, n: number) {
  if (si == null || !n) return;
  S.stageXP[si] = (S.stageXP[si] || 0) + n; S.week.stages[si] = (S.week.stages[si] || 0) + n; recalcWeek();
}
export function award(id: string) { if (S.ach.includes(id)) return; S.ach.push(id); addXP(60); persist(); onAward && onAward(id); }

/* kunlik bosqich javoblari: har savolga bir marta */
export function saRec(si: number) { const k = dkey(stageDate(si)) + "|" + si; if (!S.sa[k]) S.sa[k] = { m: {}, p: null, b: false }; return S.sa[k]; }
export function saSettle(si: number) {
  const rec = saRec(si);
  if (rec.p != null && !rec.m[rec.p]) { rec.m[rec.p] = "bad"; const t = content(S.lang || "uz").STAGES[si].tasks[rec.p]; if (t) S.errs[t.id] = true; }
  rec.p = null; persist(); return rec;
}
export const saLeft = (si: number) => content(S.lang || "uz").STAGES[si].tasks.map((_, k) => k).filter((k) => !saRec(si).m[k]);
export const saBad = (si: number) => Object.values(saRec(si).m).filter((v) => v === "bad").length;
export function accStats() { let ok = 0, n = 0; Object.keys(S.sa || {}).forEach((k) => Object.values(S.sa[k].m || {}).forEach((v) => { n++; if (v === "ok") ok++; })); return { ok, n }; }

/* kunlik seriya */
const dstr = (d: Date) => dkey(d);
export function recalcStreak() { let n = 0; const d = ymd(tzNow().day); for (let i = 0; i < 90; i++) { if (isWd(d)) { const v = S.days[dstr(d)]; if (v === "done" || v === "shield") n++; else break; } d.setDate(d.getDate() - 1); } S.streak = n; }
export function sweepDays() {
  const n = tzNow(), t = n.day;
  for (let i = 1; i <= 21; i++) { const d = ymd(t); d.setDate(d.getDate() - i); if (isWd(d) && !S.days[dstr(d)]) S.days[dstr(d)] = "missed"; }
  if (n.wd >= 1 && n.wd <= 5 && !S.days[t] && n.h >= closeH(n.wd)) S.days[t] = "missed";
  Object.keys(S.days).forEach((k) => { if (S.days[k] === "missed" && S.shield > 0) { S.days[k] = "shield"; S.shield--; } });
  recalcStreak(); persist();
}
export function markDay() {
  const n = tzNow(), t = n.day;
  if (S.days[t] === "done") return 0;
  if (n.wd < 1 || n.wd > 5) { S.days[t] = "bonus"; S.last = t; persist(); return 0; }
  if (n.h >= closeH(n.wd)) { S.days[t] = "late"; S.last = t; persist(); return 0; }
  S.days[t] = "done"; S.last = t; recalcStreak();
  const bonus = Math.min(120, S.streak * 12); addXP(bonus);
  if (S.streak >= 3) award("streak3"); if (S.streak >= 7) award("streak7");
  persist(); return bonus;
}
export function dailyTick(ok: boolean): boolean {
  const t = today(); if (S.daily.d !== t) S.daily = { d: t, n: 0, got: false };
  if (ok) S.daily.n++;
  let got = false; if (S.daily.n >= 15 && !S.daily.got) { S.daily.got = true; addXP(120); got = true; }
  persist(); return got;
}
export const GIFT_NEED = 5;
export const giftDone = () => S.gift === today();
export const giftCorrect = () => (S.daily.d === today() ? S.daily.n : 0);
export const giftReady = () => !giftDone() && giftCorrect() >= GIFT_NEED;

/* hafta almashuvi: juma 12:00 */
export function checkWeek(): boolean {
  const id = weekId();
  if (!S.week.id) { S.week.id = id; persist(); return false; }
  if (S.week.id === id) return false;
  const my = S.week.my;
  const pr = my >= WEEK_GOAL ? { xp: 400, cup: 0 } : my >= WEEK_GOAL * 0.6 ? { xp: 150, cup: 1 } : my > 0 ? { xp: 50, cup: -1 } : { xp: 0, cup: -1 };
  S.lastWeekXp = my; S.lastPart = { ...S.week.part }; S.lastStages = { ...S.week.stages };
  S.pending = { my, xp: pr.xp, goal: my >= WEEK_GOAL };
  S.xp += pr.xp; if (pr.cup >= 0) S.cups[pr.cup]++;
  S.leagues = (S.leagues || 0) + 1; if (my >= WEEK_GOAL) award("league");
  S.week = { id, my: 0, part: { stage: 0, daily: 0, blitz: 0, bonus: 0 }, stages: {} };
  persist(); return true;
}
export function nextStage(): number | null {
  for (let i = 0; i < STAGE_N; i++) if (stageOpen(i) && !(S.stg && S.stg[i] && S.stg[i].finished)) return i;
  return null;
}
