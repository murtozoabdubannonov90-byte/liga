import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Heart, Zap, Share2, RotateCcw, Home as HomeI, Trophy, Clock3 } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { back, replace, setBackGuard, tab, toast, go } from "../lib/nav";
import { C, QSEC, apply, finish, grade, markPending, giftReward, startBlitz, startDaily, startErrs, startTopic, startPractice, type Run, type Q, type Ans, type Fin } from "../engine/run";
import { shuffle, fmt } from "../engine/data";
import { saSettle } from "../engine/score";
import { stageOpen } from "../engine/time";
import { rpc, syncSoon, syncNow, errMsg } from "../engine/server";
import { sfx, burst } from "../lib/fx";
import { Ring, Star, CountUp } from "../components/ui";
import { botNotify } from "./Duel";

const KIND: Record<string, string> = { mc: "Test", pv: "Provodka tuzing", calc: "Hisoblang" };
const isFair = (r: Run) => r.fair;

function Confirm({ text, yes, no, onYes, onNo }: { text: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "grid", alignItems: "end" }} onClick={onNo}>
      <motion.div className="card" style={{ borderRadius: "24px 24px 0 0", padding: "20px 16px calc(18px + var(--safe-b))", display: "grid", gap: 12 }}
        initial={{ y: 60 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontWeight: 700 }}>{text}</p>
        <div className="btn-row"><button className="btn ghost" onClick={onNo}>{no}</button><button className="btn bad" onClick={onYes}>{yes}</button></div>
      </motion.div>
    </div>
  );
}

export default function Quiz({ run }: { run: Run }) {
  const r = run;
  const c = C();
  const [i, setI] = useState(r.i);
  const [ans, setAns] = useState<Ans>({ dt: null, kt: null, pick: null, val: "" });
  const [active, setActive] = useState<"dt" | "kt">("dt");
  const [res, setRes] = useState<null | { ok: boolean; gain: number; why: "time" | "left" | "" }>(null);
  const [left, setLeft] = useState(QSEC);
  const [fin, setFin] = useState<null | Fin>(null);
  const [ask, setAsk] = useState(false);
  const [extra, setExtra] = useState<any>(null);
  const tq: Q = r.queue[i];
  const answered = useRef(false); answered.current = !!res;
  const qEnd = useRef(Date.now() + QSEC * 1000);

  /* variantlar va hisobvaraq tugmalari — har savolda bir marta aralashtiriladi */
  const opts = useMemo(() => {
    if (!tq || tq.t !== "mc" || !tq.o) return [];
    let o = tq.o.map((x, k) => ({ x: /^\d{4} /.test(x) ? x.slice(0, 4) : x, c: k === tq.a }));
    if (tq.o.every((x) => /^\d{4}$/.test(x))) { const pool = shuffle(Object.keys(c.A).filter((k) => !tq.o!.includes(k))); pool.slice(0, 2).forEach((k) => o.push({ x: k, c: false })); }
    return shuffle(o);
  }, [i]);
  const keys = useMemo(() => {
    if (!tq || tq.t !== "pv") return [];
    let pv = [...(tq.o || [tq.dt!, tq.kt!])]; if (!pv.includes(tq.dt!)) pv.push(tq.dt!); if (!pv.includes(tq.kt!)) pv.push(tq.kt!);
    const pool = shuffle(Object.keys(c.A).filter((k) => !pv.includes(k)));
    return shuffle(pv.concat(pool.slice(0, Math.max(0, 8 - pv.length))).slice(0, 8));
  }, [i]);

  useEffect(() => {
    if (!tq) return;
    markPending(r, tq); setAns({ dt: null, kt: null, pick: null, val: "" }); setActive("dt"); setRes(null);
    qEnd.current = Date.now() + QSEC * 1000; setLeft(QSEC); window.scrollTo(0, 0);
  }, [i]);

  /* taymer */
  useEffect(() => {
    if (!r.timed || fin || res) return;
    const iv = setInterval(() => {
      if (r.mode === "stage" && r.si != null && !stageOpen(r.si)) { clearInterval(iv); onClosed(); return; }
      const l = Math.max(0, Math.ceil((qEnd.current - Date.now()) / 1000)); setLeft(l);
      if (l <= 5 && l > 0) sfx("tick");
      if (l <= 0) { clearInterval(iv); check("time"); }
    }, 250);
    return () => clearInterval(iv);
  }, [i, res, fin]);
  /* xodim testi: umumiy vaqt */
  const testEnd = r.testMinutes ? r.startedAt + r.testMinutes * 60000 : 0;
  const [tLeft, setTLeft] = useState(0);
  useEffect(() => { if (!testEnd || fin) return; const iv = setInterval(() => { const l = testEnd - Date.now(); setTLeft(l); if (l <= 0) { clearInterval(iv); doFinish(true); } }, 1000); return () => clearInterval(iv); }, [fin]);

  /* halol o'yin: ilovadan chiqish = xato; nusxalash taqiqlangan */
  useEffect(() => {
    if (!isFair(r)) return;
    const vis = () => { if (document.hidden && !answered.current && !fin) check("left"); };
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", vis);
    ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.addEventListener(ev, block));
    return () => { document.removeEventListener("visibilitychange", vis); ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.removeEventListener(ev, block)); };
  });
  /* orqaga — tasdiq */
  useEffect(() => { setBackGuard(() => { if (fin) return true; setAsk(true); return false; }); return () => setBackGuard(null); }, [fin]);

  const canCheck = tq && (tq.t === "pv" ? !!(ans.dt && ans.kt) : tq.t === "mc" ? ans.pick != null : String(ans.val || "").replace(/\D/g, "") !== "");
  function check(why: "time" | "left" | "" = "") {
    if (!tq || answered.current) return;
    if (r.mode === "stage" && r.si != null && !stageOpen(r.si)) return onClosed();
    answered.current = true;
    let ok = why ? false : grade(tq, { ...ans, opts });
    const a = apply(r, tq, ok);
    setRes({ ok, gain: a.gain, why });
    sfx(ok ? "ok" : "bad");
    if (r.mode === "stage" && a.gain) syncSoon();
    if (r.mode === "final" && S.pid) rpc("liga_final_tick", { p_id: S.pid, p_token: S.token, p_right: r.right, p_done: r.answers.length }).catch(() => {});
    if (ok && r.combo === 5) toast(t("🔥 5 ketma-ket!"));
  }
  function next() {
    const last = i >= r.queue.length - 1;
    if (r.mode === "gift") return doGift();
    if (r.maxLives && r.lives <= 0) return doFinish(false);
    if (last) return doFinish(true);
    r.i = i + 1; setI(i + 1);
  }
  function onClosed() { if (r.si != null) saSettle(r.si); syncNow(); setFin({ passed: false, stars: 0, bonus: 0, dayBonus: 0, total: r.earned }); setExtra({ closed: true }); }
  function doGift() { const n = giftReward(!!res?.ok); setFin({ passed: true, stars: 0, bonus: 0, dayBonus: 0, total: n }); setExtra({ gift: n }); if (res?.ok) burst(); sfx("coin"); syncSoon(); }
  async function doFinish(passed: boolean) {
    const f = finish(r, passed); setFin(f);
    const ms = Date.now() - r.startedAt;
    if (r.mode === "final") {
      S.finRun = { month: r.month, right: r.right, done: r.answers.length, ms, sent: false }; persist();
      try { await rpc("liga_final_submit", { p_id: S.pid, p_token: S.token, p_score: r.right * 20, p_ms: ms }); S.finRun.sent = true; persist(); setExtra({ sent: true, ms }); }
      catch (e) { setExtra({ sent: false, ms, err: errMsg(e) }); }
    } else if (r.mode === "duel" && r.duel) {
      try { const x = (await rpc<any[]>("liga_duel_submit", { p_code: r.duel, p_id: S.pid, p_token: S.token, p_score: r.right, p_ms: ms }))[0];
        setExtra({ sent: true, ms }); botNotify(r.duel, x);
      } catch (e) { setExtra({ sent: false, ms, err: errMsg(e) }); }
    } else if (r.mode === "test" && r.testRun) {
      try { await rpc("liga_test_finish", { p_run: r.testRun, p_score: r.right, p_total: r.queue.length, p_ms: ms, p_detail: r.answers });
        setExtra({ sent: true, ms }); } catch (e) { setExtra({ sent: false, ms, err: errMsg(e) }); }
    } else syncNow();
    if (f.passed && (f.stars === 3 || f.newRecord || r.mode === "final")) { burst(true); sfx("win"); } else if (f.passed) { burst(); sfx("win"); }
  }
  const quit = () => {
    setAsk(false);
    if (r.mode === "stage") { if (!answered.current && tq) { r.mistakes++; } if (r.si != null) saSettle(r.si); syncNow(); back(); return; }
    if (["final", "duel", "test"].includes(r.mode)) { doFinish(true); return; }
    back();
  };

  const wm = useMemo(() => { const u = S.user; return (((u.first || "") + " " + (u.last || "")).trim() + " · " + String(u.phone || "").slice(-4) + "   ").repeat(60); }, []);
  if (fin) return <Result r={r} f={fin} extra={extra} />;
  if (!tq) return null;
  const pct = left / QSEC;
  return (
    <div className="shell bare" style={{ paddingTop: "calc(6px + var(--safe-t))" }}>
      <div className="qbar">
        <button className="x" aria-label={t("Chiqish")} onClick={() => setAsk(true)}><X size={20} /></button>
        <div className="qprog">{r.marks.map((m, k) => <i key={k} className={m || (k === tq.k ? "now" : "")} />)}</div>
        {r.timed && <div className={"timer" + (left <= 10 ? " low" : "")}><Ring pct={pct} size={42} stroke={4} color={left <= 10 ? "var(--red)" : "var(--stamp)"}><b className="num" style={{ fontFamily: "var(--display)", fontSize: 13, fontWeight: 700, color: left <= 10 ? "var(--red)" : "inherit" }}>{left}</b></Ring></div>}
        {r.mode === "blitz" && <span className="chip"><Zap size={13} />{r.right}</span>}
      </div>
      <div className="row" style={{ marginBottom: 10, minHeight: 26 }}>
        {r.maxLives > 0 && <span className="hearts" aria-label={t("Jonlar")}>{Array.from({ length: r.maxLives }).map((_, k) => <Heart key={k} size={18} fill={k < r.lives ? "var(--red)" : "none"} color={k < r.lives ? "var(--red)" : "var(--rule)"} />)}</span>}
        {testEnd > 0 && <span className="chip"><Clock3 size={13} />{Math.max(0, Math.floor(tLeft / 60000))}:{String(Math.max(0, Math.floor(tLeft / 1000) % 60)).padStart(2, "0")}</span>}
        <span className="grow" />
        <AnimatePresence>{r.combo >= 2 && <motion.span key={r.combo} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="chip gold"><Flame size={14} />×{r.combo}</motion.span>}</AnimatePresence>
      </div>
      <motion.article key={i} className="qcard" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        {isFair(r) && <div className="wm" aria-hidden="true">{wm}</div>}
        <div className="qkind">{t(r.title)} · {t(KIND[tq.t])}</div>
        <p className="qtext">{tq.q}</p>
        {tq.t === "pv" && <>
          <div className="taccount">
            {(["dt", "kt"] as const).map((side) => {
              const v = ans[side]; const cls = res ? (v === tq[side] ? "right" : "wrong") : active === side ? "active" : v ? "filled" : "";
              return (<div className="side" key={side}><span className="lbl">{side === "dt" ? t("Debet") : t("Kredit")}</span>
                <button className={"slot " + cls} onClick={() => { if (res) return; sfx("tap"); setAns({ ...ans, [side]: null }); setActive(side); }}>
                  {v ? <span><span className="code">{v}</span>{res && <span className="nm">{c.A[v]}</span>}</span> : <span>{active === side ? t("Hisobvaraqni tanlang") : t("Bo'sh")}</span>}
                </button></div>);
            })}
          </div>
          <div className="keys">{keys.map((k) => (
            <button key={k} className={"key" + (k === ans.dt || k === ans.kt ? " used" : "")} disabled={!!res} onClick={() => {
              sfx("tap"); const n = { ...ans }; if (n.dt === k) n.dt = null; if (n.kt === k) n.kt = null; n[active] = k; setAns(n); setActive(!n.dt ? "dt" : !n.kt ? "kt" : active);
            }}>{k}</button>))}</div>
        </>}
        {tq.t === "mc" && <div className="opts">{opts.map((o, k) => {
          const cls = res ? (o.c ? "right" : k === ans.pick ? "wrong" : "") : k === ans.pick ? "sel" : "";
          return <button key={k} className={"opt " + cls} disabled={!!res} onClick={() => { sfx("tap"); setAns({ ...ans, pick: k }); }}>{o.x}</button>;
        })}</div>}
        {tq.t === "calc" && <div className="calc">
          <input id="num" inputMode="numeric" autoComplete="off" placeholder="0" aria-label={t("Javob")} disabled={!!res} value={ans.val}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAns({ ...ans, val: d ? fmt(+d) : "" }); }}
            onKeyDown={(e) => { if (e.key === "Enter" && canCheck) check(); }} />
          <div className="unit">{tq.unit || t("so'm")} — {t("faqat raqam")}</div></div>}
        <AnimatePresence>{res && <motion.div className={"stamp " + (res.ok ? "ok" : "bad")} initial={{ scale: 2.2, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ type: "spring", stiffness: 520, damping: 18 }}>{res.ok ? t("TO'G'RI") : t("XATO")}</motion.div>}</AnimatePresence>
      </motion.article>
      {!res && <div className="dock"><button className="btn" id="chk" disabled={!canCheck} onClick={() => check()}>{t("Tekshirish")}</button></div>}
      <AnimatePresence>{res && (
        <motion.div className={"sheet-fb " + (res.ok ? "ok" : "bad")} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
          <div>
            <h4>{res.ok ? t("To'g'ri!") + (res.gain ? " +" + res.gain + " XP" : "") : res.why === "left" ? t("Ilovadan chiqildi — savol xato hisoblandi") : res.why === "time" ? t("Vaqt tugadi") : t("Xato — sababini ko'ring")}</h4>
            {!res.ok && <p className="ans">{tq.t === "pv" ? `${t("To'g'ri provodka")}: Dt ${tq.dt} — Kt ${tq.kt}` : tq.t === "mc" ? `${t("To'g'ri javob")}: ${opts.find((o) => o.c)?.x}` : `${t("To'g'ri javob")}: ${fmt(Number(tq.a))} ${tq.unit || t("so'm")}`}</p>}
            {!res.ok && tq.t === "pv" && <p className="small">{tq.dt} — {c.A[tq.dt!]}<br />{tq.kt} — {c.A[tq.kt!]}</p>}
            <p>{tq.e}</p>
            <button className={"btn " + (res.ok ? "ok" : "bad")} id="nx" onClick={next}>
              {r.mode === "gift" ? t("Sovg'ani ochish") : r.maxLives && r.lives <= 0 ? t("Natijani ko'rish") : i >= r.queue.length - 1 ? t("Yakunlash") : t("Davom etish")}
            </button>
          </div>
        </motion.div>)}</AnimatePresence>
      {ask && <Confirm text={r.mode === "stage" ? t("Chiqasizmi? Javobsiz savol XATO hisoblanadi va qaytib chiqmaydi. Topgan XP saqlanadi.") : ["final", "duel", "test"].includes(r.mode) ? t("Chiqsangiz, natijangiz shu holatda yuboriladi va qayta kirib bo'lmaydi.") : t("Chiqasizmi? Bu mashq natijasi saqlanmaydi.")}
        yes={t("Chiqish")} no={t("Qolish")} onYes={quit} onNo={() => setAsk(false)} />}
    </div>
  );
}

function Result({ r, f, extra }: { r: Run; f: Fin; extra: any }) {
  const okN = r.answers.filter((a) => a.ok).length, badN = r.answers.length - okN;
  const again = r.mode === "blitz" ? startBlitz : r.mode === "daily" ? startDaily : r.mode === "errs" ? startErrs : r.mode === "practice" ? startPractice : r.mode === "topic" && r.tp ? () => startTopic(r.tp!) : null;
  let title = t("Yakunlandi"), big: any = null;
  if (extra?.closed) title = t("Soat 17:00 — bosqich yopildi");
  else if (r.mode === "gift") { title = extra?.gift > 25 ? t("Sovg'a ochildi!") : t("Qutida kichik sovg'a"); big = <>+<CountUp to={extra?.gift || 0} /> XP</>; }
  else if (r.mode === "blitz") { title = f.newRecord ? t("Yangi rekord!") : t("Blits yakunlandi"); big = <><CountUp to={r.right} />/{r.queue.length}</>; }
  else if (r.mode === "final") { title = t("Final yakunlandi!"); big = <><CountUp to={r.right * 20} /> {t("ball")}</>; }
  else if (r.mode === "duel") { title = t("Duel natijangiz"); big = <><CountUp to={r.right} />/{r.queue.length}</>; }
  else if (r.mode === "test") { title = t("Test yakunlandi"); big = <><CountUp to={r.right} />/{r.queue.length}</>; }
  else if (!f.passed) title = t("Jonlar tugadi");
  else { title = r.mode === "stage" ? t("Bosqich yakunlandi!") : r.mode === "topic" ? t("Yo'nalish mashqi bajarildi!") : t("Mashq bajarildi!"); big = <>+<CountUp to={f.total} /> XP</>; }
  const mmss = (ms: number) => Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return (
    <div className="shell bare">
      <div className="result">
        {r.mode === "stage" && f.passed && <div className="stars">{[0, 1, 2].map((k) => <Star key={k} on={k < f.stars} delay={0.15 + k * 0.18} />)}</div>}
        {r.mode === "final" && <Trophy size={64} color="var(--gold)" style={{ margin: "0 auto" }} />}
        <h2>{title}</h2>
        {big && <div className="hero-n">{big}</div>}
        {!["gift"].includes(r.mode) && <div className="stat3">
          <div><b className="num">{okN}</b><i>{t("to'g'ri")}</i></div><div><b className="num">{badN}</b><i>{t("xato")}</i></div>
          <div><b className="num">{r.mode === "stage" ? S.week.stages[r.si!] || 0 : extra?.ms ? mmss(extra.ms) : S.week.my}</b><i>{r.mode === "stage" ? t("bosqich XP") : extra?.ms ? t("vaqt") : t("hafta XP")}</i></div></div>}
        {f.dayBonus > 0 && <p className="small muted">{t("Kunlik seriya bonusi: +{n} XP", { n: f.dayBonus })}</p>}
        {r.mode === "final" && <p className="small muted">{extra?.sent ? t("Natijangiz yuborildi. G'olib 13:00 da aniqlanadi.") : extra?.err || t("Yuborilmoqda...")}</p>}
        {r.mode === "duel" && <p className="small muted">{extra?.sent ? t("Natija yuborildi. Raqibingiz o'ynagach g'olib ko'rinadi.") : extra?.err || ""}</p>}
        {r.mode === "test" && <p className="small muted">{extra?.sent ? t("Natijangiz kompaniyaga yuborildi. Rahmat!") : extra?.err || ""}</p>}
        {r.mode === "blitz" && <p className="small muted">{t("Blits bali alohida — haftalik jamiga qo'shilmaydi.")}</p>}
        {!f.passed && r.mode === "stage" && <p className="small muted">{t("Topgan XP saqlandi. Javob berilgan savollar qaytmaydi — «Davom etish» bilan qolganlarini ishlaysiz.")}</p>}
      </div>
      <div className="dock"><div style={{ display: "grid", gap: 10 }}>
        {r.mode === "stage" && f.passed && <button className="btn gold" onClick={() => replace("share", { kind: "stage", si: r.si, stars: f.stars })}><Share2 size={18} />{t("Natijani ulashish")}</button>}
        {r.mode === "duel" && <button className="btn" onClick={() => replace("duel", { code: r.duel })}>{t("Duel holati")}</button>}
        {r.mode === "test" ? null : <div className="btn-row">
          {again ? <button className="btn ghost" onClick={() => { const x = (again as any)(); if (typeof x === "string") toast(t(x)); else replace("quiz", { run: x }); }}><RotateCcw size={18} />{t("Yana")}</button>
            : r.mode === "stage" && !f.passed && !extra?.closed ? <button className="btn ghost" onClick={() => replace("intro", { si: r.si })}>{t("Davom etish")}</button> : <span />}
          <button className="btn" onClick={() => tab("home")}><HomeI size={18} />{t("Asosiy")}</button></div>}
      </div></div>
    </div>
  );
}
