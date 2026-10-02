import { useEffect, useState } from "react";
import { Swords, Send, Copy, Play, Crown, Hourglass } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { go, replace, toast } from "../lib/nav";
import { PageTitle, Card, Empty, copyText } from "../components/ui";
import { rpc, errMsg, botApp } from "../engine/server";
import { startDuel } from "../engine/run";
import { award } from "../engine/score";
import { BOT_LINK, openTg } from "../lib/tg";
import { entry } from "../boot";
import { sfx, burst } from "../lib/fx";
import { playerBlocked } from "./Home";

export const duelLink = (code: string) => BOT_LINK + "?start=d_" + code;
export function botNotify(code: string, _x?: any) { botApp("duel_done", { code }).catch(() => {}); }
const mmss = (ms: number) => Math.floor((ms || 0) / 60000) + ":" + String(Math.floor((ms || 0) / 1000) % 60).padStart(2, "0");
function winner(d: any): "a" | "b" | "tie" | null {
  if (d.a_score == null || d.b_score == null) return null;
  if (d.a_score !== d.b_score) return d.a_score > d.b_score ? "a" : "b";
  return d.a_ms === d.b_ms ? "tie" : d.a_ms < d.b_ms ? "a" : "b";
}
function share(code: string) {
  const text = t("Sizni Hisobchi Ligada duelga chaqiraman: 10 ta savol, kim tezroq va aniqroq? ⚔️");
  openTg("https://t.me/share/url?url=" + encodeURIComponent(duelLink(code)) + "&text=" + encodeURIComponent(text));
}
function DuelView({ code }: { code: string }) {
  const [d, setD] = useState<any>(null), [err, setErr] = useState("");
  useEffect(() => { let on = true; const load = () => rpc<any[]>("liga_duel_get", { p_code: code, p_id: S.pid || null }).then((r) => on && (r && r[0] ? setD(r[0]) : setErr(t("Duel topilmadi")))).catch((e) => setErr(errMsg(e)));
    load(); const iv = setInterval(load, 8000); return () => { on = false; clearInterval(iv); }; }, [code]);
  useEffect(() => { if (!d) return; const w = winner(d); if (w && ((w === "a" && d.is_a) || (w === "b" && d.is_b)) && !(S.duelsWon || {})[code]) { S.duelsWon = { ...(S.duelsWon || {}), [code]: 1 }; persist(); award("duel"); burst(true); sfx("win"); } }, [d]);
  if (err) return <Empty>{err}</Empty>;
  if (!d) return <Empty>{t("Yuklanmoqda...")}</Empty>;
  const w = winner(d), mine = d.is_a ? "a" : d.is_b ? "b" : null, myScore = mine ? d[mine + "_score"] : null;
  const canPlay = (d.is_a && d.a_score == null) || (!d.is_a && !d.is_b && d.b_score == null) || (d.is_b && d.b_score == null);
  const Side = ({ s }: { s: "a" | "b" }) => (
    <div style={{ textAlign: "center", display: "grid", gap: 4 }}>
      {w === s && <Crown size={22} color="var(--gold)" style={{ margin: "0 auto" }} />}
      <b style={{ fontSize: 15 }}>{(s === "a" ? d.a_name : d.b_name) || t("Kutilmoqda")}</b>
      <span className="disp num" style={{ fontSize: 34, fontWeight: 700 }}>{d[s + "_score"] ?? "–"}</span>
      <span className="tiny muted">{d[s + "_score"] != null ? mmss(d[s + "_ms"]) : ""}</span>
    </div>);
  return (
    <div className="stack">
      <section className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}><Side s="a" /><Swords size={28} color="var(--red)" /><Side s="b" /></div>
        <div className="divider" style={{ margin: "14px 0" }} />
        <p className="small" style={{ textAlign: "center", fontWeight: 700 }}>
          {w === "tie" ? t("Durang!") : w ? (w === mine ? t("Siz yutdingiz! 🎉") : mine ? t("Bu safar raqib kuchliroq") : t("Duel yakunlangan")) : myScore != null ? t("Raqib o'ynashini kutyapmiz") : t("10 ta savol · har biriga 1 daqiqa · teng ballda tezroq yutadi")}</p>
      </section>
      {d.is_a && d.b_score == null && <div className="btn-row"><button className="btn ghost" onClick={() => copyText(duelLink(code), () => toast(t("Nusxa olindi")))}><Copy size={18} />{t("Havola")}</button>
        <button className="btn" onClick={() => share(code)}><Send size={18} />{t("Yuborish")}</button></div>}
      {canPlay && <button className="btn gold" id="play" onClick={() => { if (!S.pid) return toast(t("Avval ro'yxatdan o'ting")); replace("quiz", { run: startDuel(code) }); }}><Play size={18} />{d.is_a ? t("Men ham o'ynayman") : t("Qabul qilish va boshlash")}</button>}
    </div>
  );
}
export default function Duel({ code }: { code?: string }) {
  const c = code || entry.d;
  if (entry.d && !code) entry.d = undefined;
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!c && S.pid) rpc<any[]>("liga_my_duels", { p_id: S.pid }).then((r) => setList(r || [])).catch(() => {}); }, [c]);
  const create = async () => {
    if (playerBlocked()) return go("pay");
    setBusy(true);
    try { const code = await rpc<string>("liga_duel_create", { p_id: S.pid, p_token: S.token, p_lang: S.lang || "uz" }); sfx("tap"); replace("duel", { code }); share(code); }
    catch (e) { toast(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="shell bare">
      <PageTitle title={t("Duel")} />
      {c ? <DuelView code={c} /> : <div className="stack">
        <section className="ticket"><div className="t-top"><Swords size={42} /><div className="grow"><div className="t-title">{t("Hamkasbingizni bahsga chaqiring")}</div>
          <div className="t-meta">{t("Ikkalangizga bir xil 10 ta savol. Kim ko'proq to'g'ri topsa — g'olib, teng bo'lsa tezrog'i.")}</div></div></div>
          <div className="t-bottom"><button className="btn gold" id="create" disabled={busy} onClick={create}><Send size={18} />{t("Duel yaratish va yuborish")}</button></div></section>
        <Card title={t("Mening duellarim")}>
          {list.length ? <div className="board">{list.map((d) => { const w = winner(d), me = d.is_a ? "a" : "b"; return (
            <button key={d.code} className="r" style={{ textAlign: "left" }} onClick={() => go("duel", { code: d.code })}>
              <span className="p">{w ? (w === me ? <Crown size={18} color="var(--gold)" /> : w === "tie" ? "=" : "·") : <Hourglass size={16} />}</span>
              <span className="n">{d.is_a ? (d.b_name || t("Raqib kutilmoqda")) : d.a_name}<small>{d.code}</small></span>
              <span className="x">{d.a_score ?? "–"}:{d.b_score ?? "–"}</span></button>); })}</div>
            : <Empty>{t("Hali duel yo'q")}</Empty>}
        </Card>
      </div>}
    </div>
  );
}
