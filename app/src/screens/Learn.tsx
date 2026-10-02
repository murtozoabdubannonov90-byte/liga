import { useState } from "react";
import { Check, Lock, ChevronRight, BookOpenCheck, Scale, Compass, RefreshCw } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go } from "../lib/nav";
import { C } from "../engine/run";
import { stageState, stageDay, season, STAGE_N, closeStr, stageDate } from "../engine/time";
import { saLeft } from "../engine/score";
import { qbase } from "../engine/data";
import { Seg } from "../components/ui";
import { TopBar } from "./Home";

export default function Learn() {
  const c = C();
  const [tb, setTb] = useState<"map" | "more">("map");
  return (
    <div className="shell">
      <TopBar />
      <div className="stack">
        <Seg id="learn" value={tb} onChange={setTb} items={[["map", t("Bosqichlar")], ["more", t("Mashq va darslar")]]} />
        {tb === "map" && <>
          {season() > 0 && <div className="note"><RefreshCw size={18} /><span>{t("{n}-mavsum — bosqichlar yangidan boshlandi", { n: season() + 1 })}</span></div>}
          <div className="path">
            {Array.from({ length: STAGE_N }, (_, i) => i).map((i) => {
              const ss = stageState(i), done = !saLeft(i).length, sc = S.stars[i] || 0;
              const lbl = ss === "open" ? (done ? t("✅ Bajarildi · bugun") : t("Ochiq — bugun {c} gacha", { c: closeStr() })) : ss === "future" ? stageDay(i) + " · 09:00–" + closeStr(stageDate(i).getDay()) : done ? t("Bajarilgan · yopildi") : t("Yopildi · {d}", { d: stageDay(i) });
              return (
                <button key={i} className={"st" + (ss === "open" && !done ? " open" : done ? " done" : "")} disabled={ss !== "open"} onClick={() => go("intro", { si: i })}>
                  <span className="no">{done ? <Check size={24} /> : ss === "future" ? <Lock size={20} /> : i + 1}</span>
                  <span><b>{c.STAGES[i].title}</b><i>{lbl}{S.stageXP[i] ? " · " + S.stageXP[i] + " XP" : ""}</i></span>
                  <span className="disp" style={{ color: "var(--gold)", fontSize: 14, letterSpacing: 2 }}>{"★".repeat(sc)}<span style={{ color: "var(--rule)" }}>{"★".repeat(3 - sc)}</span></span>
                </button>);
            })}
          </div>
          <p className="small muted" style={{ fontWeight: 600 }}>{t("Har ish kuni bittadan bosqich: faqat o'z kunida 09:00 dan 17:00 gacha ochiq, juma kuni 12:00 gacha.")}</p>
        </>}
        {tb === "more" && <div className="stack">
          <button className="card row" style={{ textAlign: "left" }} onClick={() => go("topics")}>
            <span className="tile ic" style={{ border: 0, padding: 0, boxShadow: "none" }}><Compass size={22} /></span>
            <span className="grow"><b>{t("Yo'nalishlar")}</b><br /><span className="small muted">{t("QQS, ish haqi, MHXS va boshqalar · bazada {n} ta savol", { n: qbase(c) + (S.customQ?.length || 0) })}</span></span><ChevronRight size={18} /></button>
          <button className="card row" style={{ textAlign: "left" }} onClick={() => go("lessons")}>
            <BookOpenCheck size={22} color="var(--green)" /><span className="grow"><b>{t("Mini-darslar")}</b><br /><span className="small muted">{t("Har kuni 1 daqiqalik qoida · {n} ta dars", { n: c.LESSONS.length })}</span></span><ChevronRight size={18} /></button>
          <button className="card row" style={{ textAlign: "left" }} onClick={() => go("balance")}>
            <Scale size={22} color="var(--stamp)" /><span className="grow"><b>{t("Balans o'yini")}</b><br /><span className="small muted">{t("Hisobvaraqlarni aktiv, majburiyat va kapitalga ajrating")}</span></span><ChevronRight size={18} /></button>
        </div>}
      </div>
    </div>
  );
}
