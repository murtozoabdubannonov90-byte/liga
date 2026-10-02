/* Savollar bazasi: bosqichlar (240), yo'nalishlar (292), hisobvaraqlar, darslar — tilga qarab */
import stagesUz from "../data/stages.uz.json";
import stagesRu from "../data/stages.ru.json";
import accUz from "../data/accounts.uz.json";
import accRu from "../data/accounts.ru.json";
import lessonsRaw from "../data/lessons.json";
import { buildTopics as topicsUz } from "../data/topics.uz";
import { buildTopics as topicsRu } from "../data/topics.ru";
import { cyr, type Lang } from "../lib/i18n";

export type TaskType = "pv" | "mc" | "calc";
export interface Task { t: TaskType; q: string; o?: string[]; a?: number; dt?: string; kt?: string; e: string; unit?: string; id: string; tp?: string; k?: number; author?: string }
export interface Stage { title: string; icon: string; story: string; theory: string; example: null | { t: string; dt: string; kt: string }; tasks: Task[] }
export interface Topic { id: string; icon: string; title: string; tasks: Task[] }
export interface Lesson { id: string; topic: string; title: string; body: string; tip: string; dt: string | null; kt: string | null }
export interface Content { lang: Lang; STAGES: Stage[]; A: Record<string, string>; TOPICS: Topic[]; TASKMAP: Record<string, Task>; LESSONS: Lesson[] }

export const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU").replace(/ /g, " ");
const isCode = (s: string) => /^\d{4}( |$)/.test(s);
function cyrTask(t: Task): Task {
  return { ...t, q: cyr(t.q), e: cyr(t.e), unit: t.unit ? cyr(t.unit) : t.unit, o: t.t === "mc" && t.o ? t.o.map((x) => (isCode(x) ? x : cyr(x))) : t.o };
}
const cache: Partial<Record<Lang, Content>> = {};
export function content(lang: Lang): Content {
  if (cache[lang]) return cache[lang]!;
  const base = lang === "ru" ? "ru" : "uz";
  const raw: Stage[] = JSON.parse(JSON.stringify(base === "ru" ? stagesRu : stagesUz));
  let A: Record<string, string> = { ...(base === "ru" ? accRu : accUz) };
  let TOPICS: Topic[] = (base === "ru" ? topicsRu : topicsUz)(base === "ru" ? accRu : accUz, fmt) as Topic[];
  raw.forEach((st, si) => st.tasks.forEach((t, k) => { t.id = si + "-" + k; }));
  let STAGES = raw;
  if (lang === "uzc") {
    STAGES = raw.map((s) => ({ ...s, title: cyr(s.title), story: cyr(s.story), theory: cyr(s.theory),
      example: s.example ? { ...s.example, t: cyr(s.example.t) } : null, tasks: s.tasks.map(cyrTask) }));
    A = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, cyr(v)]));
    TOPICS = TOPICS.map((tp) => ({ ...tp, title: cyr(tp.title), tasks: tp.tasks.map(cyrTask) }));
  }
  const TASKMAP: Record<string, Task> = {};
  STAGES.forEach((s) => s.tasks.forEach((t) => (TASKMAP[t.id] = t)));
  TOPICS.forEach((tp) => tp.tasks.forEach((t) => (TASKMAP[t.id] = t)));
  const LESSONS: Lesson[] = (lessonsRaw as any[]).map((l) => {
    const src = base === "ru" ? l.ru : l.uz;
    const f = (s: string) => (lang === "uzc" ? cyr(s) : s);
    return { id: l.id, topic: l.topic, title: f(src.title), body: f(src.body), tip: f(src.tip), dt: l.uz.dt, kt: l.uz.kt };
  });
  return (cache[lang] = { lang, STAGES, A, TOPICS, TASKMAP, LESSONS });
}
export const TOPIC_ICONS: Record<string, string> = { qqs: "receipt", ish: "wallet", av: "factory", tmz: "package", sol: "landmark", mhxs: "globe", pro: "book", jamoa: "users" };
export const allTopicTasks = (c: Content) => c.TOPICS.reduce((a: Task[], t) => a.concat(t.tasks), []);
export const qbase = (c: Content) => c.STAGES.reduce((n, s) => n + s.tasks.length, 0) + allTopicTasks(c).length;

/* barqaror tasodifiy son (urug' bilan) */
export function srng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hstr(s: string) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function shuffle<T>(a: T[], R: () => number = Math.random): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
