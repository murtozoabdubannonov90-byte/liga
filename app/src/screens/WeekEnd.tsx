import { useEffect } from "react";
import { Trophy, Share2 } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { tab, replace } from "../lib/nav";
import { CountUp } from "../components/ui";
import { burst, sfx } from "../lib/fx";
import { pull } from "../engine/server";

/* juma 12:00 dan keyin birinchi ochilganda — hafta yakuni */
export default function WeekEnd() {
  const d = S.pending || { my: S.lastWeekXp, xp: 0 };
  useEffect(() => { pull(true); if (d.my > 0) { burst(true); sfx("win"); } S.pending = null; persist(); }, []);
  const L = S.lastRes, pos = L ? L.rows.findIndex((x: any) => x.me) + 1 : 0;
  return (
    <div className="shell bare">
      <div className="result">
        <Trophy size={70} color="var(--gold)" style={{ margin: "0 auto" }} />
        <h2>{t("Haftalik liga yakunlandi!")}</h2>
        <div className="hero-n"><CountUp to={d.my || 0} /> XP</div>
        {pos > 0 && <p style={{ fontWeight: 800 }}>{t("Jamoada {n}-o'rin", { n: pos })}</p>}
        {d.xp > 0 && <span className="chip gold" style={{ justifySelf: "center" }}>{t("Haftalik sovg'a: +{n} XP", { n: d.xp })}</span>}
        <p className="small muted">{t("Yangi liga boshlandi — hisob noldan. Darajalar 12:10 da yangilanadi.")}</p>
      </div>
      <div className="dock"><div className="btn-row">
        <button className="btn ghost" onClick={() => replace("share", { kind: "week" })}><Share2 size={18} />{t("Ulashish")}</button>
        <button className="btn" onClick={() => tab("rate")}>{t("Jadvalni ko'rish")}</button></div></div>
    </div>);
}
