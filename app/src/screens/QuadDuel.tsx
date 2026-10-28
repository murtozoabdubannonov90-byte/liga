/* Guruh dueli — jonli duel 2 tadan 10 kishigacha (2026-10-28: 4 → 10). Bir kishi xona ochib havolani yuboradi, qolganlar havola orqali kiradi.
   20 ta savol: 15 ta provodka + 5 ta savol — o'tgan mavzulardan. Kim birinchi to'g'ri javob bersa — +1 ochko, hammaga keyingi savol.
   Savollar serverdan javobsiz keladi, javob va vaqt serverda tekshiriladi (liga_quad_*). Liga baliga qo'shilmaydi. */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Send, Crown, Users, Home as HomeI, Lock, Hourglass, Eye, Play, LogOut, ChevronRight, UserPlus } from "lucide-react";
import { S, persist } from "../engine/state";
import { t, tx } from "../lib/i18n";
import { rpc, errMsg } from "../engine/server";
import { C } from "../engine/run";
import { shuffle, fmt } from "../engine/data";
import { award } from "../engine/score";
import { go, tab, replace, toast } from "../lib/nav";
import { sfx, burst, cheer } from "../lib/fx";
import { Ring, copyText } from "../components/ui";
import { BOT_LINK, openTg } from "../lib/tg";
import { watchAway, AWAY_MS, AWAY_LOG_MS } from "../lib/guard";

export const isQuad = (code?: string) => !!code && code.length === 7 && code[0] === "Q";
export const quadLink = (code: string) => BOT_LINK + "?start=d_" + code;
const blocked = () => !S.trial && !!(S.me && S.me.personal && S.me.ok === false);
const mmss = (ms: number) => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const MEDAL = ["🥇", "🥈", "🥉"];
export const QMAX = 10;   // serverdagi liga_quad_max() bilan bir xil

export function shareQuad(code: string) {
  const text = t("Guruh dueliga chaqiraman! 2 dan 10 kishigacha bir vaqtda: 20 ta savol (15 provodka + 5 savol), kim birinchi to'g'ri topsa — ochko o'shaniki. Havolani bosing va kiring ⚡");
  openTg("https://t.me/share/url?url=" + encodeURIComponent(quadLink(code)) + "&text=" + encodeURIComponent(text));
}
export async function createQuad(): Promise<string | null> {
  if (blocked()) { go("pay"); return null; }
  if (!S.pid || !S.token) { toast(t("Avval ro'yxatdan o'ting")); return null; }
  try { return await rpc<string>("liga_quad_create", { p_id: S.pid, p_token: S.token, p_lang: S.lang === "ru" ? "ru" : "uz" }); }
  catch (e) { toast(errMsg(e)); return null; }
}
/* xona ochiladi, havola yuborish oynasi chiqadi */
export async function openQuad(rep = false) {
  const c = await createQuad(); if (!c) return;
  sfx("tap"); (rep ? replace : go)("duel", { code: c }); shareQuad(c);
}

/* Asosiy ekrandagi bo'lim */
export function QuadCard() {
  const [busy, setBusy] = useState(false), [list, setList] = useState<any[]>([]);
  useEffect(() => { if (S.pid && S.token) rpc<any[]>("liga_quad_list", { p_id: S.pid, p_token: S.token }).then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  if (!S.pid) return null;
  const open = list.filter((x) => x.status !== "done");
  return (
    <section className="ticket quad-ticket" id="quad-card">
      <div className="t-top"><Users size={40} /><div className="grow">
        <div className="t-title">{t("Guruh dueli")}</div>
        <div className="t-meta">{t("Xona oching va havolani hamkasblaringizga yuboring — 2 tadan 10 kishigacha bir vaqtda o'ynaysiz. 20 ta savol: 15 ta provodka + 5 ta savol, o'tgan mavzulardan. Kim birinchi to'g'ri topsa — ochko o'shaniki.")}</div>
      </div></div>
      {open.length > 0 && <div className="quad-mini">{open.slice(0, 2).map((x) => (
        <button key={x.code} className="quad-mini-r" onClick={() => go("duel", { code: x.code })}>
          <span className="grow"><b>{x.status === "play" ? t("O'yin davom etmoqda") : t("Xona ochiq · {n}/{m}", { n: x.n, m: QMAX })}</b>
            <small>{x.others || t("Hali hech kim kirmadi")}</small></span><ChevronRight size={18} /></button>))}</div>}
      <div className="t-bottom">
        <button className="btn gold" id="quad-create" disabled={busy} onClick={async () => { setBusy(true); await openQuad(); setBusy(false); }}><UserPlus size={18} />{t("Xona ochish va chaqirish")}</button>
      </div>
    </section>);
}

type V = any;
export default function QuadDuel({ code }: { code: string }) {
  const [v, setV] = useState<V>(null), [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const showAt = useRef(0), endAt = useRef(0), closeAt = useRef(0), lastCur = useRef(-1), busy = useRef(false), done = useRef(false);
  const seq = useRef(0), applied = useRef(0), inflight = useRef(false), rank = useRef(-1);
  const rankOf = (x: V) => (x.status === "done" ? 2e6 : x.status === "play" ? 1e6 : 0) + (x.cur || 0) * 10 + (x.locked ? 1 : 0);
  const [ans, setAns] = useState<{ dt: string | null; kt: string | null; pick: number | null; val: string }>({ dt: null, kt: null, pick: null, val: "" });
  const [flash, setFlash] = useState<null | "ok" | "bad">(null);
  const [starting, setStarting] = useState(false);

  const apply = (x: V, id: number) => {
    if (!x || id < applied.current) return;
    const rk = rankOf(x); if (rk < rank.current) return;
    applied.current = id; rank.current = rk;
    const tnow = Date.now(), qi = x.q_in || 0, newQ = x.cur !== lastCur.current;
    if (newQ || qi > 0 || x.status !== "play") showAt.current = tnow + qi;
    const e = x.left != null ? tnow + x.left : 0;
    if (newQ || !e || Math.abs(e - endAt.current) > 1500) endAt.current = e;
    if (x.closes_in != null) closeAt.current = tnow + x.closes_in;
    if (newQ) {
      if (lastCur.current >= 0 && x.last && x.last.k === lastCur.current && x.last.w && x.last.w !== x.me && x.me) sfx("bad");
      lastCur.current = x.cur; setAns({ dt: null, kt: null, pick: null, val: "" }); setFlash(null);
    }
    if (x.status === "done" && !done.current) {
      done.current = true;
      if (x.me && x.winner === x.me) { burst(true); sfx("win"); if (!(S.duelsWon || {})[code]) { S.duelsWon = { ...(S.duelsWon || {}), [code]: 1 }; persist(); award("duel"); } }
    }
    setV(x);
  };
  useEffect(() => {
    let on = true;
    const poll = async () => {
      if (!on || done.current || inflight.current || busy.current) return;
      inflight.current = true; const id = ++seq.current;
      try { const x = await rpc<V>("liga_quad_state", { p_id: S.pid, p_token: S.token, p_code: code }); if (on && !busy.current) apply(x, id); setErr(""); }
      catch (e) { if (on) setErr(errMsg(e)); }
      finally { inflight.current = false; }
    };
    poll(); const iv = setInterval(poll, 1000); const tk = setInterval(() => setNow(Date.now()), 250);
    return () => { on = false; clearInterval(iv); clearInterval(tk); };
  }, [code]);

  /* halol o'yin: savol ochiq turganda 3 soniyadan ko'p boshqa ilovaga chiqqan o'yinchi shu savolda qulflanadi */
  const vRef = useRef<V>(null); vRef.current = v;
  useEffect(() => {
    const playing = () => { const x = vRef.current; return !!(x && x.me && x.status === "play" && x.item && !x.locked && Date.now() >= showAt.current); };
    const stop = watchAway(playing, (ms) => {
      const x = vRef.current; if (!x || !x.me) return;
      if (ms >= AWAY_LOG_MS) rpc("liga_quad_away", { p_id: S.pid, p_token: S.token, p_code: code, p_k: x.cur, p_ms: Math.round(ms) }).catch(() => {});
      if (ms > AWAY_MS && x.status === "play" && !x.locked && !busy.current) {
        busy.current = true; const id = ++seq.current;
        rpc<V>("liga_quad_answer", { p_id: S.pid, p_token: S.token, p_code: code, p_k: x.cur, p_ans: { left: true } })
          .then((y) => { toast(t("Duel paytida ilovadan chiqdingiz — bu savolda qulflandingiz.")); sfx("bad"); busy.current = false; apply(y, id); })
          .catch(() => { busy.current = false; });
      }
    });
    const block = (e: Event) => { if (vRef.current?.me && vRef.current?.status === "play") e.preventDefault(); };
    ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.addEventListener(ev, block));
    return () => { stop(); ["copy", "cut", "contextmenu", "selectstart"].forEach((ev) => document.removeEventListener(ev, block)); };
  }, [code]);
  const wm = useMemo(() => { const u = S.user; return (((u.first || "") + " " + (u.last || "")).trim() + " · " + String(u.phone || "").slice(-4) + "   ").repeat(60); }, []);

  const item = v?.item, A = C().A;
  const opts = useMemo(() => (item?.t === "mc" ? shuffle((item.o || []).map((x: string, i: number) => ({ x: tx(x), i }))) : []), [v?.cur, item?.t]);
  const keys = useMemo(() => (item?.t === "pv" ? shuffle([...(item.o || [])]) : []), [v?.cur, item?.t]);
  const canSend = item && !!v?.me && !v.locked && (item.t === "pv" ? !!(ans.dt && ans.kt) : item.t === "mc" ? ans.pick != null : ans.val.replace(/\D/g, "") !== "");

  async function send() {
    if (!canSend || busy.current) return;
    busy.current = true; const id = ++seq.current;
    const payload = item.t === "pv" ? { dt: ans.dt, kt: ans.kt } : item.t === "mc" ? { pick: (opts[ans.pick!] as any).i } : { val: ans.val.replace(/\D/g, "") };
    try {
      const x = await rpc<V>("liga_quad_answer", { p_id: S.pid, p_token: S.token, p_code: code, p_k: v.cur, p_ans: payload });
      if (x.ok) { sfx("ok"); cheer(true); setFlash("ok"); }
      else if (x.why === "wrong") { sfx("bad"); cheer(false); setFlash("bad"); }
      else if (x.why === "late") toast(t("Kechikdingiz — boshqa o'yinchi birinchi topdi"));
      busy.current = false; apply(x, id);
    } catch (e) { busy.current = false; toast(errMsg(e)); }
  }
  async function start() {
    if (busy.current) return; busy.current = true; setStarting(true); const id = ++seq.current;
    try { const x = await rpc<V>("liga_quad_start", { p_id: S.pid, p_token: S.token, p_code: code }); sfx("tap"); busy.current = false; apply(x, id); }
    catch (e) { busy.current = false; toast(errMsg(e)); } finally { setStarting(false); }
  }
  async function leave() {
    try { await rpc("liga_quad_leave", { p_id: S.pid, p_token: S.token, p_code: code }); } catch { /* */ }
    done.current = true; tab("home");
  }

  if (err && !v) return <div className="empty">{err}</div>;
  if (!v) return <div className="empty">{t("Yuklanmoqda...")}</div>;
  const P: any[] = v.players || [], me = v.me as number | undefined;
  const nm = (p: any) => (p.me ? t("Siz") : p.name || t("O'yinchi"));
  const byS = (s?: number | null) => P.find((p) => p.s === s);

  /* kutish zali */
  if (v.status === "wait") {
    const here = P.filter((p) => p.here).length, left = closeAt.current - now;
    return (
      <div className="stack" id="quad-lobby">
        <section className="card live-lobby">
          <Users size={34} color="var(--stamp)" />
          <h3>{t("Guruh dueli — kutish zali")}</h3>
          <p className="small muted">{me ? (v.is_host ? t("Havolani hamkasblaringizga yuboring. {m} kishi to'lsa o'yin o'zi boshlanadi, kamroq bo'lsa — «Boshlash»ni bosing.", { m: v.max || QMAX }) : t("Siz xonadasiz. Xona egasi o'yinni boshlashini kuting — bu ekranni yopmang."))
            : t("Xona to'lgan — siz tomoshabinsiz.")}</p>
          <div className={"quad-seats" + (P.length > 4 ? " many" : "")} id="quad-seats">
            {P.map((p) => (
              <div key={p.s} className={"seat on" + (p.me ? " me" : "") + (!p.here ? " away" : "")}>
                <span className="av">{p.host ? <Crown size={16} /> : (p.name || "?").slice(0, 1)}</span>
                <b>{nm(p)}</b>
                <small>{p.here ? t("ilovada") : t("chiqib ketgan")}</small>
              </div>))}
            {P.length < (v.max || QMAX) && <div className="seat" id="quad-free">
              <span className="av">+</span><b>{t("{n} ta bo'sh joy", { n: (v.max || QMAX) - P.length })}</b><small>{t("havola orqali kiradi")}</small></div>}
          </div>
          <p className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: ".08em" }}>{code}</p>
          {left > 0 && <p className="tiny muted">{t("Xona yana {m} daqiqa ochiq", { m: Math.max(1, Math.ceil(left / 60000)) })}</p>}
        </section>
        {me && <div className="btn-row">
          <button className="btn ghost" onClick={() => copyText(quadLink(code), () => toast(t("Nusxa olindi")))}><Copy size={18} />{t("Havola")}</button>
          <button className="btn" id="quad-share" onClick={() => shareQuad(code)}><Send size={18} />{t("Yuborish")}</button></div>}
        {v.is_host && <button className="btn gold" id="quad-start" disabled={here < 2 || starting} onClick={start}><Play size={18} />
          {here < 2 ? t("Kamida 2 kishi kerak") : t("Boshlash ({n} kishi)", { n: here })}</button>}
        {me && <button className="btn ghost sm" id="quad-leave" onClick={leave}><LogOut size={16} />{v.is_host ? t("Xonani yopish") : t("Xonadan chiqish")}</button>}
        <div className="note"><Users size={18} /><span>{t("Qoida: 20 ta savol (15 provodka + 5 savol), har biriga 1,5 daqiqa. Kim birinchi to'g'ri javob bersa — ochko oladi va hammaga keyingi savol chiqadi. Xato javob bergan shu savolda qulflanadi. Teng ochkoda to'g'ri javoblarga kam vaqt sarflagan yuqori turadi.")}</span></div>
      </div>);
  }

  /* yakun */
  if (v.status === "done") {
    const ranked: any[] = (v.rank || []).map((s: number) => byS(s)).filter(Boolean);
    const myPos = ranked.findIndex((p) => p.me);
    const title = v.note === "cancel" || v.note === "expired" ? t("Duel o'ynalmadi") : v.tie ? t("Durang!") : me && v.winner === me ? t("Siz yutdingiz! 🎉")
      : myPos >= 0 ? t("Siz {n}-o'rindasiz", { n: myPos + 1 }) : t("Duel yakunlangan");
    return (
      <div className="stack" id="quad-done">
        <section className="card" style={{ textAlign: "center", display: "grid", gap: 12 }}>
          {me && v.winner === me && <Crown size={44} color="var(--gold)" style={{ margin: "0 auto" }} />}
          <h2 className="disp" style={{ fontSize: 24 }}>{title}</h2>
          {ranked.length > 0 && <div className="board" id="quad-rank" style={{ textAlign: "left" }}>{ranked.map((p, k) => (
            <div key={p.s} className={"r" + (p.me ? " me" : "") + (k < 3 ? " top" + (k + 1) : "")}>
              <span className="p">{MEDAL[k] || k + 1}</span><span className="n">{p.me ? t("Siz") : p.name}<small>{t("{n} ta to'g'ri", { n: p.pts })}{p.pts ? " · " + mmss(p.ms) : ""}</small></span>
              <span className="x">{p.pts}</span></div>))}</div>}
          <p className="small muted" id="quad-note">{v.note === "expired" ? t("30 daqiqa ichida o'yin boshlanmadi — xona yopildi.") : v.note === "cancel" ? t("Xona egasi xonani yopdi.")
            : v.note === "idle" ? t("7 daqiqa davomida hech kim javob bermadi — duel to'xtatildi.") : t("Teng ochkoda to'g'ri javoblarga kam vaqt sarflagan yuqori turadi.")}</p>
        </section>
        <div className="btn-row">
          <button className="btn ghost" id="quad-again" onClick={() => openQuad(true)}><Users size={18} />{t("Yana xona ochish")}</button>
          <button className="btn" onClick={() => tab("home")}><HomeI size={18} />{t("Asosiy")}</button>
        </div>
      </div>);
  }

  /* o'yin */
  const inPause = Date.now() < showAt.current || !item;
  const left = Math.max(0, Math.ceil((endAt.current - now) / 1000)), qsec = v.qsec || 90;
  const L = v.last, lw = byS(L?.w);
  const Board = () => (
    <div className={"quad-score n" + Math.min(P.length, 4) + (P.length > 4 ? " many" : "")} id="quad-score">
      {P.map((p) => <div key={p.s} className={"qs" + (p.me ? " me" : "") + (p.locked ? " lk" : "") + (!p.here ? " away" : "")}>
        <b className="num">{p.pts}</b><span>{nm(p)}</span>{p.locked && <i>{t("xato")}</i>}</div>)}
      <div className="qs-mid"><small className="num">{Math.min(v.cur + 1, v.n)}/{v.n}</small><small>{v.cur < 15 ? t("Provodka") : t("Savol")}</small></div>
    </div>);
  return (
    <div className="stack live">
      <Board />
      <AnimatePresence mode="wait">
        {inPause ? (
          <motion.section key={"p" + v.cur} className="card live-pause" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {v.cur === 0 ? <>
              <p className="small muted" style={{ fontWeight: 700 }}>{P.map((p) => p.name).join(" ⚡ ")}</p>
              <div className="disp live-count num">{Math.max(1, Math.ceil((showAt.current - now) / 1000))}</div>
              <p style={{ fontWeight: 800 }}>{t("Tayyorlaning!")}</p></> : L && <>
              <p className={"live-who " + (lw?.me ? "ok" : L.w ? "bad" : "")} id="quad-who">
                {lw?.me ? t("Siz birinchi topdingiz! +1") : L.w ? t("{n} birinchi topdi", { n: L.w_name || lw?.name || "" }) : t("Hech kim topmadi")}</p>
              <p className="small" style={{ fontWeight: 700 }}>{tx(L.q || "")}</p>
              <p className="ex-line">{L.t === "pv" ? `Dt ${L.dt} — Kt ${L.kt}` : L.t === "mc" ? tx((L.o || [])[Number(L.a)] || "") : fmt(Number(L.a))}</p>
              {L.e && <p className="small muted">{tx(L.e)}</p>}
              <p className="tiny muted">{v.cur === 15 ? t("Provodkalar tugadi — endi 5 ta savol. ") : ""}{t("Keyingi savol {s} soniyada", { s: Math.max(1, Math.ceil((showAt.current - now) / 1000)) })}</p></>}
          </motion.section>
        ) : (
          <motion.article key={"q" + v.cur} className={"qcard" + (me ? "" : " watch")} id={me ? "quad-q" : "quad-watch-q"} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            {me && <div className="wm" aria-hidden="true">{wm}</div>}
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="qkind grow">{me ? t("Guruh dueli") : t("Tomosha")} · {t(item.t === "pv" ? "Provodka tuzing" : item.t === "mc" ? "Test" : "Hisoblang")}</span>
              <Ring pct={left / qsec} size={40} stroke={4} color={left <= 8 ? "var(--red)" : "var(--stamp)"}><b className="num" style={{ fontSize: 13 }}>{left}</b></Ring>
            </div>
            <p className="qtext">{tx(item.q)}</p>
            {item.t === "pv" && <>
              <div className="taccount">
                {(["dt", "kt"] as const).map((s) => <div className="side" key={s}><span className="lbl">{s === "dt" ? t("Debet") : t("Kredit")}</span>
                  <button className={"slot " + (ans[s] ? "filled" : "")} disabled={v.locked || !me} onClick={() => setAns({ ...ans, [s]: null })}>
                    {ans[s] ? <span><span className="code">{ans[s]}</span><span className="nm">{A[ans[s]!]}</span></span> : <span>{t("Bo'sh")}</span>}</button></div>)}
              </div>
              <div className="keys">{keys.map((k: string) => <button key={k} className={"key" + (k === ans.dt || k === ans.kt ? " used" : "")} disabled={v.locked || !me}
                onClick={() => { sfx("tap"); const n = { ...ans }; if (n.dt === k) n.dt = null; else if (n.kt === k) n.kt = null; else if (!n.dt) n.dt = k; else n.kt = k; setAns(n); }}>{k}</button>)}</div>
            </>}
            {item.t === "mc" && <div className="opts">{opts.map((o: any, k: number) => <button key={k} className={"opt " + (k === ans.pick ? (flash === "bad" ? "wrong" : "sel") : "")} disabled={v.locked || !me}
              onClick={() => { sfx("tap"); setAns({ ...ans, pick: k }); }}>{o.x}</button>)}</div>}
            {item.t === "calc" && <div className="calc"><input id="num" inputMode="numeric" autoComplete="off" placeholder="0" disabled={v.locked || !me} value={ans.val} aria-label={t("Javob")}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAns({ ...ans, val: d ? fmt(+d) : "" }); }} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
              <div className="unit">{item.unit ? tx(item.unit) : t("so'm")}</div></div>}
          </motion.article>)}
      </AnimatePresence>
      {!me && <div className="note" id="quad-spectator"><Eye size={18} /><span>{t("Siz tomoshabinsiz: savolni va kim birinchi topganini ko'rasiz, javob bera olmaysiz.")}</span></div>}
      {!inPause && !!me && <div className="dock">
        {v.locked ? <div className="note" id="quad-locked" style={{ background: "var(--red-soft)" }}><Lock size={18} color="var(--red)" /><span>{t("Xato — bu savolda qulflandingiz. Boshqalar javobini kuting.")}</span></div>
          : <button className="btn" id="quad-send" disabled={!canSend} onClick={send}>{t("Javob berish")}</button>}
      </div>}
      {!!me && inPause && v.cur > 0 && <p className="tiny muted" style={{ textAlign: "center" }}><Hourglass size={12} /> {t("Savol {a}/{n}", { a: Math.min(v.cur + 1, v.n), n: v.n })}</p>}
    </div>);
}
