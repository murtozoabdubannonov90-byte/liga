/* O'ringa qarab alohida medal: oltin (1), kumush (2), bronza (3) — har birining lentasi, rangi va bezagi boshqa.
   Hafta raqami medal ichiga "o'yib" yoziladi, shuning uchun bir kishining medallari ham bir-biridan farq qiladi. */
import { useId } from "react";

export const PLACE = [
  { key: "gold", metal: ["#FFE9A8", "#F2C14E", "#B9861A", "#7A5410"], ribbon: ["#2446D8", "#F7F3E3", "#2446D8"], name: "Oltin" },
  { key: "silver", metal: ["#FFFFFF", "#D9DEE6", "#9AA5B4", "#5E6877"], ribbon: ["#0F6B4E", "#F7F3E3", "#0F6B4E"], name: "Kumush" },
  { key: "bronze", metal: ["#FFD9B8", "#D9935C", "#9C5A2B", "#5F3415"], ribbon: ["#B3261E", "#F7F3E3", "#B3261E"], name: "Bronza" },
] as const;

export function Medal({ place, size = 56, label, week }: { place: 1 | 2 | 3 | number; size?: number; label?: string; week?: string }) {
  const p = PLACE[Math.min(3, Math.max(1, place)) - 1], id = useId().replace(/:/g, "");
  const [hi, mid, lo, edge] = p.metal, [r1, r2, r3] = p.ribbon;
  return (
    <svg width={size} height={size * 1.32} viewBox="0 0 100 132" role="img" aria-label={label || p.name} className={"medal medal-" + p.key}>
      <defs>
        <radialGradient id={"m" + id} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={hi} /><stop offset=".45" stopColor={mid} /><stop offset="1" stopColor={lo} />
        </radialGradient>
        <linearGradient id={"e" + id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={mid} /><stop offset="1" stopColor={edge} /></linearGradient>
      </defs>
      {/* lenta */}
      <path d="M22 0h22l14 52H36z" fill={r1} /><path d="M30 0h6l14 52h-6z" fill={r2} />
      <path d="M56 0h22L64 52H42z" fill={r3} /><path d="M64 0h6L56 52h-6z" fill={r2} />
      <path d="M36 52h28l-4 8H40z" fill={edge} opacity=".55" />
      {/* disk */}
      <circle cx="50" cy="90" r="40" fill={`url(#e${id})`} />
      <circle cx="50" cy="90" r="34" fill={`url(#m${id})`} />
      <circle cx="50" cy="90" r="29" fill="none" stroke={edge} strokeOpacity=".45" strokeWidth="1.5" strokeDasharray={place === 1 ? "0" : place === 2 ? "3 2.5" : "1 2.2"} />
      {/* o'ringa qarab bezak: 1 — dafna shoxlari, 2 — yulduzlar, 3 — nuqtalar */}
      {place === 1 && <g fill="none" stroke={edge} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round">
        <path d="M30 104c-6-8-6-20 0-28" /><path d="M70 104c6-8 6-20 0-28" />
        {[0, 1, 2, 3].map((k) => <path key={k} d={`M${30 - k * 0.8} ${100 - k * 7}l-5 -3`} />)}
        {[0, 1, 2, 3].map((k) => <path key={"r" + k} d={`M${70 + k * 0.8} ${100 - k * 7}l5 -3`} />)}
      </g>}
      {place === 2 && <g fill={edge} fillOpacity=".5">{[-1, 1].map((s) => <path key={s} d={`M${50 + s * 20} 80l1.8 3.8 4.2.6-3 2.9.7 4.2-3.7-2-3.7 2 .7-4.2-3-2.9 4.2-.6z`} />)}</g>}
      {place === 3 && <g fill={edge} fillOpacity=".5">{[-1, 1].map((s) => <circle key={s} cx={50 + s * 20} cy="88" r="2.6" />)}</g>}
      <text x="50" y="99" textAnchor="middle" fontFamily="Unbounded Variable, Unbounded, system-ui" fontWeight="800" fontSize="28" fill={edge}>{place}</text>
      {week && <text x="50" y="114" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="7.5" fill={edge} fillOpacity=".8">{week}</text>}
    </svg>
  );
}
