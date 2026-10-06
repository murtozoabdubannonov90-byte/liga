/* G'oliblar: kunlik kuchli uchlik mukofoti (bosqich boshida va oxirida), bosh sahifadagi «Imtiyozlaringiz», reytingdagi kunlik uchlik */
import { useEffect, useState } from "react";
import { Timer, Award, Trophy, HelpCircle, ChevronRight, Medal, Eye, Swords, Crown } from "lucide-react";
import { useNow } from "../components/ui";
import { rpc } from "../engine/server";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go } from "../lib/nav";
import { closeStr, tzNow } from "../engine/time";
import { QSEC } from "../engine/run";

export const EXTRA = [10, 7, 4];
const MEDAL = ["🥇", "🥈", "🥉"];
const fmtDay = (d?: string) => { if (!d) return ""; const [y, m, dd] = d.split("-"); return `${dd}.${m}`; };
const nextWord = () => { const w = tzNow().wd; return w >= 5 || w === 0 ? t("dushanba kuni") : t("ertaga"); };

function TopList({ rows, id }: { rows: { pos: number; name: string; me: boolean }[]; id?: string }) {
  return (
    <ol className="daytop" id={id}>
      {rows.map((x) => (
        <li key={x.pos} className={x.me ? "me" : ""}><span className="md">{MEDAL[x.pos - 1]}</span><b className="grow">{x.name}{x.me ? " · " + t("siz") : ""}</b><span className="num">+{EXTRA[x.pos - 1]} {t("s")}</span></li>
      ))}
    </ol>);
}

/* bosqich boshida (when="start") va yakunida (when="end"): kuchli uchlikka nima beriladi */
export function DayRewards({ when }: { when: "start" | "end" }) {
  const d = S.day, mine = d?.extra_today || 0, top = (d?.today_closed && d?.today_top) || [];
  return (
    <section className="rewards" id={"rw-" + when}>
      <div className="rw-h"><Trophy size={20} /><h3>{t("Kunlik kuchli uchlik mukofoti")}</h3></div>
      <div className="rw-podium">
        {EXTRA.map((s, k) => (
          <div key={k} className={"p" + (k + 1)}><span className="md">{MEDAL[k]}</span><b className="num">+{s}</b><i>{t("soniya har savolga")}</i></div>
        ))}
      </div>
      <p className="rw-note">{t("O'rin bugungi bosqich bali bo'yicha (teng bo'lsa — tezroq tugatgan). Mukofot {d} bosqichda: har savolga {q} soniya o'rniga ko'proq vaqt.", { d: nextWord(), q: QSEC })}</p>
      {when === "start" && mine > 0 && <p className="rw-mine"><Timer size={16} />{t("Sizda bugun har savolga +{n} soniya bor — kechagi g'alaba uchun.", { n: mine })}</p>}
      {when === "end" && (top.length
        ? <><p className="rw-sub">{t("Bugungi kuchli uchlik")}</p><TopList rows={top} id="today-top" /></>
        : <p className="rw-sub">{t("Natija soat {c} da e'lon qilinadi — bot g'oliblarga shaxsan xabar yuboradi.", { c: closeStr() })}</p>)}
      <p className="rw-week"><Medal size={15} />{t("Haftalik kuchli uchlik: medal nishoni va sertifikat; oyda 2 marta kirsangiz — oylik finalga yo'llanma; 1-o'rin «Haftaning savoli»ni tuzadi.")}</p>
    </section>);
}

/* bosh sahifa: g'olibning imtiyozlari */
export function PerksCard() {
  const d = S.day, extra = d?.extra_today || 0, prevMe = (d?.prev_top || []).find((x: any) => x.me);
  const medal = (S.members || []).find((m) => m.me)?.m || 0, wqCan = !!S.wq?.can_submit, fin = !!S.fin?.qualified && !S.fin?.ended;
  if (!extra && !medal && !wqCan && !fin) return null;
  return (
    <section className="card perks" id="perks">
      <div className="card-h"><Award size={20} color="var(--gold)" /><h3>{t("Imtiyozlaringiz")}</h3></div>
      <ul className="perk-list">
        {extra > 0 && <li><span className="pi gold"><Timer size={18} /></span><span className="grow"><b>{t("Bugun har savolga +{n} soniya", { n: extra })}</b>
          <i>{t("{p}-o'rin ({d}) uchun · savolga {s} soniya", { p: prevMe?.pos || EXTRA.indexOf(extra) + 1, d: fmtDay(d?.prev_day), s: QSEC + extra })}</i></span></li>}
        {medal > 0 && <li><span className="pi"><span style={{ fontSize: 18 }}>{MEDAL[medal - 1]}</span></span><span className="grow"><b>{t("O'tgan hafta {p}-o'rin", { p: medal })}</b>
          <i>{t("Medal nishoni ismingiz yonida; sertifikat — Profil → Sertifikatlar")}</i></span>
          <button className="chip blue" onClick={() => go("cert")}>{t("Ochish")}<ChevronRight size={13} /></button></li>}
        {wqCan && <li><span className="pi"><HelpCircle size={18} /></span><span className="grow"><b>{t("«Haftaning savoli» muallifi")}</b><i>{t("Jamoangiz uchun savol tuzing — ismingiz bilan chiqadi")}</i></span>
          <button className="chip blue" onClick={() => go("wqSubmit")}>{t("Tuzish")}<ChevronRight size={13} /></button></li>}
        {fin && <li><span className="pi"><Trophy size={18} /></span><span className="grow"><b>{t("Oylik finalga saralangansiz")}</b><i>{t("Final: {d}, 10:00–13:00", { d: fmtDay(S.fin.final_date) })}</i></span></li>}
      </ul>
    </section>);
}

/* reyting: kechagi va bugungi kuchli uchlik */
export function DayTopCard() {
  const d = S.day; if (!d) return null;
  const prev = d.prev_top || [], today = (d.today_closed && d.today_top) || [];
  if (!prev.length && !today.length) return null;
  return (
    <section className="card" id="daytop-card">
      <div className="card-h"><Trophy size={20} color="var(--gold)" /><h3>{t("Kunlik kuchli uchlik")}</h3></div>
      {today.length > 0 && <><p className="small muted" style={{ fontWeight: 700 }}>{t("Bugun")} · {t("mukofot {d}", { d: nextWord() })}</p><TopList rows={today} /></>}
      {prev.length > 0 && <><p className="small muted" style={{ fontWeight: 700, marginTop: today.length ? 10 : 0 }}>{fmtDay(d.prev_day)} · {t("mukofot bugun")}</p><TopList rows={prev} /></>}
    </section>);
}

/* faqat admin (PIN bilan kirgan) uchun: jamoa a'zolarining bosqich ballari — bugungi va haftalik. Kunlik mashq va blits kirmaydi. */
export function TeamLiveCard() {
  const pin = S.adminPin || S.superPin;
  const [rows, setRows] = useState<any[] | null>(null);
  const [pairs, setPairs] = useState<any[] | null>(null);
  useEffect(() => {
    if (!pin) return; let on = true;
    const load = () => { rpc<any[]>("liga_admin_live", { p_pin: pin }).then((r) => on && setRows(r || [])).catch(() => on && setRows([]));
      rpc<any[]>("liga_day_duels_admin", { p_pin: pin }).then((r) => on && setPairs(r || [])).catch(() => {}); };
    load(); const iv = setInterval(load, 60000); return () => { on = false; clearInterval(iv); };
  }, [pin]);
  if (!pin || !rows || !rows.length) return null;
  const played = rows.filter((r) => r.today_done > 0).length;
  return (
    <section className="card team-live" id="team-live">
      <div className="card-h"><Eye size={20} color="var(--stamp)" /><h3>{t("Jamoa natijalari")}</h3><span className="chip blue">{t("faqat sizga")}</span></div>
      <p className="small muted" style={{ fontWeight: 600, marginBottom: 8 }}>{t("Faqat bosqich ballari (kunlik mashq va blits kirmaydi). Bugun o'ynaganlar: {a}/{b}.", { a: played, b: rows.length })}</p>
      <div className="board">
        {rows.map((r, k) => (
          <div key={k} className={"r" + (k < 3 && r.week_pts > 0 ? " top" + (k + 1) : "")}>
            <span className="p">{r.week_pts > 0 ? k + 1 : "·"}</span>
            <span className="n">{r.name}<small>{r.today_done > 0
              ? t("Bugun: {s}-bosqich · {r}/{n} to'g'ri · {p} ball", { s: (r.today_si ?? 0) + 1, r: r.today_right, n: r.today_n, p: r.today_pts }) + (r.today_finished ? " ✅" : " ⏳")
              : t("Bugun hali o'ynamagan")}</small></span>
            <span className="x">{r.week_pts}</span>
          </div>))}
      </div>
      <p className="tiny muted" style={{ marginTop: 6, textAlign: "right" }}>{t("o'ng tomonda — haftalik bosqich bali")}</p>
      {pairs && pairs.length > 0 && <>
        <p className="small" style={{ fontWeight: 800, marginTop: 12 }}>{t("Bugungi juftliklar")}</p>
        <div className="board" id="pairs">{pairs.map((p, k) => (
          <div key={k} className="r"><span className="p" style={{ fontSize: 12 }}>{p.slot}</span>
            <span className="n">{p.a_name} — {p.b_name}<small>{p.status === "done" ? (p.note === "cancel" ? t("o'ynalmadi") : p.note === "forfeit" ? t("kelmagan yutqazdi") : t("yakunlandi")) : p.status === "play" ? t("o'ynamoqda") : t("kutilmoqda")}</small></span>
            <span className="x">{p.status === "wait" ? "–" : `${p.a_pts}:${p.b_pts}`}</span></div>))}</div></>}
    </section>);
}

/* bosh sahifa: bugungi juftlik dueli — mening duelim va jamoaning to'liq jadvali (09:00 da tasodifiy tuziladi) */
export function DayDuelCard() {
  useNow(20000);
  if (!S.pid) return null;
  const d = S.dd, list: any[] = S.dl || [], n = tzNow(), wk = n.wd === 0 || n.wd === 6;
  const done = d?.status === "done", open = !!d?.open && !done;
  const res = done ? (d.note === "cancel" ? t("O'ynalmadi") : d.tie ? t("Durang") : d.won ? t("Siz yutdingiz!") : t("Raqib yutdi")) : "";
  const st = (p: any) => p.status === "done" ? (p.note === "cancel" ? t("o'ynalmadi") : `${p.a_pts}:${p.b_pts}`) : p.status === "play" ? t("o'ynamoqda") : "";
  return (
    <section className={"card dayduel" + (open ? " live" : "")} id="day-duel">
      <div className="card-h"><Swords size={20} color="var(--red)" /><h3>{t("Bugungi duel")}</h3>{d && <span className="chip">{t("soat {s}", { s: d.slot })}</span>}</div>
      {d ? <>
        <div className="dd-vs"><b>{t("Siz")}</b><span className="num">{done ? `${d.my_pts}:${d.opp_pts}` : "⚡"}</span><b>{d.opp}</b></div>
        <p className="small muted" style={{ fontWeight: 600 }}>{done ? <>{d.won && <Crown size={14} color="var(--gold)" style={{ verticalAlign: -2 }} />} {res}</>
          : open ? t("Duel ochiq — raqibingiz bilan bir vaqtda kiring.") : d.closed ? t("Vaqt tugadi") : t("Faqat provodka · 10 savol · soat {s} da ochiladi, 1 soat davom etadi", { s: d.slot })}</p>
        {!done && <button className={"btn " + (open ? "" : "ghost")} style={{ marginTop: 10 }} id="dd-go" onClick={() => go("duel", { code: d.code })}>{open ? t("Duelga kirish") : t("Duelni ochish")}</button>}
      </> : <p className="small muted" style={{ fontWeight: 600 }} id="dd-wait">{wk || (n.wd === 5 && n.h >= 9 && !list.length) ? t("Juftlar dushanba soat 09:00 da tasodifiy tuziladi. Bot sizga raqibingiz va soatni yuboradi.")
          : n.h < 9 ? t("Juftlar bugun soat 09:00 da tasodifiy tuziladi. Bot sizga raqibingiz va soatni yuboradi.")
          : list.length ? t("Bugun sizga juft chiqmadi (ishtirokchilar soni toq).") : t("Juftlar har ish kuni soat 09:00 da tasodifiy tuziladi. Keyingisi — ertaga 09:00 da.")}</p>}
      {list.length > 0 && <>
        <p className="small" style={{ fontWeight: 800, marginTop: 12 }}>{t("Bugungi duellar jadvali")}</p>
        <div className="board" id="dd-list">{list.map((p, k) => (
          <div key={k} className={"r" + (p.mine ? " me" : "")}><span className="p" style={{ fontSize: 12 }}>{p.slot}</span>
            <span className="n">{p.a_name} — {p.b_name}</span><span className="x" style={{ fontSize: 13 }}>{st(p)}</span></div>))}</div></>}
    </section>);
}
