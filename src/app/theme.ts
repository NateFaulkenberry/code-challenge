import type { Settings } from "@/domain/settings";

/** Resolves "system" against the OS preference and applies the theme to <html>. */
export function applyTheme(theme: Settings["theme"]): void {
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}
