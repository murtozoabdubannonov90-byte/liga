import { useEffect } from "react";
import { motion } from "framer-motion";
import { entry } from "../boot";
import { Zap, Target, Swords, Scale, NotebookPen, Gift, BookOpenCheck, Clock3, KeyRound, CreditCard, ChevronRight, Trophy, Smartphone, HelpCircle, Flame, BellRing } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go, toast } from "../lib/nav";
import { C, startDaily, startBlitz, startErrs, startGift, startPractice } from "../engine/run";
import { stLeft, stTotal, stg } from "../engine/remote";
import { rankOf, giftDone, giftReady, giftCorrect, GIFT_NEED, WEEK_GOAL } from "../engine/score";
import { stageState, todayStage, tzNow, isWeekend, weekDays, stageOfDate, dkey, OPEN_H, closeH, closeStr, hm, weekEnd, stageDay } from "../engine/time";
import { joinServer, pull, tgLinkCode } from "../engine/server";
import { CountUp, TierBadge, useNow } from "../components/ui";
import { canHomeScreen, addToHomeScreen, inTelegram, openTg, BOT_LINK } from "../lib/tg";
import { persist } from "../engine/state";
import { lessonOfDay } from "./Lessons";
import { finalCanPlay } from "./FinalLive";
import { sfx } from "../lib/fx";
import { DeadlineCard, NewsCard } from "./Tools";
import { PerksCard } from "./Perks";

/* Telegram ulanmagan bo'lsa — bot shaxsiy xabar yubora olmaydi */
export const needTgLink = () => !!(S.pid && S.token && S.me && S.me.tg_linked === false && !(inTelegram && S.tgLinked));
export async function connectTelegram() {
  try { const c = await tgLinkCode(); openTg(BOT_LINK + "?start=" + c); setTimeout(() => pull(true), 15000); }
  catch { toast(t("Serverga ulanib bo'lmadi — internetni tekshiring")); }
}
export function TgLinkCard() {
  if (!needTgLink()) return null;
  return (
    <button className="card tglink" onClick={connectTelegram}>
      <span className="ic"><BellRing size={22} /></span>
      <span className="grow"><b>{t("Natijangiz Telegram'ga kelsin")}</b>
        <span className="small">{t("Har bosqichdan keyin balingiz, ertalab bosqich eslatmasi, juma kuni o'rningiz — shaxsan sizga.")}</span></span>
      <span className="chip blue">{t("Ulash")}<ChevronRight size={13} /></span>
    </button>);
}
export const playerBlocked = () => !S.trial && !!(S.me && S.me.personal && S.me.ok === false);
export const groupBlocked = () => !!(S.group && S.group.ok === false);
const WD = ["Du", "Se", "Ch", "Pa", "Ju"];

export function TopBar() {
  const u = S.user, ini = (((u.first || "?")[0] || "") + ((u.last || "")[0] || "")).toUpperCase();
  return (
    <header className="topbar">
      <button className="ava" onClick={() => go("profile")} aria-label={t("Profil")}>{ini}<span className="tier"><TierBadge tier={S.tier || 0} size={20} /></span></button>
      <div className="who grow"><b>{u.first} {(u.last || "").slice(0, 1)}{u.last ? "." : ""}</b><span>{t(rankOf(S.xp).cur[1])}</span></div>
      <span className="xp-pill"><Zap size={16} fill="currentColor" /><CountUp to={S.xp} id="xp" /></span>
    </header>
  );
}
const runOrToast = (r: any) => { if (typeof r === "string") { toast(t(r)); return; } sfx("tap"); go("quiz", { run: r }); };

function Ticket() {
  useNow(30000);
  const si = todayStage(), wk = isWeekend(), c = C();
  if (playerBlocked()) return (
    <div className="ticket"><span className="hole l" /><span className="hole r" />
      <div className="t-top"><CreditCard size={40} /><div className="grow"><div className="t-title">{t("Ligaga qo'shilish uchun obuna kerak")}</div>
        <div className="t-meta">{t("Oyiga {p} so'm · to'lab, chekni yuboring", { p: (S.me?.price || 30000).toLocaleString("ru-RU").replace(/ /g, " ") })}</div></div></div>
      <div className="t-bottom"><button className="btn gold" onClick={() => go("pay")}>{t("To'lov qilish")}</button></div>
    </div>);
  if (wk || si == null) {
    const nx = Array.from({ length: 12 }, (_, i) => i).find((i) => stageState(i) === "future");
    return (
      <div className="ticket"><span className="hole l" /><span className="hole r" />
        <div className="t-top"><div className="t-no">☕</div><div className="grow"><div className="t-title">{t("Dam olish kuni")}</div>
          <div className="t-meta">{nx != null ? t("Keyingi bosqich: {d}, 09:00", { d: stageDay(nx) }) : t("Bosqichlar ish kunlari ochiladi")}</div></div></div>
        <div className="t-bottom"><button className="btn ghost" onClick={() => runOrToast(startPractice())}>{t("Qo'shimcha mashq")}</button></div>
      </div>);
  }
  const ss = stageState(si), left = stLeft(si), total = stTotal(si), done = total - left, n = tzNow(), sv = stg(si);
  const until = ss === "future" ? hm((OPEN_H - n.h) * 3600e3) : hm((closeH(n.wd) - n.h) * 3600e3);
  const finished = left === 0;
  return (
    <motion.div className="ticket" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <span className="hole l" /><span className="hole r" />
      {finished && <span className="stampmark" style={{ color: "#6EE7B7" }}>{t("BAJARILDI")}</span>}
      <div className="t-top">
        <div className="t-no num">{si + 1}<small>{t("bosqich")}</small></div>
        <div className="grow" style={{ paddingTop: 4 }}>
          <div className="t-title">{c.STAGES[si].title}</div>
          <div className="t-meta">
            {ss === "future" && (until.h > 0 ? t("Bugun 09:00 da ochiladi · {h} soat {m} daqiqa qoldi", { h: until.h, m: until.m }) : t("Bugun 09:00 da ochiladi · {m} daqiqa qoldi", { m: until.m }))}
            {ss === "open" && !finished && <>{t("{d}/{n} savol", { d: done, n: total })} · <Clock3 size={13} style={{ verticalAlign: -2 }} /> {until.h > 0 ? t("{c} gacha {h} soat {m} daqiqa", { c: closeStr(), h: until.h, m: until.m }) : t("{c} gacha {m} daqiqa", { c: closeStr(), m: until.m })}</>}
            {ss === "open" && finished && t("✅ {ok} to'g'ri · ❌ {bad} xato · {xp} XP", { ok: sv?.right_n || 0, bad: (sv?.done_n || 0) - (sv?.right_n || 0), xp: S.week.stages[si] || 0 })}
            {ss === "closed" && (finished ? t("✅ Bajarilgan · {xp} XP", { xp: S.week.stages[si] || 0 }) : t("{c} da yopildi", { c: closeStr() }))}
          </div>
        </div>
      </div>
      <div className="t-bottom">
        {ss === "open" && !finished && !groupBlocked() && <button className="btn" onClick={() => go("intro", { si })} id="go-stage">{done ? t("Davom etish") : t("Bosqichni boshlash")}</button>}
        {(ss !== "open" || finished || groupBlocked()) && <button className="btn ghost" onClick={() => runOrToast(startDaily())}>{t("Kunlik mashq")}</button>}
      </div>
    </motion.div>
  );
}

function WeekLedger() {
  useNow(60000);
  const days = weekDays(), my = S.week.my, td = tzNow().day;
  const ms = weekEnd().getTime() - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), mi = Math.max(1, Math.floor((ms % 36e5) / 6e4));
  return (
    <section className="card">
      <div className="card-h"><h3>{t("Haftalik liga")}</h3><span className="chip"><Clock3 size={13} />{d > 0 ? t("{d} kun {h} soat", { d, h }) : h > 0 ? t("{h} soat", { h }) : t("{m} daqiqa", { m: mi })}</span></div>
      <div className="ledger-week">
        {days.map((dt, i) => {
          const k = dkey(dt), si = stageOfDate(dt), xp = si != null ? S.week.stages[si] : undefined, isT = k === td, past = k < td;
          return (<div key={k} className={(isT ? "today " : "") + (xp ? "done" : past && si != null ? "miss" : "")}>
            <i>{t(WD[i])}</i><b className="num">{xp ? xp : past && si != null ? "—" : "·"}</b></div>);
        })}
      </div>
      <div className="total-line"><span className="big num"><CountUp to={my} id="week" /></span><span className="muted" style={{ fontWeight: 700 }}>XP {t("bu hafta")}</span>
        <span className="grow" /><span className="chip gold"><Trophy size={13} />{t("maqsad")} {WEEK_GOAL}</span></div>
      <div className="meter" style={{ marginTop: 10 }}><motion.i initial={{ width: 0 }} animate={{ width: Math.min(100, (my / WEEK_GOAL) * 100) + "%" }} transition={{ duration: 0.9, ease: "easeOut" }} /></div>
      <p className="small muted" style={{ marginTop: 10, fontWeight: 600 }}>{t("Hafta davomida natijangizni faqat siz ko'rasiz. Jadval juma 12:00 da ochiladi.")}</p>
    </section>
  );
}

export default function Home() {
  useEffect(() => { if (entry.d) { const code = entry.d; entry.d = undefined; go("duel", { code }); } }, []);
  const L = lessonOfDay(), errs = Object.keys(S.errs).length;
  const tiles: [any, string, string, () => void, boolean?][] = [
    [Target, "Kunlik mashq", isWeekend() ? t("10 savol · XP siz") : t("10 savol · +8 XP"), () => runOrToast(isWeekend() ? startPractice() : startDaily())],
    [Zap, "Blits", t("20 provodka · rekord {n}", { n: S.blitz || 0 }), () => runOrToast(startBlitz())],
    [Swords, "Duel", t("Hamkasbingizni chaqiring"), () => go("duel"), true],
    [Scale, "Balans o'yini", t("Aktiv va passivni joylang"), () => go("balance")],
    [NotebookPen, "Xato daftari", errs ? t("{n} ta · misol bilan", { n: errs }) : t("{n} ta savol", { n: 0 }), () => go("review"), errs > 0],
    [Gift, "Kunlik sovg'a", giftDone() ? t("ertaga yana") : giftReady() ? t("ochishga tayyor") : t("{a}/{b} to'g'ri javob", { a: giftCorrect(), b: GIFT_NEED }), () => runOrToast(startGift()), giftReady()],
  ];
  const fin = S.fin, wq = S.wq;
  return (
    <div className="shell">
      <TopBar />
      <div className="stack">
        {S.user.first && !S.token && (S.tokenLost || S.joinErr) && (
          <div className="card" style={{ borderColor: "var(--red)" }}>
            <div className="row"><KeyRound size={20} color="var(--red)" /><b className="grow">{S.tokenLost ? t("Hisobingiz boshqa telefonga o'tkazilgan.") : t(S.joinErr || "")}</b></div>
            <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={async () => { const r = await joinServer(true); toast(t(r.msg)); if (r.ok) pull(true); }}>{t("Qayta ulanish")}</button>
          </div>)}
        {groupBlocked() && <div className="note" style={{ background: "var(--red-soft)" }}><CreditCard size={18} /><span>{t("«{n}» obunasi tugagan. Bosqichlar yopiq — administratorga murojaat qiling.", { n: S.group?.name || "" })}</span></div>}
        {fin && finalCanPlay() && <button className="ticket" style={{ textAlign: "left" }} onClick={() => go("finalLive")}>
          <div className="t-top"><Trophy size={40} color="var(--gold)" /><div className="grow"><div className="t-title">{t("Oylik final boshlandi!")}</div><div className="t-meta">{t("Siz saralangansiz · 13:00 gacha")}</div></div><ChevronRight /></div></button>}
        <Ticket />
        <PerksCard />
        <TgLinkCard />
        <DeadlineCard />
        <NewsCard />
        {S.streak > 1 && <div className="row small" style={{ fontWeight: 800, color: "var(--ink-2)" }}><Flame size={18} color="#E8590C" fill="#FFB020" />{t("{n} kunlik seriya — davom eting!", { n: S.streak })}</div>}
        {wq && wq.q_id && !(S.wqDone || {})[wq.q_id] && (
          <button className="card" style={{ textAlign: "left", borderColor: "var(--stamp)" }} onClick={() => go("wqAnswer")}>
            <div className="card-h"><HelpCircle size={20} color="var(--stamp)" /><h3>{t("Haftaning savoli")}</h3><span className="chip blue">+50 XP</span></div>
            <p style={{ fontWeight: 700 }}>{wq.q}</p><p className="small muted" style={{ marginTop: 6 }}>{t("Muallif: {n} — o'tgan hafta g'olibi", { n: wq.author })}</p>
          </button>)}
        {wq && wq.can_submit && <button className="card" style={{ textAlign: "left" }} onClick={() => go("wqSubmit")}>
          <div className="card-h"><Trophy size={20} color="var(--gold)" /><h3>{t("Siz o'tgan hafta g'olibisiz!")}</h3><ChevronRight size={18} /></div>
          <p className="small muted">{t("Jamoangiz uchun «Haftaning savoli»ni tuzing — savol ismingiz bilan chiqadi.")}</p></button>}
        <WeekLedger />
        {L && <button className="card" style={{ textAlign: "left" }} onClick={() => go("lesson", { id: L.id })}>
          <div className="card-h"><BookOpenCheck size={20} color="var(--green)" /><h3>{t("Bugungi dars")}</h3><span className="chip ok">{t("1 daqiqa")}</span></div>
          <p style={{ fontWeight: 800 }}>{L.title}</p><p className="small muted" style={{ marginTop: 4 }}>{L.body.slice(0, 110)}…</p></button>}
        <div className="tiles">
          {tiles.map(([Ic, title, sub, fn, hot]) => (
            <button key={title} className={"tile" + (hot ? " hot" : "")} onClick={fn}><span className="ic"><Ic size={20} /></span><b>{t(title)}</b><i>{sub}</i></button>
          ))}
        </div>
        {canHomeScreen() && !S.hsDone && <button className="card row" style={{ textAlign: "left" }} onClick={() => { addToHomeScreen(); S.hsDone = true; persist(); }}>
          <Smartphone size={22} /><span className="grow"><b>{t("Telefon ekraniga qo'shish")}</b><br /><span className="small muted">{t("Liga bir bosishda ochiladi")}</span></span><ChevronRight size={18} /></button>}
      </div>
    </div>
  );
}
