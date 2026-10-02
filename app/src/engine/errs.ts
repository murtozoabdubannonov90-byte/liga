/* Xatolar ustida ishlash: xato savol misol bilan tushuntiriladi, keyin chalg'ituvchilar orasida yana so'raladi,
   so'ng teskari savol beriladi. Ikkalasi ham to'g'ri bo'lsa — xato daftardan o'chadi. */
import { S, persist } from "./state";
import { allTopicTasks, hstr, shuffle, fmt, type Task } from "./data";
import { C, taskById, type Run, type Q } from "./run";
import { t as tr } from "../lib/i18n";

export interface ErrInfo { at: number; my?: Mine; task?: Task }
/* mening javobim: provodka, tanlangan variant matni yoki raqam; "time"/"left" — javob berilmagan */
export interface Mine { dt?: string | null; kt?: string | null; pick?: string | null; val?: string | null; none?: "time" | "left" }

const info = (): Record<string, ErrInfo> => (S.errInfo = S.errInfo || {});
export const errId = (q: Task) => (q.id && !/^R\d/.test(q.id) ? q.id : "S:" + hstr(q.t + "|" + q.q).toString(36));

/* xato yozib qo'yiladi; server savollari (bosqich, final, duel) to'liq saqlanadi — javob allaqachon ochilgan */
export function recordErr(q: Task, my: Mine, remote = false) {
  const id = errId(q), m = info();
  S.errs[id] = true;
  m[id] = { at: Date.now(), my, task: remote || !taskById(id) ? { t: q.t, q: q.q, o: q.o, a: q.a, dt: q.dt, kt: q.kt, e: q.e, unit: q.unit, id } : undefined };
  /* eng eski yozuvlar tozalanadi (telefon xotirasi) */
  const ks = Object.keys(m); if (ks.length > 240) ks.sort((a, b) => m[a].at - m[b].at).slice(0, ks.length - 240).forEach((k) => { delete m[k]; delete S.errs[k]; });
  persist();
}
export function clearErr(id: string) { delete S.errs[id]; if (S.errInfo) delete S.errInfo[id]; }
export const errTask = (id: string): Task | undefined => info()[id]?.task || taskById(id);
/* eng yangi xatolar birinchi */
export function errList(): { id: string; task: Task; my?: Mine; at: number }[] {
  const m = info();
  return Object.keys(S.errs).map((id) => ({ id, task: errTask(id)!, my: m[id]?.my, at: m[id]?.at || 0 })).filter((x) => x.task).sort((a, b) => b.at - a.at);
}

/* ---------- hisobvaraq turi (O'zbekiston BHMS hisobvaraqlar rejasi) ---------- */
export type AccKind = "aktiv" | "kontr" | "majburiyat" | "kapital" | "daromad" | "xarajat" | "tranzit" | "natija";
export function accKind(code: string): AccKind {
  const n = Number(String(code).slice(0, 4)), g = Math.floor(n / 100);
  if (g === 2 || g === 5) return "kontr";               // 0200, 0500 — eskirish, amortizatsiya
  if (n < 6000) return n >= 4900 && n < 5000 ? "kontr" : "aktiv";
  if (n < 8000) return "majburiyat";
  if (n < 9000) return g === 86 ? "kontr" : "kapital";
  if (g === 90 || g === 93 || g === 95 || n === 9710) return "daromad";
  if (g === 92) return "tranzit";
  if (g === 99) return "natija";
  return "xarajat";                                      // 91, 94, 96, 97, 98
}
export const KIND_NAME: Record<AccKind, string> = { aktiv: "aktiv", kontr: "kontr-aktiv", majburiyat: "majburiyat", kapital: "xususiy kapital", daromad: "daromad", xarajat: "xarajat", tranzit: "tranzit", natija: "moliyaviy natija" };
/* debet yoki kreditga yozilganda hisobvaraq bilan nima bo'ladi */
export function sideEffect(k: AccKind, side: "dt" | "kt"): { up: boolean; txt: string } {
  const D: Record<AccKind, [boolean, string, boolean, string]> = {
    aktiv: [true, "ko'paydi", false, "kamaydi"],
    kontr: [false, "kamaydi", true, "ko'paydi"],
    majburiyat: [false, "qarz kamaydi", true, "qarz paydo bo'ldi"],
    kapital: [false, "kamaydi", true, "ko'paydi"],
    daromad: [false, "yopildi (9910 ga)", true, "daromad tan olindi"],
    xarajat: [true, "xarajat tan olindi", false, "yopildi (9910 ga)"],
    tranzit: [true, "chiqim yig'ildi", false, "yopildi"],
    natija: [true, "zarar", false, "foyda"],
  };
  const x = D[k]; return side === "dt" ? { up: x[0], txt: x[1] } : { up: x[2], txt: x[3] };
}
export const RULE: Record<AccKind, string> = {
  aktiv: "Aktiv hisobvaraq debetda ko'payadi, kreditda kamayadi.",
  kontr: "Kontr-aktiv (eskirish, rezerv) teskari: kreditda ko'payadi, debetda kamayadi.",
  majburiyat: "Majburiyat kreditda ko'payadi (qarz paydo bo'ladi), debetda kamayadi (qarz to'lanadi).",
  kapital: "Xususiy kapital kreditda ko'payadi, debetda kamayadi.",
  daromad: "Daromad kreditda tan olinadi, oy oxirida debetdan 9910 ga yopiladi.",
  xarajat: "Xarajat debetda tan olinadi, oy oxirida kreditdan 9910 ga yopiladi.",
  tranzit: "9200 tranzit: chiqib ketgan aktiv qiymati debetga yig'iladi, natija 9310 yoki 9430 ga o'tadi.",
  natija: "9910: kreditda foyda, debetda zarar yig'iladi.",
};
/* savoldagi summa (bo'lmasa — misol uchun 1 000 000) */
export function amountOf(q: string): { n: number; given: boolean } {
  const mln = /(\d+(?:[.,]\d+)?)\s*(mln|million|млн)/i.exec(q); if (mln) return { n: Math.round(parseFloat(mln[1].replace(",", ".")) * 1e6), given: true };
  const re = /\d{1,3}(?:[   ]\d{3})+|\d{4,}/g; let m: RegExpExecArray | null;
  while ((m = re.exec(q))) { const n = Number(m[0].replace(/\D/g, "")); if (n >= 1000 && !/^(19|20)\d\d$/.test(m[0]) && !/^\d{4}$/.test(m[0])) return { n, given: true }; }
  return { n: 1000000, given: false };
}
/* hisoblash xatosining ehtimoliy sababi */
export function calcHint(my: number, right: number): string {
  if (!my || !right || my === right) return "";
  const r = my / right, near = (x: number) => Math.abs(r - x) < 0.006 * x;
  if (near(1.12)) return "Javobingiz 12% ko'p — QQS ajratilmagan bo'lishi mumkin.";
  if (near(1 / 1.12)) return "Javobingiz 12% kam — summaga QQS qo'shilishi kerak edi.";
  if (near(0.12) || near(0.12 / 1.12)) return "Siz faqat QQS summasini hisobladingiz.";
  if (near(12)) return "Javob 12 marta katta — yillik va oylik summa chalkashgan.";
  if (near(1 / 12)) return "Javob 12 marta kichik — yillik summa kerak edi.";
  if (near(0.88)) return "Siz 12% ni ayirdingiz — bu holatda ayirilmaydi.";
  if (near(10) || near(0.1)) return "Javob 10 marta farq qiladi — nol yoki vergul joyini tekshiring.";
  return "";
}
export const fmtMine = (t: Task, my?: Mine) => {
  if (!my) return "";
  if (my.none) return my.none === "time" ? "vaqt tugadi" : "ilovadan chiqildi";
  if (t.t === "pv") return `Dt ${my.dt || "—"} — Kt ${my.kt || "—"}`;
  if (t.t === "mc") return my.pick || "—";
  return my.val ? fmt(Number(String(my.val).replace(/\D/g, ""))) + " " + (t.unit || "so'm") : "—";
};

/* ---------- mashq: asl savol + chalg'ituvchi, keyin teskari savol ---------- */
function pool(t: Task["t"]): Task[] {
  const c = C(); const all: Task[] = [];
  c.STAGES.forEach((s) => all.push(...s.tasks)); all.push(...allTopicTasks(c));
  return all.filter((x) => x.t === t);
}
const pick3 = <T,>(arr: T[], n = 3) => shuffle(arr.slice()).slice(0, n);
export function reverseOf(id: string, t: Task): Task | null {
  const A = C().A;
  if (t.t === "pv" && t.dt && t.kt) {
    const oth = pick3(pool("pv").filter((x) => !(x.dt === t.dt && x.kt === t.kt) && x.q !== t.q).map((x) => x.q).filter((v, i, a) => a.indexOf(v) === i));
    if (oth.length < 3) return null;
    const o = shuffle([t.q, ...oth]);
    return { id: "REV:" + id, t: "mc", q: `Dt ${t.dt} ${A[t.dt] || ""} — Kt ${t.kt} ${A[t.kt] || ""}.\n` + tr("Bu provodka qaysi muomalani aks ettiradi?"), o, a: o.indexOf(t.q), e: t.e, rv: { of: id, kind: "rev" } } as Task;
  }
  if (t.t === "mc" && t.o && t.a != null) {
    const right = t.o[Number(t.a)];
    const oth = pick3(pool("mc").filter((x) => x.q !== t.q && x.o && x.o[Number(x.a)] !== right).map((x) => x.q));
    if (oth.length < 3) return null;
    const o = shuffle([t.q, ...oth]);
    return { id: "REV:" + id, t: "mc", q: tr("«{a}» — qaysi savolning to'g'ri javobi?", { a: right }), o, a: o.indexOf(t.q), e: t.e, rv: { of: id, kind: "rev" } } as Task;
  }
  if (t.t === "calc" && t.a != null) {
    const oth = pick3(pool("calc").filter((x) => Number(x.a) !== Number(t.a) && x.q !== t.q).map((x) => x.q));
    if (oth.length < 3) return null;
    const o = shuffle([t.q, ...oth]);
    return { id: "REV:" + id, t: "mc", q: tr("Javobi {n} bo'lgan masalani toping.", { n: fmt(Number(t.a)) + " " + (t.unit || tr("so'm")) }), o, a: o.indexOf(t.q), e: t.e, rv: { of: id, kind: "rev" } } as Task;
  }
  return null;
}
export function buildReview(max = 5): Q[] | string {
  const list = errList().slice(0, max);
  if (!list.length) return "Xato daftari bo'sh — zo'r!";
  const first: Task[] = [], rev: Task[] = [];
  list.forEach(({ id, task }, k) => {
    first.push({ ...task, id, rv: { of: id, kind: "orig" } } as Task);
    const d = pick3(pool(task.t).filter((x) => x.q !== task.q && !S.errs[x.id]), 1)[0];
    if (d) first.push({ ...d, id: "D:" + d.id + ":" + k, rv: { of: id, kind: "dist" } } as Task);
    const r = reverseOf(id, task); if (r) rev.push(r);
  });
  return [...shuffle(first), ...shuffle(rev)].map((t, k) => ({ ...t, k }));
}
/* yakun: asl savol ham, teskarisi ham to'g'ri — o'zlashtirildi */
export function settleReview(r: Run): number {
  const m: Record<string, { o?: boolean; r?: boolean; hasR: boolean }> = {};
  r.queue.forEach((q) => { const v = (q as any).rv; if (v && v.kind !== "dist") { m[v.of] = m[v.of] || { hasR: false }; if (v.kind === "rev") m[v.of].hasR = true; } });
  r.answers.forEach((a, k) => { const q = r.queue.find((x) => x.id === a.id) || r.queue[k]; const v = (q as any)?.rv; if (!v || v.kind === "dist") return; m[v.of][v.kind === "orig" ? "o" : "r"] = a.ok; });
  let n = 0;
  for (const [id, x] of Object.entries(m)) if (x.o && (x.r || !x.hasR)) { clearErr(id); n++; }
  persist(); return n;
}
