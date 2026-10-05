/* Jonli duel: ikkalasi bir vaqtda o'ynaydi. Kim birinchi to'g'ri javob bersa — ochko oladi, ikkalasiga keyingi savol chiqadi.
   Savollar serverdan javobsiz keladi, javob serverda tekshiriladi, vaqtni server hisoblaydi. */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Send, Crown, Zap, Home as HomeI, Lock, Hourglass } from "lucide-react";
import { S, persist } from "../engine/state";
import { t, tx } from "../lib/i18n";
import { rpc, errMsg } from "../engine/server";
import { C } from "../engine/run";
import { shuffle, fmt } from "../engine/data";
import { award } from "../engine/score";
import { tab, replace, toast } from "../lib/nav";
import { sfx, burst, cheer } from "../lib/fx";
import { Ring, copyText } from "../components/ui";
import { BOT_LINK, openTg } from "../lib/tg";

export const isLive = (code?: string) => !!code && code.length === 7 && code[0] === "L";
const link = (code: string) => BOT_LINK + "?start=d_" + code;
export function shareLive(code: string) {
  const text = t("Jonli duelga chaqiraman: 10 ta savol, kim birinchi to'g'ri topsa — ochko o'shaniki! ⚡");
  openTg("https://t.me/share/url?url=" + encodeURIComponent(link(code)) + "&text=" + encodeURIComponent(text));
}
export async function createLive(): Promise<string | null> {
  try { return await rpc<string>("liga_live_create", { p_id: S.pid, p_token: S.token, p_lang: S.lang === "ru" ? "ru" : "uz" }); }
  catch (e) { toast(errMsg(e)); return null; }
}

type V = any;
export default function LiveDuel({ code }: { code: string }) {
  const [v, setV] = useState<V>(null), [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const showAt = useRef(0), endAt = useRef(0), lastCur = useRef(-1), busy = useRef(false), done = useRef(false);
  const [ans, setAns] = useState<{ dt: string | null; kt: string | null; pick: number | null; val: string }>({ dt: null, kt: null, pick: null, val: "" });
  const [flash, setFlash] = useState<null | "ok" | "bad">(null);

  const apply = (x: V) => {
    if (!x) return;
    showAt.current = Date.now() + (x.q_in || 0); endAt.current = x.left != null ? Date.now() + x.left : 0;
    if (x.cur !== lastCur.current) {
      /* yangi savol: oldingisini kim topdi */
      if (lastCur.current >= 0 && x.last && x.last.k === lastCur.current) {
        const w = x.last.w; if (w && w !== x.me) sfx("bad");
      }
      lastCur.current = x.cur; setAns({ dt: null, kt: null, pick: null, val: "" }); setFlash(null);
    }
    if (x.status === "done" && !done.current) {
      done.current = true;
      if (x.winner === x.me) { burst(true); sfx("win"); if (!(S.duelsWon || {})[code]) { S.duelsWon = { ...(S.duelsWon || {}), [code]: 1 }; persist(); award("duel"); } }
    }
    setV(x);
  };
  useEffect(() => {
    let on = true;
    const poll = async () => {
      if (!on || done.current) return;
      try { const x = await rpc<V>("liga_live_state", { p_id: S.pid, p_token: S.token, p_code: code }); if (on && !busy.current) apply(x); setErr(""); }
      catch (e) { if (on) setErr(errMsg(e)); }
    };
    poll(); const iv = setInterval(poll, 1000); const tk = setInterval(() => setNow(Date.now()), 250);
    return () => { on = false; clearInterval(iv); clearInterval(tk); };
  }, [code]);

  const item = v?.item, A = C().A;
  const opts = useMemo(() => (item?.t === "mc" ? shuffle((item.o || []).map((x: string, i: number) => ({ x: tx(x), i }))) : []), [v?.cur, item?.t]);
  const keys = useMemo(() => (item?.t === "pv" ? shuffle([...(item.o || [])]) : []), [v?.cur, item?.t]);
  const canSend = item && !v.locked && (item.t === "pv" ? !!(ans.dt && ans.kt) : item.t === "mc" ? ans.pick != null : ans.val.replace(/\D/g, "") !== "");

  async function send() {
    if (!canSend || busy.current) return;
    busy.current = true;
    const payload = item.t === "pv" ? { dt: ans.dt, kt: ans.kt } : item.t === "mc" ? { pick: (opts[ans.pick!] as any).i } : { val: ans.val.replace(/\D/g, "") };
    try {
      const x = await rpc<V>("liga_live_answer", { p_id: S.pid, p_token: S.token, p_code: code, p_k: v.cur, p_ans: payload });
      if (x.ok) { sfx("ok"); cheer(true); setFlash("ok"); }
      else if (x.why === "wrong") { sfx("bad"); cheer(false); setFlash("bad"); }
      else if (x.why === "late") toast(t("Kechikdingiz — raqib birinchi topdi"));
      busy.current = false; apply(x);
      if (x.ok) setFlash("ok");
    } catch (e) { busy.current = false; toast(errMsg(e)); }
  }

  if (err && !v) return <div className="empty">{err}</div>;
  if (!v) return <div className="empty">{t("Yuklanmoqda...")}</div>;
  const me = v.me as "a" | "b" | undefined, op = me === "a" ? "b" : "a";
  const myName = me ? v[me + "_name"] : "", opName = me ? v[op + "_name"] : "";
  const Score = () => (
    <div className="live-score" id="live-score">
      <div className={"ls me" + (v.winner === me ? " win" : "")}><b className="num">{me ? v[me + "_pts"] : v.a_pts}</b><span>{t("Siz")}</span></div>
      <div className="ls-mid"><Zap size={18} /><small className="num">{Math.min(v.cur + 1, v.n)}/{v.n}</small></div>
      <div className={"ls op" + (v.winner === op ? " win" : "")}><b className="num">{me ? v[op + "_pts"] : v.b_pts}</b><span>{opName || t("Raqib")}</span></div>
    </div>);

  /* kutish zali */
  if (v.status === "wait") return (
    <div className="stack">
      <section className="card live-lobby">
        <Hourglass size={34} color="var(--stamp)" />
        <h3>{me === "a" && !v.b_name ? t("Raqibni kutyapmiz") : t("Raqib ilovani ochishini kutyapmiz")}</h3>
        <p className="small muted">{me === "a" && !v.b_name ? t("Havolani hamkasbingizga yuboring. U ochishi bilan o'yin boshlanadi — bu ekranni yopmang.") : t("Ikkalangiz ham shu ekranda bo'lsangiz, o'yin 3 soniyada boshlanadi.")}</p>
        {v.b_name && <p style={{ fontWeight: 800 }}>{v.a_name} ⚡ {v.b_name}</p>}
        <p className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: ".08em" }}>{code}</p>
      </section>
      {me === "a" && <div className="btn-row"><button className="btn ghost" onClick={() => copyText(link(code), () => toast(t("Nusxa olindi")))}><Copy size={18} />{t("Havola")}</button>
        <button className="btn" id="live-share" onClick={() => shareLive(code)}><Send size={18} />{t("Yuborish")}</button></div>}
      <div className="note"><Zap size={18} /><span>{t("Qoida: 10 ta savol, har biriga 1 daqiqa. Kim birinchi to'g'ri javob bersa — ochko oladi va ikkalangizga keyingi savol chiqadi. Xato javob bergan shu savolda qulflanadi.")}</span></div>
    </div>);

  /* yakun */
  if (v.status === "done") {
    const win = v.winner, title = win === "tie" ? t("Durang!") : win === me ? t("Siz yutdingiz! 🎉") : me ? t("Bu safar raqib kuchliroq") : t("Duel yakunlangan");
    return (
      <div className="stack" id="live-done">
        <section className="card" style={{ textAlign: "center", display: "grid", gap: 12 }}>
          {win === me && <Crown size={44} color="var(--gold)" style={{ margin: "0 auto" }} />}
          <h2 className="disp" style={{ fontSize: 24 }}>{title}</h2>
          <Score />
          <p className="small muted">{t("Teng ochkoda to'g'ri javoblarga kam vaqt sarflagan yutadi.")}</p>
        </section>
        <div className="btn-row">
          <button className="btn ghost" onClick={async () => { const c = await createLive(); if (c) { replace("duel", { code: c }); shareLive(c); } }}><Zap size={18} />{t("Yana jonli duel")}</button>
          <button className="btn" onClick={() => tab("home")}><HomeI size={18} />{t("Asosiy")}</button>
        </div>
      </div>);
  }

  /* o'yin: tanaffus (oldingi savol javobi) yoki savol */
  const inPause = now < showAt.current || !item;
  const left = Math.max(0, Math.ceil((endAt.current - now) / 1000)), qsec = v.qsec || 60;
  const L = v.last;
  return (
    <div className="stack live">
      <Score />
      <AnimatePresence mode="wait">
        {inPause ? (
          <motion.section key={"p" + v.cur} className="card live-pause" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {v.cur === 0 ? <>
              <p className="small muted" style={{ fontWeight: 700 }}>{myName} ⚡ {opName}</p>
              <div className="disp live-count num">{Math.max(1, Math.ceil((showAt.current - now) / 1000))}</div>
              <p style={{ fontWeight: 800 }}>{t("Tayyorlaning!")}</p></> : L && <>
              <p className={"live-who " + (L.w === me ? "ok" : L.w ? "bad" : "")} id="live-who">
                {L.w === me ? t("Siz birinchi topdingiz! +1") : L.w ? t("{n} birinchi topdi", { n: opName }) : t("Hech kim topmadi")}</p>
              <p className="small" style={{ fontWeight: 700 }}>{tx(L.q || "")}</p>
              <p className="ex-line">{L.t === "pv" ? `Dt ${L.dt} — Kt ${L.kt}` : L.t === "mc" ? tx((L.o || [])[Number(L.a)] || "") : fmt(Number(L.a))}</p>
              {L.e && <p className="small muted">{tx(L.e)}</p>}
              <p className="tiny muted">{t("Keyingi savol {s} soniyada", { s: Math.max(1, Math.ceil((showAt.current - now) / 1000)) })}</p></>}
          </motion.section>
        ) : (
          <motion.article key={"q" + v.cur} className="qcard" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="qkind grow">{t("Jonli duel")} · {t(item.t === "pv" ? "Provodka tuzing" : item.t === "mc" ? "Test" : "Hisoblang")}</span>
              <Ring pct={left / qsec} size={40} stroke={4} color={left <= 8 ? "var(--red)" : "var(--stamp)"}><b className="num" style={{ fontSize: 13 }}>{left}</b></Ring>
            </div>
            <p className="qtext">{tx(item.q)}</p>
            {item.t === "pv" && <>
              <div className="taccount">
                {(["dt", "kt"] as const).map((s) => <div className="side" key={s}><span className="lbl">{s === "dt" ? t("Debet") : t("Kredit")}</span>
                  <button className={"slot " + (ans[s] ? "filled" : "")} disabled={v.locked} onClick={() => setAns({ ...ans, [s]: null })}>
                    {ans[s] ? <span><span className="code">{ans[s]}</span><span className="nm">{A[ans[s]!]}</span></span> : <span>{t("Bo'sh")}</span>}</button></div>)}
              </div>
              <div className="keys">{keys.map((k: string) => <button key={k} className={"key" + (k === ans.dt || k === ans.kt ? " used" : "")} disabled={v.locked}
                onClick={() => { sfx("tap"); const n = { ...ans }; if (n.dt === k) n.dt = null; else if (n.kt === k) n.kt = null; else if (!n.dt) n.dt = k; else n.kt = k; setAns(n); }}>{k}</button>)}</div>
            </>}
            {item.t === "mc" && <div className="opts">{opts.map((o: any, k: number) => <button key={k} className={"opt " + (k === ans.pick ? (flash === "bad" ? "wrong" : "sel") : "")} disabled={v.locked}
              onClick={() => { sfx("tap"); setAns({ ...ans, pick: k }); }}>{o.x}</button>)}</div>}
            {item.t === "calc" && <div className="calc"><input id="num" inputMode="numeric" autoComplete="off" placeholder="0" disabled={v.locked} value={ans.val} aria-label={t("Javob")}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAns({ ...ans, val: d ? fmt(+d) : "" }); }} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
              <div className="unit">{item.unit ? tx(item.unit) : t("so'm")}</div></div>}
          </motion.article>)}
      </AnimatePresence>
      {!inPause && <div className="dock">
        {v.locked ? <div className="note" id="live-locked" style={{ background: "var(--red-soft)" }}><Lock size={18} color="var(--red)" /><span>{t("Xato — bu savolda qulflandingiz. Raqib javobini kuting.")}</span></div>
          : <button className="btn" id="live-send" disabled={!canSend} onClick={send}>{v.opp_locked ? t("Raqib xato qildi — javob bering!") : t("Javob berish")}</button>}
      </div>}
    </div>);
}
