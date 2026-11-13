/* Bosh sahifa: buxgalter ma'lumotnomasi — har mavzu yig'ilgan, bosganda ochiladi (bir vaqtda bittasi).
   Mazmun bazadan (liga_info, har dushanba tekshiriladi va yangilanadi); internet bo'lmasa — oxirgi saqlangani yoki ilovadagi zaxira. */
import { useState } from "react";
import { ChevronDown, ChevronRight, Library, RefreshCw, Scale } from "lucide-react";
import { INFO, UPDATED, type Info } from "../data/malumot";
import { S, persist } from "../engine/state";
import { rpc, due } from "../engine/server";
import { Fold } from "./ui";
import { go } from "../lib/nav";
import { fmtD } from "../engine/time";
import { newsVisible, nTitle, lawSub } from "../screens/Tools";
import { t, tx, getLang } from "../lib/i18n";

const L = (x: { uz: string; ru: string }) => (getLang() === "ru" ? x.ru : tx(x.uz));
type Pack = { updated: string; checked?: string; items: Info[] };

/* bazadan kelgan ma'lumot to'g'ri tuzilganini tekshiradi — buzuq bo'lsa zaxira ishlatiladi */
export function validInfo(x: any): x is Pack {
  return !!x && typeof x.updated === "string" && Array.isArray(x.items) && x.items.length >= 3 &&
    x.items.every((i: any) => i && typeof i.id === "string" && i.title?.uz && i.short?.uz && Array.isArray(i.rows));
}

/* 2026-11-13: karta yig'ilgan — bosganda ochiladi; ichida qonun yangiliklari ham. Bazadan faqat ochilganda olinadi (6 soatda bir). */
export function InfoCard() {
  const [open, setOpen] = useState<string | null>(null);
  const [pack, setPack] = useState<Pack>(validInfo(S.info) ? S.info : { updated: UPDATED, items: INFO });
  const load = () => {
    if (validInfo(S.info) && !due("info", 6 * 3600e3)) return;
    rpc<any>("liga_info").then((r) => { if (validInfo(r)) { setPack(r); S.info = r; persist(); } }).catch(() => {});
  };
  const news = newsVisible().slice(0, 3);
  const fresh = news.filter((n: any) => Date.now() - new Date(n.created_at).getTime() < 7 * 864e5).length;
  return (
    <Fold id="info" tone="info" icon={<Library size={20} />} onOpen={load}
      title={t("Imtiyozlar va qonun yangiliklari")}
      sub={t("Korxona shakllari, imtiyozlar va 2026 stavkalari")}
      badge={fresh > 0 ? <span className="chip bad" id="info-new">{t("{n} yangi", { n: fresh })}</span> : undefined}>
      {news.length > 0 && <div className="info-news" id="info-news">
        <p className="info-sub"><Scale size={15} /> {t("Qonun yangiliklari")}</p>
        {news.map((n: any) => (
          <button key={n.id} className="info-nw" onClick={() => go("newsView", { id: n.id })}>
            <span className="grow"><small>{fmtD(n.created_at)}{n.qs?.length ? " · " + lawSub(n) : ""}</small><b>{nTitle(n)}</b></span><ChevronRight size={16} />
          </button>))}
        <button className="lnk-all" onClick={() => go("news")}>{t("Barcha yangiliklar")} <ChevronRight size={14} /></button>
      </div>}
      <p className="info-sub" style={{ marginTop: news.length ? 12 : 0 }}><Library size={15} /> {t("Korxona shakllari va imtiyozlar")}</p>
      <div className="info-list">
        {pack.items.map((x) => {
          const on = open === x.id;
          return (
            <div key={x.id} className={"info-it" + (on ? " on" : "")} id={"info-" + x.id}>
              <button className="info-h" aria-expanded={on} onClick={() => setOpen(on ? null : x.id)}>
                <span className="info-tag">{L(x.short)}</span>
                <span className="grow"><b>{L(x.title)}</b><small>{L(x.sub)}</small></span>
                <ChevronDown size={18} className="dd-chev" />
              </button>
              {on && <div className="info-b">
                <dl>{x.rows.map(([k, v], i) => <div key={i}><dt>{L(k)}</dt><dd>{L(v)}</dd></div>)}</dl>
                {x.plus && <><p className="info-sub">{t("Afzalliklari va imtiyozlari")}</p>
                  <ul>{x.plus.map((p, i) => <li key={i}>{L(p)}</li>)}</ul></>}
                {x.note && <p className="small muted info-note">{L(x.note)}</p>}
              </div>}
            </div>);
        })}
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }} id="info-checked">
        <span id="info-updated"><RefreshCw size={11} /> {t("Yangilandi: {d}", { d: pack.updated })}</span>. {t("Har dushanba tekshiriladi.")} {pack.checked && pack.checked !== pack.updated ? t("Oxirgi tekshiruv: {d} — o'zgarish yo'q.", { d: pack.checked }) + " " : ""}
        {t("Qaror chiqishidan oldin lex.uz dagi amaldagi matnni tekshiring.")}</p>
    </Fold>);
}
