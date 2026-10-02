/* Xatoni misol bilan tushuntirish: provodka — ikki T-hisobda summa bilan; test va hisob — to'g'ri javob, sizning javobingiz, sabab */
import { ArrowDown, ArrowUp } from "lucide-react";
import { t } from "../lib/i18n";
import { C } from "../engine/run";
import { fmt, type Task } from "../engine/data";
import { accKind, sideEffect, amountOf, calcHint, fmtMine, RULE, KIND_NAME, type Mine } from "../engine/errs";

function TBox({ code, side, n }: { code: string; side: "dt" | "kt"; n: number }) {
  const A = C().A, k = accKind(code), ef = sideEffect(k, side);
  return (
    <div className="tbox">
      <div className="tb-h"><b className="mono">{code}</b><span>{A[code] || ""}</span><i>{t(KIND_NAME[k])}</i></div>
      <div className="tb-t">
        <div><span className="lbl">{t("Debet")}</span>{side === "dt" && <b className="num">{fmt(n)}</b>}</div>
        <div><span className="lbl">{t("Kredit")}</span>{side === "kt" && <b className="num">{fmt(n)}</b>}</div>
      </div>
      <div className={"tb-ef " + (ef.up ? "up" : "down")}>{ef.up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{t(ef.txt)}</div>
    </div>);
}

export function Explain({ task, my }: { task: Task; my?: Mine }) {
  const A = C().A;
  if (task.t === "pv" && task.dt && task.kt) {
    const am = amountOf(task.q), kd = accKind(task.dt), kk = accKind(task.kt);
    const rules = kd === kk ? [RULE[kd]] : [RULE[kd], RULE[kk]];
    const swapped = my && my.dt === task.kt && my.kt === task.dt;
    return (
      <div className="explain">
        <p className="ex-h">{am.given ? t("Misol bilan: summa {n} so'm", { n: fmt(am.n) }) : t("Misol bilan: summa {n} so'm bo'lsin", { n: fmt(am.n) })}</p>
        <div className="tpair"><TBox code={task.dt} side="dt" n={am.n} /><TBox code={task.kt} side="kt" n={am.n} /></div>
        <p className="ex-line mono">Dt {task.dt} — Kt {task.kt} · {fmt(am.n)}</p>
        {rules.map((r) => <p key={r} className="ex-rule">{t(r)}</p>)}
        {my && !my.none && (my.dt !== task.dt || my.kt !== task.kt) && <div className="ex-mine">
          <p><b>{t("Siz")}:</b> {fmtMine(task, my)}</p>
          {swapped ? <p>{t("Tomonlar almashib qolgan: bunday yozuv teskari muomalani bildiradi.")}</p> : <>
            {my.dt && my.dt !== task.dt && <p>{t("Debetda {c} — {n} ({k}) emas, {r} — {m} bo'lishi kerak.", { c: my.dt, n: A[my.dt] || "", k: t(KIND_NAME[accKind(my.dt)]), r: task.dt, m: A[task.dt] || "" })}</p>}
            {my.kt && my.kt !== task.kt && <p>{t("Kreditda {c} — {n} ({k}) emas, {r} — {m} bo'lishi kerak.", { c: my.kt, n: A[my.kt] || "", k: t(KIND_NAME[accKind(my.kt)]), r: task.kt, m: A[task.kt] || "" })}</p>}
          </>}
        </div>}
        {task.e && <p className="ex-why"><b>{t("Nega")}:</b> {task.e}</p>}
      </div>);
  }
  const right = task.t === "mc" ? (task.o || [])[Number(task.a)] || "" : fmt(Number(task.a)) + " " + (task.unit || t("so'm"));
  const code = /^\d{4}$/.test(right) ? right : "";
  const myVal = my?.val ? Number(String(my.val).replace(/\D/g, "")) : 0;
  const hint = task.t === "calc" ? calcHint(myVal, Number(task.a)) : "";
  return (
    <div className="explain">
      <div className="ex-ans">
        <div className="ok"><span>{t("To'g'ri javob")}</span><b>{right}{code && A[code] ? " — " + A[code] : ""}</b>{code && <i>{t(KIND_NAME[accKind(code)])}</i>}</div>
        {my && <div className="bad"><span>{t("Siz")}</span><b>{my.none ? t(fmtMine(task, my)) : fmtMine(task, my)}</b></div>}
      </div>
      {task.t === "calc" && myVal > 0 && <p className="ex-line">{t("Farq")}: <b className="num">{fmt(Math.abs(myVal - Number(task.a)))}</b></p>}
      {hint && <p className="ex-rule">{t(hint)}</p>}
      {task.e && <p className="ex-why"><b>{task.t === "calc" ? t("Yechim") : t("Nega")}:</b> {task.e}</p>}
    </div>);
}
