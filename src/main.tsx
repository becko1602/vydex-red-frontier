import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { engine } from "./sim/game";
import "./styles.css";
import { registerOffline } from "./pwa";
registerOffline();
engine.data.stage = "briefing";
// Development-only hook for automated visual checks.
if (import.meta.env.DEV)
  import("./store").then(({ useGame }) => Object.assign(window as object, { __vydex: { engine, useGame } }));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
