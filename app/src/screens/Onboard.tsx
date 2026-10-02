import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CreditCard, Check } from "lucide-react";
import { S, persist } from "../engine/state";
import { LANGS, setLang, t, type Lang } from "../lib/i18n";
import { rpc, joinServer, pull, setLangServer } from "../engine/server";
import { setLigaStart } from "../engine/time";
import { fmt } from "../engine/data";
import { entry } from "../boot";
import { tab, go, toast, back } from "../lib/nav";
import { sfx, burst } from "../lib/fx";

export const REGIONS = ["Qoraqalpog'iston Respublikasi", "Andijon viloyati", "Buxoro viloyati", "Farg'ona viloyati", "Jizzax viloyati", "Xorazm viloyati", "Namangan viloyati",
  "Navoiy viloyati", "Qashqadaryo viloyati", "Samarqand viloyati", "Sirdaryo viloyati", "Surxondaryo viloyati", "Toshkent viloyati", "Toshkent shahri"];

/* belgi: T-hisob (Dt | Kt) */
export function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--stamp)" />
      <path d="M14 22h36M32 22v28" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="21" cy="35" r="3.2" fill="var(--gold)" /><circle cx="43" cy="35" r="3.2" fill="#fff" />
    </svg>
  );
}
function Hero({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: "grid", gap: 14, padding: "26px 2px 18px" }}>
      <Mark />
      <h1 className="disp" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05 }}>{title}</h1>
      {sub && <p className="muted" style={{ fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

export function LangPick() {
  const pick = (l: Lang) => { sfx("tap"); S.lang = l; setLang(l); persist(); setLangServer(); };
  return (
    <div className="shell bare">
      <Hero title="Hisobchi Liga" sub="Tilni tanlang · Тилни танланг · Выберите язык" />
      <div className="stack">
        {LANGS.map((l, i) => (
          <motion.button key={l.id} className="btn ghost" style={{ justifyContent: "space-between", minHeight: 62 }} onClick={() => pick(l.id)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <span style={{ fontSize: 18 }}>{l.name}</span><span className="chip">{l.short}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function Register() {
  const [f, setF] = useState(""), [l, setL] = useState(""), [p, setP] = useState(""), [rg, setRg] = useState(S.user.region || "");
  const [g, setG] = useState(entry.g || ""), [gname, setGname] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const personal = !g || g === "ASOSIY";
  useEffect(() => {
    const c = g.trim().toUpperCase(); if (!c) { setGname(""); return; }
    const tm = setTimeout(async () => {
      try { const r = await rpc<any[]>("liga_group_public", { p_code: c }); const x = r && r[0];
        setGname(!x ? "❌ " + t("Bunday jamoa topilmadi") : x.exists_active === false ? "⛔ " + t("Jamoa to'xtatilgan") : "✅ " + x.name);
      } catch { setGname(""); }
    }, 450);
    return () => clearTimeout(tm);
  }, [g]);
  const submit = async () => {
    let ph = p.replace(/[^\d+]/g, "");
    if (f.trim().length < 2) return setErr(t("Ismni kiriting"));
    if (l.trim().length < 2) return setErr(t("Familiyani kiriting"));
    if (/^9\d{8}$/.test(ph)) ph = "+998" + ph; else if (/^\d{9}$/.test(ph)) ph = "+998" + ph;
    if (/^998\d{9}$/.test(ph)) ph = "+" + ph;
    if (!/^\+998\d{9}$/.test(ph)) return setErr(t("Telefon raqam: +998 XX XXX XX XX"));
    if (!rg) return setErr(t("Viloyatni tanlang"));
    const code = g.trim().toUpperCase();
    if (code && gname.startsWith("❌")) return setErr(t("Jamoa kodini tekshiring yoki bo'sh qoldiring"));
    setBusy(true); setErr("");
    if (code) { try { const r = await rpc<any[]>("liga_group_public", { p_code: code }); if (r && r[0]) { S.group = { code: r[0].code, name: r[0].name, start: r[0].start_date, ok: r[0].ok }; setLigaStart(r[0].start_date); } } catch { S.group = { code }; } }
    else S.group = { code: "ASOSIY" };
    S.user = { first: f.trim(), last: l.trim(), phone: ph, region: rg }; S.name = f.trim();
    if (S.group?.code === "ASOSIY") S.me = { personal: true, ok: false, price: 30000 };
    persist();
    const r = await joinServer(); setBusy(false);
    if (!r.ok) toast(r.msg); else { sfx("win"); burst(); }
    pull(true);
    if (S.group?.code === "ASOSIY") { tab("home"); go("pay", { first: true }); } else tab("home");
  };
  return (
    <div className="shell bare">
      <Hero title={t("Ligaga qo'shiling")} sub={t("Har ish kuni 20 ta savol. Juma kuni — g'oliblar.")} />
      <div className="stack">
        <div className="field"><label htmlFor="f">{t("Ism")}</label><input id="f" className="inp" value={f} onChange={(e) => setF(e.target.value)} autoComplete="given-name" /></div>
        <div className="field"><label htmlFor="l">{t("Familiya")}</label><input id="l" className="inp" value={l} onChange={(e) => setL(e.target.value)} autoComplete="family-name" /></div>
        <div className="field"><label htmlFor="p">{t("Telefon raqam")}</label><input id="p" className="inp" type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={p} onChange={(e) => setP(e.target.value)} autoComplete="tel" /></div>
        <div className="field"><label htmlFor="rg">{t("Viloyat")}</label>
          <select id="rg" className="inp" value={rg} onChange={(e) => setRg(e.target.value)}>
            <option value="">{t("— tanlang —")}</option>{REGIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select></div>
        <div className="field"><label htmlFor="g">{t("Jamoa kodi")} <span className="muted small">({t("bo'lmasa bo'sh qoldiring")})</span></label>
          <input id="g" className="inp mono" value={g} onChange={(e) => setG(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="BX12AB" autoCapitalize="characters" />
          {gname && <span className="small" style={{ fontWeight: 700 }}>{gname}</span>}</div>
        {personal && <div className="note"><CreditCard size={18} /><span>{t("Ligada qatnashish: oyiga {p} so'm. Ro'yxatdan o'tgach kartaga to'lab, chekni yuborasiz — shu zahoti ligaga qo'shilasiz.", { p: fmt(S.payCfg?.price || 30000) })}</span></div>}
        <div className="note"><ShieldCheck size={18} /><span>{t("Telefon raqamingizni faqat jamoa administratori ko'radi. Natijangizni faqat shu telefon yoza oladi.")}</span></div>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock"><button className="btn" disabled={busy} onClick={submit} id="go">{busy ? t("Yuborilmoqda...") : t("Ro'yxatdan o'tish")}</button></div>
    </div>
  );
}

export function AskRegion({ back: isBack }: { back?: boolean }) {
  const [rg, setRg] = useState(S.user.region || ""), [err, setErr] = useState("");
  const save = () => { if (!rg) return setErr(t("Viloyatni tanlang")); S.user.region = rg; persist(); toast(t("Saqlandi")); isBack ? back() : tab("home"); };
  return (
    <div className="shell bare">
      <Hero title={t("Viloyatingiz")} sub={t("Viloyat ligasi uchun: jamoangizning eng yaxshi 3 nafari viloyatdagi boshqa jamoalar bilan bellashadi.")} />
      <div className="field"><label htmlFor="rg">{t("Viloyat")}</label>
        <select id="rg" className="inp" value={rg} onChange={(e) => setRg(e.target.value)}>
          <option value="">{t("— tanlang —")}</option>{REGIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
        </select></div>
      <p className="err">{err}</p>
      <div className="dock"><button className="btn" id="go" onClick={save}><Check size={18} />{t("Saqlash")}</button></div>
    </div>
  );
}
