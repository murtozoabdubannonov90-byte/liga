/* Holat: eski ilova bilan bir xil kalit — natijalar saqlanib qoladi */
import { useSyncExternalStore } from "react";
import type { Lang } from "../lib/i18n";
import { weekId } from "./time";

export const KEY = "hisobchi-liga-v1";
export interface Part { stage: number; daily: number; blitz: number; bonus: number }
export interface SaRec { m: Record<number, "ok" | "bad">; p: number | null; b: boolean }
export interface St {
  xp: number; stars: Record<number, number>; streak: number; last: string; ach: string[];
  daily: { d: string; n: number; got: boolean }; dailyRuns: number; failed: Record<number, boolean>;
  name: string; user: { first: string; last: string; phone: string; region?: string };
  days: Record<string, string>; errs: Record<string, boolean>; gift: string; shield: number; blitz: number; blitzXP?: number;
  key: string; pid: string; token: string; tokenLost?: boolean; joinErr?: string; pcount: number;
  week: { id: string; my: number; part: Part; stages: Record<string, number> };
  lastWeekXp: number; lastPart: Part | null; lastStages: Record<string, number> | null; stageXP: Record<string, number>;
  cups: number[]; leagues: number; pending: any; sa: Record<string, SaRec>; seen: Record<string, number>; tacc: Record<string, { ok: number; n: number }>;
  group?: { code: string; name?: string; start?: string; ok?: boolean; until?: string | null; members?: number };
  me?: { paid_until?: string | null; ok?: boolean; personal?: boolean; price?: number; pending?: boolean; tier?: number; ref_code?: string; refs?: number };
  payCfg?: any; members?: { n: string; me: boolean; m: number; tier?: number }[]; lastRes?: any; champs?: any[];
  wq?: any; wqDone?: Record<string, { ok: boolean; e: string }>; fin?: any; finDone?: Record<string, boolean>; finRun?: any; regL?: any[];
  adminPin?: string; superPin?: string; adminRows?: any[]; adminGroup?: any;
  lang?: Lang; theme?: "auto" | "light" | "dark"; sound?: boolean; lessonsRead?: Record<string, string>;
  customQ?: any[]; duels?: Record<string, any>; certs?: any[]; ref?: string; tgLinked?: boolean; balBest?: number; tier?: number;
  [k: string]: any;
}
const fresh = (): St => ({
  xp: 0, stars: {}, streak: 0, last: "", ach: [], daily: { d: "", n: 0, got: false }, dailyRuns: 0, failed: {},
  name: "", user: { first: "", last: "", phone: "" }, days: {}, errs: {}, gift: "", shield: 0, blitz: 0,
  key: "sb_publishable_DWSUYhML5IH5cOksXdlCDA_SNt6c9Dm", pid: "", token: "", pcount: 1,
  week: { id: "", my: 0, part: { stage: 0, daily: 0, blitz: 0, bonus: 0 }, stages: {} },
  lastWeekXp: 0, lastPart: null, lastStages: null, stageXP: {}, cups: [0, 0, 0], leagues: 0, pending: null, sa: {}, seen: {}, tacc: {},
  sound: true, theme: "auto",
});
function load(): St {
  const s = fresh();
  try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o && typeof o.xp === "number") Object.assign(s, o); } catch { /* */ }
  if (!s.week || typeof s.week !== "object") s.week = fresh().week;
  if (!s.week.part) s.week.part = { stage: 0, daily: 0, blitz: 0, bonus: 0 };
  if (!s.week.stages) s.week.stages = {};
  if (!s.stageXP) s.stageXP = {};
  if (!Array.isArray(s.cups)) s.cups = [0, 0, 0];
  if (!s.user) s.user = { first: "", last: "", phone: "" };
  if (!s.key) s.key = fresh().key;
  for (const k of ["days", "errs", "sa", "seen", "tacc", "stars", "failed"]) if (!s[k]) s[k] = {};
  if (!s.blitz20) { s.blitz = 0; s.blitz20 = true; }
  if (!s.week.id) s.week.id = weekId();
  return s;
}
export let S: St = load();
let ver = 0; const subs = new Set<() => void>();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* */ } ver++; subs.forEach((f) => f()); }
export const bump = () => { ver++; subs.forEach((f) => f()); };
export function useStore() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => ver); }
export function resetAll() { const keep = { lang: S.lang, theme: S.theme, sound: S.sound, name: S.name }; S = Object.assign(fresh(), keep); persist(); }
