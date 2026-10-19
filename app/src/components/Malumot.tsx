/* Bosh sahifa: buxgalter ma'lumotnomasi — har mavzu yig'ilgan, bosganda ochiladi (bir vaqtda bittasi).
   Mazmun bazadan (liga_info, har dushanba tekshiriladi va yangilanadi); internet bo'lmasa — oxirgi saqlangani yoki ilovadagi zaxira. */
import { useEffect, useState } from "react";
import { ChevronDown, Library, RefreshCw } from "lucide-react";
import { INFO, UPDATED, type Info } from "../data/malumot";
import { S, persist } from "../engine/state";
import { rpc } from "../engine/server";
import { t, tx, getLang } from "../lib/i18n";

const L = (x: { uz: string; ru: string }) => (getLang() === "ru" ? x.ru : tx(x.uz));
type Pack = { updated: string; checked?: string; items: Info[] };

/* bazadan kelgan ma'lumot to'g'ri tuzilganini tekshiradi — buzuq bo'lsa zaxira ishlatiladi */
export function validInfo(x: any): x is Pack {
  return !!x && typeof x.updated === "string" && Array.isArray(x.items) && x.items.length >= 3 &&
    x.items.every((i: any) => i && typeof i.id === "string" && i.title?.uz && i.short?.uz && Array.isArray(i.rows));
}

export function InfoCard() {
  const [open, setOpen] = useState<string | null>(null);
  const [pack, setPack] = useState<Pack>(validInfo(S.info) ? S.info : { updated: UPDATED, items: INFO });
  useEffect(() => {
    let on = true;
    rpc<any>("liga_info").then((r) => { if (on && validInfo(r)) { setPack(r); S.info = r; persist(); } }).catch(() => {});
    return () => { on = false; };
  }, []);
  return (
    <section className="card info" id="info">
      <div className="card-h"><Library size={20} color="var(--green)" /><h3>{t("Buxgalter ma'lumotnomasi")}</h3>
        <span className="chip ok" id="info-updated"><RefreshCw size={12} />{t("Yangilandi: {d}", { d: pack.updated })}</span></div>
      <p className="small muted info-lead">{t("Korxona shakllari, imtiyozlar va 2026 yil stavkalari. Kerakli mavzuni bosing.")}</p>
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
        {t("Har dushanba tekshiriladi.")} {pack.checked && pack.checked !== pack.updated ? t("Oxirgi tekshiruv: {d} — o'zgarish yo'q.", { d: pack.checked }) + " " : ""}
        {t("Qaror chiqishidan oldin lex.uz dagi amaldagi matnni tekshiring.")}</p>
    </section>);
}
