/* Xatolar ustida ishlash: avval har xato misol bilan, keyin mashq (chalg'ituvchilar orasida + teskari savol) */
import { useState } from "react";
import { ChevronDown, NotebookPen, Target } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { PageTitle } from "../components/ui";
import { Explain } from "../components/Explain";
import { errList } from "../engine/errs";
import { startReview, startDaily } from "../engine/run";
import { go, replace, toast } from "../lib/nav";
import { sfx } from "../lib/fx";

const KIND: Record<string, string> = { mc: "Test", pv: "Provodka", calc: "Hisob" };

export default function Review() {
  const list = errList(), top = list.slice(0, 5);
  const [open, setOpen] = useState<string | null>(top[0]?.id || null);
  const start = () => { const r = startReview(); if (typeof r === "string") return toast(t(r)); sfx("tap"); replace("quiz", { run: r }); };
  if (!list.length) return (
    <div className="shell bare">
      <PageTitle title={t("Xatolar ustida ishlash")} />
      <div className="empty" style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center", padding: "40px 10px" }}>
        <NotebookPen size={40} color="var(--green)" />
        <b>{t("Xato daftari bo'sh — zo'r!")}</b>
        <span className="small muted">{t("Bosqich yoki mashqda xato qilsangiz, savol shu yerga tushadi va misol bilan tushuntiriladi.")}</span>
        <button className="btn ghost" onClick={() => { const r = startDaily(); go("quiz", { run: r }); }}><Target size={18} />{t("Kunlik mashq")}</button>
      </div>
    </div>);
  return (
    <div className="shell bare">
      <PageTitle title={t("Xatolar ustida ishlash")} right={<span className="chip bad">{list.length}</span>} />
      <div className="stack">
        <section className="card">
          <ol className="review-steps">
            <li>{t("Har xatoni misol bilan ko'rib chiqing.")}</li>
            <li>{t("Shu savollar boshqa savollar orasida yana chiqadi.")}</li>
            <li>{t("Keyin teskari savol: provodkadan muomalani, javobdan savolni toping.")}</li>
          </ol>
          <p className="small muted" style={{ marginTop: 10, fontWeight: 600 }}>{t("Ikkalasini to'g'ri topsangiz — xato daftardan o'chadi.")}</p>
        </section>
        {top.map(({ id, task, my }) => (
          <section key={id} className="card err-card">
            <button onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
              <span className="grow"><span className="chip" style={{ marginBottom: 6 }}>{t(KIND[task.t])}</span><span className="q" style={{ display: "block" }}>{task.q}</span></span>
              <ChevronDown size={20} style={{ flex: "none", transform: open === id ? "rotate(180deg)" : "", transition: "transform .2s" }} />
            </button>
            {open === id && <Explain task={task} my={my} />}
          </section>))}
        {list.length > top.length && <p className="small muted" style={{ textAlign: "center" }}>{t("Daftarda yana {n} ta xato bor — bularni o'zlashtirgach navbat ularga keladi.", { n: list.length - top.length })}</p>}
      </div>
      <div className="dock"><button className="btn" id="rv-go" onClick={start}>{t("Mashqni boshlash")}</button></div>
    </div>);
}
export const errCount = () => Object.keys(S.errs).length;
