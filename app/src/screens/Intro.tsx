import { useState } from "react";
import { ShieldAlert, Timer, Heart, ListChecks } from "lucide-react";
import { t } from "../lib/i18n";
import { PageTitle } from "../components/ui";
import { C } from "../engine/run";
import { startStageR, stLeft, stTotal } from "../engine/remote";
import { go, replace, toast } from "../lib/nav";
import { stageState, stageDay } from "../engine/time";
import { playerBlocked, groupBlocked } from "./Home";
import { sfx } from "../lib/fx";

export default function Intro({ si }: { si: number }) {
  const c = C(), s = c.STAGES[si];
  const left = stLeft(si), total = stTotal(si);
  const [busy, setBusy] = useState(false);
  const ss = stageState(si);
  const start = async () => {
    if (playerBlocked()) return go("pay");
    if (groupBlocked()) return toast(t("Jamoa obunasi tugagan — administratorga murojaat qiling"));
    if (ss === "future") return toast(t("{n}-bosqich {d} soat 09:00 da ochiladi", { n: si + 1, d: stageDay(si) }));
    if (ss === "closed") return toast(t("Bosqich yopilgan — faqat o'z kunida ochiq: 09:00–17:00, juma 09:00–12:00"));
    if (busy) return; setBusy(true);
    const r = await startStageR(si); setBusy(false);
    if (typeof r === "string") return toast(t(r));
    sfx("tap"); replace("quiz", { run: r });
  };
  return (
    <div className="shell bare">
      <PageTitle title={t("{n}-bosqich", { n: si + 1 })} />
      <div className="stack">
        <section className="card">
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>{s.title}</h3>
          <p className="muted" style={{ fontWeight: 600 }}>{s.story}</p>
        </section>
        <section className="card lesson-html"><div className="small" style={{ lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: s.theory }} />
          {s.example && <div className="flat" style={{ marginTop: 12 }}>
            <p className="small muted" style={{ fontWeight: 700 }}>{s.example.t}</p>
            <div className="taccount" style={{ marginTop: 8 }}>
              <div className="side"><span className="lbl">{t("Debet")}</span><span className="mono" style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{s.example.dt}</span><span className="tiny muted" style={{ textAlign: "center" }}>{c.A[s.example.dt]}</span></div>
              <div className="side"><span className="lbl">{t("Kredit")}</span><span className="mono" style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{s.example.kt}</span><span className="tiny muted" style={{ textAlign: "center" }}>{c.A[s.example.kt]}</span></div>
            </div></div>}
        </section>
        <div className="tiles">
          <div className="tile"><span className="ic"><ListChecks size={20} /></span><b>{t("{n} ta savol", { n: left })}</b><i>{left < total ? t("davom etasiz") : t("12 provodka + 8 savol")}</i></div>
          <div className="tile"><span className="ic"><Timer size={20} /></span><b>{t("1 daqiqa")}</b><i>{t("har savolga")}</i></div>
          <div className="tile"><span className="ic"><Heart size={20} /></span><b>{t("5 ta jon")}</b><i>{t("xatoda kamayadi")}</i></div>
          <div className="tile"><span className="ic"><ShieldAlert size={20} /></span><b>{t("Bir marta")}</b><i>{t("har savolga")}</i></div>
        </div>
        <div className="note" style={{ background: "var(--stamp-soft)" }}><ShieldAlert size={18} color="var(--stamp)" />
          <span>{t("Halol o'yin: savol ochiq turganda ilovadan chiqsangiz (boshqa ilova, brauzer, sun'iy intellekt) — savol avtomatik xato hisoblanadi. Matnni nusxalab bo'lmaydi, ekranda ismingiz yozilgan.")}</span></div>
      </div>
      <div className="dock"><button className="btn" id="go" onClick={start}>{busy ? t("Yuklanmoqda...") : left < total ? t("Davom etish") : t("Boshlash")}</button></div>
    </div>
  );
}
