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
