/* Effektlar: ovoz (fayllarsiz, WebAudio), konfetti, tebranish */
import confetti from "canvas-confetti";
import { haptic } from "./tg";

let ctx: AudioContext | null = null;
let soundOn = true;
export const setSound = (v: boolean) => { soundOn = v; };
function ac() { if (!ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (C) ctx = new C(); } return ctx; }
function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + at);
  g.gain.setValueAtTime(0.0001, c.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
}
export function sfx(kind: "ok" | "bad" | "tap" | "win" | "tick" | "coin") {
  if (kind === "ok" || kind === "bad" || kind === "win") haptic(kind === "win" ? "ok" : kind);
  if (kind === "tap") haptic("tap");
  if (!soundOn) return;
  try {
    const c = ac(); if (c && c.state === "suspended") c.resume();
    if (kind === "ok") { tone(660, 0, .12, "triangle"); tone(990, .09, .18, "triangle"); }
    else if (kind === "bad") { tone(220, 0, .18, "sawtooth", .06); tone(165, .12, .25, "sawtooth", .06); }
    else if (kind === "tap") tone(520, 0, .05, "sine", .05);
    else if (kind === "tick") tone(880, 0, .04, "square", .03);
    else if (kind === "coin") { tone(1200, 0, .08, "square", .04); tone(1600, .07, .12, "square", .04); }
    else if (kind === "win") { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .11, .25, "triangle", .1)); }
  } catch { /* ovoz yo'q */ }
}
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
export function burst(big = false) {
  if (reduced()) return;
  const colors = ["#2446D8", "#13895B", "#F2B32A", "#D6322E", "#ffffff"];
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, startVelocity: big ? 48 : 36, origin: { y: .7 }, colors, disableForReducedMotion: true });
  if (big) setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: .8 }, colors }), 250);
  if (big) setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: .8 }, colors }), 400);
}

/* Javob effekti: to'g'ri — ekran chetlaridan yashil sharlar va belgilar ko'tariladi; xato — katta qizil X, qizil chet, silkinish va vibratsiya */
const GREENS = ["#13895B", "#1FA971", "#3CCB8B", "#0E6B47", "#5FD7A0"];
const balloon = (c: string) => `<svg viewBox="0 0 40 74" width="100%" height="100%" aria-hidden="true">
  <path d="M20 50 C 16 58, 24 62, 19 73" fill="none" stroke="${c}" stroke-opacity=".55" stroke-width="1.4"/>
  <path d="M17 49 L23 49 L20 45 Z" fill="${c}"/>
  <ellipse cx="20" cy="24" rx="17" ry="22" fill="${c}"/>
  <ellipse cx="13" cy="15" rx="4.5" ry="7" fill="#fff" fill-opacity=".38" transform="rotate(-18 13 15)"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#13895B"/><path d="M6.5 12.4l3.6 3.6 7.4-7.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BIGX = `<svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="#D6322E"/><circle cx="60" cy="60" r="54" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4"/><path d="M40 40 L80 80 M80 40 L40 80" stroke="#fff" stroke-width="12" stroke-linecap="round"/></svg>`;
let cheerT: any = 0;
export function cheer(ok: boolean) {
  try {
    document.querySelectorAll(".cheer").forEach((n) => n.remove()); clearTimeout(cheerT);
    const box = document.createElement("div"); box.className = "cheer " + (ok ? "ok" : "bad"); box.setAttribute("aria-hidden", "true");
    const calm = reduced(), W = window.innerWidth;
    if (ok) {
      const n = calm ? 0 : W < 400 ? 10 : 14;
      for (let k = 0; k < n; k++) {
        const left = k % 2 === 0, el = document.createElement("i"), size = 34 + Math.random() * 22;
        el.className = "bln"; el.innerHTML = balloon(GREENS[k % GREENS.length]);
        el.style.cssText = `${left ? "left" : "right"}:${-6 + Math.random() * 18}%;width:${size}px;height:${size * 1.85}px;animation-delay:${(k >> 1) * 70 + Math.random() * 60}ms;animation-duration:${1500 + Math.random() * 600}ms;--sway:${(left ? 1 : -1) * (14 + Math.random() * 30)}px`;
        box.appendChild(el);
      }
      const m = calm ? 1 : 6;
      for (let k = 0; k < m; k++) {
        const el = document.createElement("i"), left = k % 2 === 0; el.className = "chk"; el.innerHTML = CHECK;
        el.style.cssText = calm ? "left:50%;top:40%;margin-left:-22px" : `${left ? "left" : "right"}:${1 + Math.random() * 6}%;top:${45 + Math.random() * 30}%;animation-delay:${120 + k * 90}ms`;
        box.appendChild(el);
      }
    } else {
      const x = document.createElement("i"); x.className = "bigx"; x.innerHTML = BIGX; box.appendChild(x);
      const card = document.querySelector(".qcard");
      if (card && !calm) { card.classList.remove("shake"); void (card as HTMLElement).offsetWidth; card.classList.add("shake"); }
    }
    document.body.appendChild(box);
    cheerT = setTimeout(() => box.remove(), ok ? 2300 : 1100);
  } catch { /* effekt majburiy emas */ }
}
