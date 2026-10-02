import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Check, Scale } from "lucide-react";
import { S, persist } from "../engine/state";
import { t } from "../lib/i18n";
import { PageTitle } from "../components/ui";
import { C } from "../engine/run";
import { fmt, shuffle } from "../engine/data";
import { addXP, award } from "../engine/score";
import { today } from "../engine/time";
import { sfx, burst } from "../lib/fx";
import { toast } from "../lib/nav";

type Side = "a" | "l" | "e";
const ASSETS = ["0130", "1010", "2910", "2810", "4010", "4310", "5010", "5110"], LIAB = ["6010", "6310", "6410", "6710", "6810", "7810"], EQ = ["8330", "8710"];
const r = (a: number, b: number) => (a + Math.floor(Math.random() * (b - a + 1))) * 1_000_000;
function makeGame() {
  const as = shuffle(ASSETS.slice()).slice(0, 4).map((c) => ({ c, v: r(5, 90), s: "a" as Side }));
  const li = shuffle(LIAB.slice()).slice(0, 3).map((c) => ({ c, v: r(3, 40), s: "l" as Side }));
  const A = as.reduce((n, x) => n + x.v, 0), L = li.reduce((n, x) => n + x.v, 0);
  let uk = Math.max(1_000_000, Math.round((A - L) * 0.4 / 1e6) * 1e6);
  if (A - L - uk < 1_000_000) { as[0].v += L + uk + 5_000_000 - A; }
  const A2 = as.reduce((n, x) => n + x.v, 0);
  const eq = [{ c: "8330", v: uk, s: "e" as Side }, { c: "8710", v: A2 - L - uk, s: "e" as Side }];
  return shuffle([...as, ...li, ...eq]);
}
export default function Balance() {
  const c = C();
  const [game, setGame] = useState(makeGame);
  const [place, setPlace] = useState<Record<string, Side>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const left = game.filter((x) => !place[x.c]);
  const sum = (s: Side) => game.filter((x) => place[x.c] === s).reduce((n, x) => n + x.v, 0);
  const allRight = useMemo(() => game.every((x) => place[x.c] === x.s), [place, game]);
  const put = (s: Side) => { if (!sel || checked) return; sfx("tap"); setPlace({ ...place, [sel]: s }); setSel(null); };
  const check = () => {
    setChecked(true);
    if (allRight) { sfx("win"); burst(); award("balance"); if (S.balDay !== today()) { S.balDay = today(); addXP(30); persist(); toast("+30 XP"); } }
    else sfx("bad");
  };
  const reset = () => { setGame(makeGame()); setPlace({}); setSel(null); setChecked(false); };
  const ZONES: [Side, string][] = [["a", "Aktiv"], ["l", "Majburiyatlar"], ["e", "Kapital"]];
  return (
    <div className="shell bare">
      <PageTitle title={t("Balans o'yini")} right={<button className="back" aria-label={t("Yangi o'yin")} onClick={reset}><RotateCcw size={18} /></button>} />
      <p className="small muted" style={{ fontWeight: 600, marginBottom: 12 }}>{t("Hisobvaraqni bosing, keyin bo'limni tanlang. Oxirida Aktiv = Majburiyatlar + Kapital bo'lishi kerak.")}</p>
      <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
        {left.map((x) => (
          <motion.button layout key={x.c} className={"acc-card" + (sel === x.c ? " sel" : "")} onClick={() => { sfx("tap"); setSel(sel === x.c ? null : x.c); }}>
            <span><code>{x.c}</code> {c.A[x.c]}</span><b className="num">{fmt(x.v)}</b>
          </motion.button>))}
        {!left.length && !checked && <p className="small" style={{ fontWeight: 700, textAlign: "center" }}>{t("Hammasi joylandi — tekshiring")}</p>}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {ZONES.map(([s, title]) => (
          <div key={s} className={"bal-col" + (sel ? " on" : "")} onClick={() => put(s)} role="button" aria-label={t(title)}>
            <div className="row between"><h4>{t(title)}</h4><b className="num disp" style={{ fontSize: 15 }}>{fmt(sum(s))}</b></div>
            {game.filter((x) => place[x.c] === s).map((x) => (
              <button key={x.c} className={"acc-card" + (checked ? (x.s === s ? " right" : " wrong") : "")} onClick={(e) => { e.stopPropagation(); if (checked) return; const p = { ...place }; delete p[x.c]; setPlace(p); }}>
                <span><code>{x.c}</code> {c.A[x.c]}</span><b className="num">{fmt(x.v)}</b></button>))}
          </div>))}
      </div>
      {checked && <div className="card" style={{ marginTop: 14, borderColor: allRight ? "var(--green)" : "var(--red)" }}>
        <div className="row"><Scale size={22} color={allRight ? "var(--green)" : "var(--red)"} /><b className="grow">{allRight ? t("Balans yig'ildi! Aktiv = Majburiyatlar + Kapital") : t("Ba'zi hisobvaraqlar noto'g'ri bo'limda")}</b></div>
        <p className="small" style={{ marginTop: 8 }}>{t("Aktiv")}: {fmt(sum("a"))} · {t("Majburiyatlar + Kapital")}: {fmt(sum("l") + sum("e"))}</p>
        {!allRight && <p className="small muted" style={{ marginTop: 6 }}>{t("Qizil bilan belgilangan hisobvaraqlar boshqa bo'limga tegishli. 0–5 guruh — aktiv, 6–7 — majburiyat, 8 — kapital.")}</p>}
      </div>}
      <div className="dock">{!checked ? <button className="btn" id="go" disabled={left.length > 0} onClick={check}><Check size={18} />{t("Tekshirish")}</button>
        : <button className="btn" onClick={reset}><RotateCcw size={18} />{t("Yangi balans")}</button>}</div>
    </div>
  );
}
