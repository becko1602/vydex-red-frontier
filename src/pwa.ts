import { useSyncExternalStore } from "react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let pending: InstallEvent | null = null;
let state = {
  installable: false,
  offlineReady: false,
  installed: window.matchMedia("(display-mode: standalone)").matches,
  message: "",
};
const listeners = new Set<() => void>();
function update(value: Partial<typeof state>) {
  state = { ...state, ...value };
  listeners.forEach((fn) => fn());
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pending = event as InstallEvent;
  update({ installable: true });
});
window.addEventListener("appinstalled", () => {
  pending = null;
  update({
    installed: true,
    installable: false,
    message: "Game installed. Launch Vydex from your apps.",
  });
});
export async function installGame() {
  if (pending) {
    const event = pending;
    pending = null;
    await event.prompt();
    const result = await event.userChoice;
    update({
      installable: false,
      message:
        result.outcome === "accepted"
          ? "Installation accepted. Offline files are prepared automatically."
          : "Installation dismissed. You can keep playing in your browser.",
    });
  } else
    update({
      message: state.installed
        ? "Already installed on this device."
        : "Chrome/Edge: use the address-bar Install icon or menu → Install app. iPhone/iPad: Safari → Share → Add to Home Screen. Use HTTPS or localhost.",
    });
}
export function usePwa() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
  );
}
export function registerOffline() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => update({ offlineReady: true }))
        .catch(() =>
          update({
            message:
              "Offline setup unavailable. The game can still run online.",
          }),
        );
    },
    { once: true },
  );
}
