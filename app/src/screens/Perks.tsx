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
import { OppName } from "../components/OppContact";

export const EXTRA = [10, 7, 4];
const MEDAL = ["🥇", "🥈", "🥉"];
const fmtDay = (d?: string) => { if (!d) return ""; const [y, m, dd] = d.split("-"); return `${dd}.${m}`; };
const nextWord = () => { const w = tzNow().wd; return w >= 5 || w === 0 ? t("dushanba kuni") : t("ertaga"); };

function TopList({ rows, id }: { rows: { pos: number; name: string; me: boolean }[]; id?: string }) {
  return (
    <ol className="daytop" id={id}>
      {rows.map((x) => (
        <li key={x.pos} className={x.me ? "me" : ""}><span className="md">{MEDAL[x.pos - 1]}</span><b className="grow">{x.name}{x.me ? " · " + t("siz") : ""}</b></li>
      ))}
    </ol>);
}

/* bosqich boshida (when="start") va yakunida (when="end"): kuchli uchlikka nima beriladi */
export function DayRewards({ when }: { when: "start" | "end" }) {
  const d = S.day, top = (d?.today_closed && d?.today_top) || [];
  return (
    <section className="rewards" id={"rw-" + when}>
      <div className="rw-h"><Trophy size={20} /><h3>{t("Kunlik kuchli uchlik")}</h3></div>
      <p className="rw-note">{t("Har savolga hamma uchun teng — 2 daqiqa. O'rin bugungi bosqich bali bo'yicha (teng bo'lsa — tezroq tugatgan).")}</p>
      {when === "end" && (top.length
        ? <><p className="rw-sub">{t("Bugungi kuchli uchlik")}</p><TopList rows={top} id="today-top" /></>
        : <p className="rw-sub">{t("Natija soat {c} da e'lon qilinadi — bot g'oliblarga shaxsan xabar yuboradi.", { c: closeStr() })}</p>)}
      <p className="rw-week"><Medal size={15} />{t("Haftalik kuchli uchlik: o'ringa qarab medal va QR kodli sertifikat; 1-o'rin «Haftaning savoli»ni tuzadi. Oktyabr va noyabrning kuchli uchligi — dekabrdagi Katta finalga.")}</p>
    </section>);
}

/* bosh sahifa: g'olibning imtiyozlari */
export function PerksCard() {
  const medal = (S.members || []).find((m) => m.me)?.m || 0, wqCan = !!S.wq?.can_submit, fin = !!S.fin?.qualified && !S.fin?.ended;
  if (!medal && !wqCan && !fin) return null;
  return (
    <section className="card perks" id="perks">
      <div className="card-h"><Award size={20} color="var(--gold)" /><h3>{t("Imtiyozlaringiz")}</h3></div>
      <ul className="perk-list">
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
      {today.length > 0 && <><p className="small muted" style={{ fontWeight: 700 }}>{t("Bugun")}</p><TopList rows={today} /></>}
      {prev.length > 0 && <><p className="small muted" style={{ fontWeight: 700, marginTop: today.length ? 10 : 0 }}>{fmtDay(d.prev_day)}</p><TopList rows={prev} /></>}
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
            <span className="n">{p.a_name} — {p.b_name}<small>{p.status === "done" ? (p.note === "cancel" ? t("o'ynalmadi") : p.note === "forfeit" ? t("kelmagan yutqazdi") : p.note === "idle" ? t("javob bermagan yutqazdi") : p.note === "idle2" ? t("o'ynamay to'xtatildi") : t("yakunlandi")) : p.status === "play" ? t("o'ynamoqda") : t("kutilmoqda")}</small></span>
            <span className="x">{p.status === "wait" ? "–" : `${p.a_pts}:${p.b_pts}`}</span></div>))}</div></>}
    </section>);
}

/* bosh sahifa: kunlik duel kubogi — mening duelim, kun jadvali (saralash → 1/16 → 1/8 → chorak → yarim → final 17:00) */
const STAGE: Record<string, string> = { qual: "Saralash raundi", r64: "1/32 final", r32: "1/16 final", r16: "1/8 final", quarter: "Chorak final", semi: "Yarim final", final: "Final" };
export const stageName = (st?: string) => {
  if (!st) return "";
  if (STAGE[st]) return t(STAGE[st]);
  const m = /^r(\d+)$/.exec(st); return m && Number(m[1]) >= 4 ? t("1/{n} final", { n: Number(m[1]) / 2 }) : t("Raund");
};
const BIG = 8;          // bundan ko'p duelli raund yig'ib ko'rsatiladi (faqat o'z dueli + «hammasini ko'rish»)
export function DayDuelCard() {
  useNow(20000);
  const [all, setAll] = useState<Record<number, boolean>>({});
  if (!S.pid) return null;
  const d = S.dd, list: any[] = S.dl || [], me2 = S.dm, n = tzNow(), wk = n.wd === 0 || n.wd === 6;
  const plan: { round: number; stage: string; duels: number; at: string }[] = me2?.table || [];
  const done = d?.status === "done", open = !!d?.open && !done;
  const champ = list.find((x) => x.champion)?.champion;
  const res = done ? (d.won ? (d.stage === "final" ? t("Siz kubok g'olibisiz! 🏆") : t("Siz keyingi bosqichga chiqdingiz!")) : t("Bu safar raqib kuchliroq — ertaga yana kubok")) : "";
  const myBye = list.find((x) => x.status === "bye" && x.mine && x.round > (d?.round ?? 0));
  const rounds = [...new Set(list.map((x) => x.round))].sort((a, b) => a - b);
  const cur = rounds.length ? rounds[rounds.length - 1] : 0;
  const st = (p: any) => p.status === "done" ? `${p.a_pts}:${p.b_pts}` : p.status === "play" ? t("o'ynamoqda") : "";
  const next = plan.find((x) => x.round === 2);
  const row = (p: any, k: number) => p.status === "bye" ? (
    <div key={"b" + k} className={"r bye" + (p.mine ? " me" : "")}><span className="p" style={{ fontSize: 12 }}>➡️</span>
      <span className="n">{p.a_name}<small>{t("Juftsiz qoldi — keyingi raundga avtomatik o'tdi")}</small></span><span className="x" /></div>) : (
    <div key={k} className={"r" + (p.mine ? " me" : "")}><span className="p" style={{ fontSize: 12 }}>{k}</span>
      <span className="n">{p.a_name} — {p.b_name}{p.winner_name && <small>✅ {p.winner_name}</small>}</span><span className="x" style={{ fontSize: 13 }}>{st(p)}</span></div>);
  return (
    <section className={"card dayduel" + (open ? " live" : "")} id="day-duel">
      <div className="card-h"><Swords size={20} color="var(--red)" /><h3>{t("Kunlik duel kubogi")}</h3>{d && <span className="chip">{stageName(d.stage)} · {d.slot}</span>}</div>
      {champ && <p className="dd-champ" id="dd-champ"><Crown size={18} color="var(--gold)" />{t("Kubok g'olibi: {n}", { n: champ })}</p>}
      {d ? <>
        <div className="dd-vs"><b>{t("Siz")}</b><span className="num">{done ? `${d.my_pts}:${d.opp_pts}` : "⚡"}</span><OppName code={d.code} name={d.opp} id="dd-opp" /></div>
        {!done && d.opp && <p className="tiny muted dd-tip">{t("Raqib ismiga bosing — telefoni va Telegrami chiqadi")}</p>}
        <p className="small muted" style={{ fontWeight: 600 }}>{done ? (myBye ? t("Siz juftsiz qoldingiz va {st} dan keyingi raundga avtomatik o'tdingiz. Keyingi duelingiz haqida bot xabar beradi.", { st: stageName(myBye.stage) }) : res)
          : open ? t("Duel ochiq — raqibingiz bilan bir vaqtda kiring.") : d.closed ? t("Vaqt tugadi") : t("Faqat provodka · 15 savol · har biriga 1,5 daqiqa · soat {s} da ochiladi, 30 daqiqa ochiq", { s: d.slot })}</p>
        {!done && <button className={"btn " + (open ? "" : "ghost")} style={{ marginTop: 10 }} id="dd-go" onClick={() => go("duel", { code: d.code })}>{open ? t("Duelga kirish") : t("Duelni ochish")}</button>}
      </> : me2?.bye && next && cur <= 1 ? <p className="dd-bye" id="dd-bye">{t("Siz 1-raunddan avtomatik o'tdingiz. Keyingi duelingiz — soat {s} ({st}). Raqib 1-raund tugagach chiqadi.", { s: next.at, st: stageName(next.stage) })}</p>
        : <p className="small muted" style={{ fontWeight: 600 }} id="dd-wait">{wk || (n.wd === 5 && n.h >= 9 && !list.length) ? t("Kubok juftlari dushanba soat 09:00 da tasodifiy tuziladi, duellar 10:00 dan. Bot sizga raqibingiz va soatni yuboradi.")
          : n.h < 9 ? t("Kubok juftlari bugun soat 09:00 da tasodifiy tuziladi, duellar 10:00 dan. Bot sizga raqibingiz va soatni yuboradi.")
          : list.length ? t("Bugungi kubok 09:00 da tuzilgan — siz ro'yxatga kirmadingiz. Keyingi kubok — {w}: juftlar 09:00 da, duellar 10:00 dan.", { w: nextWord() }) : t("Kubok har ish kuni: juftlar 09:00 da, duellar 10:00 dan. Keyingisi — ertaga.")}</p>}
      {plan.length > 1 && <div className="dd-plan" id="dd-plan">
        <p className="small" style={{ fontWeight: 800 }}>{t("Kun jadvali · {n} ishtirokchi", { n: me2.players })}</p>
        <ol>{plan.map((x) => <li key={x.round} className={x.round === cur ? "now" : x.round < cur ? "past" : ""}>
          <span className="num">{x.at}</span><b>{stageName(x.stage)}</b><small>{t("{d} duel", { d: x.duels })}</small></li>)}</ol>
        <p className="tiny muted">{t("Raundning barcha duellari bir vaqtda o'ynaladi. 12:00–14:00 — tanaffus. Final — 17:00.")}</p>
      </div>}
      {rounds.map((r) => { const rr = list.filter((x) => x.round === r && x.status !== "bye"), by = list.filter((x) => x.round === r && x.status === "bye"),
        big = rr.length > BIG && !all[r], mine = rr.filter((x) => x.mine); if (!rr.length) return null; return (
        <div key={r}>
          <p className="small" style={{ fontWeight: 800, marginTop: 12 }}>{stageName(rr[0].stage)} · {rr[0].slot}<span className="muted" style={{ fontWeight: 600 }}> · {t("{d} duel", { d: rr.length })}</span></p>
          <div className="board dd-list">{(big ? mine : rr).map((p) => row(p, rr.indexOf(p) + 1))}{by.map((p, i) => row(p, i))}</div>
          {rr.length > BIG && <button className="dd-more" onClick={() => setAll({ ...all, [r]: !all[r] })}>
            {all[r] ? t("Yig'ish") : t("Barcha {d} duelni ko'rish", { d: rr.length })}</button>}
        </div>); })}
    </section>);
}
