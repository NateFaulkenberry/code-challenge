import { useEffect, useRef } from "react";
import { useServices } from "@/app/context";
import type { LanguageId } from "@/domain/languages";
import { isPreviewCapable } from "@/runtimes/react";
import styles from "./PreviewPane.module.css";

function resolvedTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Hosts the language runtime's sandboxed preview. It stays mounted while other
 * tabs are active, because moving an iframe reloads it. It is moved offscreen
 * rather than hidden with `display: none`: elements inside a non-rendered
 * iframe can't take focus, which silently breaks user-event typing in tests
 * (see tests/regression/react-preview-hidden-focus).
 */
export function PreviewPane({ language, hidden }: { language: LanguageId; hidden: boolean }) {
  const { execution } = useServices();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let detach: (() => void) | undefined;
    let cancelled = false;
    void execution.instance(language).then((runtime) => {
      if (cancelled || !host.current || !isPreviewCapable(runtime)) return;
      detach = runtime.attachPreview(host.current, { theme: resolvedTheme() });
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [execution, language]);

  return (
    <div
      className={`${styles.pane} ${hidden ? styles.offscreen : ""}`}
      aria-hidden={hidden || undefined}
    >
      <p className={styles.note}>
        Live, sandboxed render of your default export. <strong>Run</strong> re-renders it; running
        tests clears it.
      </p>
      <div ref={host} className={styles.frame} />
    </div>
  );
}
