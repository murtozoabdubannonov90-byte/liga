/* Dekabr Katta finali: oktyabr va noyabr oylarining kuchli uchligi (6 finalchi).
   Bosh sahifa kartasi + har kuni birinchi kirishda eslatma oynasi. */
import { motion } from "framer-motion";
import { Crown, X } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { fmt } from "../engine/data";
import { tzNow, fmtD } from "../engine/time";
import { monthName } from "./FinalLive";
import { Medal } from "../components/Medal";

const OYG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const dayMonth = (d: string) => { const [, m, dd] = String(d || "").split("-").map(Number); return m ? dd + "-" + t(OYG[m - 1]) : ""; };
export const grandOn = () => { const g = S.grand; return !!(g && g.active && (g.months || []).length); };

function MonthBlock({ m }: { m: any }) {
  const top = m.top || [], need = Math.max(0, (m.third_xp || 0) - (m.my_xp || 0) + 1);
  const st = m.closed ? t("Yakunlandi") : m.live ? t("Davom etmoqda") : t("Hali boshlanmagan");
  return (
    <div className="gf-month" data-m={m.m}>
      <div className="gf-mh"><b>{monthName(m.m)}</b><span className={"chip " + (m.closed ? "ok" : m.live ? "gold" : "")}>{st}</span></div>
      {top.length ? <ol className="gf-top">{top.map((x: any) => (
        <li key={x.pos} className={x.me ? "me" : ""}><Medal place={x.pos} size={22} /><span className="grow">{x.n}{x.me ? " · " + t("siz") : ""}</span><span className="num">{fmt(x.xp)}</span></li>))}</ol>
        : <p className="small muted">{m.live ? t("Birinchi natijalar juma soat 12:00 da chiqadi.") : t("Oy boshlanganda reyting shu yerda chiqadi.")}</p>}
      {m.live && (m.my_pos && m.my_pos <= 3
        ? <p className="gf-me ok">{t("Siz hozir {p}-o'rindasiz — finalga yo'l ochiq!", { p: m.my_pos })}</p>
        : <p className="gf-me">{m.my_pos ? t("Siz {p}-o'rindasiz ({x} ball). Kuchli uchlikka {n} ball yetmayapti.", { p: m.my_pos, x: fmt(m.my_xp), n: fmt(need) })
          : t("Bu oy hali ball yo'q — bugungi bosqichdan boshlang.")}</p>)}
    </div>);
}

export function GrandCard() {
  const g = S.grand; if (!grandOn()) return null;
  return (
    <section className="gf card" id="grand">
      <div className="gf-head"><Crown size={26} /><div className="grow">
        <h3>{t("Katta final — {d}", { d: dayMonth(g.date) })}</h3>
        <p>{t("Oktyabr va noyabrning kuchli uchligi — 6 finalchi. {d}, soat 10:00–13:00, eng qiyin 20 savol.", { d: dayMonth(g.date) })}</p></div></div>
      {g.qualified && <p className="gf-q">🎟 {t("Siz Katta finalga yo'llanma oldingiz!")}</p>}
      <div className="gf-months">{(g.months || []).map((m: any) => <MonthBlock key={m.m} m={m} />)}</div>
      <p className="tiny muted">{t("Oy reytingi — shu oydagi haftalik ballar yig'indisi. Har juma soat 12:00 da yangilanadi.")}</p>
    </section>);
}

/* har kuni birinchi kirishda bir marta */
export function GrandPop() {
  const day = tzNow().day;
  if (!grandOn() || (S as any).grandSeen === day || !S.user?.first) return null;
  const close = () => { (S as any).grandSeen = day; persist(); };
  const g = S.grand, live = (g.months || []).find((m: any) => m.live);
  return (
    <div className="gf-pop" role="dialog" aria-modal="true" aria-labelledby="gf-pop-h" id="grand-pop" onClick={close}>
      <motion.div className="gf-sheet" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <button className="gf-x" onClick={close} aria-label={t("Yopish")}><X size={20} /></button>
        <div className="gf-medals" aria-hidden="true"><Medal place={2} size={40} /><Medal place={1} size={52} /><Medal place={3} size={40} /></div>
        <h2 id="gf-pop-h">{t("Dekabrda Katta final!")}</h2>
        <p className="gf-lead">{t("{d} kuni oktyabr va noyabr oylarining kuchli uchligi bellashadi. Har bir bosqich bali hisobga olinadi.", { d: fmtD(g.date) })}</p>
        {live && <MonthBlock m={live} />}
        <button className="btn gold" onClick={close} id="grand-ok">{t("Tushunarli — kuchli uchlikka kiraman")}</button>
      </motion.div>
    </div>);
}
