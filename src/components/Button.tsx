import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";
import { Spinner } from "./Spinner";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  busy?: boolean;
  icon?: ReactNode;
  /** Keyboard shortcut hint rendered after the label, e.g. "⌘↵". */
  shortcut?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  icon,
  shortcut,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], styles[size], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner size={12} /> : icon}
      {children && <span>{children}</span>}
      {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
    </button>
  );
}
