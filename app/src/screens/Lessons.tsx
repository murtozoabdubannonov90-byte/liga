import { Check, BookOpenCheck, Lightbulb } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { go, back } from "../lib/nav";
import { C } from "../engine/run";
import { PageTitle, Card } from "../components/ui";
import { tzNow, ymd } from "../engine/time";
import { addXP } from "../engine/score";
import { sfx } from "../lib/fx";

/* kunning darsi: 01.10.2026 dan beri o'tgan kunlar bo'yicha (botdagi bilan bir xil) */
export function lessonIndex() { const d0 = ymd("2026-10-01").getTime(), d = ymd(tzNow().day).getTime(); return Math.max(0, Math.round((d - d0) / 864e5)); }
export function lessonOfDay() { const L = C().LESSONS; return L.length ? L[lessonIndex() % L.length] : null; }
const TOPIC: Record<string, string> = { provodka: "Provodka", qqs: "QQS", ish: "Ish haqi", av: "Asosiy vositalar", tmz: "Zaxiralar", sol: "Soliqlar", hisobot: "Hisobot", mhxs: "MHXS" };

export function Lessons() {
  const L = C().LESSONS, upto = lessonIndex() % L.length, read = S.lessonsRead || {};
  return (
    <div className="shell bare">
      <PageTitle title={t("Mini-darslar")} />
      <div className="stack" style={{ gap: 8 }}>
        {L.map((l, k) => (
          <button key={l.id} className="card row" style={{ textAlign: "left", padding: 13, opacity: k > upto + 7 ? 0.55 : 1 }} onClick={() => go("lesson", { id: l.id })}>
            <span className="disp num" style={{ width: 30, fontWeight: 700, color: "var(--muted)" }}>{k + 1}</span>
            <span className="grow"><b style={{ fontSize: 14.5 }}>{l.title}</b><br /><span className="tiny muted" style={{ fontWeight: 700 }}>{t(TOPIC[l.topic] || l.topic)}{k === upto ? " · " + t("bugungi") : ""}</span></span>
            {read[l.id] ? <Check size={18} color="var(--green)" /> : k === upto ? <span className="chip ok">{t("yangi")}</span> : null}
          </button>))}
      </div>
    </div>
  );
}
export function LessonView({ id }: { id: string }) {
  const c = C(), l = c.LESSONS.find((x) => x.id === id); if (!l) return null;
  const done = !!(S.lessonsRead || {})[l.id];
  const finish = () => { if (!done) { S.lessonsRead = { ...(S.lessonsRead || {}), [l.id]: tzNow().day }; addXP(15); persist(); sfx("coin"); } back(); };
  return (
    <div className="shell bare">
      <PageTitle title={t("Bugungi dars")} />
      <div className="stack">
        <Card>
          <div className="row" style={{ marginBottom: 10 }}><BookOpenCheck size={22} color="var(--green)" /><span className="chip ok">{t(TOPIC[l.topic] || l.topic)}</span></div>
          <h2 className="disp" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 10 }}>{l.title}</h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6 }}>{l.body}</p>
          {l.dt && l.kt && <div className="taccount" style={{ marginTop: 16 }}>
            <div className="side"><span className="lbl">{t("Debet")}</span><span className="mono" style={{ fontSize: 24, fontWeight: 700, textAlign: "center" }}>{l.dt}</span><span className="tiny muted" style={{ textAlign: "center" }}>{c.A[l.dt]}</span></div>
            <div className="side"><span className="lbl">{t("Kredit")}</span><span className="mono" style={{ fontSize: 24, fontWeight: 700, textAlign: "center" }}>{l.kt}</span><span className="tiny muted" style={{ textAlign: "center" }}>{c.A[l.kt]}</span></div>
          </div>}
        </Card>
        <div className="note" style={{ background: "var(--gold-soft)" }}><Lightbulb size={18} color="#9A6500" /><span>{l.tip}</span></div>
      </div>
      <div className="dock"><button className="btn ok" id="go" onClick={finish}><Check size={18} />{done ? t("O'qildi") : t("Tushundim · +15 XP")}</button></div>
    </div>
  );
}
