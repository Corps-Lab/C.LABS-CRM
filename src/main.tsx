import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AgencyProvider } from "./contexts/AgencyContext";

const SW_VERSION = "2026-03-23-02";

createRoot(document.getElementById("root")!).render(
  <AgencyProvider>
    <App />
  </AgencyProvider>
);

// PWA: registra service worker (ignora em dev ou se não suportado)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let hasReloadedForSw = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloadedForSw) return;
    hasReloadedForSw = true;
    window.location.reload();
  });

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
    registrations.forEach((registration) => {
      const scopePath = new URL(registration.scope).pathname;
      if (!scopePath.startsWith(basePath)) {
        registration.unregister().catch(() => {
          /* ignore unregister errors */
        });
      }
    });
  });

  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js?v=${SW_VERSION}`)
    .then((registration) => {
      registration.update().catch(() => {
        /* ignore update errors */
      });

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            installingWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    })
    .catch((err) => console.error("SW registration failed", err));
}
