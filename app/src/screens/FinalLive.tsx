import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Gift, Radio } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go, replace, toast } from "../lib/nav";
import { Card, Empty, PageTitle } from "../components/ui";
import { fmtD } from "../engine/time";
import { rpc } from "../engine/server";
import { startFinalR } from "../engine/remote";

const OY = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const monthName = (m: string) => { const [y, mm] = String(m || "").split("-").map(Number); if (!mm) return ""; const n = t(OY[mm - 1]); return n.charAt(0).toUpperCase() + n.slice(1) + " " + y; };
export function finalCanPlay() { const f = S.fin; return !!(f && f.open_now && f.qualified && f.my_score == null && !(S.finDone || {})[f.month]); }
const mmss = (ms: number) => Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0");

export function FinalCard() {
  const f = S.fin;
  if (!f) return <Card title={t("Oylik chempionat")}><Empty>{t("Ma'lumot yuklanmoqda...")}</Empty></Card>;
  const Q = f.qualifiers || [], St = f.standings || [];
  return (
    <div className="stack">
      <section className="ticket">
        <div className="t-top"><Trophy size={42} color="var(--gold)" /><div className="grow">
          <div className="t-title">{t("{m} chempionati", { m: monthName(f.month) })}</div>
          <div className="t-meta">{t("Final: {d}, shanba 10:00–13:00 · 20 savol · teng ballda tezroq ishlagan yutadi", { d: fmtD(f.final_date) })}</div></div></div>
        <div className="t-bottom">
          {finalCanPlay() ? <button className="btn gold" onClick={() => go("finalLive")}>{t("Finalga kirish")}</button>
            : <span className="small" style={{ color: "var(--on-board-2)", fontWeight: 700 }}>{f.my_score != null ? t("Siz finalni ishladingiz: {s} ball", { s: f.my_score }) : f.qualified ? t("Siz saralandingiz!") : t("2 marta kuchli uchlikka kiring — finalga yo'llanma olasiz")}</span>}
        </div>
      </section>
      <Card title={f.ended ? t("Final natijalari") : t("Finalchilar")}>
        {f.ended && St.length ? <div className="board">{St.map((x: any, k: number) => (
          <div key={k} className={"r" + (k < 3 ? " top" + (k + 1) : "") + (x.me ? " me" : "")}><span className="p">{k + 1}</span>
            <span className="n">{x.n}<small>{Math.round(x.s / 20)}/20 · {mmss(x.ms)}</small></span><span className="x">{x.s}</span></div>))}</div>
          : Q.length ? <div className="board">{Q.map((x: any, k: number) => (
            <div key={k} className={"r" + (x.me ? " me" : "")}><span className="p"><Trophy size={16} /></span>
              <span className="n">{x.n}<small>{t("kuchli uchlikda: {n} marta", { n: x.tops })}</small></span><span className="x">{x.xp}</span></div>))}</div>
          : <Empty>{t("Hali saralanganlar yo'q. Oy davomida 2 marta kuchli uchlikka kiring.")}</Empty>}
      </Card>
      <div className="note" style={{ background: "var(--gold-soft)" }}><Gift size={18} color="#9A6500" /><span>{t("Oy chempioniga maxsus sovg'a tayyorlangan — final kuni ochiladi.")}</span></div>
    </div>
  );
}

/* jonli jadval (har 5 soniyada yangilanadi) */
export default function FinalLive() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let on = true;
    const load = () => S.pid && rpc<any[]>("liga_final_board", { p_id: S.pid }).then((r) => on && setRows(r || [])).catch(() => {});
    load(); const iv = setInterval(load, 5000); return () => { on = false; clearInterval(iv); };
  }, []);
  const can = finalCanPlay();
  return (
    <div className="shell bare">
      <PageTitle title={t("Oylik final")} right={<span className="chip bad"><Radio size={13} />{t("jonli")}</span>} />
      <div className="stack">
        <Card title={t("Jonli jadval")}>
          {rows.length ? <div className="board">{rows.map((x, k) => (
            <motion.div layout key={x.name} className={"r" + (x.is_me ? " me" : "")}><span className="p">{k + 1}</span>
              <span className="n">{x.name}<small>{x.finished ? t("yakunladi") : t("{d}/20 savol", { d: x.done_n })}</small></span>
              <span className="x">{x.right_n * 20}</span></motion.div>))}</div> : <Empty>{t("Finalchilar hali boshlamadi")}</Empty>}
        </Card>
        <p className="small muted" style={{ fontWeight: 600 }}>{t("Jadval har 5 soniyada yangilanadi. Yakuniy natija 13:00 da e'lon qilinadi.")}</p>
      </div>
      {can && <div className="dock"><button className="btn gold" id="fin" onClick={async () => { const f = S.fin; if (!f) return toast(t("Final hozir yopiq")); const r = await startFinalR(f.month); if (typeof r === "string") return toast(t(r)); replace("quiz", { run: r }); }}><Trophy size={18} />{t("Finalni boshlash")}</button></div>}
    </div>
  );
}
