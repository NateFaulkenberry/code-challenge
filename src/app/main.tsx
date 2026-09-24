import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@/styles/global.css";
import { AppProviders } from "./context";
import { createRouter } from "./router";
import { createAppServices } from "./services";
import { applyTheme } from "./theme";
import { UnsavedChangesProvider } from "./unsaved-changes";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const root = createRoot(container);

createAppServices()
  .then((services) => {
    // Apply the saved theme before the first paint (no flash, no animated theme switch).
    applyTheme(services.settingsStore.load().theme);
    const router = createRouter();
    root.render(
      <StrictMode>
        <AppProviders services={services}>
          <UnsavedChangesProvider>
            <RouterProvider router={router} />
          </UnsavedChangesProvider>
        </AppProviders>
      </StrictMode>,
    );
    window.addEventListener("pagehide", () => services.execution.disposeAll());
  })
  .catch((error: unknown) => {
    container.textContent = `Coding Challenge Lab failed to start: ${error instanceof Error ? error.message : String(error)}`;
  });
