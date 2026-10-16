/* Bosh sahifa: bugungi sana va O'zbekiston Markaziy banki kurslari (bot har soatda cbu.uz dan yangilaydi) */
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { S, persist } from "../engine/state";
import { rpc } from "../engine/server";
import { tzNow } from "../engine/time";
import { t, getLang } from "../lib/i18n";
import { useNow } from "./ui";

const OY = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const OY_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const KUN = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const KUN_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const SIGN: Record<string, string> = { USD: "$", EUR: "€", RUB: "₽", CNY: "¥" };
const nf = (x: number, d = 2) => x.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, " ");
export function dayTitle() {
  const n = tzNow(), [, m, d] = n.day.split("-").map(Number);
  return getLang() === "ru" ? `${d} ${OY_RU[m - 1]}, ${KUN_RU[n.wd]}` : t("{d}-{m}, {w}", { d, m: t(OY[m - 1]), w: t(KUN[n.wd]) });
}
export function RatesCard() {
  useNow(60000);
  const [rows, setRows] = useState<any[]>(S.rates || []);
  useEffect(() => {
    let on = true;
    const load = () => rpc<any[]>("liga_rates").then((r) => { if (on && Array.isArray(r) && r.length) { setRows(r); S.rates = r; persist(); } }).catch(() => {});
    load(); const iv = setInterval(load, 30 * 60000); return () => { on = false; clearInterval(iv); };
  }, []);
  const show = rows.filter((r) => SIGN[r.ccy]);
  const rd = rows[0]?.date ? rows[0].date.split("-").reverse().join(".") : "";
  return (
    <section className="rates" id="rates">
      <div className="rates-h"><CalendarDays size={17} /><b className="grow" id="today-date">{dayTitle()}</b>
        {rd && <span className="tiny muted">{t("MB kursi · {d}", { d: rd })}</span>}</div>
      {show.length > 0 && <div className="rates-g">
        {show.map((r) => (
          <div key={r.ccy} className="rt" id={"rate-" + r.ccy}>
            <span className="cc">{SIGN[r.ccy]} {r.ccy}</span>
            <b className="num">{nf(Number(r.rate))}</b>
            {Number(r.diff) !== 0 && <i className={Number(r.diff) > 0 ? "up" : "dn"}>{Number(r.diff) > 0 ? "▲" : "▼"} {nf(Math.abs(Number(r.diff)))}</i>}
          </div>))}
      </div>}
    </section>);
}
