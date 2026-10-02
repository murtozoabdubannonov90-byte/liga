/* Server o'yinlari: bosqich, oylik final, duel, xodim testi.
   Savollar serverdan JAVOBSIZ keladi; har javob serverda tekshiriladi, vaqt va ball serverda hisoblanadi.
   Ilovada bu savollarning to'g'ri javobi hech qachon saqlanmaydi. */
import { S, persist, bump } from "./state";
import { rpc } from "./server";
import { tx } from "../lib/i18n";
import { addXP, award, dailyTick, markDay, recalcWeek } from "./score";
import { STAGE_N } from "./time";
import type { Run, Q, Mode } from "./run";

export interface StageSt { si: number; n: number; done_n: number; right_n: number; gain: number; bonus: number; stars: number | null; finished: boolean }
export interface RState { run: string; kind: string; n: number; combo: number; right_n: number; done_n: number; gain: number; bonus: number; stars: number | null; finished: boolean; ms?: number | null; started_at?: string }
export interface RRes { ok: boolean; why: "" | "time" | "left" | "skip"; gain: number; reveal: { dt?: string; kt?: string; a?: number; e?: string }; state: RState }

const lang = () => (S.lang === "ru" ? "ru" : "uz");
const auth = (r: Run) => (r.remote?.secret ? { p_id: null, p_token: null, p_secret: r.remote.secret } : { p_id: S.pid, p_token: S.token, p_secret: null });

/* serverdagi bosqich holati (bosh sahifa, xarita) */
export const stg = (si: number): StageSt | null => (S.stg && S.stg[si]) || null;
export const stLeft = (si: number) => { const x = stg(si); return x ? Math.max(0, x.n - x.done_n) : 20; };
export const stTotal = (si: number) => stg(si)?.n || 20;
export const stDone = (si: number) => !!stg(si)?.finished;
export function setStageStatus(rows: any[]) {
  const m: Record<number, StageSt> = {};
  for (const x of rows || []) m[x.si] = { si: x.si, n: x.n, done_n: x.done_n, right_n: x.right_n, gain: x.gain, bonus: x.bonus, stars: x.stars, finished: x.finished };
  S.stg = m;
  /* server — haqiqat manbai: haftalik bosqich ballari */
  for (const k of Object.keys(m)) { const x = m[+k]; S.week.stages[k] = x.gain + x.bonus; if (x.finished && x.stars) S.stars[+k] = Math.max(S.stars[+k] || 0, x.stars); }
  recalcWeek();
}
function keepState(si: number, st: RState) {
  S.stg = S.stg || {};
  S.stg[si] = { si, n: st.n, done_n: st.done_n, right_n: st.right_n, gain: st.gain, bonus: st.bonus, stars: st.stars, finished: st.finished };
  S.week.stages[si] = st.gain + st.bonus; recalcWeek();
}

/* serverdan kelgan ko'rinish → o'yin navbati (javob berilganlari belgilanadi, qolganlari navbatda) */
function fromView(mode: Mode, v: any, o: Partial<Run>): Run {
  const items: any[] = v.items || [];
  const all: Q[] = items.map((x) => ({ id: "R" + x.k, k: x.k, t: x.t, q: tx(x.q || ""), o: x.t === "mc" ? (x.o || []).map((s: string) => tx(s)) : x.o, unit: x.unit ? tx(x.unit) : undefined, e: "" } as Q));
  const queue = all.filter((_, k) => !items[k].st);
  return {
    mode, si: null, title: "", queue, i: 0, lives: 5, maxLives: 5, combo: v.combo || 0, mistakes: items.filter((x) => x.st === "bad").length,
    marks: items.map((x) => (x.st || "") as any), earned: 0, right: v.right_n || 0, noXP: true, timed: true, startedAt: Date.now(), fair: true, answers: [],
    remote: { id: v.run }, state: v, ...o,
  } as Run;
}

const errOf = (e: unknown) => { const m = String((e as any)?.message || e); return m; };

export async function startStageR(si: number): Promise<Run | string> {
  try {
    const v = await rpc<any>("liga_stage_start", { p_id: S.pid, p_token: S.token, p_si: si, p_lang: lang() });
    keepState(si, v); persist(); bump();
    if (!v.items?.some((x: any) => !x.st)) return "Bu bosqich bugun yakunlangan";
    const { C } = await import("./run");
    return fromView("stage", v, { si, title: C().STAGES[si].title, noXP: false });
  } catch (e) {
    const m = errOf(e);
    if (/unpaid/.test(m)) return "Ligaga qo'shilish uchun obuna kerak";
    if (/stage_closed/.test(m)) return "Bosqich hozir yopiq";
    if (/bad_token/.test(m)) { S.token = ""; S.tokenLost = true; persist(); return "Hisobingiz bu telefonga ulanmagan — «Qayta ulanish» tugmasini bosing"; }
    return "Serverga ulanib bo'lmadi — internetni tekshiring";
  }
}
export async function startFinalR(month: string): Promise<Run | string> {
  try {
    const v = await rpc<any>("liga_final_start", { p_id: S.pid, p_token: S.token, p_lang: lang() });
    S.finDone = S.finDone || {}; S.finDone[month] = true; persist();
    return fromView("final", v, { lives: 99, maxLives: 0, month, title: "Oylik final" });
  } catch (e) {
    const m = errOf(e);
    return /final_closed/.test(m) ? "Final yopiq — faqat oyning oxirgi shanbasi 10:00–13:00" : /not_qualified/.test(m) ? "Siz bu oy finalga saralanmagansiz"
      : /already_done/.test(m) ? "Siz buni allaqachon bajargansiz" : "Serverga ulanib bo'lmadi — internetni tekshiring";
  }
}
export async function startDuelR(code: string): Promise<Run | string> {
  try {
    const v = await rpc<any>("liga_duel_start", { p_id: S.pid, p_token: S.token, p_code: code, p_lang: lang() });
    return fromView("duel", v, { lives: 99, maxLives: 0, duel: code, title: "Duel" });
  } catch (e) {
    const m = errOf(e);
    return /duel_taken/.test(m) ? "Bu duelni boshqa odam qabul qilgan" : /already_done/.test(m) ? "Siz buni allaqachon bajargansiz"
      : /duel_expired/.test(m) ? "Duel muddati tugagan" : /not_found/.test(m) ? "Duel topilmadi" : "Serverga ulanib bo'lmadi — internetni tekshiring";
  }
}
/* xodim testi: nomzod ro'yxatdan o'tmaydi; server maxfiy kalit beradi */
export async function beginTestR(code: string, name: string, phone: string): Promise<Run | string> {
  try {
    const v = await rpc<any>("liga_test_begin", { p_code: code, p_name: name, p_phone: phone, p_lang: lang() });
    const started = new Date(v.test_started).getTime();
    return fromView("test", v, { lives: 99, maxLives: 0, title: "Test", testRun: v.run, testMinutes: v.minutes, startedAt: started, remote: { id: v.run, secret: v.secret } });
  } catch (e) {
    const m = errOf(e);
    return /already_done/.test(m) ? "Siz bu testni allaqachon topshirgansiz" : /test_closed/.test(m) ? "Test yopilgan" : /bad_input/.test(m) ? "Ma'lumotlarni tekshiring"
      : "Serverga ulanib bo'lmadi — internetni tekshiring";
  }
}

/* savol ekranda ko'rindi — server vaqtni shu paytdan hisoblaydi; qolgan soniyani qaytaradi */
export async function showR(r: Run, k: number): Promise<number> {
  return rpc<number>("liga_run_show", { ...auth(r), p_run: r.remote!.id, p_k: k });
}
export async function answerR(r: Run, k: number, ans: Record<string, unknown>): Promise<RRes> {
  const x = await rpc<any>("liga_run_answer", { ...auth(r), p_run: r.remote!.id, p_k: k, p_ans: ans });
  const st: RState = x; r.state = st;
  r.combo = st.combo; r.right = st.right_n;
  if (r.mode === "stage" && r.si != null) {
    keepState(r.si, st);
    if (x.got) { S.xp += x.got; S.week.part.stage = S.week.my; }
    if (x.ok) { if (st.combo === 5) award("combo5"); if (st.combo === 10) award("combo10"); dailyTick(true); }
    persist(); bump();
  }
  /* got — shu savol uchun ball; gain — bosqich bo'yicha jami (server holati) */
  return { ok: !!x.ok, why: x.why || "", gain: x.got || 0, reveal: x.reveal || {}, state: st };
}
export async function finishR(r: Run): Promise<RState | null> {
  try { const st = await rpc<RState>("liga_run_finish", { ...auth(r), p_run: r.remote!.id }); r.state = st; return st; } catch { return null; }
}

/* bosqich tugadi — yulduzlar, yutuqlar, kunlik seriya (XP bonus serverda hisoblangan) */
export function stageFinishedLocal(si: number, st: RState) {
  const stars = st.stars || 0;
  const had = S.stars[si] || 0; S.stars[si] = Math.max(had, stars);
  if (st.bonus && !(S.stgBonus || {})[si + "|" + S.week.id]) { S.xp += st.bonus; S.stgBonus = { ...(S.stgBonus || {}), [si + "|" + S.week.id]: true }; }
  award("first"); if (stars === 3) award("perfect");
  if (Object.keys(S.stars).length >= 4) award("half"); if (Object.keys(S.stars).length >= STAGE_N) award("all");
  if (S.failed[si]) award("comeback");
  const dayBonus = markDay(); persist();
  return dayBonus;
}
export { addXP };
