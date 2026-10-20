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

export function start() {
  (window as any).__liga = { nav, st, run, score, time };
  boot();
  createRoot(document.getElementById("root")!).render(<Boundary><App /></Boundary>);
  (window as any).__ligaMounted = true;
}
