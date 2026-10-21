/* «Sovrinli musobaqa» (avval «Mashq zali»): 3 ta tezkor o'yin (40 soniya, har savolga 10 soniya), oylik reyting va sovrin jamg'armasi.
   Faqat telefonda, faqat to'lov qilganlar, har kuni 09:00–18:00, ballar 22.10.2026 09:00 dan.
   Liga bali, bosqichlar, duel va kubokka ta'sir qilmaydi (server: liga_px_*). */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Dumbbell, ArrowLeftRight, ListOrdered, Scale, Coins, Trophy, Target, Award, Flame, ChevronRight, CircleCheck, Lock, RotateCcw,
  Crown, Footprints, Crosshair, ShieldCheck, CalendarCheck, Zap, Repeat, Medal, Sparkles, BookMarked, Gem } from "lucide-react";
import { S, useStore } from "../engine/state";
import { t, tx } from "../lib/i18n";
import { go, replace, setBackGuard, toast, tryBack } from "../lib/nav";
import { PageTitle, Card, Seg, Empty, Ring, CountUp, useNow } from "../components/ui";
import { C } from "../engine/run";
import { errMsg, rpc } from "../engine/server";
import { sfx, burst } from "../lib/fx";
import { watchAway, AWAY_MS } from "../lib/guard";
import { KINDS, KIND_TITLE, KIND_SUB, SIDES, QUEST_T, ACH_T, fmtSum, daysLeftInMonth, pxMe, pxStart, pxAnswer, pxFinish, pxBoard, pxWinners, pxOnPhone, pxAutomated,
  type PxKind, type PxMe, type PxState, type PxRes, type PxRow } from "../engine/px";

const KIND_IC: Record<PxKind, any> = { pv: ArrowLeftRight, acc: ListOrdered, side: Scale };
const ACH_IC: Record<string, any> = { first: Footprints, games10: Dumbbell, games50: ShieldCheck, r100: Target, r1000: Gem, sniper: Crosshair, clean: Sparkles,
  combo10: Flame, streak3: CalendarCheck, streak7: Repeat, master: BookMarked, top3: Crown };
const MEDAL = ["🥇", "🥈", "🥉"];
/* musobaqada ilovadan chiqish chegarasi qattiqroq (pul sovrini): 1,5 soniya */
const PX_AWAY_MS = 1500;
const tzNowHM = () => { const d = new Date(Date.now() + 5 * 3600e3); return d.toISOString().slice(11, 16); };
const fmtDay = (s?: string | null) => { if (!s) return ""; const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return t("{d}-{m}", { d, m: t(["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"][m - 1]) }) + (s.length > 10 ? " " + s.slice(11, 16) : ""); };
/* o'ynash mumkinmi: telefon, to'lov, boshlanish sanasi, soat oralig'i */
export function pxGate(me: PxMe | null): string {
  if (pxAutomated()) return t("Avtomatlashtirilgan brauzerda o'ynab bo'lmaydi");
  if (!pxOnPhone()) return t("Sovrinli musobaqa faqat telefonda ishlaydi — Telegram'da telefoningizdan oching");
  if (!me) return "";
  if (!me.eligible) return t("Sovrinli musobaqada faqat to'lov qilganlar qatnashadi — ligaga kirish 30 000 so'm");
  if (me.started === false) return t("Musobaqa {d} da boshlanadi", { d: fmtDay(me.start_at) });
  const hm = tzNowHM(), from = me.open_from || "09:00", to = me.open_to || "18:00";
  if (hm < from || hm >= to) return t("Musobaqa har kuni {a} dan {b} gacha ochiq", { a: from, b: to });
  return "";
}
function RulesCard({ me }: { me: PxMe }) {
  const dl = me.days_left ?? daysLeftInMonth();
  return (
    <section className="card px-rules" id="px-rules">
      <div className="row"><CalendarCheck size={20} color="var(--stamp)" /><b className="grow">{t("Musobaqa tugashiga {n} kun qoldi", { n: dl })}</b>
        {me.end_day && <span className="chip">{fmtDay(me.end_day)}</span>}</div>
      <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.55, fontWeight: 600 }}>
        <li>{t("Har kuni {a} dan {b} gacha ochiq", { a: me.open_from || "09:00", b: me.open_to || "18:00" })}</li>
        {me.start_at && <li>{t("Ballar {d} dan hisoblanadi", { d: fmtDay(me.start_at) })}</li>}
        <li>{t("Har o'yin {s} soniya, har savolga {q} soniya", { s: me.secs, q: me.qs || 10 })}</li>
        <li>{t("Faqat telefonda. Ilovadan chiqilsa — o'yin yakunlanadi")}</li>
        <li>{t("Ballar liga baliga va umumiy ballga qo'shilmaydi")}</li>
      </ul>
    </section>);
}
const monName = (m?: string) => { if (!m) return ""; const [y, mm] = m.split("-"); return t(["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"][+mm - 1]) + " " + y; };

function useMe(force = false) {
  useStore();
  const [me, setMe] = useState<PxMe | null>((S.px as PxMe) || null);
  useEffect(() => { let on = true; pxMe(force).then((m) => { if (on && m) setMe(m); }); return () => { on = false; }; }, []);
  return (S.px as PxMe) || me;
}

/* ---------- bosh sahifa kartasi ---------- */
export function PxCard() {
  const me = useMe();
  if (!S.pid || !S.token || (me && !me.on)) return null;
  const fund = me?.fund?.amount || 0, rk = me?.month?.rank;
  return (
    <button className="card px-card" id="px-card" onClick={() => { sfx("tap"); go("px"); }}>
      <span className="ic"><Dumbbell size={22} /></span>
      <span className="grow"><b>{t("Sovrinli musobaqa")}</b>
        <span className="small">{fund > 0 ? t("Oylik sovrin jamg'armasi: {s} so'm", { s: fmtSum(fund) }) : t("3 ta tezkor o'yin — savollar")}
          {rk ? " · " + t("siz {n}-o'rinda", { n: rk }) : ""}</span></span>
      <span className="chip gold"><Coins size={13} />{me?.month?.pts ? fmtSum(me.month.pts) : t("O'ynash")}</span>
    </button>);
}

/* ---------- jamg'arma banneri ---------- */
function FundBanner({ me }: { me: PxMe }) {
  const f = me.fund;
  if (!f || !f.amount) return null;
  return (
    <section className="px-fund" id="px-fund">
      <div className="row"><Coins size={22} /><b className="grow">{t("Oylik sovrin jamg'armasi")}</b><span className="chip">{t("{d} kun qoldi", { d: daysLeftInMonth() })}</span></div>
      <div className="px-fund-sum num"><CountUp to={f.amount} id="pxfund" /> <small>{t("so'm")}</small></div>
      <div className="px-prizes">{f.prizes.map((p, i) => <span key={i}><i>{MEDAL[i] || i + 1 + "."}</i><b className="num">{fmtSum(p)}</b></span>)}</div>
      <p className="small">{t("Oy oxirida Sovrinli musobaqa reytingining kuchli uchligi sovrinni bo'lishadi (obunasi faol bo'lganlar).")}</p>
      <p className="small" id="px-entry">{t("Ligaga kirish — har bir kishi uchun oyiga 30 000 so'm. Ball faqat savollarga to'g'ri javob uchun beriladi.")}</p>
      {!me.eligible && <div className="px-elig"><Lock size={16} /><span className="grow">{t("Sovrin faqat obunasi faol ishtirokchilarga beriladi")}</span>
        <button className="btn sm gold" id="px-pay" onClick={() => go("pay")}>{t("Obuna bo'lish")}</button></div>}
    </section>);
}

/* ---------- Mashq zali ---------- */
export default function Px() {
  const me = useMe(true);
  const [tb, setTb] = useState<"g" | "r">("g");
  return (
    <div className="shell bare">
      <PageTitle title={t("Sovrinli musobaqa")} />
      {!me ? <Empty>{t("Yuklanmoqda...")}</Empty> : <div className="stack">
        <FundBanner me={me} />
        <RulesCard me={me} />
        <div className="px-stats" id="px-stats">
          <div><b className="num">{fmtSum(me.month.pts)}</b><i>{t("oy bali")}</i></div>
          <div><b className="num">{me.month.rank ? me.month.rank + "/" + me.month.n : "—"}</b><i>{t("o'rin")}</i></div>
          <div><b className="num">{fmtSum(me.today.pts)}</b><i>{t("bugun")}</i></div>
          <div><b className="num"><Flame size={15} color="#E8590C" />{me.streak}</b><i>{t("kun ketma-ket")}</i></div>
        </div>
        <p className="small muted" style={{ fontWeight: 600 }}>{t("Sovrinli musobaqa ballari liga baliga, kunlik bosqich va duellarga qo'shilmaydi — alohida reyting.")}</p>
        {/* 2026-10-21: faqat savollar — vazifalar va yutuqlar bo'limlari olib tashlandi */}
        <Seg id="px" value={tb} onChange={setTb} items={[["g", t("Savollar")], ["r", t("Reyting")]]} />
        {tb === "g" && <Games me={me} />}{tb === "r" && <Board me={me} />}
      </div>}
    </div>);
}
function Games({ me }: { me: PxMe }) {
  useNow(30000);
  const gate = pxGate(me);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {gate && <div className="note" id="px-gate" style={{ background: "var(--red-soft)" }}><Lock size={18} /><span className="grow">{gate}</span>
        {!me.eligible && pxOnPhone() && <button className="btn sm gold" id="px-gate-pay" onClick={() => go("pay")}>{t("To'lov qilish")}</button>}</div>}
      {KINDS.map((k) => { const Ic = KIND_IC[k]; return (
        <button key={k} className="card px-game" id={"px-" + k} disabled={!!gate} style={gate ? { opacity: 0.55 } : undefined} onClick={() => { if (gate) { toast(gate); return; } sfx("tap"); go("pxGame", { kind: k }); }}>
          <span className="ic"><Ic size={24} /></span>
          <span className="grow"><b>{t(KIND_TITLE[k])}</b><span className="small">{t(KIND_SUB[k])}</span>
            <span className="small muted">{t("{s} soniya", { s: me.secs })} · {t("rekord {n}", { n: me.total.best[k] || 0 })}</span></span>
          <ChevronRight size={20} />
        </button>); })}
      <div className="note"><Zap size={18} /><span>{t("To'g'ri javob — 10 ball, ketma-ket to'g'ri javoblar uchun +2 dan +10 gacha bonus. Xatoda bonus yo'qoladi.")}</span></div>
    </div>);
}
function Board({ me }: { me: PxMe }) {
  const [sc, setSc] = useState<"month" | "week" | "day">("month");
  const [rows, setRows] = useState<PxRow[] | null>(null), [wins, setWins] = useState<any[]>([]);
  useEffect(() => { setRows(null); pxBoard(sc).then((r) => setRows(r || [])).catch(() => setRows([])); }, [sc]);
  useEffect(() => { pxWinners().then((w) => setWins(w || [])).catch(() => {}); }, []);
  const prizes = me.fund?.prizes || [];
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Seg id="pxsc" value={sc} onChange={setSc} items={[["month", t("Oy")], ["week", t("Hafta")], ["day", t("Bugun")]]} />
      <Card>
        {!rows ? <Empty>{t("Yuklanmoqda...")}</Empty> : !rows.length ? <Empty>{t("Hali hech kim o'ynamagan — birinchi bo'ling!")}</Empty> :
          <ol className="px-board" id="px-board">{rows.map((r) => (
            <li key={r.pos + r.name} className={r.me ? "me" : ""}>
              <span className="pos num">{r.pos <= 3 ? MEDAL[r.pos - 1] : r.pos}</span>
              <span className="grow"><b>{r.name}{r.me ? " · " + t("siz") : ""}</b>
                <i>{t("{n} o'yin", { n: r.games })}{!r.ok ? " · " + t("obunasiz") : ""}{sc === "month" && r.pos <= 3 && prizes[r.pos - 1] && r.ok ? " · " + fmtSum(prizes[r.pos - 1]) + " " + t("so'm") : ""}</i></span>
              <b className="num">{fmtSum(r.pts)}</b>
            </li>))}</ol>}
      </Card>
      {wins.length > 0 && <Card title={t("O'tgan oylar g'oliblari")} right={<Trophy size={18} color="var(--gold)" />}>
        <ul className="px-board" id="px-wins">{wins.map((w) => (
          <li key={w.mon + w.pos} className={w.me ? "me" : ""}><span className="pos">{MEDAL[w.pos - 1] || w.pos}</span>
            <span className="grow"><b>{w.name}</b><i>{monName(w.mon)} · {fmtSum(w.pts)} {t("ball")}</i></span>
            {w.amount > 0 && <b className="num">{fmtSum(w.amount)}</b>}</li>))}</ul>
      </Card>}
    </div>);
}

/* ---------- o'yin ---------- */
export function PxGame({ kind }: { kind: PxKind }) {
  const c = C();
  const [st, setSt] = useState<PxState | null>(null), [err, setErr] = useState("");
  const [fb, setFb] = useState<PxRes | null>(null), [pick, setPick] = useState<{ dt?: string; kt?: string; p?: number }>({});
  const [fin, setFin] = useState<any>(null), [busy, setBusy] = useState(false);
  const end = useRef(0), stRef = useRef<PxState | null>(null), finRef = useRef(false), away = useRef({ at: 0 });
  const now = useNow(250);
  stRef.current = st;
  const finish = async (why?: string) => {
    if (finRef.current || !stRef.current) return; finRef.current = true;
    if (why) toast(why);
    try { const r = await pxFinish(stRef.current.sid); setFin(r); if (r?.record) { sfx("win"); burst(true); } else sfx("coin"); }
    catch (e) { setFin({ score: stRef.current.score, right_n: stRef.current.right_n, done_n: stRef.current.done_n, quests_new: [] }); }
  };
  const begin = async () => {
    setErr(""); setFin(null); setFb(null); setPick({}); finRef.current = false;
    try { const s = await pxStart(kind); end.current = Date.now() + s.left_ms; setSt(s); sfx("tap"); }
    catch (e) { setErr(errMsg(e)); }
  };
  useEffect(() => { const g = pxGate((S.px as PxMe) || null); if (g) { setErr(g); return; } begin(); }, [kind]);
  /* chiqishni tasdiqlash: o'yin yakunlanadi, to'plangan ball saqlanadi */
  useEffect(() => { setBackGuard(() => { if (fin || !st) return true; if (confirm(t("O'yin yakunlansinmi? To'plangan ballar saqlanadi."))) { finish(); return true; } return false; }); return () => setBackGuard(null); }, [fin, st]);
  /* halol o'yin: 3 soniyadan ko'p boshqa ilova/oynaga chiqilsa — o'yin yakunlanadi */
  useEffect(() => watchAway(() => !!stRef.current && !finRef.current, (ms) => { if (ms > PX_AWAY_MS) finish(t("Ilovadan chiqildi — o'yin yakunlandi")); }, away.current), []);
  /* AI'ga qarshi: nusxalash, belgilash, kontekst menyu taqiqlangan */
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.addEventListener(ev, block));
    return () => { ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.removeEventListener(ev, block)); };
  }, []);
  /* har savolga {qs} soniya: o'tib ketsa — javobsiz yuboriladi (xato) */
  const qStart = useRef(Date.now());
  useEffect(() => { qStart.current = Date.now(); }, [st?.k]);
  const left = st && !fin ? Math.max(0, end.current - now) : 0;
  const QS = (st?.qs || (S.px as any)?.qs || 10) * 1000, qLeft = st && !fin && !fb ? Math.max(0, qStart.current + QS - now) : QS;
  useEffect(() => { if (st && !fin && !fb && !busy && qLeft <= 0 && left > 0) send({ timeout: true }); }, [qLeft <= 0]);
  useEffect(() => { if (st && !fin && left <= 0 && !busy) finish(); }, [left <= 0, st, fin, busy]);

  const send = async (ans: Record<string, unknown>) => {
    if (!st || busy || fb || fin) return; setBusy(true);
    try {
      const r = await pxAnswer(st.sid, st.k, ans);
      if (typeof r.left_ms === "number") end.current = Date.now() + r.left_ms;
      if (r.stale) { if (r.over) { finish(); } else setSt({ ...st, ...r, q: r.q || st.q } as PxState); setPick({}); return; }
      sfx(r.ok ? "ok" : "bad"); setFb(r);
      setTimeout(() => {
        setFb(null); setPick({});
        if (r.over || !r.q) finish(); else setSt({ ...st, ...r, q: r.q } as PxState);
      }, r.ok ? 450 : 1400);
    } catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };

  if (err) return (<div className="shell bare"><PageTitle title={t(KIND_TITLE[kind])} />
    <div className="stack"><div className="note" style={{ background: "var(--red-soft)" }}><span>{err}</span></div>
      <button className="btn" onClick={begin}><RotateCcw size={18} />{t("Qayta urinish")}</button></div></div>);
  if (fin) return <PxResult kind={kind} r={fin} again={begin} />;
  if (!st || !st.q) return <div className="shell bare"><PageTitle title={t(KIND_TITLE[kind])} /><Empty>{t("Yuklanmoqda...")}</Empty></div>;
  const q = st.q, secs = st.secs || (S.px?.secs as number) || 40, sec = Math.ceil(left / 1000), low = sec <= 10;
  const wm = ((S.user.first || "") + " " + (S.user.last || "") + " · ").repeat(40);
  const optLabel = (o: string) => q.t === "side" ? t(SIDES[o] || o) : q.t === "acc" && q.mode === "c2n" ? tx(o) : o;
  const okIdx = fb?.ans?.a;
  return (
    <div className="shell bare px-play">
      <div className="ptitle">
        <button className="back" aria-label={t("Orqaga")} onClick={tryBack}><ArrowLeft size={20} /></button>
        <h2 className="grow">{t(KIND_TITLE[kind])}</h2>
        <div className={"timer" + (low ? " low" : "")} id="px-timer"><Ring pct={left / (secs * 1000)} size={42} stroke={4} color={low ? "var(--red)" : "var(--stamp)"}><b className="num">{sec}</b></Ring></div>
      </div>
      <div className="row" style={{ marginBottom: 10, minHeight: 26 }}>
        <span className="chip blue" id="px-score"><Coins size={13} /><span className="num">{st.score}</span></span>
        <span className="chip"><CircleCheck size={13} />{st.right_n}/{st.done_n}</span>
        <span className="grow" />
        <AnimatePresence>{st.combo >= 2 && <motion.span key={st.combo} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="chip gold"><Flame size={14} />×{st.combo}</motion.span>}</AnimatePresence>
      </div>
      <div className="meter px-qtimer" id="px-qtimer" style={{ marginBottom: 8 }}><i style={{ width: (qLeft / QS) * 100 + "%", background: qLeft < 3000 ? "var(--red)" : undefined }} /></div>
      <motion.article key={st.k} className="qcard" initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
        <div className="wm" aria-hidden="true">{wm}</div>
        {q.t === "pv" && <>
          <p className="qtext" id="px-q">{tx(q.q || "")}</p>
          <div className="taccount">
            {(["dt", "kt"] as const).map((side) => {
              const v = pick[side], right = fb?.ans?.[side];
              const cls = fb ? (v === right ? "right" : "wrong") : v ? "filled" : (!pick.dt ? side === "dt" : side === "kt") ? "active" : "";
              return (<div className="side" key={side}><span className="lbl">{side === "dt" ? t("Debet") : t("Kredit")}</span>
                <div className={"slot " + cls}>{v ? <span><span className="code">{v}</span><span className="nm">{c.A[v]}</span></span> : <span>{t("Bo'sh")}</span>}</div></div>);
            })}
          </div>
          <div className="keys px-keys">{q.o.map((k) => (
            <button key={k} className={"key" + (k === pick.dt || k === pick.kt ? " used" : "")} disabled={!!fb || busy} onClick={() => {
              sfx("tap"); const n = { ...pick }; if (n.dt === k) { n.dt = undefined; setPick(n); return; } if (n.kt === k) { n.kt = undefined; setPick(n); return; }
              if (!n.dt) n.dt = k; else n.kt = k; setPick(n);
              if (n.dt && n.kt) send({ dt: n.dt, kt: n.kt });
            }}><span>{k}</span><small>{c.A[k]}</small></button>))}</div>
        </>}
        {q.t !== "pv" && <>
          <div className="qkind">{q.t === "side" ? t("Bu hisobvaraq qaysi bo'limga tegishli?") : q.mode === "c2n" ? t("Hisobvaraq nomini toping") : t("Hisobvaraq raqamini toping")}</div>
          <p className="qtext px-ask" id="px-q">{q.t === "side" ? <><span className="mono">{q.code}</span> {c.A[q.code || ""]}</> : q.mode === "c2n" ? <span className="mono">{q.ask}</span> : tx(q.ask || "")}</p>
          <div className={"opts" + (q.t === "side" ? " px-sides" : "")}>{q.o.map((o, k) => {
            const cls = fb ? (k === okIdx ? "right" : k === pick.p ? "wrong" : "") : k === pick.p ? "sel" : "";
            return <button key={k} className={"opt " + cls + (q.t === "acc" && q.mode === "n2c" ? " mono" : "")} disabled={!!fb || busy}
              onClick={() => { sfx("tap"); setPick({ p: k }); send({ pick: k }); }}>{optLabel(o)}</button>;
          })}</div>
        </>}
        <AnimatePresence>{fb && <motion.div className={"stamp " + (fb.ok ? "ok" : "bad")} initial={{ scale: 2, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}>
          {fb.ok ? "+" + (fb.got || 0) : fb.why === "fast" ? t("JUDA TEZ") : fb.why === "slow" ? t("VAQT") : t("XATO")}</motion.div>}</AnimatePresence>
      </motion.article>
      {fb && !fb.ok && <div className="px-fb" id="px-fb">
        {q.t === "pv" ? <><b>{t("To'g'ri provodka")}: Dt {fb.ans?.dt} — Kt {fb.ans?.kt}</b>{fb.e && <p className="small">{tx(fb.e)}</p>}</>
          : <b>{t("To'g'ri javob")}: {fb.ans?.code} — {q.t === "side" ? t(SIDES[q.o[fb.ans?.a ?? 0]] || "") : c.A[fb.ans?.code || ""]}</b>}
      </div>}
    </div>);
}

function PxResult({ kind, r, again }: { kind: PxKind; r: any; again: () => void }) {
  return (
    <div className="shell bare"><PageTitle title={t(KIND_TITLE[kind])} />
      <div className="stack" id="px-result">
        <section className="card" style={{ textAlign: "center" }}>
          {r.record && <div className="chip gold" style={{ margin: "0 auto 8px" }}><Medal size={14} />{t("Yangi rekord!")}</div>}
          <div className="px-big num"><CountUp to={r.score || 0} /></div>
          <p style={{ fontWeight: 800 }}>{t("ball")} · {t("{r}/{n} to'g'ri", { r: r.right_n || 0, n: r.done_n || 0 })}</p>
          {r.best_combo > 1 && <p className="small muted">{t("Eng uzun seriya: {n}", { n: r.best_combo })}</p>}
        </section>
        {r.month_rank && <div className="note"><Trophy size={18} /><span>{t("Sovrinli musobaqa oylik reytingida {n}-o'rindasiz · {p} ball", { n: r.month_rank, p: fmtSum(r.month_pts || 0) })}</span></div>}
      </div>
      <div className="dock"><div className="row" style={{ gap: 10 }}>
        <button className="btn ghost" onClick={() => replace("px")}>{t("Sovrinli musobaqa")}</button>
        <button className="btn" id="px-again" onClick={again}><RotateCcw size={18} />{t("Yana o'ynash")}</button></div></div>
    </div>);
}

/* ---------- superadmin: jamg'arma va g'oliblar ---------- */
export function PxSuper() {
  const [d, setD] = useState<any>(null), [st, setSt] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const load = () => rpc<any>("liga_px_admin", { p_pin: S.superPin }).then((x) => { setD(x); setF({ ...(x?.cfg || {}) }); }).catch((e) => setSt(errMsg(e)));
  useEffect(() => { load(); }, []);
  const save = async (k: string, v: string) => {
    try { await rpc("liga_px_admin_set", { p_pin: S.superPin, p_key: k, p_val: v }); setSt("✅ " + t("Saqlandi")); load(); } catch (e) { setSt(errMsg(e)); } };
  if (!d) return <Empty>{st || t("Yuklanmoqda...")}</Empty>;
  const on = (d.cfg?.px_on || "on") === "on";
  return (
    <div className="stack" id="px-super">
      <Card title={t("Sovrinli musobaqa — {m}", { m: monName(d.mon) })} right={<span className={"chip " + (on ? "ok" : "")}>{on ? t("yoqilgan") : t("o'chiq")}</span>}>
        <p style={{ fontWeight: 800 }}>{t("Sovrin jamg'armasi")}: {fmtSum(d.fund)} {t("so'm")}</p>
        <p className="small muted">{t("{p} kishi · {g} o'yin", { p: d.players, g: d.games })}</p>
        <ol className="px-board" style={{ marginTop: 8 }}>{(d.top || []).map((x: any, i: number) => (
          <li key={i}><span className="pos">{i + 1}</span><span className="grow"><b>{x.name}</b><i>{x.ok ? t("obuna faol") : t("obunasiz")}</i></span><b className="num">{fmtSum(x.pts)}</b></li>))}</ol>
      </Card>
      <Card title={t("Sozlamalar")}>
        <div className="stack" style={{ gap: 10 }}>
          {([["px_fund_per_pay", "Har bir to'lovdan jamg'armaga (so'm)"], ["px_fund_base", "Boshlang'ich jamg'arma (so'm)"], ["px_split", "Taqsimot, % (masalan 50,30,20)"], ["px_secs", "O'yin vaqti (soniya)"]] as [string, string][]).map(([k, l]) => (
            <div className="field" key={k}><label htmlFor={k}>{t(l)}</label>
              <div className="row" style={{ gap: 8 }}><input id={k} className="inp mono grow" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                <button className="btn sm" onClick={() => save(k, (f[k] || "").trim())}>{t("Saqlash")}</button></div></div>))}
          <button className={"btn sm " + (on ? "bad" : "")} id="px-onoff" onClick={() => save("px_on", on ? "off" : "on")}>{on ? t("Sovrinli musobaqani o'chirish") : t("Sovrinli musobaqani yoqish")}</button>
          <p className="small">{st}</p>
        </div>
      </Card>
      <Card title={t("G'oliblar")} right={<Trophy size={18} />}>
        {!(d.wins || []).length ? <Empty>{t("Hali oy yakunlanmagan — g'oliblar oy oxirida avtomatik aniqlanadi")}</Empty> :
          <ul className="px-board">{d.wins.map((w: any) => (
            <li key={w.mon + w.pos}><span className="pos">{MEDAL[w.pos - 1] || w.pos}</span>
              <span className="grow"><b>{w.name}</b><i>{monName(w.mon)} · {w.phone || ""} · {fmtSum(w.amount)} {t("so'm")}</i></span>
              <button className={"chip " + (w.paid ? "ok" : "gold")} onClick={async () => { await rpc("liga_px_win_paid", { p_pin: S.superPin, p_mon: w.mon, p_pos: w.pos, p_paid: !w.paid }); load(); }}>
                {w.paid ? t("berildi") : t("berilmagan")}</button></li>))}</ul>}
      </Card>
    </div>);
}
