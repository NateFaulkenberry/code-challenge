import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Accessible description, for confirmation dialogs. */
  describedBy?: string;
}

/**
 * Built on the native <dialog> element: focus trapping, Escape to close,
 * inert background and top-layer rendering come from the platform.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width = 480,
  describedBy,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.header}>
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
