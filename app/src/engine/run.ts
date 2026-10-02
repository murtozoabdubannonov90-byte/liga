/* Savol-javob jarayoni: bosqich, kunlik mashq, blits, xato daftari, sovg'a, yo'nalish, final, duel, xodim testi */
import { S, persist } from "./state";
import { tx } from "../lib/i18n";
import { content, allTopicTasks, shuffle, srng, hstr, type Task, type Content } from "./data";
import { addXP, addStageXP, award, dailyTick, saRec, saSettle, saBad, saLeft, markDay, giftCorrect } from "./score";
import { unlocked, isWeekend, stageOpen, today, STAGE_N } from "./time";

export type Mode = "stage" | "daily" | "blitz" | "errs" | "gift" | "practice" | "topic" | "final" | "duel" | "test";
export interface Q extends Task { k: number }
export interface Run {
  mode: Mode; si: number | null; tp?: string; title: string; queue: Q[]; i: number; lives: number; maxLives: number;
  combo: number; mistakes: number; marks: ("" | "ok" | "bad")[]; earned: number; right: number; noXP: boolean; timed: boolean;
  startedAt: number; duel?: string; testRun?: string; testMinutes?: number; month?: string; fair: boolean; answers: { id: string; ok: boolean }[];
  /* server o'yini (bosqich, final, duel, test): javoblar serverda tekshiriladi */
  remote?: { id: string; secret?: string }; state?: any;
}
export const QSEC = 60;
export const lang = () => S.lang || "uz";
export const C = (): Content => content(lang());

/* jamoa savollari (admin qo'shgan) */
export function customTasks(): Task[] {
  return (S.customQ || []).map((c: any) => ({ id: "C" + c.id, tp: "jamoa", t: c.t, q: c.q, o: c.o || undefined, a: c.a != null ? Number(c.a) : undefined,
    dt: c.dt || undefined, kt: c.kt || undefined, e: c.e || "", unit: c.unit || undefined } as Task));
}
export function taskById(id: string): Task | undefined { if (id.startsWith("C")) return customTasks().find((t) => t.id === id); return C().TASKMAP[id]; }

function freshFirst(pool: Task[]): Task[] { const now = Date.now(), seen = S.seen || {}; const age = (t: Task) => (t.id && seen[t.id] ? now - seen[t.id] : 1e13); return shuffle(pool.slice()).sort((a, b) => age(b) - age(a)); }
const openIdx = () => { const o = Array.from({ length: STAGE_N }, (_, i) => i).filter(unlocked); return o.length ? o : [0]; };
const q = (arr: Task[]): Q[] => arr.map((t, k) => ({ ...t, k }));
function mk(mode: Mode, queue: Q[], o: Partial<Run> = {}): Run {
  return { mode, si: null, title: "", queue, i: 0, lives: 5, maxLives: 5, combo: 0, mistakes: 0, marks: queue.map(() => ""), earned: 0, right: 0,
    noXP: false, timed: true, startedAt: Date.now(), fair: false, answers: [], ...o };
}

export function startDaily(): Run {
  const c = C(); let st: Task[] = []; openIdx().forEach((i) => st.push(...c.STAGES[i].tasks));
  const pool = shuffle(freshFirst(st).slice(0, 5).concat(freshFirst(allTopicTasks(c).concat(customTasks())).slice(0, 5)));
  return mk("daily", q(pool), { noXP: isWeekend(), title: "Kunlik mashq" });
}
export function startBlitz(): Run {
  const c = C(); let pool: Task[] = []; openIdx().forEach((i) => c.STAGES[i].tasks.forEach((t) => t.t === "pv" && pool.push(t)));
  pool = pool.concat(allTopicTasks(c).filter((t) => t.t === "pv"));
  return mk("blitz", q(freshFirst(pool).slice(0, 20)), { lives: 99, maxLives: 0, timed: false, noXP: isWeekend(), title: "Blits" });
}
export function startErrs(): Run | string {
  const ids = Object.keys(S.errs); if (!ids.length) return "Xato daftari bo'sh — zo'r!";
  const pool = shuffle(ids.map(taskById).filter(Boolean) as Task[]).slice(0, 12);
  return mk("errs", q(pool), { noXP: isWeekend(), lives: isWeekend() ? 99 : 5, title: "Xato daftari" });
}
export function startGift(): Run | string {
  if (isWeekend()) return "Shanba va yakshanba sovg'a yo'q";
  if (S.gift === today()) return "Bugungi sovg'a olingan — ertaga yana";
  if (giftCorrect() < 5) return "Avval 5 ta to'g'ri javob bering";
  const c = C(); let pool: Task[] = []; openIdx().forEach((i) => pool.push(...c.STAGES[i].tasks));
  return mk("gift", q([shuffle(pool)[0]]), { lives: 1, maxLives: 1, title: "Kunlik sovg'a" });
}
export function startPractice(): Run { const r = startDaily(); r.mode = "practice"; r.noXP = true; r.lives = 99; r.maxLives = 0; r.title = "Qo'shimcha mashq"; return r; }
export function startTopic(id: string): Run | string {
  const tp = id === "jamoa" ? { id, title: "Jamoa savollari", tasks: customTasks() } : C().TOPICS.find((x) => x.id === id);
  if (!tp || !tp.tasks.length) return "Bu yo'nalishda savol yo'q";
  return mk("topic", q(freshFirst(tp.tasks).slice(0, 10)), { tp: id, noXP: isWeekend(), title: tp.title });
}
/* qonun yangiligi bo'yicha qisqa test (superadmin yozgan savollar) */
export function startNews(n: any): Run | string {
  const qs: any[] = n?.qs || []; if (!qs.length) return "Hali savol yo'q";
  const tasks = qs.map((x, k) => ({ t: "mc", q: tx(x.q), o: (x.o || []).map((s: string) => tx(s)), a: Number(x.a), e: tx(x.e || ""), id: "N" + n.id + "-" + k } as Task));
  return mk("topic", q(tasks), { noXP: isWeekend(), title: "Qonun yangiligi" });
}
/* ---------- javob ---------- */
export interface Ans { dt?: string | null; kt?: string | null; pick?: number | null; opts?: { x: string; c: boolean }[]; val?: string }
export function grade(t: Task, a: Ans): boolean {
  if (t.t === "pv") return a.dt === t.dt && a.kt === t.kt;
  if (t.t === "mc") return a.pick != null && !!a.opts && !!a.opts[a.pick]?.c;
  const raw = String(a.val || "").replace(/[^\d-]/g, ""); return raw !== "" && Number(raw) === Number(t.a);
}
export interface AnsRes { ok: boolean; gain: number; giftReady?: boolean; combo: number; ach?: string }
/* javobni hisobga olish (XP, belgilar, xato daftari) */
export function apply(r: Run, t: Q, ok: boolean): AnsRes {
  if (t.id) S.seen[t.id] = Date.now();
  if (t.tp) { const ta = S.tacc[t.tp] || (S.tacc[t.tp] = { ok: 0, n: 0 }); ta.n++; if (ok) ta.ok++; }
  if (r.mode === "stage" && r.si != null) { const rec = saRec(r.si); rec.m[t.k] = ok ? "ok" : "bad"; rec.p = null; }
  r.answers.push({ id: t.id, ok });
  let gain = 0;
  if (ok) {
    r.combo++; r.right++;
    gain = r.noXP ? 0 : r.mode === "daily" || r.mode === "topic" ? 8 : 10;
    if (!r.noXP) { if (r.combo >= 3) gain += 5; if (r.combo >= 7) gain += 5; }
    r.earned += gain; if (r.marks[t.k] !== "bad") r.marks[t.k] = "ok";
    if (r.mode === "stage" && gain && r.si != null) { addXP(gain, "stage"); addStageXP(r.si, gain); }
    if (!r.noXP && ["stage", "daily", "topic", "errs"].includes(r.mode)) { if (r.combo === 5) award("combo5"); if (r.combo === 10) award("combo10"); }
    if (!r.noXP && ["stage", "daily", "topic", "errs", "blitz"].includes(r.mode)) dailyTick(true);
    if (t.id && S.errs[t.id] && ["errs", "daily", "topic"].includes(r.mode)) delete S.errs[t.id];
  } else {
    r.combo = 0; if (r.maxLives) r.lives--; r.mistakes++; r.marks[t.k] = "bad";
    if (t.id && !["test"].includes(r.mode)) S.errs[t.id] = true;
  }
  if (r.mode === "final") S.finRun = { month: r.month, right: r.right, done: r.answers.length, ms: Date.now() - r.startedAt, sent: false };
  persist();
  return { ok, gain, combo: r.combo };
}
/* bosqichda savol ko'rsatildi (javobsiz chiqib ketsa — xato) */
export function markPending(r: Run, t: Q) { if (r.mode === "stage" && r.si != null) { saRec(r.si).p = t.k; persist(); } }

/* ---------- yakun ---------- */
export interface Fin { passed: boolean; stars: number; bonus: number; dayBonus: number; total: number; newRecord?: boolean; stageDone?: boolean }
export function finish(r: Run, passed: boolean): Fin {
  if (r.mode === "blitz") {
    const rec = r.right > (S.blitz || 0); if (rec) S.blitz = r.right;
    addXP(r.earned, "blitz"); markDay(); persist();
    return { passed: true, stars: 0, bonus: 0, dayBonus: 0, total: r.earned, newRecord: rec };
  }
  if (r.noXP || ["final", "duel", "test", "gift"].includes(r.mode)) { persist(); return { passed, stars: 0, bonus: 0, dayBonus: 0, total: r.earned }; }
  let stars = 0, bonus = 0, stageDone = false;
  if (r.mode === "stage" && r.si != null) { saSettle(r.si); stageDone = !saLeft(r.si).length; if (stageDone) passed = true; }
  if (!passed) { if (r.mode === "stage" && r.si != null) S.failed[r.si] = true; persist(); return { passed, stars: 0, bonus: 0, dayBonus: 0, total: r.earned, stageDone }; }
  const miss = r.mode === "stage" && r.si != null ? saBad(r.si) : r.mistakes;
  stars = miss === 0 ? 3 : miss <= 2 ? 2 : 1;
  if (r.mode === "stage" && r.si != null) {
    const rec = saRec(r.si); bonus = rec.b ? 0 : stars * 30; rec.b = true;
    if (bonus) { addXP(bonus, "stage"); addStageXP(r.si, bonus); }
    S.stars[r.si] = Math.max(S.stars[r.si] || 0, stars);
    award("first"); if (stars === 3) award("perfect"); if (Object.keys(S.stars).length >= 4) award("half");
    if (Object.keys(S.stars).length >= STAGE_N) award("all"); if (S.failed[r.si]) award("comeback");
  } else {
    bonus = 70; addXP(r.earned + bonus, r.mode === "daily" || r.mode === "topic" ? "daily" : undefined);
    S.dailyRuns = (S.dailyRuns || 0) + 1; if (S.dailyRuns >= 5) award("daily5");
  }
  const dayBonus = markDay(); persist();
  return { passed, stars, bonus, dayBonus, total: r.earned + bonus + dayBonus, stageDone };
}
export function giftReward(ok: boolean) { const n = ok ? [80, 110, 140, 170, 200][Math.floor(Math.random() * 5)] : 25; S.gift = today(); addXP(n); persist(); return n; }
