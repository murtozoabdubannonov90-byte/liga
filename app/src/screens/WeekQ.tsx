import { useState } from "react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { back, tab, toast } from "../lib/nav";
import { PageTitle } from "../components/ui";
import { rpc, errMsg, pull, syncSoon } from "../engine/server";
import { addXP } from "../engine/score";
import { sfx, burst } from "../lib/fx";

export function WqAnswer() {
  const w = S.wq; const [pick, setPick] = useState<number | null>(null), [res, setRes] = useState<any>(null), [busy, setBusy] = useState(false);
  if (!w || !w.q_id) return null;
  const send = async () => {
    if (pick == null) return; setBusy(true);
    try { const r = (await rpc<any[]>("liga_wq_answer", { p_id: S.pid, p_token: S.token, p_q: w.q_id, p_pick: pick }))[0]; if (!r) return toast(t("Savol topilmadi"));
      S.wqDone = { ...(S.wqDone || {}), [w.q_id]: { ok: r.ok, e: r.e || "" } }; addXP(r.ok ? 50 : 10, "bonus"); persist(); syncSoon(); setRes(r);
      sfx(r.ok ? "ok" : "bad"); if (r.ok) burst(); } catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="shell bare"><PageTitle title={t("Haftaning savoli")} />
      <article className="qcard"><div className="qkind">{t("Muallif: {n} — o'tgan hafta g'olibi", { n: w.author })}</div><p className="qtext">{w.q}</p>
        <div className="opts">{(w.o || []).map((x: string, k: number) => (
          <button key={k} disabled={!!res} className={"opt " + (res ? (k === res.a ? "right" : k === pick ? "wrong" : "") : k === pick ? "sel" : "")} onClick={() => setPick(k)}>{x}</button>))}</div></article>
      {res && <div className={"sheet-fb " + (res.ok ? "ok" : "bad")}><div><h4>{res.ok ? t("To'g'ri! +50 XP") : t("Xato. Ishtirok uchun +10 XP")}</h4><p>{res.e}</p>
        <button className={"btn " + (res.ok ? "ok" : "bad")} onClick={() => tab("home")}>{t("Asosiy")}</button></div></div>}
      {!res && <div className="dock"><button className="btn" disabled={pick == null || busy} onClick={send}>{t("Javob berish")}</button></div>}
    </div>);
}
export function WqSubmit() {
  const [q, setQ] = useState(""), [o, setO] = useState(["", "", "", ""]), [a, setA] = useState(0), [e, setE] = useState(""), [err, setErr] = useState("");
  const send = async () => {
    if (q.trim().length < 10) return setErr(t("Savol kamida 10 belgi"));
    if (!o[a].trim()) return setErr(t("To'g'ri javob varianti bo'sh"));
    const opts: string[] = []; let ai = 0; o.forEach((x, k) => { if (x.trim()) { if (k === a) ai = opts.length; opts.push(x.trim()); } });
    if (opts.length < 2) return setErr(t("Kamida 2 ta variant kiriting"));
    try { await rpc("liga_wq_submit", { p_id: S.pid, p_token: S.token, p_q: q.trim(), p_o: opts, p_a: ai, p_e: e.trim() }); toast(t("Yuborildi — admin tasdiqlaydi")); await pull(true); back(); }
    catch (x) { setErr(errMsg(x)); }
  };
  return (
    <div className="shell bare"><PageTitle title={t("Savol taklif qilish")} />
      <div className="stack">
        <p className="small muted" style={{ fontWeight: 600 }}>{t("Savolingiz admin tasdiqlagach, jamoangizga ismingiz bilan chiqadi.")}</p>
        <div className="field"><label htmlFor="wq">{t("Savol")}</label><textarea id="wq" className="inp" maxLength={400} value={q} onChange={(x) => setQ(x.target.value)} /></div>
        {o.map((v, k) => <div key={k} className="field"><label htmlFor={"wo" + k}>{"ABCD"[k]} {t("variant")}{k > 1 ? " (" + t("ixtiyoriy") + ")" : ""}</label>
          <div className="row"><input id={"wo" + k} className="inp" maxLength={120} value={v} onChange={(x) => { const n = o.slice(); n[k] = x.target.value; setO(n); }} />
            <button className={"chip " + (a === k ? "ok" : "")} onClick={() => setA(k)} aria-pressed={a === k}>{a === k ? t("to'g'ri") : "✓"}</button></div></div>)}
        <div className="field"><label htmlFor="we">{t("Izoh (nega to'g'ri)")}</label><textarea id="we" className="inp" maxLength={400} value={e} onChange={(x) => setE(x.target.value)} /></div>
        <p className="err">{err}</p>
      </div>
      <div className="dock"><button className="btn" id="go" onClick={send}>{t("Yuborish")}</button></div>
    </div>);
}
