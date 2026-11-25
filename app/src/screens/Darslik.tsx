/* «Darsliklar» (2026-11-25): o'tgan kunlarning darsliklari — nazariya va provodka mashqi.
   - Ro'yxat va darslik serverdan keladi (faqat o'tgan kunlar, takrorlanmaydi: har kun — o'z mavzusi).
   - Savollar JAVOBSIZ keladi, har javob serverda tekshiriladi (liga_lesson_check).
   - Xato javob qaytib chiqmaydi: to'g'ri provodka va izoh ko'rsatiladi, keyingi savolga o'tiladi.
   - «Boshidan boshlash» — shu darslik noldan, hamma savol qayta.
   - Ballar ligaga qo'shilmaydi; progress telefonda saqlanadi. */
import { useEffect, useState } from "react";
import { BookOpenCheck, ChevronRight, RotateCcw, Check, Library, Play } from "lucide-react";
import { S, persist, bump } from "../engine/state";
import { t, tx } from "../lib/i18n";
import { go, replace, toast } from "../lib/nav";
import { rpc, joinServer } from "../engine/server";
import { PageTitle } from "../components/ui";
import { EmptyScreen } from "../components/Boundary";
import type { Run, Q } from "../engine/run";

export interface DItem { day: string; level: number; icon?: string; title: Record<string, string>; n: number }
export interface DLesson { day: string; level: number; icon?: string; title: string; story?: string; theory?: string; items: { id: string; q: string; q_ru?: string; o: string[] }[]; lang: string }
type Prog = Record<string, "ok" | "bad">;
interface DState { list?: DItem[]; at?: number; c?: Record<string, DLesson>; p?: Record<string, Prog> }

const LIST_TTL = 6 * 3600e3; /* trafik tejash: ro'yxat 6 soatda bir */
export const D = (): DState => ((S as any).dars ||= {});
const lng = () => (S.lang === "ru" ? "ru" : "uz");
export const dProg = (day: string): Prog => (D().p ||= {})[day] || {};
const dTitle = (x: DItem) => tx((lng() === "ru" ? x.title.ru : x.title.uz) || x.title.uz || "");
const dFmt = (day: string) => day.slice(8, 10) + "." + day.slice(5, 7);

async function authed(): Promise<string | null> {
  if (S.pid && S.token) return null;
  const r = await joinServer(true);
  return !r.ok || !S.pid || !S.token ? r.msg || "Hisobingiz bu telefonga ulanmagan — «Qayta ulanish» tugmasini bosing" : null;
}
const errText = (e: unknown) => { const m = String((e as any)?.message || e);
  if (/bad_token/.test(m)) { S.token = ""; S.tokenLost = true; persist(); return "Hisobingiz bu telefonga ulanmagan — «Qayta ulanish» tugmasini bosing"; }
  if (/not_found/.test(m)) return "Darslik topilmadi";
  return "Serverga ulanib bo'lmadi — internetni tekshiring"; };

export async function loadList(force = false, quiet = false): Promise<DItem[] | string> {
  const d = D();
  if (!force && d.list && d.at && Date.now() - d.at < LIST_TTL) return d.list;
  /* Asosiy oynadagi karta serverga ulanishni o'zi boshlamaydi (ro'yxatdan o'tish jarayoniga aralashmasin) */
  if (quiet && !(S.pid && S.token)) return d.list || [];
  const e0 = await authed(); if (e0) return d.list || e0;
  try { const v = await rpc<DItem[]>("liga_lessons", { p_id: S.pid, p_token: S.token }); d.list = Array.isArray(v) ? v : []; d.at = Date.now(); persist(); bump(); return d.list; }
  catch (e) { return d.list || errText(e); }
}
async function loadLesson(day: string): Promise<DLesson | string> {
  const d = D(), c = (d.c ||= {});
  if (c[day] && c[day].lang === lng()) return c[day];
  const e0 = await authed(); if (e0) return e0;
  try {
    const v = await rpc<DLesson>("liga_lesson_get", { p_id: S.pid, p_token: S.token, p_day: day, p_lang: lng() });
    c[day] = { ...v, lang: lng() };
    /* telefon xotirasi: oxirgi 12 ta darslik saqlanadi */
    const ks = Object.keys(c); if (ks.length > 12) ks.sort().slice(0, ks.length - 12).forEach((k) => k !== day && delete c[k]);
    persist(); return c[day];
  } catch (e) { return errText(e); }
}

/* mashq navbati: javob berilganlar (to'g'ri ham, xato ham) qaytmaydi */
export function startLesson(L: DLesson, fresh = false): Run | string {
  if (fresh) { (D().p ||= {})[L.day] = {}; persist(); }
  const pr = dProg(L.day), all = L.items;
  if (!all.length) return "Bu darslikda provodka yo'q";
  const queue: Q[] = [];
  all.forEach((x, k) => { if (!pr[x.id]) queue.push({ id: x.id, k, t: "pv", q: tx(lng() === "ru" ? x.q_ru || x.q : x.q), o: x.o, e: "" } as Q); });
  if (!queue.length) return "Bu darslik yakunlangan — «Boshidan boshlash» bilan qayta ishlang";
  return { mode: "lesson", si: null, title: "Darslik", queue, i: 0, lives: 99, maxLives: 0, combo: 0, mistakes: 0,
    marks: all.map((x) => pr[x.id] || ""), earned: 0, right: 0, noXP: true, timed: false, startedAt: Date.now(), fair: false, answers: [], lessonDay: L.day } as Run;
}
/* javob serverda tekshiriladi */
export async function checkLessonR(qid: string, dt: string | null | undefined, kt: string | null | undefined): Promise<{ ok: boolean; dt: string; kt: string; e: string }> {
  const x = await rpc<any>("liga_lesson_check", { p_id: S.pid, p_token: S.token, p_qid: qid, p_dt: dt || "", p_kt: kt || "", p_lang: lng() });
  return { ok: !!x.ok, dt: x.dt, kt: x.kt, e: tx(x.e || "") };
}
export function saveLessonAns(day: string, qid: string, ok: boolean) { const p = (D().p ||= {}); p[day] = { ...(p[day] || {}), [qid]: ok ? "ok" : "bad" }; persist(); }
export function restartLesson(day: string): Run | string {
  const L = D().c?.[day]; if (!L) return "Darslik topilmadi";
  return startLesson(L, true);
}

/* ---------- Asosiy oynadagi karta ---------- */
export function DarslikCard() {
  const [, setV] = useState(0);
  useEffect(() => { loadList(false, true).then(() => setV((x) => x + 1)); }, [S.token]);
  const L = D().list || [];
  const done = L.filter((x) => Object.keys(dProg(x.day)).length >= x.n && x.n > 0).length;
  const pv = L.reduce((a, x) => a + x.n, 0);
  return (
    <button className="card" id="darslik-card" style={{ textAlign: "left" }} onClick={() => go("darsliklar")}>
      <div className="card-h"><Library size={20} color="var(--green)" /><h3>{t("Darsliklar")}</h3>
        {L.length > 0 && <span className="chip ok">{t("{n} ta", { n: L.length })}</span>}<ChevronRight size={18} /></div>
      <p style={{ fontWeight: 700 }}>{t("O'tgan kunlarning barcha darsliklari — o'qing va provodkalarni ishlang")}</p>
      <p className="small muted" style={{ marginTop: 4 }}>{L.length ? t("{p} ta provodka · bajarildi: {d}/{n}", { p: pv, d: done, n: L.length }) : t("Bosib oching")}</p>
    </button>
  );
}

/* ---------- ro'yxat ---------- */
export function Darsliklar() {
  const [list, setList] = useState<DItem[] | null>(D().list || null);
  const [err, setErr] = useState("");
  useEffect(() => { loadList().then((v) => { if (typeof v === "string") setErr(v); else setList(v.slice()); }); }, []);
  if (!list && err) return <EmptyScreen text={t(err)} />;
  if (!list) return <div className="shell bare"><PageTitle title={t("Darsliklar")} /><div className="splash"><span className="spinner" />{t("Yuklanmoqda...")}</div></div>;
  const rows = list.slice().reverse(); /* eng yangisi tepada */
  return (
    <div className="shell bare">
      <PageTitle title={t("Darsliklar")} />
      <div className="stack" style={{ gap: 8 }}>
        <div className="note"><BookOpenCheck size={18} color="var(--green)" /><span>{t("Har darslik — bir kunning mavzusi, takrorlanmaydi. Ichiga kiring: avval qoida, keyin provodkalar. Xato javob qaytib chiqmaydi — to'g'ri javob va sababi ko'rsatiladi. Ballar ligaga qo'shilmaydi.")}</span></div>
        {!rows.length && <p className="muted">{t("Hali darslik yo'q.")}</p>}
        {rows.map((x) => {
          const pr = dProg(x.day), n = Object.keys(pr).length, ok = Object.values(pr).filter((v) => v === "ok").length, full = x.n > 0 && n >= x.n;
          return (
            <button key={x.day} className="card row darslik-row" data-day={x.day} style={{ textAlign: "left", padding: 13 }} onClick={() => go("darslik", { day: x.day })}>
              <span style={{ fontSize: 24, width: 32, textAlign: "center" }}>{x.icon || "📘"}</span>
              <span className="grow"><b style={{ fontSize: 14.5 }}>{dTitle(x)}</b><br />
                <span className="tiny muted" style={{ fontWeight: 700 }}>{dFmt(x.day)} · {t("{n} ta provodka", { n: x.n })}{n ? " · " + t("{ok}/{n} to'g'ri", { ok, n: x.n }) : ""}</span></span>
              {full ? <Check size={18} color="var(--green)" /> : n ? <span className="chip">{n}/{x.n}</span> : <ChevronRight size={18} />}
            </button>);
        })}
      </div>
    </div>
  );
}

/* ---------- bitta darslik ---------- */
export function DarslikView({ day }: { day: string }) {
  const [L, setL] = useState<DLesson | null>(null);
  const [err, setErr] = useState("");
  const [, setV] = useState(0);
  useEffect(() => { loadLesson(day).then((v) => (typeof v === "string" ? setErr(v) : setL(v))); }, [day]);
  if (err) return <EmptyScreen text={t(err)} />;
  if (!L) return <div className="shell bare"><PageTitle title={t("Darslik")} /><div className="splash"><span className="spinner" />{t("Yuklanmoqda...")}</div></div>;
  const pr = dProg(day), n = Object.keys(pr).length, ok = Object.values(pr).filter((v) => v === "ok").length, total = L.items.length, full = n >= total;
  const run = (fresh: boolean) => { const r = startLesson(L, fresh); if (typeof r === "string") { toast(t(r)); return; } go("quiz", { run: r }); };
  return (
    <div className="shell bare">
      <PageTitle title={t("Darslik")} />
      <div className="stack">
        <section className="card">
          <div className="row" style={{ gap: 6, marginBottom: 8 }}><span className="chip blue">{L.icon || "📘"} {dFmt(day)}</span>
            <span className="chip">{t("Qiyinlik darajasi: {l}", { l: L.level })}</span></div>
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>{tx(L.title)}</h3>
          {L.story && <p className="muted" style={{ fontWeight: 600 }}>{tx(L.story)}</p>}
        </section>
        {L.theory && <section className="card lesson-html"><div className="small" style={{ lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: tx(L.theory) }} /></section>}
        <div className="tiles">
          <div className="tile"><span className="ic"><Play size={20} /></span><b>{t("{n} ta provodka", { n: total })}</b><i>{t("vaqt cheklovisiz")}</i></div>
          <div className="tile"><span className="ic"><Check size={20} /></span><b id="dprog">{n}/{total}</b><i>{t("{ok} ta to'g'ri", { ok })}</i></div>
        </div>
      </div>
      <div className="dock"><div style={{ display: "grid", gap: 10 }}>
        {!full && <button className="btn ok" id="go" onClick={() => run(false)}>{n ? t("Davom etish ({n} ta qoldi)", { n: total - n }) : t("Provodkalarni ishlash")}</button>}
        {n > 0 && <button className="btn ghost" id="restart" onClick={() => { run(true); setV((x) => x + 1); }}><RotateCcw size={18} />{t("Boshidan boshlash")}</button>}
      </div></div>
    </div>
  );
}
export const lessonAgain = (r: Run) => () => { const d = (r as any).lessonDay as string; const x = restartLesson(d); if (typeof x === "string") { replace("darslik", { day: d }); return null; } return x; };
