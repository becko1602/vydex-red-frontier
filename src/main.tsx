import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { engine } from "./sim/game";
import "./styles.css";
import { registerOffline } from "./pwa";
registerOffline();
engine.data.stage = "briefing";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
