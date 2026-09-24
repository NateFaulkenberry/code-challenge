import { createHashRouter, type RouteObject } from "react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { Layout } from "./Layout";
import { NotFoundPage, RouteErrorPage } from "./RouteError";

/**
 * Hash routing works on GitHub Pages without server rewrites (ADR-008).
 * Editor-heavy routes are lazy so CodeMirror stays out of the initial bundle.
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "challenges", element: <LibraryPage /> },
      {
        path: "challenges/:id",
        lazy: async () => ({
          Component: (await import("@/features/library/PortfolioViewPage")).PortfolioViewPage,
        }),
      },
      {
        path: "workspace/:id",
        lazy: async () => ({
          Component: (await import("@/features/workspace/WorkspacePage")).WorkspacePage,
        }),
      },
      {
        path: "settings",
        lazy: async () => ({
          Component: (await import("@/features/settings/SettingsPage")).SettingsPage,
        }),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createRouter() {
  return createHashRouter(routes);
}
