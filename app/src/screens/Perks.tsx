/* G'oliblar: kunlik kuchli uchlik mukofoti (bosqich boshida va oxirida), bosh sahifadagi «Imtiyozlaringiz», reytingdagi kunlik uchlik */
import { Timer, Award, Trophy, HelpCircle, ChevronRight, Medal } from "lucide-react";
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
