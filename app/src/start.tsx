import { createRoot } from "react-dom/client";
import App from "./App";
import { boot } from "./boot";
import { Boundary } from "./components/Boundary";
/* testlar uchun ichki kirish */
import * as nav from "./lib/nav";
import * as st from "./engine/state";
import * as run from "./engine/run";
import * as score from "./engine/score";
import * as time from "./engine/time";
import { SIM_DOCS, report as simReport } from "./screens/Sim";

export function start() {
  (window as any).__liga = { nav, st, run, score, time, sim: { SIM_DOCS, report: simReport } };
  boot();
  createRoot(document.getElementById("root")!).render(<Boundary><App /></Boundary>);
  (window as any).__ligaMounted = true;
}
