import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning" | "info";

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {children}
    </span>
  );
}
