/* Bosh sahifa: buxgalter ma'lumotnomasi — har mavzu yig'ilgan, bosganda ochiladi (bir vaqtda bittasi) */
import { useState } from "react";
import { ChevronDown, Library } from "lucide-react";
import { INFO, UPDATED } from "../data/malumot";
import { t, tx, getLang } from "../lib/i18n";

const L = (x: { uz: string; ru: string }) => (getLang() === "ru" ? x.ru : tx(x.uz));

export function InfoCard() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card info" id="info">
      <div className="card-h"><Library size={20} color="var(--green)" /><h3>{t("Buxgalter ma'lumotnomasi")}</h3></div>
      <p className="small muted info-lead">{t("Korxona shakllari, imtiyozlar va 2026 yil stavkalari. Kerakli mavzuni bosing.")}</p>
      <div className="info-list">
        {INFO.map((x) => {
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
      <p className="tiny muted" style={{ marginTop: 10 }}>{t("Ma'lumot {d} holatiga. Qaror chiqishidan oldin lex.uz dagi amaldagi matnni tekshiring.", { d: UPDATED })}</p>
    </section>);
}
