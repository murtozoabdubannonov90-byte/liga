import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, animate, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { t } from "../lib/i18n";
import { tryBack } from "../lib/nav";
import { TIERS } from "../engine/score";

export function PageTitle({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <div className="ptitle">
      <button className="back" aria-label={t("Orqaga")} onClick={onBack || tryBack}><ArrowLeft size={20} /></button>
      <h2 className="grow">{title}</h2>{right}
    </div>
  );
}
export function Card({ title, right, children, className = "", style }: { title?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; style?: any }) {
  return (
    <section className={"card " + className} style={style}>
      {(title || right) && <div className="card-h"><h3>{title}</h3>{right}</div>}
      {children}
    </section>
  );
}
export function Seg<T extends string>({ items, value, onChange, id }: { items: [T, string][]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div className="seg" role="tablist">
      {items.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {value === v && <motion.i layoutId={"seg-" + id} className="pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}
/* son o'zgarganda sanab chiqadi; id bo'lsa oldingi qiymatdan davom etadi (ekran almashganda qayta sanamaydi) */
const lastVals: Record<string, number> = {};
export function CountUp({ to, ms = 900, id }: { to: number; ms?: number; id?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const from = id ? lastVals[id] ?? 0 : 0; if (id) lastVals[id] = to || 0;
    if (from === to) { el.textContent = (to || 0).toLocaleString("ru-RU").replace(/\u00a0/g, " "); return; }
    const c = animate(from, to || 0, { duration: ms / 1000, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = Math.round(v).toLocaleString("ru-RU").replace(/ /g, " "); } });
    return () => c.stop();
  }, [to, ms]);
  return <span ref={ref} className="num">0</span>;
}
const TIER_C = ["var(--bronze)", "var(--silver)", "var(--goldt)", "var(--diamond)"];
/* daraja belgisi: qalqon, ichida pog'ona chiziqlari (daraja soni) */
export function TierBadge({ tier = 0, size = 22 }: { tier?: number; size?: number }) {
  const c = TIER_C[Math.max(0, Math.min(3, tier))];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={t(TIERS[tier] || TIERS[0])} role="img">
      <path d="M12 1.6 21 5v6.6c0 5.3-3.9 9.4-9 10.8C6.9 21 3 16.9 3 11.6V5z" fill={c} stroke="rgba(0,0,0,.25)" strokeWidth="1" />
      <path d="M12 3.7 19 6.4v5.2c0 4.3-3 7.7-7 8.9-4-1.2-7-4.6-7-8.9V6.4z" fill="rgba(255,255,255,.18)" />
      {Array.from({ length: tier + 1 }).map((_, i) => (
        <path key={i} d={`M7.5 ${15.5 - i * 3.2} 12 ${12.6 - i * 3.2} 16.5 ${15.5 - i * 3.2}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
export function TierChip({ tier = 0 }: { tier?: number }) {
  return <span className="tierchip"><TierBadge tier={tier} size={20} />{t("{t} liga", { t: t(TIERS[tier] || TIERS[0]) })}</span>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function Toast({ toast }: { toast: { text: string; id: number } | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key={toast.id} className="toast" role="status" initial={{ opacity: 0, y: -16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -10, x: "-50%" }}>
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
/* yulduz */
export function Star({ on, delay = 0 }: { on: boolean; delay?: number }) {
  return (
    <motion.svg viewBox="0 0 24 24" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay, type: "spring", stiffness: 380, damping: 14 }}>
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={on ? "var(--gold)" : "var(--rule)"} stroke={on ? "#B07D0B" : "transparent"} strokeWidth="1" />
    </motion.svg>
  );
}
export function Ring({ pct, size = 42, stroke = 4, color = "var(--stamp)", children }: { pct: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}
export function useNow(ms = 1000) { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }
export function copyText(text: string, done?: () => void) {
  try { navigator.clipboard.writeText(text).then(() => done && done(), () => window.prompt("", text)); } catch { window.prompt("", text); }
}
